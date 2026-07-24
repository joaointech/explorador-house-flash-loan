import { NextRequest, NextResponse } from "next/server";
import { runTreasuryAgent } from "@/lib/agent";
import type { KycResult } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const kyc: KycResult = body.kyc ?? { verified: false, nullifierHash: "" };
    if (!kyc.verified) return NextResponse.json({ error: "kyc_required" }, { status: 400 });

    const result = await runTreasuryAgent({
      vpt: Number(body.vpt) || 0,
      collateralPct: Number(body.collateralPct) || 0,
      drawAmount: Number(body.drawAmount) || 0,
      kyc,
      accountId: String(body.accountId ?? ""),
      vaultId: String(body.vaultId ?? ""),
    });

    return NextResponse.json({ disbursement: result });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "disburse_failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
