import { NextRequest, NextResponse } from "next/server";
import { signAgreement, maskPhone, docSha256 } from "@/lib/agreement";
import { anchorDocument } from "@/lib/sui";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));

    const vaultId = String(body.vaultId ?? "");
    const accountId = String(body.accountId ?? "");
    const amountEur = Number(body.amountEur) || 0;
    const article = String(body.article ?? "");
    const nome = String(body.nome ?? "");
    const phone = String(body.phone ?? "");

    if (!vaultId || !accountId || !amountEur || !nome) {
      return NextResponse.json({ error: "missing_fields" }, { status: 400 });
    }

    // The doc hash is derived server-side from the actual PDF, never trusted from the
    // client — the CMD step signed "this file", not whatever bytes a request claims.
    const anchored = await anchorDocument({
      article,
      docHashHex: await docSha256(),
    });

    const agreement = await signAgreement({
      vaultId,
      accountId,
      amountEur,
      property: { article, morada: body.morada ? String(body.morada) : undefined },
      signer: { nome, phoneMasked: maskPhone(phone) },
      anchorDigest: anchored.digest,
    });

    return NextResponse.json({
      agreement: {
        id: agreement.id,
        docSha256: agreement.docSha256,
        signedAt: agreement.signedAt,
        amountEur: agreement.amountEur,
        signerNome: agreement.signer.nome,
        anchorDigest: agreement.anchorDigest,
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "sign_failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
