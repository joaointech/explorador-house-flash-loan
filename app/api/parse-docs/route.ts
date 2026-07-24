import { NextRequest, NextResponse } from "next/server";
import { parsePropertyDocuments } from "@/lib/ai-parse";
import type { PropertyData } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

// Demo fallback so the wizard flows end-to-end even without an Anthropic key.
const DEMO: PropertyData = {
  artigoMatricial: "1234",
  vpt: 250000,
  morada: "Rua das Amendoeiras, 42",
  freguesia: "Alvalade",
  concelho: "Lisboa",
  proprietario: "Maria Santos",
  fracao: "B",
  confidence: 0.4,
};

const ALLOWED = ["application/pdf", "image/png", "image/jpeg", "image/webp", "image/gif"];

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const files = form.getAll("files").filter((f): f is File => f instanceof File);
    if (files.length === 0) {
      return NextResponse.json({ error: "no_files" }, { status: 400 });
    }

    // No key configured → return the demo extraction (flagged) so the demo works.
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ property: DEMO, demo: true });
    }

    const docs = [];
    for (const f of files) {
      const type = f.type || "application/octet-stream";
      if (!ALLOWED.includes(type)) {
        return NextResponse.json({ error: `unsupported_type:${type}` }, { status: 400 });
      }
      const buf = Buffer.from(await f.arrayBuffer());
      docs.push({ mediaType: type, dataBase64: buf.toString("base64") });
    }

    const property = await parsePropertyDocuments(docs);
    return NextResponse.json({ property, demo: false });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "parse_failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
