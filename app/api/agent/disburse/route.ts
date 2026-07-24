import { NextRequest, NextResponse } from "next/server";
import { runTreasuryAgent } from "@/lib/agent";
import { recordLoan } from "@/lib/loans";
import type { KycResult } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const kyc: KycResult = body.kyc ?? { verified: false, nullifierHash: "" };
    if (!kyc.verified) return NextResponse.json({ error: "kyc_required" }, { status: 400 });

    const vaultId = String(body.vaultId ?? "");
    const accountId = String(body.accountId ?? "");
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
