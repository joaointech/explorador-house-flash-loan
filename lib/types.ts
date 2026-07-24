/** Shared domain types for the bridge flow (Sui settlement). */

/** Fields the AI extracts from the caderneta predial + ID. */
export type PropertyData = {
  artigoMatricial: string; // tax article number
  vpt: number; // Valor Patrimonial Tributário, in EUR
  morada: string; // street address
  freguesia: string; // parish
  concelho: string; // municipality
  proprietario: string; // owner name
  fracao?: string; // fraction (apartments), optional
  confidence?: number; // 0..1 model confidence
};

/** Result of encrypting + storing a document set on Walrus, anchored on Sui. */
export type StorageResult = {
  blobId: string; // Walrus blob id
  sealed: boolean; // encrypted with Seal
  sha256: string; // hash anchored on Sui
  anchorDigest: string; // Sui tx digest of the DocumentAnchored event
};

/** World ID verification result (unique human + jurisdiction attributes). */
export type KycResult = {
  verified: boolean;
  nullifierHash: string;
  jurisdiction?: string; // e.g. "PT"
  verificationLevel?: string; // "orb" | "device"
};

/** HOUSE fungible equity minted on Sui + its CollateralVault object. */
export type HouseToken = {
  coinType: string; // 0x…::house::HOUSE
  vaultId: string; // shared CollateralVault object id
  symbol: string;
  totalSupply: number; // = VPT in whole EUR
  digest: string; // tokenize tx digest
};

/** The disbursement executed by the treasury AI agent on Sui. */
export type Disbursement = {
  digest: string; // Sui tx digest
  asset: "USDC" | "SUI";
  amountUsdc: number;
  status: "executed" | "declined";
  agentRationale: string; // why the agent released funds
};

/** The full in-progress bridge session held client-side across the wizard. */
export type BridgeSession = {
  accountId?: string; // Sui address (0x…)
  property?: PropertyData;
  storage?: StorageResult;
  kyc?: KycResult;
  token?: HouseToken;
  collateralPct?: number; // fraction of equity locked
  drawAmount?: number; // requested USDC
  disbursement?: Disbursement;
};

// ── Suiscan explorer links (testnet) ─────────────────────────────────
const NET = "testnet";
const isReal = (v?: string) => Boolean(v && v.startsWith("0x")) || Boolean(v && /^[1-9A-HJ-NP-Za-km-z]{40,}$/.test(v));
export function suiscanTx(digest: string, net = NET) {
  return `https://suiscan.xyz/${net}/tx/${digest}`;
}
export function suiscanObject(id: string, net = NET) {
  return `https://suiscan.xyz/${net}/object/${id}`;
}
export function suiscanCoin(coinType: string, net = NET) {
  return `https://suiscan.xyz/${net}/coin/${encodeURIComponent(coinType)}`;
}
/** True when a value looks like a real on-chain id/digest (not a demo placeholder). */
export function onChain(v?: string): boolean {
  return isReal(v) && !String(v).startsWith("demo");
}
