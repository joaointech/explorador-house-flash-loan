import "server-only";
import { promises as fs } from "fs";
import path from "path";
import { createHash, randomUUID } from "crypto";
import { storeEncryptedDocuments } from "./walrus";
import { readCollection, writeCollection } from "./store";

/**
 * Server-side registry for signed debt-acknowledgement agreements (Termo de
 * Reconhecimento e Confissão de Dívida, art. 458.º Código Civil). Same JSON-file
 * pattern as lib/loans.ts and lib/kyc-store.ts — good enough for a hackathon.
 *
 * The Chave Móvel Digital step that produces a signature is a front-end mock (no
 * OTP, no SMS, no identity assertion) — see components/bridge/steps/StepSign.tsx.
 * What carries real weight here is the amount/account binding the disburse route
 * checks against, and the doc hash anchored on Sui.
 */

export type SignedAgreement = {
  id: string;
  docSha256: string;
  signedAt: number;
  vaultId: string;
  accountId: string;
  amountEur: number;
  property: { article: string; morada?: string };
  signer: { nome: string; phoneMasked: string };
  method: "cmd-mock";
  anchorDigest?: string;
  termoBlobId?: string; // Walrus blob of the signed termo PDF
  demo: true;
};

const DOC = path.join(process.cwd(), "public", "termo-reconhecimento-divida.pdf");

let docHashPromise: Promise<string> | null = null;

/** sha256 hex of the public termo PDF, computed once and memoised. */
export function docSha256(): Promise<string> {
  if (!docHashPromise) {
    docHashPromise = fs.readFile(DOC).then((buf) => createHash("sha256").update(buf).digest("hex"));
  }
  return docHashPromise;
}

let termoBlobPromise: Promise<string> | null = null;

/** Walrus blob id of the (shared, unsigned-template) termo PDF, uploaded once and memoised. */
export function termoBlobId(): Promise<string> {
  if (!termoBlobPromise) {
    termoBlobPromise = fs
      .readFile(DOC)
      .then((buf) => storeEncryptedDocuments(new Uint8Array(buf)))
      .then((r) => r.blobId);
  }
  return termoBlobPromise;
}

/** Masks a phone number for storage: keep the country code + last 2 digits. */
export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 4) return "•".repeat(digits.length);
  return `+351 9•• •••${digits.slice(-2)}`;
}

const readAll = () => readCollection<SignedAgreement>("agreements");
const writeAll = (list: SignedAgreement[]) => writeCollection("agreements", list);

export async function signAgreement(
  params: Omit<SignedAgreement, "id" | "signedAt" | "docSha256" | "termoBlobId" | "method" | "demo">,
): Promise<SignedAgreement> {
  const agreement: SignedAgreement = {
    id: randomUUID(),
    docSha256: await docSha256(),
    termoBlobId: await termoBlobId(),
    signedAt: Date.now(),
    method: "cmd-mock",
    demo: true,
    ...params,
  };
  const list = await readAll();
  list.unshift(agreement);
  await writeAll(list);
  return agreement;
}

export async function getAgreement(id: string): Promise<SignedAgreement | undefined> {
  return (await readAll()).find((a) => a.id === id);
}

/** Most recent signature for a vault — the gate the disburse route checks. */
export async function getAgreementForVault(vaultId: string): Promise<SignedAgreement | undefined> {
  return (await readAll()).find((a) => a.vaultId === vaultId);
}
