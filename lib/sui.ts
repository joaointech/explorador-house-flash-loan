import "server-only";

/**
 * Sui settlement layer (testnet) — talks to the published `bridge::house` Move
 * package. The protocol treasury (SUI_SECRET_KEY, holder of the TreasuryCap)
 * signs every write:
 *   - tokenizeHouse  → mint HOUSE equity + open a shared CollateralVault
 *   - anchorDocument → emit a DocumentAnchored event (audit trail)
 *   - disburse       → record the draw on-chain (lock_and_draw) + transfer USDC
 *                      (falls back to a symbolic SUI transfer if the treasury
 *                      holds no USDC) — one PTB, one Suiscan-verifiable digest.
 *
 * Every call degrades to a clearly-marked demo result when the treasury/package
 * isn't configured, so the wizard always flows.
 */

const NETWORK = (process.env.SUI_NETWORK as "testnet" | "mainnet") || "testnet";
const PKG = process.env.BRIDGE_PACKAGE_ID || "";
const CAP = process.env.BRIDGE_TREASURY_CAP || "";
const USDC = process.env.USDC_COIN_TYPE || "";

export function suiConfigured(): boolean {
  return Boolean(process.env.SUI_SECRET_KEY && PKG && CAP);
}

export function suiRpcUrl(): string {
  return process.env.SUI_RPC_URL || "https://sui-testnet-endpoint.blockvision.org";
}

async function ctx() {
  const { SuiJsonRpcClient } = await import("@mysten/sui/jsonRpc");
  const { Ed25519Keypair } = await import("@mysten/sui/keypairs/ed25519");
  const { decodeSuiPrivateKey } = await import("@mysten/sui/cryptography");
  const client = new SuiJsonRpcClient({ url: suiRpcUrl(), network: NETWORK });
  const { secretKey } = decodeSuiPrivateKey(process.env.SUI_SECRET_KEY!);
  const keypair = Ed25519Keypair.fromSecretKey(secretKey);
  return { client, keypair, sender: keypair.getPublicKey().toSuiAddress() };
}

const bytes = (s: string) => Array.from(new TextEncoder().encode(s));
const rndDigest = () => "demo" + Math.random().toString(36).slice(2, 12);
const rndObj = () => "0x" + Math.random().toString(16).slice(2).padEnd(60, "0").slice(0, 60);

// ── Tokenize: mint HOUSE + open a CollateralVault ────────────────────
export async function tokenizeHouse(params: {
  owner: string;
  article: string;
  docHashHex: string;
  vpt: number;
}): Promise<{ digest: string; vaultId: string; coinType: string; demo: boolean }> {
  const coinType = process.env.HOUSE_COIN_TYPE || `${PKG}::house::HOUSE`;
  if (!suiConfigured()) {
    return { digest: rndDigest(), vaultId: rndObj(), coinType, demo: true };
  }
  const { Transaction } = await import("@mysten/sui/transactions");
  const { client, keypair, sender } = await ctx();
  const owner = params.owner?.startsWith("0x") ? params.owner : sender;

  const tx = new Transaction();
  tx.moveCall({
    target: `${PKG}::house::tokenize`,
    arguments: [
      tx.object(CAP),
      tx.pure.address(owner),
      tx.pure.vector("u8", bytes(params.article)),
      tx.pure.vector("u8", Array.from(Buffer.from(params.docHashHex, "hex"))),
      tx.pure.u64(Math.max(1, Math.round(params.vpt))),
    ],
  });

  const res = await client.signAndExecuteTransaction({
    signer: keypair,
    transaction: tx,
    options: { showObjectChanges: true, showEffects: true },
  });
  const created = (res.objectChanges ?? []).find(
    (c) => c.type === "created" && "objectType" in c && c.objectType.includes("::house::CollateralVault"),
  );
  const vaultId = created && "objectId" in created ? created.objectId : "";
  return { digest: res.digest, vaultId, coinType, demo: false };
}

// ── Anchor a document hash on-chain (audit event) ────────────────────
export async function anchorDocument(params: {
  article: string;
  docHashHex: string;
}): Promise<{ digest: string; demo: boolean }> {
  if (!suiConfigured()) return { digest: rndDigest(), demo: true };
  const { Transaction } = await import("@mysten/sui/transactions");
  const { client, keypair } = await ctx();
  const tx = new Transaction();
  tx.moveCall({
    target: `${PKG}::house::anchor`,
    arguments: [
      tx.pure.vector("u8", bytes(params.article)),
      tx.pure.vector("u8", Array.from(Buffer.from(params.docHashHex, "hex"))),
    ],
  });
  const res = await client.signAndExecuteTransaction({ signer: keypair, transaction: tx });
  return { digest: res.digest, demo: false };
}

// ── Disburse: lock_and_draw on the vault + transfer stablecoin ───────
export async function disburse(params: {
  vaultId: string;
  to: string;
  pctBps: number; // collateral fraction in basis points
  drawUsdc: number;
}): Promise<{ digest: string; asset: "USDC" | "SUI"; amount: number; demo: boolean }> {
  if (!suiConfigured()) {
    return { digest: rndDigest(), asset: "USDC", amount: params.drawUsdc, demo: true };
  }
  const { Transaction } = await import("@mysten/sui/transactions");
  const { client, keypair, sender } = await ctx();
  const to = params.to?.startsWith("0x") ? params.to : sender;

  const tx = new Transaction();

  // 1) Record the collateral + draw on-chain (real vault state) — only if we
  //    have a real vault object; demo vaults are skipped.
  if (params.vaultId?.startsWith("0x") && params.vaultId.length > 40) {
    tx.moveCall({
      target: `${PKG}::house::lock_and_draw`,
      arguments: [
        tx.object(params.vaultId),
        tx.pure.u64(Math.round(params.pctBps)),
        tx.pure.u64(Math.round(params.drawUsdc)),
      ],
    });
  }

  // 2) Transfer a stablecoin to the borrower to demonstrate the rail. Prefer a
  //    real USDC coin; otherwise a symbolic SUI transfer (still a real tx).
  let asset: "USDC" | "SUI" = "SUI";
  if (USDC) {
    const coins = await client.getCoins({ owner: sender, coinType: USDC });
    const usable = coins.data.find((c) => BigInt(c.balance) > BigInt(0));
    if (usable) {
      const [c] = tx.splitCoins(tx.object(usable.coinObjectId), [tx.pure.u64(1_000_000)]); // 1 USDC (6dp) symbolic
      tx.transferObjects([c], tx.pure.address(to));
      asset = "USDC";
    }
  }
  if (asset === "SUI") {
    const [c] = tx.splitCoins(tx.gas, [tx.pure.u64(10_000_000)]); // 0.01 SUI symbolic
    tx.transferObjects([c], tx.pure.address(to));
  }

  const res = await client.signAndExecuteTransaction({ signer: keypair, transaction: tx });
  return { digest: res.digest, asset, amount: params.drawUsdc, demo: false };
}
