import "server-only";

/**
 * AI provider selection. The app supports OpenAI or Anthropic for the two AI
 * features (caderneta parsing + the treasury agent's reasoning). Whichever key
 * is present wins; set AI_PROVIDER to force one. Server-side only — no key ever
 * reaches the browser.
 */

export type AiProvider = "openai" | "anthropic";

const OPENAI_KEY = process.env.OPENAI_KEY || process.env.OPENAI_API_KEY;

export function aiProvider(): AiProvider | null {
  const forced = process.env.AI_PROVIDER?.toLowerCase();
  if (forced === "openai") return OPENAI_KEY ? "openai" : null;
  if (forced === "anthropic") return process.env.ANTHROPIC_API_KEY ? "anthropic" : null;
  // Auto: prefer OpenAI when its key is set, else Anthropic.
  if (OPENAI_KEY) return "openai";
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  return null;
}

export function aiConfigured(): boolean {
  return aiProvider() !== null;
}

/** OpenAI vision/reasoning model (Responses API). Override with OPENAI_MODEL. */
export const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o";

export async function openaiClient() {
  const { default: OpenAI } = await import("openai");
  return new OpenAI({ apiKey: OPENAI_KEY });
}
