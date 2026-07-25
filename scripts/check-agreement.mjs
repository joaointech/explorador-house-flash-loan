#!/usr/bin/env node
/**
 * Runnable check for the agreement gate in app/api/agent/disburse/route.ts.
 *
 * Verifies the thing that actually guards money: no signed Termo de Reconhecimento
 * e Confissão de Dívida → no disbursement, and a signature only authorizes the exact
 * amount + account it was signed for.
 *
 * Requires a running dev server (`npm run dev`) with NEXT_PUBLIC_WORLD_SANDBOX=1 set, so the
 * World ID gate can be satisfied without a real proof:
 *
 *   NEXT_PUBLIC_WORLD_SANDBOX=1 npm run dev
 *   node scripts/check-agreement.mjs
 */

const BASE = process.env.BASE_URL || "http://localhost:3000";
const rnd = () => "0x" + Array.from({ length: 40 }, () => Math.floor(Math.random() * 16).toString(16)).join("");

async function post(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: res.status, json: await res.json().catch(() => ({})) };
}

async function assert(cond, message) {
  if (!cond) throw new Error(`FAIL: ${message}`);
  console.log(`ok — ${message}`);
}

async function sandboxKycToken() {
  const identity = await post("/api/worldid/verify", { credential: "identity", result: {} });
  if (identity.status !== 200) {
    throw new Error(
      `Could not get a sandbox KYC token (${identity.status} ${JSON.stringify(identity.json)}). ` +
        `Start the dev server with NEXT_PUBLIC_WORLD_SANDBOX=1.`,
    );
  }
  const selfie = await post("/api/worldid/verify", { credential: "selfie", result: {}, token: identity.json.token });
  return selfie.json.token;
}

async function main() {
  const kycToken = await sandboxKycToken();
  const accountId = rnd();
  const article = "TEST-" + Date.now();
  const amountEur = 5000;

  // 1. No agreement signed yet → disburse must be refused.
  const vaultA = rnd();
  const noAgreement = await post("/api/agent/disburse", {
    vpt: 100000, collateralPct: 0.3, drawAmount: amountEur,
    kycToken, accountId, vaultId: vaultA, article,
  });
  await assert(
    noAgreement.status === 403 && noAgreement.json.error === "agreement_required",
    "disburse without a signed agreement is rejected (agreement_required)",
  );

  // 2. Sign for `amountEur`, then try to disburse 2x that amount on the same vault.
  const vaultB = rnd();
  const signed = await post("/api/agreement/sign", {
    vaultId: vaultB, accountId, amountEur, article, nome: "Test Borrower", phone: "912345678",
  });
  await assert(signed.status === 200 && signed.json.agreement?.id, "signing the termo succeeds");

  const mismatched = await post("/api/agent/disburse", {
    vpt: 100000, collateralPct: 0.3, drawAmount: amountEur * 2,
    kycToken, accountId, vaultId: vaultB, article,
  });
  await assert(
    mismatched.status === 403 && mismatched.json.error === "agreement_mismatch",
    "disbursing a different amount than was signed is rejected (agreement_mismatch)",
  );

  // 3. Disburse the exact signed amount on the same vault → should go through.
  const matched = await post("/api/agent/disburse", {
    vpt: 100000, collateralPct: 0.3, drawAmount: amountEur,
    kycToken, accountId, vaultId: vaultB, article,
  });
  await assert(
    matched.status === 200 && matched.json.disbursement?.status === "executed",
    "disbursing the exact signed amount succeeds",
  );

  console.log("\nAll checks passed.");
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
