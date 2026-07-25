"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import YieldLab from "@/components/YieldLab";
import { useWallet } from "@/components/WalletProvider";
import type { Locale } from "@/lib/i18n";
import { suiscanTx, suiscanObject, suiscanCoin, onChain } from "@/lib/types";

type Loan = {
  vaultId: string;
  owner: string;
  article: string;
  morada?: string;
  vpt: number;
  drawnUsdc: number;
  collateralPct: number;
  coinType: string;
  disburseDigest: string;
  repayDigest?: string;
  status: "active" | "repaid";
  live?: {
    drawnUsdc: number;
    locked: number;
    repaid: boolean;
    vpt: number;
    rateBps?: number;
    drawnAtMs?: number;
    interestUsdc?: number;
    owedUsdc?: number;
  } | null;
};

type Treasury = { address: string; suiBalance: number; eusdSupply: number };
type Pool = { capacity: number; totalDrawn: number; utilizationBps: number; currentRateBps: number; totalInterest: number };

const short = (a: string) => (a && a.length > 16 ? `${a.slice(0, 8)}…${a.slice(-6)}` : a || "—");

/** Read-only protocol view: treasury + pool health and every loan. Repayment
 * lives on the borrower's own account page (components/DashboardView.tsx). */
export default function LoansView({ lang }: { lang: Locale }) {
  const { accountId } = useWallet();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [treasury, setTreasury] = useState<Treasury | null>(null);
  const [pool, setPool] = useState<Pool | null>(null);
  const [loading, setLoading] = useState(true);

  const fmt = (n: number) => n.toLocaleString(lang === "en" ? "en-US" : "pt-PT");
  const pct = (bps: number) => `${(bps / 100).toFixed(bps % 100 === 0 ? 0 : 2)}%`;

  const t = lang === "en"
    ? {
        title: "Loan management", sub: "Every bridge position, live from Sui. Visit your account page to repay one of yours.",
        empty: "No loans yet.", start: "Start the loan", myAccount: "Your account",
        treasury: "Treasury", tSui: "SUI balance", tEusd: "eUSD minted", tAddr: "Address",
        util: "Pool utilization", curRate: "borrow APR now", yieldEarned: "Yield earned",
        rate: "Borrow APR", interest: "Interest accrued", owed: "Owed now", proj90: "≈ interest if held 90 days",
        property: "Property", drawn: "Drawn", collateral: "Collateral", vaultL: "Vault", coinL: "HOUSE coin", disburseL: "Disbursement", repayL: "Repayment",
        active: "Active", repaid: "Repaid",
      }
    : {
        title: "Gestão de empréstimos", sub: "Todas as posições-ponte, em tempo real na Sui. Visite a sua conta para reembolsar uma sua.",
        empty: "Ainda não há empréstimos.", start: "Iniciar o empréstimo", myAccount: "A sua conta",
        treasury: "Tesouraria", tSui: "Saldo SUI", tEusd: "eUSD emitido", tAddr: "Endereço",
        util: "Utilização do pool", curRate: "TAN agora", yieldEarned: "Rendimento gerado",
        rate: "TAN", interest: "Juros acumulados", owed: "Em dívida agora", proj90: "≈ juros se mantido 90 dias",
        property: "Imóvel", drawn: "Levantado", collateral: "Garantia", vaultL: "Vault", coinL: "Moeda HOUSE", disburseL: "Pagamento", repayL: "Reembolso",
        active: "Ativo", repaid: "Reembolsado",
      };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/sui/loans");
      const json = await res.json();
      setLoans(json.loans ?? []);
      setTreasury(json.treasury ?? null);
      setPool(json.pool ?? null);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 sm:text-3xl">{t.title}</h1>
      <p className="mt-1 max-w-2xl text-slate-600 dark:text-slate-400">{t.sub}</p>

      {/* Live yield + market maker */}
      <div className="mt-6">
        <YieldLab lang={lang} />
      </div>

      {/* Treasury summary */}
      {treasury && (
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl bg-gradient-to-br from-[var(--color-primary)] to-blue-700 p-5 text-white sm:col-span-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-white/70">{t.treasury}</p>
            <p className="mt-1 truncate font-mono text-sm">{short(treasury.address)}</p>
          </div>
          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/70 dark:bg-[var(--color-card)] dark:ring-slate-700">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{t.tEusd}</p>
            <p className="mt-1 text-2xl font-bold text-[var(--color-primary)]">${fmt(Math.round(treasury.eusdSupply))}</p>
          </div>
          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/70 dark:bg-[var(--color-card)] dark:ring-slate-700">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{t.tSui}</p>
            <p className="mt-1 text-2xl font-bold text-slate-800 dark:text-slate-100">{treasury.suiBalance.toFixed(2)}</p>
          </div>
        </div>
      )}

      {/* Money-market: utilization drives the borrow rate; interest is protocol yield. */}
      {pool && (
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/70 dark:bg-[var(--color-card)] dark:ring-slate-700">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{t.util}</p>
            <p className="mt-1 text-2xl font-bold text-slate-800 dark:text-slate-100">{pct(pool.utilizationBps)}</p>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
              <div className="h-full rounded-full bg-[var(--color-primary)]" style={{ width: `${Math.min(100, pool.utilizationBps / 100)}%` }} />
            </div>
            <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">${fmt(pool.totalDrawn)} / ${fmt(pool.capacity)}</p>
          </div>
          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/70 dark:bg-[var(--color-card)] dark:ring-slate-700">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{t.curRate}</p>
            <p className="mt-1 text-2xl font-bold text-[var(--color-primary)]">{pct(pool.currentRateBps)}</p>
          </div>
          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/70 dark:bg-[var(--color-card)] dark:ring-slate-700">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{t.yieldEarned}</p>
            <p className="mt-1 text-2xl font-bold text-emerald-600 dark:text-emerald-400">${fmt(Number(pool.totalInterest.toFixed(2)))}</p>
          </div>
        </div>
      )}

      {/* Loans */}
      <div className="mt-8 space-y-4">
        {loading ? (
          <p className="text-sm text-slate-500">…</p>
        ) : loans.length === 0 ? (
          <div className="rounded-3xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-200/70 dark:bg-[var(--color-card)] dark:ring-slate-700">
            <p className="text-slate-600 dark:text-slate-400">{t.empty}</p>
            <Link href={`/${lang}/loan`} className="mt-4 inline-flex h-11 items-center justify-center rounded-lg bg-[var(--color-primary)] px-6 text-sm font-semibold text-white transition hover:bg-blue-700">
              {t.start} →
            </Link>
          </div>
        ) : (
          loans.map((l) => {
            const drawn = l.live?.drawnUsdc ?? l.drawnUsdc;
            const isRepaid = l.status === "repaid" || l.live?.repaid;
            const rateBps = l.live?.rateBps ?? 0;
            const interest = l.live?.interestUsdc ?? 0;
            const owedNow = l.live?.owedUsdc ?? drawn;
            // Tangible figure for a demo where live elapsed time is only seconds.
            const proj90 = (drawn * rateBps * 90) / (10000 * 365);
            const isMine = accountId && l.owner === accountId;
            return (
              <div key={l.vaultId} className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200/70 dark:bg-[var(--color-card)] dark:ring-slate-700 sm:p-7">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">{l.morada || `${t.property} ${l.article}`}</h3>
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${isRepaid ? "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"}`}>
                        {isRepaid ? t.repaid : t.active}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      {t.property} {l.article} · VPT €{fmt(l.vpt)} · {t.collateral} {Math.round(l.collateralPct * 100)}%
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{t.drawn}</p>
                    <p className="text-2xl font-bold text-[var(--color-primary)]">${fmt(drawn)}</p>
                  </div>
                </div>

                {/* Money-market position: rate priced at draw, interest accruing by time held. */}
                {!isRepaid && rateBps > 0 && (
                  <div className="mt-4 grid grid-cols-2 gap-3 rounded-2xl bg-slate-50 p-4 dark:bg-slate-800/40 sm:grid-cols-3">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{t.rate}</p>
                      <p className="mt-0.5 text-lg font-bold text-slate-800 dark:text-slate-100">{pct(rateBps)}</p>
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{t.interest}</p>
                      <p className="mt-0.5 text-lg font-bold text-emerald-600 dark:text-emerald-400">${interest.toFixed(2)}</p>
                      <p className="text-[11px] text-slate-400">{t.proj90}: ${fmt(Math.round(proj90))}</p>
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{t.owed}</p>
                      <p className="mt-0.5 text-lg font-bold text-slate-800 dark:text-slate-100">${fmt(Number(owedNow.toFixed(2)))}</p>
                    </div>
                  </div>
                )}

                <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-xs">
                  <a href={onChain(l.vaultId) ? suiscanObject(l.vaultId) : undefined} target="_blank" rel="noreferrer" className="text-[var(--color-primary)] hover:underline">{t.vaultL} ↗</a>
                  <a href={onChain(l.disburseDigest) ? suiscanTx(l.disburseDigest) : undefined} target="_blank" rel="noreferrer" className="text-[var(--color-primary)] hover:underline">{t.disburseL} ↗</a>
                  {l.coinType && onChain(l.coinType) && <a href={suiscanCoin(l.coinType)} target="_blank" rel="noreferrer" className="text-[var(--color-primary)] hover:underline">{t.coinL} ↗</a>}
                  {l.repayDigest && onChain(l.repayDigest) && <a href={suiscanTx(l.repayDigest)} target="_blank" rel="noreferrer" className="text-emerald-600 hover:underline dark:text-emerald-400">{t.repayL} ↗</a>}
                </div>

                {!isRepaid && isMine && (
                  <div className="mt-5">
                    <Link href={`/${lang}/dashboard`} className="inline-flex h-11 items-center justify-center rounded-lg bg-[var(--color-primary)] px-6 text-sm font-semibold text-white transition hover:bg-blue-700">
                      {t.myAccount} →
                    </Link>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
