import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { PropertyData } from "./types";
import { aiProvider, openaiClient, OPENAI_MODEL } from "./ai";

/**
 * AI extraction of the Portuguese *caderneta predial* (property tax register)
 * and ID document, using structured outputs. Runs server-side only — the API
 * key never reaches the browser.
 *
 * Provider-agnostic: OpenAI (Responses API, gpt-4o) or Anthropic (claude-opus-4-8),
 * whichever key is configured. Both take vision/PDF document input and are
 * constrained to a strict JSON schema so the result always matches PropertyData.
 */

// JSON schema the model is constrained to. additionalProperties:false + required
// are mandatory for structured outputs.
const PROPERTY_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    artigoMatricial: { type: "string", description: "Artigo matricial (tax article number) of the property" },
    vpt: { type: "number", description: "Valor Patrimonial Tributário in EUR (numeric, no currency symbol)" },
    morada: { type: "string", description: "Street address / morada" },
    freguesia: { type: "string", description: "Parish / freguesia" },
    concelho: { type: "string", description: "Municipality / concelho" },
    proprietario: { type: "string", description: "Owner full name as written on the documents" },
    fracao: { type: "string", description: "Fraction identifier for apartments (e.g. 'A'), empty string if none" },
    confidence: { type: "number", description: "Your overall confidence in this extraction, 0 to 1" },
  },
  required: ["artigoMatricial", "vpt", "morada", "freguesia", "concelho", "proprietario", "fracao", "confidence"],
} as const;

type DocInput = { mediaType: string; dataBase64: string };

function docBlock(doc: DocInput): Anthropic.ContentBlockParam {
  if (doc.mediaType === "application/pdf") {
    return {
      type: "document",
      source: { type: "base64", media_type: "application/pdf", data: doc.dataBase64 },
    };
  }
  // images
  return {
    type: "image",
    source: {
      type: "base64",
      media_type: doc.mediaType as "image/png" | "image/jpeg" | "image/webp" | "image/gif",
      data: doc.dataBase64,
    },
  };
}

const INSTRUCTION = [
  "These are Portuguese real-estate documents: a *caderneta predial* (property tax register) and possibly an identity document.",
  "Extract the property's fields. The VPT (Valor Patrimonial Tributário) is a euro amount — return it as a plain number.",
  "If a field is genuinely absent, use an empty string (or 0 for vpt) and lower your confidence.",
  "Return only the structured object.",
].join(" ");

export async function parsePropertyDocuments(docs: DocInput[]): Promise<PropertyData> {
  return aiProvider() === "openai" ? parseWithOpenAI(docs) : parseWithAnthropic(docs);
}

// ── OpenAI (Responses API: input_file for PDFs, input_image for images) ──
async function parseWithOpenAI(docs: DocInput[]): Promise<PropertyData> {
  const client = await openaiClient();
  const parts = docs.map((d, i) =>
    d.mediaType === "application/pdf"
      ? { type: "input_file" as const, filename: `doc-${i}.pdf`, file_data: `data:application/pdf;base64,${d.dataBase64}` }
      : { type: "input_image" as const, image_url: `data:${d.mediaType};base64,${d.dataBase64}`, detail: "auto" as const },
  );

  const res = await client.responses.create({
    model: OPENAI_MODEL,
    input: [{ role: "user", content: [...parts, { type: "input_text", text: INSTRUCTION }] }],
    text: { format: { type: "json_schema", name: "property", schema: PROPERTY_SCHEMA, strict: true } },
  });

  const text = res.output_text;
  if (!text) throw new Error("no_structured_output");
  return JSON.parse(text) as PropertyData;
}

// ── Anthropic (document/image content blocks) ────────────────────────────
async function parseWithAnthropic(docs: DocInput[]): Promise<PropertyData> {
  const client = new Anthropic(); // resolves ANTHROPIC_API_KEY / profile
  const content: Anthropic.ContentBlockParam[] = [
    ...docs.map(docBlock),
    { type: "text", text: INSTRUCTION },
  ];

  const res = await client.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 2000,
    output_config: { format: { type: "json_schema", schema: PROPERTY_SCHEMA } },
    messages: [{ role: "user", content }],
  });

  const block = res.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") throw new Error("no_structured_output");
  return JSON.parse(block.text) as PropertyData;
}
