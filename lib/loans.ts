import "server-only";
import { promises as fs } from "fs";
import path from "path";

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
  repayDigest?: string;
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

export async function markRepaid(vaultId: string, repayDigest: string): Promise<void> {
  const list = await readAll();
  const i = list.findIndex((l) => l.vaultId === vaultId);
  if (i >= 0) {
    list[i] = { ...list[i], status: "repaid", repayDigest };
    await writeAll(list);
  }
}
