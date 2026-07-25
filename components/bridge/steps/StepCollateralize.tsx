"use client";

import { useMemo, useState } from "react";
import type { StepProps } from "../BridgeWizard";
import { StepHeading, Card, PrimaryButton, SecondaryButton } from "../ui";

export default function StepCollateralize({ lang, session, patch, next, back, canBack }: StepProps) {
  const vpt = session.property?.vpt ?? 0;
  const [pct, setPct] = useState(session.collateralPct ?? 0.3);

  const lockedEquity = Math.round(vpt * pct);
  const maxDraw = Math.floor(lockedEquity * 0.7);
  const [draw, setDraw] = useState(session.drawAmount ?? Math.floor(lockedEquity * 0.5));

  const clampedDraw = useMemo(() => Math.min(draw, maxDraw), [draw, maxDraw]);

  const t = lang === "en"
    ? {
        kicker: "Step 6", title: "Collateralize & draw",
        sub: "Lock a fraction of your HOUSE equity as collateral, and choose how much to draw. The next step has you sign a debt acknowledgement before the treasury AI agent disburses it.",
        collateral: "Collateral locked", locked: "Locked equity", draw: "Draw (USDC)", max: "Max (70% LTV)",
        run: "Review & sign the termo", back: "Back",
      }
    : {
        kicker: "Passo 6", title: "Colateralizar & levantar",
        sub: "Bloqueie uma fração do seu capital HOUSE como garantia e escolha quanto levantar. No passo seguinte assina um reconhecimento de dívida antes de o agente de IA da tesouraria transferir os fundos.",
        collateral: "Garantia bloqueada", locked: "Capital bloqueado", draw: "Levantar (USDC)", max: "Máx (70% LTV)",
        run: "Rever e assinar o termo", back: "Voltar",
      };

  const fmt = (n: number) => n.toLocaleString(lang === "en" ? "en-US" : "pt-PT");

  const run = () => {
    patch({ collateralPct: pct, drawAmount: clampedDraw });
    next();
  };

  return (
    <div>
      <StepHeading kicker={t.kicker} title={t.title} subtitle={t.sub} />
      <Card>
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
            <PrimaryButton onClick={run} disabled={clampedDraw <= 0}>{t.run} →</PrimaryButton>
            {canBack && <SecondaryButton onClick={back}>← {t.back}</SecondaryButton>}
          </div>
        </div>
      </Card>
    </div>
  );
}
