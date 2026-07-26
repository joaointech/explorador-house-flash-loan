import { NextResponse } from "next/server";
import { suiConfigured, treasurySummary, getPool } from "@/lib/sui";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * Plain diagnostic you can open in any browser (no DevTools): shows which env
 * is present (booleans only — never secret values), whether Sui is reachable,
 * the treasury's gas, and whether the on-chain pool resolves. Reveals the usual
 * deploy failures: missing/stale env, out-of-gas treasury, unreachable RPC.
 */
export async function GET() {
  const has = (k: string) => Boolean(process.env[k] && process.env[k]!.trim());
  const out: Record<string, unknown> = {
    ok: true,
    now: new Date().toISOString(),
    env: {
      SUI_SECRET_KEY: has("SUI_SECRET_KEY"),
      BRIDGE_PACKAGE_ID: process.env.BRIDGE_PACKAGE_ID || null, // public
      BRIDGE_POOL_ID: process.env.BRIDGE_POOL_ID || null,      // public
      EUSD_TREASURY_CAP: has("EUSD_TREASURY_CAP"),
      HOUSE_COIN_TYPE: process.env.HOUSE_COIN_TYPE || null,    // public
      EUSD_COIN_TYPE: process.env.EUSD_COIN_TYPE || null,      // public
      SUI_RPC_URL: process.env.SUI_RPC_URL || "(default)",
      SUI_NETWORK: process.env.SUI_NETWORK || "testnet",
      OPENAI_KEY: has("OPENAI_KEY") || has("OPENAI_API_KEY"),
      ANTHROPIC_API_KEY: has("ANTHROPIC_API_KEY"),
      WORLD_RP_ID: has("WORLD_RP_ID"),
      WORLD_RP_SIGNING_KEY: has("WORLD_RP_SIGNING_KEY"),
      WORLD_SANDBOX: process.env.WORLD_SANDBOX === "1" || process.env.NEXT_PUBLIC_WORLD_SANDBOX === "1",
      NEXT_PUBLIC_PRIVY_APP_ID: has("NEXT_PUBLIC_PRIVY_APP_ID"),
      SEAL_PACKAGE_ID: process.env.SEAL_PACKAGE_ID || null,
    },
    suiConfigured: suiConfigured(),
  };

  // Sui reachability + treasury gas + pool resolves.
  try {
    const t = await treasurySummary();
    out.treasury = { address: t.address, suiGas: t.suiBalance, lowGas: t.suiBalance < 0.05, demo: t.demo };
  } catch (e) {
    out.treasury = { error: e instanceof Error ? e.message : "treasury_check_failed" };
  }
  try {
    const pool = await getPool();
    out.pool = pool ? { exists: true, capacity: pool.capacity, utilizationBps: pool.utilizationBps, rateBps: pool.currentRateBps } : { exists: false };
  } catch (e) {
    out.pool = { error: e instanceof Error ? e.message : "pool_check_failed" };
  }

  // Data store: which backend, and can it round-trip a write? (the cross-instance fix)
  const useFirestore = process.env.USE_FIRESTORE === "1";
  try {
    const { readCollection, writeCollection } = await import("@/lib/store");
    const stamp = new Date().toISOString();
    await writeCollection("_healthcheck", [{ stamp }]);
    const back = await readCollection<{ stamp: string }>("_healthcheck");
    out.db = { backend: useFirestore ? "firestore" : "local-json (per-instance!)", roundTrip: back?.[0]?.stamp === stamp };
  } catch (e) {
    out.db = { backend: useFirestore ? "firestore" : "local-json", error: e instanceof Error ? e.message : "db_error" };
  }

  return NextResponse.json(out, { status: 200 });
}
