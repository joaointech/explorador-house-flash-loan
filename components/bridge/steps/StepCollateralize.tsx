"use client";

import { useMemo, useState } from "react";
import type { StepProps } from "../BridgeWizard";
import type { Disbursement } from "@/lib/types";
import { suiscanTx, onChain } from "@/lib/types";
import { StepHeading, Card, PrimaryButton, SecondaryButton, Badge, Spinner, ProofRow } from "../ui";

export default function StepCollateralize({ lang, session, patch, next, back, canBack }: StepProps) {
  const vpt = session.property?.vpt ?? 0;
  const [pct, setPct] = useState(session.collateralPct ?? 0.3);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Disbursement | null>(session.disbursement ?? null);

  const lockedEquity = Math.round(vpt * pct);
  const maxDraw = Math.floor(lockedEquity * 0.7);
  const [draw, setDraw] = useState(session.drawAmount ?? Math.floor(lockedEquity * 0.5));

  const clampedDraw = useMemo(() => Math.min(draw, maxDraw), [draw, maxDraw]);

  const t = lang === "en"
    ? {
        kicker: "Step 5", title: "Collateralize & draw",
        sub: "Lock a fraction of your HOUSE equity as collateral. The treasury AI agent verifies your collateral and World-ID human, then autonomously records the draw on the vault and transfers USDC — one Sui transaction.",
        collateral: "Collateral locked", locked: "Locked equity", draw: "Draw (USDC)", max: "Max (70% LTV)",
        run: "Lock & request liquidity", running: "Agent evaluating & disbursing…",
        agent: "Treasury AI agent", approved: "Approved & executed", declined: "Declined",
        tx: "Sui tx", amount: "Disbursed", cont: "Continue", back: "Back", retry: "Adjust",
        err: "Something went wrong. Try again.",
      }
    : {
        kicker: "Passo 5", title: "Colateralizar & levantar",
        sub: "Bloqueie uma fração do seu capital HOUSE como garantia. O agente de IA da tesouraria valida a garantia e o humano-World-ID, regista o levantamento no vault e transfere USDC autonomamente — uma transação Sui.",
        collateral: "Garantia bloqueada", locked: "Capital bloqueado", draw: "Levantar (USDC)", max: "Máx (70% LTV)",
        run: "Bloquear & pedir liquidez", running: "Agente a avaliar & pagar…",
        agent: "Agente IA da tesouraria", approved: "Aprovado & executado", declined: "Recusado",
        tx: "Transação Sui", amount: "Transferido", cont: "Continuar", back: "Voltar", retry: "Ajustar",
        err: "Algo correu mal. Tente novamente.",
      };

  const fmt = (n: number) => n.toLocaleString(lang === "en" ? "en-US" : "pt-PT");

  const run = async () => {
    setLoading(true); setError(null);
    patch({ collateralPct: pct, drawAmount: clampedDraw });
    try {
      const res = await fetch("/api/agent/disburse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vpt, collateralPct: pct, drawAmount: clampedDraw,
          kyc: session.kyc, accountId: session.accountId, vaultId: session.token?.vaultId,
          article: session.property?.artigoMatricial, morada: session.property?.morada, coinType: session.token?.coinType,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "disburse_failed");
      setResult(json.disbursement);
      patch({ disbursement: json.disbursement });
    } catch {
      setError(t.err);
    } finally {
      setLoading(false);
    }
  };

  const approved = result && result.status === "executed";

  return (
    <div>
      <StepHeading kicker={t.kicker} title={t.title} subtitle={t.sub} />
      <Card>
        {result ? (
          <div className="space-y-4">
            <Badge tone={approved ? "green" : "amber"}>🤖 {approved ? t.approved : t.declined}</Badge>
            <div className="rounded-2xl border border-[var(--color-border)] bg-stone-50/60 p-4 text-sm leading-relaxed text-slate-700 dark:bg-slate-800/40 dark:text-slate-200">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">{t.agent}</p>
              {result.agentRationale}
            </div>
            {approved && (
              <div className="space-y-2">
                <ProofRow label={t.amount} value={`$${fmt(result.amountUsdc)} ${result.asset}`} mono={false} />
                <ProofRow label={t.tx} value={result.digest} href={onChain(result.digest) ? suiscanTx(result.digest) : undefined} />
              </div>
            )}
            <div className="flex items-center gap-3 pt-1">
              {!approved && <SecondaryButton onClick={() => setResult(null)}>{t.retry}</SecondaryButton>}
              {approved && <PrimaryButton onClick={next}>{t.cont} →</PrimaryButton>}
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div>
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-slate-700 dark:text-slate-300">{t.collateral}</span>
                <span className="font-mono text-[var(--color-primary)]">{Math.round(pct * 100)}%</span>
              </div>
              <input type="range" min={10} max={80} value={Math.round(pct * 100)} onChange={(e) => setPct(Number(e.target.value) / 100)} className="mt-2 w-full accent-[var(--color-primary)]" />
              <p className="mt-1 text-xs text-slate-500">{t.locked}: €{fmt(lockedEquity)}</p>
            </div>
            <div>
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-slate-700 dark:text-slate-300">{t.draw}</span>
                <span className="font-mono text-[var(--color-primary)]">${fmt(clampedDraw)}</span>
              </div>
              <input type="range" min={0} max={maxDraw} step={1000} value={clampedDraw} onChange={(e) => setDraw(Number(e.target.value))} className="mt-2 w-full accent-[var(--color-primary)]" />
              <p className="mt-1 text-xs text-slate-500">{t.max}: ${fmt(maxDraw)}</p>
            </div>
            <div className="flex items-center gap-3">
              <PrimaryButton onClick={run} disabled={loading || clampedDraw <= 0}>
                {loading ? <><Spinner /> <span className="ml-2">{t.running}</span></> : `🤖 ${t.run}`}
              </PrimaryButton>
              {canBack && <SecondaryButton onClick={back}>← {t.back}</SecondaryButton>}
            </div>
            {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}
          </div>
        )}
      </Card>
    </div>
  );
}
