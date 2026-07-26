import { NextRequest, NextResponse } from "next/server";
import { runTreasuryAgent } from "@/lib/agent";
import { recordLoan, getLoan, activeLoanForOwner } from "@/lib/loans";
import { getKycSession, isComplete, nullifierHasActiveLoan, checkContinuity } from "@/lib/kyc-store";
import { getAgreementForVault } from "@/lib/agreement";
import type { StoredDoc } from "@/lib/types";

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

    // One loan per account: an address that already has an open position can't
    // originate another one (re-draws on the SAME vault are not blocked by this).
    if (await activeLoanForOwner(accountId, vaultId)) {
      return NextResponse.json({ error: "account_has_loan" }, { status: 400 });
    }

    // Legal gate: no signed Termo de Reconhecimento e Confissão de Dívida, no funds.
    // The signature must match this vault, this borrower, and this exact draw — a
    // signed €X does not authorize a €2X disbursement.
    const agreement = await getAgreementForVault(vaultId);
    if (!agreement) return NextResponse.json({ error: "agreement_required" }, { status: 403 });
    if (agreement.accountId !== accountId || agreement.amountEur !== Number(body.drawAmount)) {
      return NextResponse.json({ error: "agreement_mismatch" }, { status: 403 });
    }

    const result = await runTreasuryAgent({
      vpt: Number(body.vpt) || 0,
      collateralPct: Number(body.collateralPct) || 0,
      drawAmount: Number(body.drawAmount) || 0,
      kyc,
      accountId,
      vaultId,
    });

    // Register the loan so it shows up in the management surface. The termo
    // (signed debt acknowledgement) joins the three documents already sealed
    // and stored at the Documents step, so the account page can link all four.
    if (result.status === "executed" && vaultId.startsWith("0x")) {
      const uploadedDocs: StoredDoc[] = Array.isArray(body.documents) ? body.documents : [];
      const termo: StoredDoc | null = agreement.termoBlobId
        ? { kind: "termo", blobId: agreement.termoBlobId, sealed: true, sha256: agreement.docSha256, filename: "termo-reconhecimento-divida.pdf" }
        : null;

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
        docAnchorDigest: body.docAnchorDigest ? String(body.docAnchorDigest) : undefined,
        documents: termo ? [...uploadedDocs, termo] : uploadedDocs,
        agreementId: agreement.id,
        agreementSha256: agreement.docSha256,
        selfieNullifier: kyc.selfieNullifier,
        identityNullifier: kyc.identityNullifier,
        status: "active",
        createdAt: Date.now(),
      });
    }

    return NextResponse.json({ disbursement: result });
  } catch (e: unknown) {
    console.error("[agent/disburse] failed:", e); // shows in Cloud Run logs
    const msg = e instanceof Error ? e.message : "disburse_failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
