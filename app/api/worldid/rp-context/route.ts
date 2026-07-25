import { NextRequest, NextResponse } from "next/server";
import { signRpContext } from "@/lib/worldid";
import { WORLD_ACTIONS, type WorldCredential } from "@/lib/types";

export const runtime = "nodejs";

/**
 * Mints a signed rp_context for one credential request.
 *
 * The credential name — not a raw action string — is what the client sends: the RP
 * signing key must never sign an action a caller invented.
 */
export async function POST(req: NextRequest) {
  try {
    const { credential } = (await req.json().catch(() => ({}))) as { credential?: WorldCredential };
    if (credential !== "identity" && credential !== "selfie") {
      return NextResponse.json({ error: "unknown_credential" }, { status: 400 });
    }

    return NextResponse.json({ rp_context: signRpContext(WORLD_ACTIONS[credential]) });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "rp_context_failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
