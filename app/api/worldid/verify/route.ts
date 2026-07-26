import { NextRequest, NextResponse } from "next/server";
import { verifyIdKitResult, skipProof, ALLOW_SKIP } from "@/lib/worldid";
import { upsertKycSession, isComplete } from "@/lib/kyc-store";
import type { WorldCredential } from "@/lib/types";

export const runtime = "nodejs";

/**
 * Verifies one IDKit result with the Developer Portal and folds it into the
 * server-side KYC session.
 *
 * The response carries an opaque token and display-only fields. It deliberately
 * contains nothing the client could use to fabricate a verified state.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      credential?: WorldCredential;
      result?: unknown;
      token?: string;
      skip?: boolean;
    };

    if (body.credential !== "identity" && body.credential !== "selfie") {
      return NextResponse.json({ error: "unknown_credential" }, { status: 400 });
    }

    // "Skip (demo)" button: only honoured when the skip flag is enabled.
    if (body.skip) {
      if (!ALLOW_SKIP) return NextResponse.json({ error: "skip_not_allowed" }, { status: 403 });
    }
    const proof = body.skip ? skipProof(body.credential) : await verifyIdKitResult(body.result, body.credential);

    const session = await upsertKycSession(
      body.token,
      body.credential === "identity"
        ? { identityNullifier: proof.nullifier, identityAttested: proof.identityAttested, sandbox: proof.sandbox }
        : { selfieNullifier: proof.nullifier, sandbox: proof.sandbox },
    );

    return NextResponse.json({
      token: session.token,
      identityAttested: session.identityAttested,
      identityNullifier: session.identityNullifier,
      selfieNullifier: session.selfieNullifier,
      complete: isComplete(session),
      sandbox: session.sandbox,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "verify_failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
