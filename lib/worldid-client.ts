import type { WorldCredential, KycResult } from "./types";

/**
 * Browser-side World ID plumbing, shared by the origination wizard (StepKyc) and the
 * loan-management surface (LoansView). The widget chrome differs per surface; these
 * two round-trips do not.
 */

export type RpContext = { rp_id: string; nonce: string; created_at: number; expires_at: number; signature: string };

/**
 * Dev bypass: skip the IDKit widget entirely and post a dummy proof straight to
 * /api/worldid/verify, which fakes the same way server-side (lib/worldid.ts SANDBOX).
 * Without this the browser still mounts a QR code that no World App can complete,
 * because the sandboxed rp_context isn't a real signature.
 */
export const SANDBOX = process.env.NEXT_PUBLIC_WORLD_SANDBOX === "1";

/** Shows the "Skip (demo)" button on the World ID steps. Server enforces the same flag. */
export const ALLOW_SKIP = SANDBOX || process.env.NEXT_PUBLIC_WORLD_ALLOW_SKIP === "1";

/** Gets a freshly-signed rp_context. One signature covers one action, so never cache this. */
export async function fetchRpContext(credential: WorldCredential): Promise<RpContext> {
  const res = await fetch("/api/worldid/rp-context", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ credential }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? "rp_context_failed");
  return json.rp_context as RpContext;
}

/** Hands a proof to our backend, which verifies it with the Developer Portal. */
export async function submitProof(
  credential: WorldCredential,
  result: unknown,
  token?: string,
  skip = false,
): Promise<KycResult & { complete: boolean }> {
  const res = await fetch("/api/worldid/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ credential, result, token, skip }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? "verify_failed");
  return json;
}
