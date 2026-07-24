"use client";

import Link from "next/link";
import { useState } from "react";
import type { StepProps } from "../BridgeWizard";
import { StepHeading, Card, PrimaryButton, SecondaryButton, Badge, Spinner, ProofRow } from "../ui";

export default function StepWithdraw({ lang, session, back, canBack }: StepProps) {
  const [withdrawn, setWithdrawn] = useState(false);
  const [loading, setLoading] = useState(false);
  const amount = session.disbursement?.amountUsdc ?? 0;

  const t = lang === "en"
    ? {
        kicker: "Step 6", title: "Withdraw your liquidity",
        sub: "Your USDC has been disbursed to your account. Withdraw it to fund the new home's CPCV signal.",
        available: "Available to withdraw", to: "To account", withdraw: "Withdraw USDC", withdrawing: "Withdrawing…",
        done: "Withdrawn — you're ready for the CPCV", terms: "Repaid automatically when your old house sells; the house tokens are then released.",
        dash: "Go to dashboard", back: "Back",
      }
    : {
        kicker: "Passo 6", title: "Levante a sua liquidez",
        sub: "O seu USDC foi transferido para a sua conta. Levante-o para o sinal do CPCV da casa nova.",
        available: "Disponível para levantar", to: "Para a conta", withdraw: "Levantar USDC", withdrawing: "A levantar…",
        done: "Levantado — está pronto para o CPCV", terms: "Reembolsado automaticamente quando a casa antiga vender; os tokens do imóvel são então libertados.",
        dash: "Ir para o painel", back: "Voltar",
      };

  const fmt = (n: number) => n.toLocaleString(lang === "en" ? "en-US" : "pt-PT");

  const withdraw = async () => {
    setLoading(true);
    await new Promise((r) => setTimeout(r, 900)); // funds are already in the account; this confirms receipt
    setWithdrawn(true);
    setLoading(false);
  };

  return (
    <div>
      <StepHeading kicker={t.kicker} title={t.title} subtitle={t.sub} />
      <Card>
        {withdrawn ? (
          <div className="space-y-4 text-center">
            <div className="text-5xl">🎉</div>
            <Badge tone="green">✓ {t.done}</Badge>
            <p className="mx-auto max-w-md text-sm leading-relaxed text-slate-600 dark:text-slate-400">{t.terms}</p>
            <div className="pt-2">
              <Link href={`/${lang}/dashboard`}>
                <PrimaryButton>{t.dash} →</PrimaryButton>
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 p-6 text-white">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/70">{t.available}</p>
              <p className="mt-2 text-4xl font-bold">${fmt(amount)} USDC</p>
            </div>
            <ProofRow label={t.to} value={session.accountId ?? "—"} />
            <div className="flex items-center gap-3">
              {canBack && <SecondaryButton onClick={back}>← {t.back}</SecondaryButton>}
              <PrimaryButton onClick={withdraw} disabled={loading || amount <= 0}>
                {loading ? <><Spinner /> <span className="ml-2">{t.withdrawing}</span></> : `💸 ${t.withdraw}`}
              </PrimaryButton>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
