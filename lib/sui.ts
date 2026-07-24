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
}): Promise<{ digest: string; asset: "eUSD" | "USDC" | "SUI"; amount: number; demo: boolean }> {
  if (!suiConfigured()) {
    return { digest: rndDigest(), asset: "eUSD", amount: params.drawUsdc, demo: true };
  }
  const { Transaction } = await import("@mysten/sui/transactions");
  const { client, keypair, sender } = await ctx();
  const to = params.to?.startsWith("0x") ? params.to : sender;
  const EUSD_CAP = process.env.EUSD_TREASURY_CAP;
  const draw = Math.max(0, Math.round(params.drawUsdc));

  const tx = new Transaction();

  // 1) Record the collateral + draw on-chain (real vault state) — only for a
  //    real vault object; demo vaults are skipped.
  if (params.vaultId?.startsWith("0x") && params.vaultId.length > 40) {
    tx.moveCall({
      target: `${PKG}::house::lock_and_draw`,
      arguments: [tx.object(params.vaultId), tx.pure.u64(Math.round(params.pctBps)), tx.pure.u64(draw)],
    });
  }

  // 2) Pay the borrower. Prefer minting our own eUSD stablecoin (full value,
  //    6 dp), so thousands-of-USD disbursements are real; fall back to Circle
  //    USDC if held, else a symbolic SUI transfer.
  let asset: "eUSD" | "USDC" | "SUI";
  if (EUSD_CAP) {
    const base = BigInt(draw) * BigInt(1_000_000); // 6 decimals
    tx.moveCall({
      target: `${PKG}::eusd::mint`,
      arguments: [tx.object(EUSD_CAP), tx.pure.u64(base), tx.pure.address(to)],
    });
    asset = "eUSD";
  } else if (USDC) {
    const coins = await client.getCoins({ owner: sender, coinType: USDC });
    const usable = coins.data.find((c) => BigInt(c.balance) > BigInt(0));
    if (usable) {
      const [c] = tx.splitCoins(tx.object(usable.coinObjectId), [tx.pure.u64(BigInt(draw) * BigInt(1_000_000))]);
      tx.transferObjects([c], tx.pure.address(to));
      asset = "USDC";
    } else {
      const [c] = tx.splitCoins(tx.gas, [tx.pure.u64(10_000_000)]);
      tx.transferObjects([c], tx.pure.address(to));
      asset = "SUI";
    }
  } else {
    const [c] = tx.splitCoins(tx.gas, [tx.pure.u64(10_000_000)]);
    tx.transferObjects([c], tx.pure.address(to));
    asset = "SUI";
  }

  const res = await client.signAndExecuteTransaction({ signer: keypair, transaction: tx });
  return { digest: res.digest, asset, amount: params.drawUsdc, demo: false };
}

// ── Read live vault (loan) state from chain ──────────────────────────
export type VaultState = {
  vaultId: string;
  owner: string;
  article: string;
  vpt: number;
  locked: number;
  drawnUsdc: number;
  repaid: boolean;
};

export async function getVault(vaultId: string): Promise<VaultState | null> {
  if (!suiConfigured() || !vaultId?.startsWith("0x")) return null;
  const { client } = await ctx();
  try {
    const obj = await client.getObject({ id: vaultId, options: { showContent: true } });
    const content = obj.data?.content as { fields?: Record<string, unknown> } | undefined;
    const f = content?.fields;
    if (!f) return null;
    const num = (v: unknown) => Number(typeof v === "string" ? v : (v ?? 0));
    return {
      vaultId,
      owner: String(f.owner ?? ""),
      article: String(f.article ?? ""),
      vpt: num(f.vpt),
      locked: num(f.locked),
      drawnUsdc: num(f.drawn_usdc),
      repaid: Boolean(f.repaid),
    };
  } catch {
    return null;
  }
}

// ── Repay: mint eUSD to cover the debt + release collateral (1 PTB) ──
export async function repayLoan(params: {
  vaultId: string;
  drawUsdc: number;
}): Promise<{ digest: string; demo: boolean }> {
  const EUSD_CAP = process.env.EUSD_TREASURY_CAP;
  if (!suiConfigured() || !EUSD_CAP || !params.vaultId?.startsWith("0x")) {
    return { digest: rndDigest(), demo: true };
  }
  const { Transaction } = await import("@mysten/sui/transactions");
  const { client, keypair } = await ctx();
  const owed = BigInt(Math.max(0, Math.round(params.drawUsdc))) * BigInt(1_000_000);

  const tx = new Transaction();
  const [coin] = tx.moveCall({
    target: `${PKG}::eusd::mint_coin`,
    arguments: [tx.object(EUSD_CAP), tx.pure.u64(owed)],
  });
  tx.moveCall({ target: `${PKG}::house::repay`, arguments: [tx.object(params.vaultId), coin] });

  const res = await client.signAndExecuteTransaction({ signer: keypair, transaction: tx });
  return { digest: res.digest, demo: false };
}

// ── Treasury summary (SUI balance + total eUSD in circulation) ───────
export async function treasurySummary(): Promise<{ address: string; suiBalance: number; eusdSupply: number; demo: boolean }> {
  const EUSD = process.env.EUSD_COIN_TYPE;
  if (!suiConfigured()) return { address: "", suiBalance: 0, eusdSupply: 0, demo: true };
  const { client, sender } = await ctx();
  try {
    const sui = await client.getBalance({ owner: sender });
    let eusdSupply = 0;
    if (EUSD) {
      const s = await client.getTotalSupply({ coinType: EUSD });
      eusdSupply = Number(BigInt(s.value)) / 1e6;
    }
    return { address: sender, suiBalance: Number(BigInt(sui.totalBalance)) / 1e9, eusdSupply, demo: false };
  } catch {
    return { address: sender, suiBalance: 0, eusdSupply: 0, demo: false };
  }
}
