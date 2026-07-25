import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { disburse } from "./sui";
import { aiProvider, openaiClient, OPENAI_MODEL } from "./ai";
import type { Disbursement } from "./types";
import type { KycSession } from "./kyc-store";

/**
 * The treasury AI agent.
 *
 * Given a collateral position + two World ID credentials, the agent decides whether
 * to release liquidity and then EXECUTES it on Sui — recording the draw on the
 * CollateralVault (lock_and_draw) and transferring stablecoin — in a single
 * programmable transaction. It only ever acts on behalf of a verified human (the
 * World AgentKit "human-backed agent" requirement).
 *
 * The credentials are underwriting inputs, not a login: Identity Check establishes
 * ELIGIBILITY (18+, PT-issued document) and Selfie Check establishes PRESENCE and
 * sybil-resistance (this human has no other active loan — checked before we get here).
 *
 * Reasoning runs on the configured AI provider (OpenAI or Anthropic) with
 * structured output. Without a key it falls back to a deterministic policy so
 * the demo still executes end-to-end.
 */

type AgentInput = {
  vpt: number;
  collateralPct: number; // fraction of equity locked (0..1)
  drawAmount: number; // requested USDC
  kyc: KycSession; // resolved server-side; never client-supplied
  accountId: string; // Sui address
  vaultId: string;
};

type Decision = { approve: boolean; rationale: string; maxDraw: number };

const DECISION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    approve: { type: "boolean", description: "Whether to release the funds" },
    rationale: { type: "string", description: "One or two sentences explaining the decision, referencing LTV and the verified human." },
    maxDraw: { type: "number", description: "Maximum USDC you would responsibly release for this collateral" },
  },
  required: ["approve", "rationale", "maxDraw"],
} as const;

async function decide(input: AgentInput): Promise<Decision> {
  const lockedEquity = input.vpt * input.collateralPct;
  const ltv = lockedEquity > 0 ? input.drawAmount / lockedEquity : Infinity;
  const maxDraw = Math.floor(lockedEquity * 0.7);

  const eligible = input.kyc.identityAttested && Boolean(input.kyc.selfieNullifier);
  const provider = aiProvider();

  if (!provider) {
    const approve = eligible && input.drawAmount <= maxDraw && input.drawAmount > 0;
    return {
      approve,
      maxDraw,
      rationale: approve
        ? `Approved: World ID attests the borrower is 18+ with a PT-issued document (Identity Check) and was physically present at signing (Selfie Check), with no other active loan under this nullifier; the Termo de Reconhecimento e Confissão de Dívida was signed via Chave Móvel Digital and its hash anchored on Sui; requested €${input.drawAmount.toLocaleString()} is ${(ltv * 100).toFixed(0)}% LTV against €${lockedEquity.toLocaleString()} locked equity, within the 70% policy.`
        : `Declined: ${!eligible ? "World ID eligibility not established (18+ / PT-issued document / live presence)" : `€${input.drawAmount.toLocaleString()} exceeds the 70% LTV cap of €${maxDraw.toLocaleString()}`}.`,
    };
  }

  const system =
    "You are the treasury risk agent for a real-estate bridge-liquidity protocol on Sui. " +
    "You release stablecoin liquidity against tokenized home equity. Only approve when World ID establishes eligibility (document-backed 18+ and a Portugal-issued document) AND liveness (a selfie proving the borrower was present at signing) AND the borrower has signed a Termo de Reconhecimento e Confissão de Dívida via Chave Móvel Digital (checked before you run — its hash is already anchored on Sui), and the requested draw stays within 70% loan-to-value of the locked equity. " +
    "You receive attestations, not personal data — you never see a name, birth date or document number, and you must not ask for them. Be concise.";

  const payload = JSON.stringify({
    // Predicates only — this is the entire identity surface the agent ever sees.
    identityAttested18PlusPrt: input.kyc.identityAttested,
    livePresenceAttested: Boolean(input.kyc.selfieNullifier),
    noOtherActiveLoanForThisHuman: true, // enforced before the agent runs
    sandbox: input.kyc.sandbox ?? false,
    vptEur: input.vpt,
    collateralPct: input.collateralPct,
    lockedEquityEur: lockedEquity,
    requestedDrawUsdc: input.drawAmount,
    impliedLtv: ltv,
    vaultId: input.vaultId,
  });

  return provider === "openai"
    ? decideWithOpenAI(system, payload, maxDraw)
    : decideWithAnthropic(system, payload, maxDraw);
}

async function decideWithOpenAI(system: string, payload: string, maxDraw: number): Promise<Decision> {
  const client = await openaiClient();
  const res = await client.responses.create({
    model: OPENAI_MODEL,
    instructions: system,
    input: payload,
    text: { format: { type: "json_schema", name: "decision", schema: DECISION_SCHEMA, strict: true } },
  });
  const text = res.output_text;
  if (!text) return { approve: false, rationale: "no_decision", maxDraw };
  return JSON.parse(text) as Decision;
}

async function decideWithAnthropic(system: string, payload: string, maxDraw: number): Promise<Decision> {
  const client = new Anthropic();
  const res = await client.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 800,
    output_config: { format: { type: "json_schema", schema: DECISION_SCHEMA } },
    system,
    messages: [{ role: "user", content: payload }],
  });
  const block = res.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") return { approve: false, rationale: "no_decision", maxDraw };
  return JSON.parse(block.text) as Decision;
}

export async function runTreasuryAgent(input: AgentInput): Promise<Disbursement & { approved: boolean }> {
  const decision = await decide(input);

  if (!decision.approve) {
    return {
      approved: false,
      digest: "",
      asset: "USDC",
      amountUsdc: input.drawAmount,
      status: "declined",
      agentRationale: decision.rationale,
    };
  }

  // Agent executes the payment on Sui: record the draw on-chain + transfer stablecoin.
  const paid = await disburse({
    vaultId: input.vaultId,
    to: input.accountId,
    pctBps: Math.round(input.collateralPct * 10000),
    drawUsdc: input.drawAmount,
  });

  return {
    approved: true,
    digest: paid.digest,
    asset: paid.asset,
    amountUsdc: input.drawAmount,
    status: "executed",
    agentRationale: decision.rationale,
  };
}
