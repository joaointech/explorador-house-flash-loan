import { NextRequest, NextResponse } from "next/server";
import { getLoan, markRepaid } from "@/lib/loans";
import { getVault, repayLoan } from "@/lib/sui";
import { checkContinuity } from "@/lib/kyc-store";

export const runtime = "nodejs";
export const maxDuration = 45;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const vaultId = String(body.vaultId ?? "");
    if (!vaultId) return NextResponse.json({ error: "vault_required" }, { status: 400 });

    const loan = await getLoan(vaultId);
    if (!loan) return NextResponse.json({ error: "loan_not_found" }, { status: 404 });

    // Continuity: repayment settles eUSD from the treasury and releases collateral, so
    // a vault id alone must not trigger it. A fresh Selfie Check proves the human who
    // pledged this house is the one asking.
    const cont = await checkContinuity(String(body.kycToken ?? ""), vaultId);
    if (!cont.ok) return NextResponse.json({ error: cont.error }, { status: 403 });

    // Amount owed: prefer live on-chain state, fall back to the registry.
    const live = await getVault(vaultId);
    const drawUsdc = live?.drawnUsdc ?? loan.drawnUsdc ?? 0;

    const res = await repayLoan({
      vaultId,
      drawUsdc,
      drawnAtMs: live?.drawnAtMs,
      rateBps: live?.rateBps,
    });
    await markRepaid(vaultId, res.digest);

    return NextResponse.json({
      digest: res.digest,
      repaidUsdc: res.owedUsdc,
      principalUsdc: res.principalUsdc,
      interestUsdc: res.interestUsdc,
      rateBps: live?.rateBps ?? 0,
      demo: res.demo,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "repay_failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
