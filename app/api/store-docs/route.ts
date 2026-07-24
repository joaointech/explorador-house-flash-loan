import { NextRequest, NextResponse } from "next/server";
import { storeEncryptedDocuments } from "@/lib/walrus";
import { anchorDocumentHash } from "@/lib/hedera";
import type { StorageResult } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const files = form.getAll("files").filter((f): f is File => f instanceof File);
    const article = String(form.get("article") ?? "");
    if (files.length === 0) return NextResponse.json({ error: "no_files" }, { status: 400 });

    // Concatenate all document bytes into one payload to seal + store.
    const parts: Buffer[] = [];
    for (const f of files) parts.push(Buffer.from(await f.arrayBuffer()));
    const bytes = new Uint8Array(Buffer.concat(parts));

    // 1) encrypt (Seal/AES) + upload to Walrus
    const stored = await storeEncryptedDocuments(bytes);

    // 2) anchor the document hash on Hedera HCS (immutable audit trail)
    const anchor = await anchorDocumentHash(stored.sha256, `caderneta:${article}`);

    const result: StorageResult = {
      blobId: stored.blobId,
      sealed: stored.sealed,
      sha256: stored.sha256,
      hcsTopicId: anchor.topicId,
      hcsSequenceNumber: anchor.sequenceNumber,
    };
    return NextResponse.json({ storage: result, demo: stored.demo || anchor.demo });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "store_failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
