import { NextResponse } from "next/server";
import { mmTick, mmReset } from "@/lib/mm";

export const runtime = "nodejs";
export const maxDuration = 45;

// Advance the market maker one step (one on-chain mm_set_draw). The client calls
// this on an interval while the MM is "running".
export async function POST() {
  try {
    const res = await mmTick();
    return NextResponse.json(res);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "mm_tick_failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// Stop: reset the MM vault's draw to 0 (utilization back to baseline).
export async function DELETE() {
  try {
    await mmReset();
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "mm_reset_failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
