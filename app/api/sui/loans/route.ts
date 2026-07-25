import { NextRequest, NextResponse } from "next/server";
import { listLoans } from "@/lib/loans";
import { getVault, getPool, quoteOwed, treasurySummary } from "@/lib/sui";

export const runtime = "nodejs";
export const maxDuration = 45;

export async function GET(req: NextRequest) {
  try {
    const owner = req.nextUrl.searchParams.get("owner") ?? undefined;
    const entries = await listLoans(owner);

    // Merge each registry entry with its live on-chain vault state, including
    // the borrow rate and interest accrued so far (money-market position).
    const loans = await Promise.all(
      entries.map(async (e) => {
        const v = await getVault(e.vaultId);
        const q = v ? quoteOwed(v) : null;
        return {
          ...e,
          live: v
            ? {
                drawnUsdc: v.drawnUsdc,
                locked: v.locked,
                repaid: v.repaid,
                vpt: v.vpt,
                rateBps: v.rateBps,
                drawnAtMs: v.drawnAtMs,
                interestUsdc: q ? q.interest / 1e6 : 0,
                owedUsdc: q ? q.owed / 1e6 : v.drawnUsdc,
              }
            : null,
          status: v?.repaid ? "repaid" : e.status,
        };
      }),
    );

    const [treasury, pool] = await Promise.all([treasurySummary(), getPool()]);
    return NextResponse.json({ loans, treasury, pool });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "loans_failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
