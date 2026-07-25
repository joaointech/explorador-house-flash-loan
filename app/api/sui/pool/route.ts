import { NextResponse } from "next/server";
import { getPool } from "@/lib/sui";

export const runtime = "nodejs";

// Light endpoint the live yield chart polls for the pool's current utilization,
// borrow rate, and accrued yield.
export async function GET() {
  try {
    const pool = await getPool();
    return NextResponse.json({ pool });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "pool_failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
