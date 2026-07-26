"use client";

import { useEffect, useState } from "react";
import type { Locale } from "@/lib/i18n";
import { PrimaryButton, SecondaryButton } from "@/components/bridge/ui";

/** Repay any amount, in full or in part — a portion via the slider, or the
 * full balance in one click. Each partial payment releases collateral to your
 * wallet proportionally; repaying in full burns whatever collateral remains. */
export default function RepayPanel({
  lang, vaultId, owedUsdc, onRepaid,
}: {
  lang: Locale;
  vaultId: string;
  owedUsdc: number;
  onRepaid: () => void | Promise<void>;
}) {
  const [amount, setAmount] = useState(owedUsdc);
  const [minUsdc, setMinUsdc] = useState(0);
  const [repaying, setRepaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // `owedUsdc` is a prop, not just an initial value — the parent refetches it
  // (e.g. right after a repay, or as interest accrues), so the slider/input must
  // track it instead of freezing at whatever was owed when this panel first mounted.
  useEffect(() => {
    setAmount(owedUsdc);
    setMinUsdc(0);
  }, [vaultId, owedUsdc]);

  const fmt = (n: number) => n.toLocaleString(lang === "en" ? "en-US" : "pt-PT", { maximumFractionDigits: 2 });

  const t = lang === "en"
    ? {
        title: "Repay", sub: "Repay any amount — a portion or the full balance. Partial payments release collateral proportionally; a full payoff burns what's left.",
        full: "Repay in full", owed: "Owed now", repay: "Repay", repaying: "Repaying…",
        belowInterest: "That amount doesn't cover interest accrued so far — raised to the minimum.",
        err: "Something went wrong. Try again.",
        settled: "Nothing owed — this loan is fully settled.",
      }
    : {
        title: "Reembolsar", sub: "Reembolse qualquer valor — uma parte ou o saldo total. Pagamentos parciais libertam garantia proporcionalmente; a liquidação total queima o que resta.",
        full: "Reembolsar tudo", owed: "Em dívida agora", repay: "Reembolsar", repaying: "A reembolsar…",
        belowInterest: "Esse valor não cobre os juros acumulados — ajustado para o mínimo.",
        err: "Algo correu mal. Tente novamente.",
        settled: "Nada em dívida — este empréstimo está totalmente liquidado.",
      };

  if (owedUsdc <= 0) {
    return (
      <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200/70 dark:bg-[var(--color-card)] dark:ring-slate-700 sm:p-8">
        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">{t.title}</h2>
        <p className="mt-1 text-sm text-emerald-600 dark:text-emerald-400">✓ {t.settled}</p>
      </div>
    );
  }

  const repay = async () => {
    setError(null);
    setRepaying(true);
    try {
      const res = await fetch("/api/sui/repay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vaultId, amount }),
      });
      const json = await res.json();
      if (!res.ok) {
        if (json.error === "below_accrued_interest" && json.minUsdc) {
          setMinUsdc(json.minUsdc);
          setAmount(json.minUsdc);
          setError(t.belowInterest);
        } else {
          setError(t.err);
        }
        return;
      }
      await onRepaid();
    } catch {
      setError(t.err);
    } finally {
      setRepaying(false);
    }
  };

  return (
    <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200/70 dark:bg-[var(--color-card)] dark:ring-slate-700 sm:p-8">
      <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">{t.title}</h2>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t.sub}</p>

      <div className="mt-5 space-y-3">
        <input
          type="range"
          min={minUsdc}
          max={Math.max(owedUsdc, minUsdc)}
          step={0.01}
          value={amount}
          onChange={(e) => setAmount(Number(e.target.value))}
          className="w-full accent-[var(--color-primary)]"
        />
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
            <input
              type="number"
              min={minUsdc}
              max={owedUsdc}
              step={0.01}
              value={amount}
              onChange={(e) => setAmount(Math.min(owedUsdc, Math.max(minUsdc, Number(e.target.value) || 0)))}
              className="h-11 w-full rounded-lg border border-[var(--color-border)] bg-white pl-7 pr-3 text-sm outline-none focus:border-[var(--color-primary)] dark:bg-slate-900"
            />
          </div>
          <SecondaryButton onClick={() => setAmount(owedUsdc)}>{t.full}</SecondaryButton>
        </div>
        <p className="text-xs text-slate-400">{t.owed}: ${fmt(owedUsdc)}</p>
      </div>

      <div className="mt-5">
        <PrimaryButton onClick={repay} disabled={repaying || amount <= 0}>
          {repaying ? t.repaying : `↩ ${t.repay} $${fmt(amount)}`}
        </PrimaryButton>
        {error && <p className="mt-2 text-sm text-[var(--color-danger)]">{error}</p>}
      </div>
    </div>
  );
}
