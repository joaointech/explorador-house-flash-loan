import { NextRequest, NextResponse } from "next/server";
import { verifyWorldId } from "@/lib/worldid";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const kyc = await verifyWorldId(body);
    return NextResponse.json({ kyc });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "verify_failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
