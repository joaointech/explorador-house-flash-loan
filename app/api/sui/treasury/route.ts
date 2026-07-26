import { NextResponse } from "next/server";
import { treasuryDetail, getPool } from "@/lib/sui";

export const runtime = "nodejs";
export const maxDuration = 30;

// Everything about the protocol treasury wallet: its address, every coin balance
// it holds, USDC in circulation, and the lending pool it runs.
export async function GET() {
  try {
    const [treasury, pool] = await Promise.all([treasuryDetail(), getPool()]);
    return NextResponse.json({ treasury, pool });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "treasury_failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
