import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { storeEncryptedDocuments } from "@/lib/walrus";
import { anchorDocument } from "@/lib/sui";
import type { DocKind, StorageResult } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const SLOTS: DocKind[] = ["cartaoCidadao", "cadernetaPredial", "declaracaoImi"];

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const article = String(form.get("article") ?? "");

    const files: { kind: DocKind; file: File }[] = [];
    for (const kind of SLOTS) {
      const f = form.get(kind);
      if (f instanceof File) files.push({ kind, file: f });
    }
    if (files.length !== SLOTS.length) {
      return NextResponse.json({ error: "missing_documents" }, { status: 400 });
    }

    // Each document is sealed + stored as its own Walrus blob, so the account
    // page can link each one individually.
    const documents = await Promise.all(
      files.map(async ({ kind, file }) => {
        const bytes = new Uint8Array(Buffer.from(await file.arrayBuffer()));
        const stored = await storeEncryptedDocuments(bytes);
        return { kind, blobId: stored.blobId, sealed: stored.sealed, sha256: stored.sha256, filename: file.name, demo: stored.demo };
      }),
    );

    // Anchor one combined hash on Sui (immutable DocumentAnchored event) — the
    // existing audit trail, now covering all three documents at once.
    const combined = createHash("sha256");
    for (const d of documents) combined.update(d.sha256);
    const sha256 = combined.digest("hex");
    const anchor = await anchorDocument({ article, docHashHex: sha256 });

    const result: StorageResult = {
      documents: documents.map(({ kind, blobId, sealed, sha256, filename }) => ({ kind, blobId, sealed, sha256, filename })),
      sealed: documents.every((d) => d.sealed),
      sha256,
      anchorDigest: anchor.digest,
    };
    return NextResponse.json({ storage: result, demo: documents.some((d) => d.demo) || anchor.demo });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "store_failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
