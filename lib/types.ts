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

/** The three required documents (plus the signed termo, added at disburse time). */
export type DocKind = "cartaoCidadao" | "cadernetaPredial" | "declaracaoImi" | "termo";

/** One document, sealed and stored as its own Walrus blob. */
export type StoredDoc = {
  kind: DocKind;
  blobId: string; // Walrus blob id
  sealed: boolean; // encrypted with Seal
  sha256: string;
  filename: string;
};

/** Result of encrypting + storing the document set on Walrus, anchored on Sui. */
export type StorageResult = {
  documents: StoredDoc[]; // one blob per document
  sealed: boolean; // encrypted with Seal
  sha256: string; // combined hash, anchored on Sui
  anchorDigest: string; // Sui tx digest of the DocumentAnchored event
};

/** The two World ID credentials the KYC step collects. */
export type WorldCredential = "identity" | "selfie";

/** Actions registered in the Developer Portal — shared by client and server. */
export const WORLD_ACTIONS: Record<WorldCredential, string> = {
  identity: process.env.NEXT_PUBLIC_WORLD_ACTION_IDENTITY || "collateralize-house-identity",
  selfie: process.env.NEXT_PUBLIC_WORLD_ACTION_SELFIE || "collateralize-house-selfie",
};

/**
 * Identity Check predicates. We request the MINIMUM needed to establish eligibility
 * for a Portuguese home-equity loan and nothing more — no full_name, no
 * document_number, no date of birth. The response is a boolean, not these values.
 * Country codes are ISO 3166-1 alpha-3.
 */
export const IDENTITY_ATTRIBUTES = [
  { type: "minimum_age", value: 18 },
  { type: "issuing_country", value: "PRT" },
] as const;

/**
 * What the client holds after Identity Check alone — the first of the two World ID
 * steps. Threaded (by `token`) into the second step, which folds Selfie Check into the
 * same server-side session and returns the full `KycResult`.
 */
export type IdentityResult = {
  token: string;
  identityAttested: boolean;
  identityNullifier: string;
  sandbox?: boolean;
};

/**
 * What the client holds after both World ID checks. `token` is an opaque lookup
 * key for a server-side session — never a claim the client can forge. The nullifiers
 * are display-only; the server reads its own copy when money moves.
 */
export type KycResult = {
  token: string;
  identityAttested: boolean;
  selfieNullifier: string;
  identityNullifier: string;
  sandbox?: boolean;
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
  asset: "eUSD" | "USDC" | "SUI";
  amountUsdc: number;
  status: "executed" | "declined";
  agentRationale: string; // why the agent released funds
};

/**
 * The borrower's signed Termo de Reconhecimento e Confissão de Dívida (art. 458.º
 * Código Civil). Client-safe subset of `SignedAgreement` in lib/agreement.ts — no
 * raw phone number, no server-only fields.
 */
export type AgreementSignature = {
  id: string;
  docSha256: string;
  signedAt: number;
  amountEur: number;
  signerNome: string;
  anchorDigest?: string;
  termoBlobId?: string; // Walrus blob of the signed termo PDF
};

/** The full in-progress bridge session held client-side across the wizard. */
export type BridgeSession = {
  accountId?: string; // Sui address (0x…)
  property?: PropertyData;
  storage?: StorageResult;
  identity?: IdentityResult;
  kyc?: KycResult;
  token?: HouseToken;
  collateralPct?: number; // fraction of equity locked
  drawAmount?: number; // requested USDC
  agreement?: AgreementSignature;
  disbursement?: Disbursement;
};

// ── Suiscan explorer links (testnet) ─────────────────────────────────
const NET = "testnet";
const isReal = (v?: string) => Boolean(v && v.startsWith("0x")) || Boolean(v && /^[1-9A-HJ-NP-Za-km-z]{40,}$/.test(v));
export function suiscanTx(digest: string, net = NET) {
  return `https://suiscan.xyz/${net}/tx/${digest}`;
}
export function suiscanAccount(addr: string, net = NET) {
  return `https://suiscan.xyz/${net}/account/${addr}`;
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

// ── Walrus explorer link ─────────────────────────────────────────────
export function walruscanBlob(blobId: string, net = NET) {
  return `https://walruscan.com/${net}/blob/${blobId}`;
}
/** Walrus blob ids are base64url, so `onChain()`'s 0x/base58 test doesn't apply here. */
export function onWalrus(id?: string): boolean {
  return Boolean(id) && !String(id).startsWith("demo");
}
