import { NextRequest, NextResponse } from "next/server";
import { listLoans } from "@/lib/loans";
import { getVault, treasurySummary } from "@/lib/sui";

export const runtime = "nodejs";
export const maxDuration = 45;

export async function GET(req: NextRequest) {
  try {
    const owner = req.nextUrl.searchParams.get("owner") ?? undefined;
    const entries = await listLoans(owner);

    // Merge each registry entry with its live on-chain vault state.
    const loans = await Promise.all(
      entries.map(async (e) => {
        const v = await getVault(e.vaultId);
        return {
          ...e,
          live: v
            ? { drawnUsdc: v.drawnUsdc, locked: v.locked, repaid: v.repaid, vpt: v.vpt }
            : null,
          status: v?.repaid ? "repaid" : e.status,
        };
      }),
    );

    const treasury = await treasurySummary();
    return NextResponse.json({ loans, treasury });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "loans_failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
