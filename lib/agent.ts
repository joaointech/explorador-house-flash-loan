import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { scheduleUsdcDisbursement } from "./hedera";
import type { Disbursement, KycResult } from "./types";

/**
 * The treasury AI agent.
 *
 * Given a collateral position + a World-ID-verified unique human, the agent
 * decides whether to release liquidity and then EXECUTES the payment itself as
 * a Hedera Scheduled Transaction (USDC via HTS). This is the pattern the Hedera
 * Agent Kit formalizes — an LLM reasoning over state, then acting on Hedera —
 * and it only ever acts on behalf of a verified human (the World AgentKit
 * "tell a bot from a human-backed agent" requirement).
 *
 * The reasoning runs on Claude (structured output). Without a key it falls back
 * to a deterministic policy so the demo still executes end-to-end.
 */

type AgentInput = {
  vpt: number;
  collateralPct: number; // fraction of equity locked (0..1)
  drawAmount: number; // requested USDC
  kyc: KycResult;
  accountId: string;
  tokenId: string;
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
  // Policy ceiling: never lend beyond 70% LTV against the locked equity.
  const maxDraw = Math.floor(lockedEquity * 0.7);

  if (!process.env.ANTHROPIC_API_KEY) {
    const approve = input.kyc.verified && input.drawAmount <= maxDraw && input.drawAmount > 0;
    return {
      approve,
      maxDraw,
      rationale: approve
        ? `Approved: borrower is a World-ID-verified unique human in ${input.kyc.jurisdiction ?? "PT"}; requested €${input.drawAmount.toLocaleString()} is ${(ltv * 100).toFixed(0)}% LTV against €${lockedEquity.toLocaleString()} locked equity, within the 70% policy.`
        : `Declined: ${!input.kyc.verified ? "KYC not verified" : `€${input.drawAmount.toLocaleString()} exceeds the ${(0.7 * 100).toFixed(0)}% LTV cap of €${maxDraw.toLocaleString()}`}.`,
    };
  }

  const client = new Anthropic();
  const res = await client.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 800,
    output_config: { format: { type: "json_schema", schema: DECISION_SCHEMA } },
    system:
      "You are the treasury risk agent for a real-estate bridge-liquidity protocol. " +
      "You release stablecoin liquidity against tokenized home equity. Only approve when the borrower is a verified unique human (World ID) and the requested draw stays within 70% loan-to-value of the locked equity. Be concise.",
    messages: [
      {
        role: "user",
        content: JSON.stringify({
          worldIdVerifiedHuman: input.kyc.verified,
          jurisdiction: input.kyc.jurisdiction,
          vptEur: input.vpt,
          collateralPct: input.collateralPct,
          lockedEquityEur: lockedEquity,
          requestedDrawUsdc: input.drawAmount,
          impliedLtv: ltv,
          houseTokenId: input.tokenId,
        }),
      },
    ],
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
      scheduleId: "",
      transactionId: "",
      amountUsdc: input.drawAmount,
      status: "scheduled",
      agentRationale: decision.rationale,
    };
  }

  // Agent executes the payment on Hedera as a Scheduled Transaction.
  const sched = await scheduleUsdcDisbursement({
    toAccountId: input.accountId,
    amountUsdc: input.drawAmount,
  });

  return {
    approved: true,
    scheduleId: sched.scheduleId,
    transactionId: sched.transactionId,
    amountUsdc: input.drawAmount,
    status: sched.demo ? "scheduled" : "executed",
    agentRationale: decision.rationale,
  };
}
