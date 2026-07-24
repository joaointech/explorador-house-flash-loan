import { NextRequest, NextResponse } from "next/server";
import { createHouseToken, associateToken } from "@/lib/hedera";
import type { HouseToken } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const vpt = Math.max(1, Math.round(Number(body.vpt) || 0));
    const article = String(body.article ?? "0000");
    const accountId = String(body.accountId ?? "");
    const userKey = body.userKey ? String(body.userKey) : undefined;

    const name = `explorador House ${article}`;
    const symbol = `HSE${article}`.slice(0, 8).toUpperCase();

    const minted = await createHouseToken({ name, symbol, supply: vpt });

    // Associate to the user's account when we can sign for it; otherwise the
    // treasury holds it until the user associates in their wallet.
    let associateTx = "";
    if (accountId) {
      const assoc = await associateToken(accountId, minted.tokenId, userKey);
      associateTx = assoc.transactionId;
    }

    const token: HouseToken = {
      tokenId: minted.tokenId,
      name,
      symbol,
      totalSupply: vpt,
      decimals: 0,
    };
    return NextResponse.json({ token, transactionId: minted.transactionId, associateTx, demo: minted.demo });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "tokenize_failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
