import { NextRequest, NextResponse } from "next/server";
import { getLoan, recordRepayment } from "@/lib/loans";
import { getVault, repayLoan, quoteOwed } from "@/lib/sui";

export const runtime = "nodejs";
export const maxDuration = 45;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const vaultId = String(body.vaultId ?? "");
    if (!vaultId) return NextResponse.json({ error: "vault_required" }, { status: 400 });

    const loan = await getLoan(vaultId);
    if (!loan) return NextResponse.json({ error: "loan_not_found" }, { status: 404 });

    // Amount owed: prefer live on-chain state, fall back to the registry.
    const live = await getVault(vaultId);
    const drawUsdc = live?.drawnUsdc ?? loan.drawnUsdc ?? 0;

    // Quote 60s ahead: the tx settles seconds from now and on-chain interest only
    // grows, so validating against a stale quote could land a payment below
    // accrued interest and abort with EBelowAccruedInterest.
    const q = quoteOwed(
      { drawnUsdc: drawUsdc, drawnAtMs: live?.drawnAtMs ?? 0, rateBps: live?.rateBps ?? 0 },
      Date.now() + 60_000,
    );

    // `amount` is in USDC. Missing / not a number / <= 0 -> full payoff (repay
    // in full, e.g. the "Repay in full" button sends no amount).
    const raw = Number(body.amount);
    const amountUsdc = Number.isFinite(raw) && raw > 0 ? Math.min(raw, q.owed / 1e6) : q.owed / 1e6;
    if (amountUsdc * 1e6 < q.interest) {
      return NextResponse.json({ error: "below_accrued_interest", minUsdc: q.interest / 1e6 }, { status: 400 });
    }

    const res = await repayLoan({
      vaultId,
      drawUsdc,
      drawnAtMs: live?.drawnAtMs,
      rateBps: live?.rateBps,
      amountUsdc,
    });
    await recordRepayment(vaultId, res.digest, res.paidUsdc, res.remainingUsdc);

    return NextResponse.json({
      digest: res.digest,
      repaidUsdc: res.paidUsdc, // amount settled by THIS call
      principalUsdc: res.principalUsdc,
      interestUsdc: res.interestUsdc,
      remainingUsdc: res.remainingUsdc,
      owedUsdc: res.owedUsdc,
      partial: res.partial,
      rateBps: live?.rateBps ?? 0,
      demo: res.demo,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "repay_failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
