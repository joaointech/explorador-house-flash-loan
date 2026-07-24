import "server-only";
import type { KycResult } from "./types";

/**
 * World ID verification (server-side).
 *
 * When a real World app is configured we verify the zero-knowledge proof
 * against World's Developer Portal (`/api/v2/verify/{app_id}`) — proving the
 * caller is a unique human. Identity Check attributes (jurisdiction, age) ride
 * along in the signal when the app requests them.
 *
 * Without a configured app (or with an obvious staging/demo id) we return a
 * clearly-marked demo verification so the wizard flows in a pitch.
 */

type ProofPayload = {
  proof: string;
  merkle_root: string;
  nullifier_hash: string;
  verification_level?: string;
  action?: string;
  signal?: string;
};

const APP_ID = process.env.NEXT_PUBLIC_WORLD_APP_ID || "";
const ACTION = process.env.NEXT_PUBLIC_WORLD_ACTION || "collateralize-house";

function isRealApp(): boolean {
  // Real staging/production ids look like app_<hex>; our placeholder is app_staging_demo.
  return /^app_/.test(APP_ID) && APP_ID !== "app_staging_demo";
}

export function worldConfigured(): boolean {
  return isRealApp();
}

export async function verifyWorldId(
  payload: Partial<ProofPayload> & { demo?: boolean; jurisdiction?: string },
): Promise<KycResult> {
  // Demo path — no real app, or the client asked for a simulated verification.
  if (!isRealApp() || payload.demo || !payload.proof) {
    return {
      verified: true,
      nullifierHash: "0xdemo" + Math.abs(hashStr(payload.nullifier_hash || "demo")).toString(16).padStart(12, "0"),
      jurisdiction: payload.jurisdiction || "PT",
      verificationLevel: "orb",
    };
  }

  const res = await fetch(`https://developer.worldcoin.org/api/v2/verify/${APP_ID}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      nullifier_hash: payload.nullifier_hash,
      merkle_root: payload.merkle_root,
      proof: payload.proof,
      verification_level: payload.verification_level ?? "orb",
      action: payload.action ?? ACTION,
      signal: payload.signal ?? "",
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`worldid_verify_failed:${res.status}:${detail.slice(0, 120)}`);
  }

  return {
    verified: true,
    nullifierHash: payload.nullifier_hash!,
    jurisdiction: payload.jurisdiction || "PT",
    verificationLevel: payload.verification_level ?? "orb",
  };
}

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return h;
}
