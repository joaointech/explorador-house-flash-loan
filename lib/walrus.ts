import "server-only";
import { createHash, createCipheriv, randomBytes } from "crypto";

/**
 * Decentralized document storage on Walrus (Sui) with client-side encryption.
 *
 * - The caderneta/KYC bytes are ENCRYPTED before they ever leave the server.
 *   When Seal is configured (SEAL_PACKAGE_ID + key servers) we use Mysten's
 *   threshold Seal; otherwise we fall back to AES-256-GCM envelope encryption
 *   so "encrypted before upload" is always literally true.
 * - The ciphertext blob is uploaded to Walrus testnet (real WalrusClient.writeBlob
 *   when SUI_SECRET_KEY is funded), returning a durable blob id.
 *
 * Every path degrades to a clearly-marked demo result so the wizard flows in a
 * pitch without funded testnet accounts.
 */

// Mysten's verified Seal key servers on testnet (open mode). Override with
// SEAL_KEY_SERVER_IDS if you run your own.
const MYSTEN_TESTNET_KEY_SERVERS = [
  "0x73d05d62c18d9374e3ea529e8e0ed6161da1a141a94d3f76ae3fe4e99356db75",
  "0xf5d14a81a982144ae441cd7d64b09027f116a468bd36e7eca494f750591623c8",
];

export function sha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export function walrusConfigured(): boolean {
  return Boolean(process.env.SUI_SECRET_KEY);
}

/** AES-256-GCM envelope encryption (the fallback / at-rest layer). */
function aesEncrypt(bytes: Uint8Array): Uint8Array {
  const key = createHash("sha256")
    .update(process.env.SEAL_MASTER_KEY || "explorador-bridge-demo-key")
    .digest();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(Buffer.from(bytes)), cipher.final()]);
  const tag = cipher.getAuthTag();
  // envelope = iv || tag || ciphertext
  return new Uint8Array(Buffer.concat([iv, tag, ct]));
}

/**
 * Encrypt with Seal if configured, else AES envelope. Returns the sealed bytes
 * and whether real Seal was used.
 */
async function sealEncrypt(bytes: Uint8Array): Promise<{ sealed: Uint8Array; usedSeal: boolean }> {
  // Identity namespace = the package holding our seal_approve policy (original id).
  const pkg = process.env.SEAL_PACKAGE_ID || process.env.BRIDGE_PACKAGE_ID;
  if (pkg) {
    try {
      const { SealClient } = await import("@mysten/seal");
      const { SuiJsonRpcClient } = await import("@mysten/sui/jsonRpc");
      const net = (process.env.SUI_NETWORK as "testnet") || "testnet";
      const url = process.env.SUI_RPC_URL || "https://sui-testnet-endpoint.blockvision.org";
      const suiClient = new SuiJsonRpcClient({ url, network: net });

      // Explicit ids if provided, else Mysten's verified testnet key servers.
      const explicit = (process.env.SEAL_KEY_SERVER_IDS || "").split(",").map((s) => s.trim()).filter(Boolean);
      const serverIds = explicit.length > 0 ? explicit : MYSTEN_TESTNET_KEY_SERVERS;
      if (serverIds.length === 0) throw new Error("no_key_servers");

      const client = new SealClient({
        suiClient: suiClient as never,
        serverConfigs: serverIds.map((id) => ({ objectId: id, weight: 1 })),
        verifyKeyServers: false,
      });
      // identity-based encryption: id = sha256(content), threshold = majority.
      const { encryptedObject } = await client.encrypt({
        threshold: Math.max(1, Math.floor(serverIds.length / 2) + 1),
        packageId: pkg,
        id: sha256Hex(bytes),
        data: bytes,
      });
      return { sealed: encryptedObject, usedSeal: true };
    } catch {
      // fall through to AES so the flow never breaks
    }
  }
  return { sealed: aesEncrypt(bytes), usedSeal: false };
}

/** Upload sealed bytes to Walrus testnet. */
async function uploadToWalrus(sealed: Uint8Array): Promise<{ blobId: string; demo: boolean }> {
  if (!walrusConfigured()) {
    // deterministic demo blob id
    return { blobId: `demo-${sha256Hex(sealed).slice(0, 32)}`, demo: true };
  }
  try {
    const { WalrusClient } = await import("@mysten/walrus");
    const { SuiJsonRpcClient } = await import("@mysten/sui/jsonRpc");
    const { Ed25519Keypair } = await import("@mysten/sui/keypairs/ed25519");
    const { decodeSuiPrivateKey } = await import("@mysten/sui/cryptography");

    const network = (process.env.SUI_NETWORK as "testnet") || "testnet";
    const url = process.env.SUI_RPC_URL || "https://sui-testnet-endpoint.blockvision.org";
    const suiClient = new SuiJsonRpcClient({ url, network });
    const walrus = new WalrusClient({ network, suiClient: suiClient as never });
    const { secretKey } = decodeSuiPrivateKey(process.env.SUI_SECRET_KEY!);
    const signer = Ed25519Keypair.fromSecretKey(secretKey);

    const { blobId } = await walrus.writeBlob({
      blob: sealed,
      deletable: false,
      epochs: 3,
      signer,
    });
    return { blobId, demo: false };
  } catch {
    // Never hard-fail the demo on a storage hiccup.
    return { blobId: `demo-${sha256Hex(sealed).slice(0, 32)}`, demo: true };
  }
}

export async function storeEncryptedDocuments(
  bytes: Uint8Array,
): Promise<{ blobId: string; sealed: boolean; sha256: string; demo: boolean }> {
  const sha = sha256Hex(bytes);
  const { sealed, usedSeal } = await sealEncrypt(bytes);
  const { blobId, demo } = await uploadToWalrus(sealed);
  return { blobId, sealed: usedSeal, sha256: sha, demo };
}
