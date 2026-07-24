import "server-only";
import {
  Client,
  AccountId,
  PrivateKey,
  TopicCreateTransaction,
  TopicMessageSubmitTransaction,
  TokenCreateTransaction,
  TokenType,
  TokenSupplyType,
  TokenAssociateTransaction,
  TransferTransaction,
  ScheduleCreateTransaction,
  Hbar,
} from "@hashgraph/sdk";

/**
 * Server-side Hedera helpers (testnet). All write operations use the operator
 * account configured via env. SDK-only — no Solidity / smart contracts — using
 * HTS (tokens), HCS (consensus/audit trail) and Scheduled Transactions, which
 * satisfies the Hedera "No Solidity Allowed" track (≥2 native services).
 *
 * Every exported call degrades gracefully: when the operator isn't configured
 * it returns a clearly-marked demo result so the wizard still flows in a pitch.
 */

export function hederaConfigured(): boolean {
  return Boolean(process.env.HEDERA_OPERATOR_ID && process.env.HEDERA_OPERATOR_KEY);
}

function operatorKey(): PrivateKey {
  const raw = process.env.HEDERA_OPERATOR_KEY!;
  // Accept ED25519 or ECDSA DER strings.
  try {
    return PrivateKey.fromStringED25519(raw);
  } catch {
    return PrivateKey.fromStringECDSA(raw);
  }
}

export function getClient(): Client {
  const client = Client.forTestnet();
  client.setOperator(AccountId.fromString(process.env.HEDERA_OPERATOR_ID!), operatorKey());
  return client;
}

const NETWORK = process.env.HEDERA_NETWORK || "testnet";
// Demo entity ids live in a clearly-synthetic 0.0.9xxxxx band so the UI knows
// not to render (dead) HashScan links for them.
const demoId = () => 900000 + Math.floor(Math.random() * 90000);

// ── HCS: anchor a document hash to an immutable topic ────────────────
export async function anchorDocumentHash(
  sha256Hex: string,
  memo: string,
): Promise<{ topicId: string; sequenceNumber: number; transactionId: string; demo: boolean }> {
  if (!hederaConfigured()) {
    return { topicId: "0.0.900001", sequenceNumber: 1, transactionId: `demo@${sha256Hex.slice(0, 8)}`, demo: true };
  }
  const client = getClient();
  try {
    let topicId = process.env.HCS_TOPIC_ID;
    if (!topicId) {
      const created = await (await new TopicCreateTransaction()
        .setTopicMemo("explorador-bridge audit trail")
        .execute(client)).getReceipt(client);
      topicId = created.topicId!.toString();
    }
    const submit = await new TopicMessageSubmitTransaction()
      .setTopicId(topicId)
      .setMessage(JSON.stringify({ sha256: sha256Hex, memo, t: NETWORK }))
      .execute(client);
    const receipt = await submit.getReceipt(client);
    return {
      topicId,
      sequenceNumber: receipt.topicSequenceNumber?.toNumber() ?? 0,
      transactionId: submit.transactionId.toString(),
      demo: false,
    };
  } finally {
    client.close();
  }
}

// ── HTS: create + mint a fungible house-equity token ─────────────────
export async function createHouseToken(params: {
  name: string;
  symbol: string;
  supply: number; // whole tokens = VPT in EUR
}): Promise<{ tokenId: string; transactionId: string; demo: boolean }> {
  if (!hederaConfigured()) {
    return { tokenId: `0.0.${demoId()}`, transactionId: "demo@mint", demo: true };
  }
  const client = getClient();
  try {
    const opId = AccountId.fromString(process.env.HEDERA_OPERATOR_ID!);
    const tx = await new TokenCreateTransaction()
      .setTokenName(params.name)
      .setTokenSymbol(params.symbol)
      .setTokenType(TokenType.FungibleCommon)
      .setDecimals(0)
      .setInitialSupply(Math.max(1, Math.round(params.supply)))
      .setTreasuryAccountId(opId)
      .setSupplyType(TokenSupplyType.Finite)
      .setMaxSupply(Math.max(1, Math.round(params.supply)))
      .setAdminKey(operatorKey())
      .setSupplyKey(operatorKey())
      .execute(client);
    const receipt = await tx.getReceipt(client);
    return { tokenId: receipt.tokenId!.toString(), transactionId: tx.transactionId.toString(), demo: false };
  } finally {
    client.close();
  }
}

// ── HTS: associate a token to a user account (needs their key) ───────
// In demo mode (or when the user account is the operator/treasury) association
// is a no-op the treasury already satisfies.
export async function associateToken(
  accountId: string,
  tokenId: string,
  userKey?: string,
): Promise<{ transactionId: string; demo: boolean }> {
  if (!hederaConfigured() || !userKey) {
    return { transactionId: "demo@associate", demo: true };
  }
  const client = getClient();
  try {
    const key = PrivateKey.fromStringED25519(userKey);
    const tx = new TokenAssociateTransaction()
      .setAccountId(AccountId.fromString(accountId))
      .setTokenIds([tokenId])
      .freezeWith(client);
    const signed = await tx.sign(key);
    const resp = await signed.execute(client);
    await resp.getReceipt(client);
    return { transactionId: resp.transactionId.toString(), demo: false };
  } finally {
    client.close();
  }
}

// ── Scheduled Transaction: treasury → user USDC disbursement ─────────
export async function scheduleUsdcDisbursement(params: {
  toAccountId: string;
  amountUsdc: number;
  usdcTokenId?: string;
}): Promise<{ scheduleId: string; transactionId: string; demo: boolean }> {
  const usdc = params.usdcTokenId || process.env.USDC_TOKEN_ID;
  if (!hederaConfigured() || !usdc) {
    return { scheduleId: `0.0.${demoId()}`, transactionId: "demo@schedule", demo: true };
  }
  const client = getClient();
  try {
    const treasury = AccountId.fromString(process.env.HEDERA_OPERATOR_ID!);
    const to = AccountId.fromString(params.toAccountId);
    const amount = Math.round(params.amountUsdc); // USDC assumed 0 decimals in demo token
    const inner = new TransferTransaction()
      .addTokenTransfer(usdc, treasury, -amount)
      .addTokenTransfer(usdc, to, amount);
    const schedule = await new ScheduleCreateTransaction()
      .setScheduledTransaction(inner)
      .setScheduleMemo("explorador-bridge treasury disbursement")
      .setAdminKey(operatorKey())
      .execute(client);
    const receipt = await schedule.getReceipt(client);
    return {
      scheduleId: receipt.scheduleId!.toString(),
      transactionId: schedule.transactionId.toString(),
      demo: false,
    };
  } finally {
    client.close();
  }
}

// ── Native HBAR fallback transfer (kept for completeness) ────────────
export async function transferHbar(toAccountId: string, amount: number): Promise<string> {
  const client = getClient();
  try {
    const from = AccountId.fromString(process.env.HEDERA_OPERATOR_ID!);
    const tx = await new TransferTransaction()
      .addHbarTransfer(from, new Hbar(-amount))
      .addHbarTransfer(AccountId.fromString(toAccountId), new Hbar(amount))
      .execute(client);
    await tx.getReceipt(client);
    return tx.transactionId.toString();
  } finally {
    client.close();
  }
}
