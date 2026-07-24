import { NextRequest, NextResponse } from "next/server";
import { getLoan, markRepaid } from "@/lib/loans";
import { getVault, repayLoan } from "@/lib/sui";

export const runtime = "nodejs";
export const maxDuration = 45;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const vaultId = String(body.vaultId ?? "");
    if (!vaultId) return NextResponse.json({ error: "vault_required" }, { status: 400 });

    // Amount owed: prefer live on-chain state, fall back to the registry.
    const live = await getVault(vaultId);
    const loan = await getLoan(vaultId);
    const drawUsdc = live?.drawnUsdc ?? loan?.drawnUsdc ?? 0;

    const res = await repayLoan({ vaultId, drawUsdc });
    await markRepaid(vaultId, res.digest);

    return NextResponse.json({ digest: res.digest, repaidUsdc: drawUsdc, demo: res.demo });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "repay_failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
