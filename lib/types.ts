/** Shared domain types for the bridge flow. */

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

/** Result of encrypting + storing a document set on Walrus (via Seal). */
export type StorageResult = {
  blobId: string; // Walrus blob id
  sealed: boolean; // encrypted with Seal
  sha256: string; // hash anchored on HCS
  hcsTopicId: string; // Hedera Consensus Service topic
  hcsSequenceNumber: number; // message sequence in that topic
};

/** World ID verification result (unique human + jurisdiction attributes). */
export type KycResult = {
  verified: boolean;
  nullifierHash: string;
  jurisdiction?: string; // e.g. "PT"
  verificationLevel?: string; // "orb" | "device"
};

/** HTS fungible token minted to represent the house equity. */
export type HouseToken = {
  tokenId: string; // 0.0.x
  name: string;
  symbol: string;
  totalSupply: number; // = VPT in whole EUR
  decimals: number;
};

/** The disbursement executed by the treasury AI agent. */
export type Disbursement = {
  scheduleId: string; // Hedera Scheduled Transaction id
  transactionId: string;
  amountUsdc: number;
  status: "scheduled" | "executed";
  agentRationale: string; // why the agent released funds
};

/** The full in-progress bridge session held client-side across the wizard. */
export type BridgeSession = {
  accountId?: string;
  property?: PropertyData;
  storage?: StorageResult;
  kyc?: KycResult;
  token?: HouseToken;
  collateralPct?: number; // fraction of equity locked
  drawAmount?: number; // requested USDC
  disbursement?: Disbursement;
};

export function hashscanTx(txId: string, network = "testnet") {
  return `https://hashscan.io/${network}/transaction/${encodeURIComponent(txId)}`;
}
export function hashscanToken(tokenId: string, network = "testnet") {
  return `https://hashscan.io/${network}/token/${tokenId}`;
}
export function hashscanTopic(topicId: string, network = "testnet") {
  return `https://hashscan.io/${network}/topic/${topicId}`;
}
