import "server-only";
import { randomBytes } from "crypto";
import { signRequest } from "@worldcoin/idkit/signing";
import { WORLD_ACTIONS, type WorldCredential } from "./types";

/**
 * World ID 4.0 — RP-side signing + proof verification.
 *
 * Two credentials, two distinct signals (see WORLDID_TESTING.md):
 *
 *  - Identity Check (v4) — eligibility. We ask for the PREDICATES `minimum_age >= 18`
 *    and `issuing_country == PRT`, because pledging a Portuguese caderneta predial
 *    requires an adult under PT jurisdiction. The response is a boolean
 *    (`identity_attested`) — we never receive a name, date of birth or document number.
 *
 *  - Selfie Check (v3) — liveness + sybil resistance. The document holder must be
 *    physically present at the moment of the pledge, and the RP-scoped nullifier proves
 *    this human hasn't already pledged another property.
 *
 * The RP signing key NEVER leaves this module. Proofs are verified against the
 * Developer Portal from the server; the client only ever holds an opaque session token.
 */

const RP_ID = process.env.WORLD_RP_ID || "";
const SIGNING_KEY = process.env.WORLD_RP_SIGNING_KEY || "";
const VERIFY_URL = "https://developer.world.org/api/v4/verify";

/**
 * Escape hatch for a dead conference wifi — and for local dev with no World ID at all.
 * Renders a loud SANDBOX badge in the UI. Either variable turns it on, so setting only
 * the NEXT_PUBLIC_ one (which the browser also needs, see lib/worldid-client.ts) is enough.
 */
export const SANDBOX =
  process.env.WORLD_SANDBOX === "1" || process.env.NEXT_PUBLIC_WORLD_SANDBOX === "1";

/**
 * Per-session "Skip (demo)" escape hatch. Unlike SANDBOX (which fakes a CONSTANT
 * nullifier and so trips the one-loan-per-human gate on the 2nd run), a skip mints
 * a UNIQUE random nullifier each time — a fresh "human" — so repeated demo runs
 * don't hit kyc_sybil. Gated behind a flag so it's never silently on in prod.
 */
export const ALLOW_SKIP =
  SANDBOX || process.env.WORLD_ALLOW_SKIP === "1" || process.env.NEXT_PUBLIC_WORLD_ALLOW_SKIP === "1";

export function skipProof(credential: WorldCredential): VerifiedProof {
  const rand = randomBytes(12).toString("hex");
  return { nullifier: `0xskip-${credential}-${rand}`, identityAttested: true, protocolVersion: "skip", sandbox: true };
}

export type RpContext = {
  rp_id: string;
  nonce: string;
  created_at: number;
  expires_at: number;
  signature: string;
};

export type VerifiedProof = {
  nullifier: string;
  identityAttested: boolean;
  protocolVersion: string;
  sandbox?: boolean;
};

/**
 * Signs an RP request for one action. The action is hashed into the signed message,
 * so each action needs its own signature — never reuse one across credentials.
 */
export function signRpContext(action: string): RpContext {
  if (SANDBOX) {
    return { rp_id: "rp_sandbox", nonce: "0".repeat(64), created_at: 0, expires_at: 0, signature: "0xsandbox" };
  }
  if (!RP_ID || !SIGNING_KEY) throw new Error("worldid_not_configured");

  const { sig, nonce, createdAt, expiresAt } = signRequest({ signingKeyHex: SIGNING_KEY, action });
  return { rp_id: RP_ID, nonce, created_at: createdAt, expires_at: expiresAt, signature: sig };
}

/**
 * Verifies an IDKit result with the Developer Portal. The payload is forwarded
 * VERBATIM — the endpoint rejects remapped fields, and it handles both v3 (Selfie
 * Check) and v4 (Identity Check) results.
 */
export async function verifyIdKitResult(result: unknown, credential: WorldCredential): Promise<VerifiedProof> {
  if (SANDBOX) {
    return { nullifier: `0xsandbox-${credential}`, identityAttested: credential === "identity", protocolVersion: "sandbox", sandbox: true };
  }
  if (!RP_ID) throw new Error("worldid_not_configured");

  const res = await fetch(`${VERIFY_URL}/${RP_ID}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(result),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`worldid_verify_failed:${res.status}:${detail.slice(0, 200)}`);
  }

  const r = result as { protocol_version?: string; identity_attested?: boolean; responses?: { nullifier?: string }[] };
  const nullifier = r.responses?.[0]?.nullifier;
  if (!nullifier) throw new Error("worldid_no_nullifier");

  // Identity Check must actually have attested the predicates — a verified proof
  // whose attributes didn't match is not an eligible borrower.
  const identityAttested = r.identity_attested === true;
  if (credential === "identity" && !identityAttested) throw new Error("identity_attributes_not_matched");

  return { nullifier, identityAttested, protocolVersion: r.protocol_version ?? "unknown" };
}

export { WORLD_ACTIONS };
