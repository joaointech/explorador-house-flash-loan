import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { disburse } from "./sui";
import type { Disbursement, KycResult } from "./types";

/**
 * The treasury AI agent.
 *
 * Given a collateral position + a World-ID-verified unique human, the agent
 * decides whether to release liquidity and then EXECUTES it on Sui — recording
 * the draw on the CollateralVault (lock_and_draw) and transferring stablecoin —
 * in a single programmable transaction. It only ever acts on behalf of a
 * verified human (the World AgentKit "human-backed agent" requirement).
 *
 * Reasoning runs on Claude (structured output). Without a key it falls back to
 * a deterministic policy so the demo still executes end-to-end.
 */

type AgentInput = {
  vpt: number;
  collateralPct: number; // fraction of equity locked (0..1)
  drawAmount: number; // requested USDC
  kyc: KycResult;
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

  if (!process.env.ANTHROPIC_API_KEY) {
    const approve = input.kyc.verified && input.drawAmount <= maxDraw && input.drawAmount > 0;
    return {
      approve,
      maxDraw,
      rationale: approve
        ? `Approved: borrower is a World-ID-verified unique human in ${input.kyc.jurisdiction ?? "PT"}; requested €${input.drawAmount.toLocaleString()} is ${(ltv * 100).toFixed(0)}% LTV against €${lockedEquity.toLocaleString()} locked equity, within the 70% policy.`
        : `Declined: ${!input.kyc.verified ? "KYC not verified" : `€${input.drawAmount.toLocaleString()} exceeds the 70% LTV cap of €${maxDraw.toLocaleString()}`}.`,
    };
  }

  const client = new Anthropic();
  const res = await client.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 800,
    output_config: { format: { type: "json_schema", schema: DECISION_SCHEMA } },
    system:
      "You are the treasury risk agent for a real-estate bridge-liquidity protocol on Sui. " +
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
          vaultId: input.vaultId,
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
