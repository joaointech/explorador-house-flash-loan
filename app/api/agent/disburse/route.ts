import { NextRequest, NextResponse } from "next/server";
import { runTreasuryAgent } from "@/lib/agent";
import { recordLoan, getLoan } from "@/lib/loans";
import { getKycSession, isComplete, nullifierHasActiveLoan, checkContinuity } from "@/lib/kyc-store";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));

    const vaultId = String(body.vaultId ?? "");
    const accountId = String(body.accountId ?? "");
    const kycToken = String(body.kycToken ?? "");

    // A vault that already carries a loan means this is a RE-DRAW, not an origination.
    // Different question, different gate: not "is this an eligible new borrower?" but
    // "is this the same human who pledged this house?".
    const existing = await getLoan(vaultId);

    if (existing) {
      const cont = await checkContinuity(kycToken, vaultId);
      if (!cont.ok) return NextResponse.json({ error: cont.error }, { status: 403 });
    }

    // The client sends an opaque token, never a verified flag — the World ID state is
    // resolved here from proofs we verified with the Developer Portal ourselves.
    const kyc = await getKycSession(kycToken);
    if (!kyc || !isComplete(kyc)) return NextResponse.json({ error: "kyc_required" }, { status: 400 });

    // Sybil gate: one active loan per human. The selfie nullifier links the two
    // without revealing anything about who the borrower is.
    if (await nullifierHasActiveLoan(kyc.selfieNullifier, vaultId)) {
      return NextResponse.json({ error: "kyc_sybil" }, { status: 400 });
    }

    const result = await runTreasuryAgent({
      vpt: Number(body.vpt) || 0,
      collateralPct: Number(body.collateralPct) || 0,
      drawAmount: Number(body.drawAmount) || 0,
      kyc,
      accountId,
      vaultId,
    });

    // Register the loan so it shows up in the management surface.
    if (result.status === "executed" && vaultId.startsWith("0x")) {
      await recordLoan({
        vaultId,
        owner: accountId,
        article: String(body.article ?? ""),
        morada: body.morada ? String(body.morada) : undefined,
        vpt: Number(body.vpt) || 0,
        drawnUsdc: result.amountUsdc,
        collateralPct: Number(body.collateralPct) || 0,
        coinType: String(body.coinType ?? ""),
        disburseDigest: result.digest,
        selfieNullifier: kyc.selfieNullifier,
        identityNullifier: kyc.identityNullifier,
        status: "active",
        createdAt: Date.now(),
      });
    }

    return NextResponse.json({ disbursement: result });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "disburse_failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
