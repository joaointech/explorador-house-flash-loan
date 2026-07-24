import { NextRequest, NextResponse } from "next/server";
import { tokenizeHouse } from "@/lib/sui";
import type { HouseToken } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const vpt = Math.max(1, Math.round(Number(body.vpt) || 0));
    const article = String(body.article ?? "0000");
    const owner = String(body.accountId ?? "");
    const docHashHex = String(body.sha256 ?? "").replace(/[^0-9a-f]/gi, "") || "00";

    const minted = await tokenizeHouse({ owner, article, docHashHex, vpt });

    const token: HouseToken = {
      coinType: minted.coinType,
      vaultId: minted.vaultId,
      symbol: "HOUSE",
      totalSupply: vpt,
      digest: minted.digest,
    };
    return NextResponse.json({ token, demo: minted.demo });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "tokenize_failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
