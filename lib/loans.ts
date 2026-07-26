import "server-only";
import { promises as fs } from "fs";
import path from "path";
import type { StoredDoc } from "./types";

/**
 * Tiny server-side loan registry (JSON file). Sui shared objects can't be listed
 * by owner without an indexer, so we record each vault we create and read its
 * live state back from chain by id. Good enough for a hackathon; swap for a DB
 * or a subgraph in production.
 */

export type LoanEntry = {
  vaultId: string;
  owner: string; // Sui address of the borrower
  article: string;
  morada?: string;
  vpt: number;
  drawnUsdc: number;
  collateralPct: number;
  coinType: string;
  disburseDigest: string;
  // Sui tx digest of the DocumentAnchored event for the documents below (from store-docs).
  docAnchorDigest?: string;
  repayDigest?: string;
  // Cumulative USDC paid back. On-chain only tracks what's *outstanding*, not history.
  repaidUsdc?: number;
  // Every settlement digest, oldest first. `repayDigest` stays the latest one.
  repayDigests?: string[];
  // The documents sealed + stored on Walrus at origination (id, caderneta, IMI, termo).
  documents?: StoredDoc[];
  // The signed Termo de Reconhecimento e Confissão de Dívida bound at origination.
  agreementId?: string;
  agreementSha256?: string;
  // World ID nullifiers, bound at origination. The selfie one is the sybil key and
  // the continuity check for any later action on this loan.
  selfieNullifier?: string;
  identityNullifier?: string;
  status: "active" | "repaid";
  createdAt: number;
};

const FILE = path.join(process.cwd(), ".loans.json");

async function readAll(): Promise<LoanEntry[]> {
  try {
    return JSON.parse(await fs.readFile(FILE, "utf8")) as LoanEntry[];
  } catch {
    return [];
  }
}

async function writeAll(list: LoanEntry[]): Promise<void> {
  await fs.writeFile(FILE, JSON.stringify(list, null, 2), "utf8");
}

export async function recordLoan(entry: LoanEntry): Promise<void> {
  const list = await readAll();
  const i = list.findIndex((l) => l.vaultId === entry.vaultId);
  if (i >= 0) list[i] = entry;
  else list.unshift(entry);
  await writeAll(list);
}

export async function listLoans(owner?: string): Promise<LoanEntry[]> {
  const list = await readAll();
  return owner ? list.filter((l) => l.owner === owner) : list;
}

export async function getLoan(vaultId: string): Promise<LoanEntry | undefined> {
  return (await readAll()).find((l) => l.vaultId === vaultId);
}

/** Record a settlement (full or partial). `remainingUsdc <= 0` closes the loan. */
export async function recordRepayment(
  vaultId: string,
  repayDigest: string,
  paidUsdc: number,
  remainingUsdc: number,
): Promise<void> {
  const list = await readAll();
  const i = list.findIndex((l) => l.vaultId === vaultId);
  if (i < 0) return;
  const prev = list[i];
  list[i] = {
    ...prev,
    repaidUsdc: (prev.repaidUsdc ?? 0) + paidUsdc,
    repayDigest,
    repayDigests: [...(prev.repayDigests ?? []), repayDigest],
    status: remainingUsdc <= 0 ? "repaid" : "active",
  };
  await writeAll(list);
}

/** Does this Sui address already have an open loan? The one-loan-per-account gate. */
export async function activeLoanForOwner(owner: string, exceptVaultId?: string): Promise<boolean> {
  if (!owner) return false;
  const loans = await listLoans(owner);
  return loans.some((l) => l.status === "active" && l.vaultId !== exceptVaultId);
}
