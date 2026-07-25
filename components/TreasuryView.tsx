"use client";

import { useCallback, useEffect, useState } from "react";
import type { Locale } from "@/lib/i18n";
import { suiscanAccount, suiscanCoin, onChain } from "@/lib/types";

type Bal = { coinType: string; symbol: string; amount: number };
type Treasury = { address: string; suiBalance: number; eusdSupply: number; balances: Bal[]; demo: boolean };
type Pool = { capacity: number; totalDrawn: number; utilizationBps: number; currentRateBps: number; totalInterest: number };

const short = (a: string) => (a && a.length > 16 ? `${a.slice(0, 10)}…${a.slice(-8)}` : a || "—");

export default function TreasuryView({ lang }: { lang: Locale }) {
  const en = lang === "en";
  const [treasury, setTreasury] = useState<Treasury | null>(null);
  const [pool, setPool] = useState<Pool | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/sui/treasury", { cache: "no-store" });
      const j = await r.json();
      setTreasury(j.treasury ?? null);
      setPool(j.pool ?? null);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); const id = setInterval(load, 5000); return () => clearInterval(id); }, [load]);

  const fmt = (n: number, d = 0) => n.toLocaleString(en ? "en-US" : "pt-PT", { maximumFractionDigits: d });
  const pct = (bps: number) => `${(bps / 100).toFixed(2)}%`;

  const t = en
    ? { title: "Treasury", sub: "The protocol treasury wallet on Sui — it holds the lending pool, mints eUSD for disbursements, and receives repayments.",
        addr: "Treasury address", holdings: "Wallet holdings", view: "View on Suiscan", pool: "Lending pool",
        capacity: "Capacity", util: "Utilization", rate: "Borrow APR now", yield: "Yield earned",
        lentOut: "Currently lent out", minted: "eUSD minted all-time (demo settlement)", empty: "No balances." }
    : { title: "Tesouraria", sub: "A carteira da tesouraria do protocolo na Sui — detém o pool de crédito, emite eUSD para desembolsos e recebe reembolsos.",
        addr: "Endereço da tesouraria", holdings: "Saldos da carteira", view: "Ver na Suiscan", pool: "Pool de crédito",
        capacity: "Capacidade", util: "Utilização", rate: "TAN agora", yield: "Rendimento gerado",
        lentOut: "Atualmente emprestado", minted: "eUSD emitido no total (liquidação demo)", empty: "Sem saldos." };

  const card = "rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/70 dark:bg-[var(--color-card)] dark:ring-slate-700";
  const stat = (label: string, value: string, tone?: "primary" | "emerald") => (
    <div className={card}>
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${tone === "emerald" ? "text-emerald-600 dark:text-emerald-400" : tone === "primary" ? "text-[var(--color-primary)]" : "text-slate-800 dark:text-slate-100"}`}>{value}</p>
    </div>
  );

  const symFmt = (b: Bal) => (b.symbol === "SUI" || b.symbol === "WAL" ? fmt(b.amount, 4) : fmt(b.amount, b.symbol === "EUSD" ? 2 : 0));

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 sm:text-3xl">🏦 {t.title}</h1>
      <p className="mt-1 max-w-2xl text-slate-600 dark:text-slate-400">{t.sub}</p>

      {/* Address */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-gradient-to-br from-[var(--color-primary)] to-blue-700 p-5 text-white">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-white/70">{t.addr}</p>
          <p className="mt-1 truncate font-mono text-sm">{treasury ? short(treasury.address) : "…"}</p>
        </div>
        {treasury && onChain(treasury.address) && (
          <a href={suiscanAccount(treasury.address)} target="_blank" rel="noreferrer" className="rounded-lg bg-white/15 px-4 py-2 text-sm font-semibold hover:bg-white/25">{t.view} ↗</a>
        )}
      </div>

      {/* Pool */}
      <h2 className="mt-8 mb-3 text-lg font-bold text-slate-800 dark:text-slate-100">{t.pool}</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stat(t.capacity, `€${fmt(pool?.capacity ?? 1_000_000)}`)}
        {stat(t.util, pct(pool?.utilizationBps ?? 0))}
        {stat(t.rate, pct(pool?.currentRateBps ?? 200), "primary")}
        {stat(t.yield, `€${fmt(pool?.totalInterest ?? 0, 2)}`, "emerald")}
      </div>
      <div className="mt-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/70 dark:bg-[var(--color-card)] dark:ring-slate-700">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{t.lentOut}</p>
        <p className="mt-1 text-2xl font-bold text-slate-800 dark:text-slate-100">€{fmt(pool?.totalDrawn ?? 0)}</p>
        <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">{t.minted}: {fmt(treasury?.eusdSupply ?? 0, 0)} eUSD</p>
      </div>

      {/* Holdings */}
      <h2 className="mt-8 mb-3 text-lg font-bold text-slate-800 dark:text-slate-100">{t.holdings}</h2>
      <div className={card}>
        {loading ? (
          <p className="text-sm text-slate-500">…</p>
        ) : !treasury || treasury.balances.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">{t.empty}</p>
        ) : (
          <div>
            {treasury.balances.map((b) => (
              <div key={b.coinType} className="flex items-center justify-between gap-3 border-b border-[var(--color-border)] py-3 last:border-0">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="inline-flex h-8 w-8 flex-none items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600 dark:bg-slate-700 dark:text-slate-200">{b.symbol.slice(0, 3)}</span>
                  <div className="min-w-0">
                    {onChain(b.coinType) ? (
                      <a href={suiscanCoin(b.coinType)} target="_blank" rel="noreferrer" className="text-sm font-medium text-[var(--color-primary)] hover:underline">{b.symbol} ↗</a>
                    ) : (
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{b.symbol}</span>
                    )}
                    <p className="truncate font-mono text-[11px] text-slate-400 dark:text-slate-500">{b.coinType.replace(/^0x/, "").slice(0, 8)}…::{b.symbol}</p>
                  </div>
                </div>
                <span className="font-mono text-sm font-semibold text-slate-800 dark:text-slate-100">{symFmt(b)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
