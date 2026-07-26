import "server-only";
import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { listLoans, getLoan } from "./loans";

/**
 * Server-side World ID session registry (JSON file, same pattern as lib/loans.ts).
 *
 * The point of this file is that the CLIENT NEVER CARRIES A VERIFIED FLAG. It holds
 * an opaque token; the disbursement route resolves it here. A forged `{verified:true}`
 * body can no longer release funds.
 *
 * Sessions are short-lived — a proof of liveness from 3 days ago says nothing about
 * who is at the keyboard now. Swap for a DB or signed JWT in production.
 */

export type KycSession = {
  token: string;
  selfieNullifier: string;
  identityNullifier: string;
  identityAttested: boolean;
  sandbox?: boolean;
  createdAt: number;
  expiresAt: number;
};

const FILE = path.join(process.cwd(), ".kyc.json");
const TTL_MS = 30 * 60 * 1000;

async function readAll(): Promise<KycSession[]> {
  try {
    return JSON.parse(await fs.readFile(FILE, "utf8")) as KycSession[];
  } catch {
    return [];
  }
}

async function writeAll(list: KycSession[]): Promise<void> {
  await fs.writeFile(FILE, JSON.stringify(list, null, 2), "utf8");
}

/**
 * Creates a session, or folds a second credential into an existing one — the KYC step
 * verifies Identity Check and Selfie Check as two separate IDKit requests.
 */
export async function upsertKycSession(
  token: string | undefined,
  patch: Partial<Omit<KycSession, "token" | "createdAt" | "expiresAt">>,
): Promise<KycSession> {
  const list = (await readAll()).filter((s) => s.expiresAt > Date.now());
  const existing = token ? list.find((s) => s.token === token) : undefined;
  const now = Date.now();

  const session: KycSession = existing
    ? { ...existing, ...patch, expiresAt: now + TTL_MS }
    : {
        token: randomUUID(),
        selfieNullifier: "",
        identityNullifier: "",
        identityAttested: false,
        createdAt: now,
        expiresAt: now + TTL_MS,
        ...patch,
      };

  await writeAll([session, ...list.filter((s) => s.token !== session.token)]);
  return session;
}

/** Returns the session only if it exists AND hasn't expired. */
export async function getKycSession(token: string): Promise<KycSession | undefined> {
  if (!token) return undefined;
  const s = (await readAll()).find((x) => x.token === token);
  return s && s.expiresAt > Date.now() ? s : undefined;
}

/** True when both credentials were collected — the gate for releasing funds. */
export function isComplete(s: KycSession): boolean {
  return s.identityAttested && Boolean(s.selfieNullifier) && Boolean(s.identityNullifier);
}

/**
 * Sybil check: has this human already borrowed against a different property?
 * The selfie nullifier is RP-scoped and stable, so it links loans without ever
 * identifying the borrower.
 */
export async function nullifierHasActiveLoan(selfieNullifier: string, exceptVaultId?: string): Promise<boolean> {
  if (!selfieNullifier) return false;
  const loans = await listLoans();
  return loans.some(
    (l) => l.status === "active" && l.selfieNullifier === selfieNullifier && l.vaultId !== exceptVaultId,
  );
}

export type Continuity =
  | { ok: true; session: KycSession }
  | { ok: false; error: "kyc_required" | "kyc_mismatch" };

/**
 * CONTINUITY GATE — the single guard for every action on an EXISTING loan
 * (repay, re-draw). Both routes call this; adding a third action means calling it
 * too, not writing a third check.
 *
 * Requires only a fresh Selfie Check, not a full re-KYC: the identity attributes
 * were established at origination and a document doesn't change. What we're asking
 * is "is the human who pledged this house the one moving money now?" — which is a
 * liveness question, and re-scanning a passport to repay a loan would be hostile.
 */
export async function checkContinuity(token: string, vaultId: string): Promise<Continuity> {
  const session = await getKycSession(token);
  if (!session?.selfieNullifier) return { ok: false, error: "kyc_required" };

  // Skip/sandbox sessions mint a fresh nullifier each time, so they can't match a
  // prior binding — accept them for the demo (they're gated by the skip flag).
  if (session.sandbox) return { ok: true, session };

  const loan = await getLoan(vaultId);
  // ponytail: loans recorded before nullifier binding existed have nothing to match
  // against. The registry is seeded fresh, so in practice this is the first-draw case.
  if (!loan?.selfieNullifier) return { ok: true, session };

  if (loan.selfieNullifier !== session.selfieNullifier) return { ok: false, error: "kyc_mismatch" };
  return { ok: true, session };
}
