"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { IDKitRequestWidget, selfieCheckLegacy, IDKitErrorCodes } from "@worldcoin/idkit";
import { useWallet } from "@/components/WalletProvider";
import type { Locale } from "@/lib/i18n";
import { suiscanTx, suiscanObject, suiscanCoin, onChain, WORLD_ACTIONS } from "@/lib/types";
import { fetchRpContext, submitProof, type RpContext } from "@/lib/worldid-client";

const APP_ID = (process.env.NEXT_PUBLIC_WORLD_APP_ID || "app_") as `app_${string}`;

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
  live?: { drawnUsdc: number; locked: number; repaid: boolean; vpt: number } | null;
};

type Treasury = { address: string; suiBalance: number; eusdSupply: number };

const short = (a: string) => (a && a.length > 16 ? `${a.slice(0, 8)}…${a.slice(-6)}` : a || "—");

export default function LoansView({ lang }: { lang: Locale }) {
  const { accountId } = useWallet();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [treasury, setTreasury] = useState<Treasury | null>(null);
  const [loading, setLoading] = useState(true);
  const [repaying, setRepaying] = useState<string | null>(null);
  // Continuity re-auth: the vault awaiting a Selfie Check before we'll repay it.
  const [gateVault, setGateVault] = useState<string | null>(null);
  const [gateCtx, setGateCtx] = useState<RpContext | null>(null);
  // Keyed by vault so the message stays attached to its card after the gate closes.
  const [gateError, setGateError] = useState<{ vaultId: string; msg: string } | null>(null);

  const fmt = (n: number) => n.toLocaleString(lang === "en" ? "en-US" : "pt-PT");

  const t = lang === "en"
    ? {
        title: "Loan management", sub: "Active bridge positions, live from Sui. Repay to settle the eUSD draw and release the collateral back to the owner.",
        empty: "No loans yet.", start: "Start the bridge",
        treasury: "Treasury", tSui: "SUI balance", tEusd: "eUSD minted", tAddr: "Address",
        property: "Property", drawn: "Drawn", collateral: "Collateral", vaultL: "Vault", coinL: "HOUSE coin", disburseL: "Disbursement", repayL: "Repayment",
        active: "Active", repaid: "Repaid", repay: "Repay & release", repayingT: "Repaying…",
        gate: "Confirming it's you…",
        gateNote: "Repaying releases your collateral, so we re-check with a live selfie that it's you — no documents, no personal data.",
        mismatch: "This World ID isn't the one that pledged this property. Only the original borrower can repay and release the collateral.",
        gateErr: "We couldn't confirm it's you. Try again.",
      }
    : {
        title: "Gestão de empréstimos", sub: "Posições-ponte ativas, em tempo real na Sui. Reembolse para liquidar o levantamento em eUSD e libertar a garantia ao proprietário.",
        empty: "Ainda não há empréstimos.", start: "Iniciar a ponte",
        treasury: "Tesouraria", tSui: "Saldo SUI", tEusd: "eUSD emitido", tAddr: "Endereço",
        property: "Imóvel", drawn: "Levantado", collateral: "Garantia", vaultL: "Vault", coinL: "Moeda HOUSE", disburseL: "Pagamento", repayL: "Reembolso",
        active: "Ativo", repaid: "Reembolsado", repay: "Reembolsar & libertar", repayingT: "A reembolsar…",
        gate: "A confirmar que é você…",
        gateNote: "Reembolsar liberta a sua garantia, por isso reconfirmamos com uma selfie ao vivo que é você — sem documentos, sem dados pessoais.",
        mismatch: "Este World ID não é o que deu este imóvel como garantia. Só o mutuário original pode reembolsar e libertar a garantia.",
        gateErr: "Não conseguimos confirmar que é você. Tente de novo.",
      };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = accountId ? `?owner=${encodeURIComponent(accountId)}` : "";
      const res = await fetch(`/api/sui/loans${q}`);
      const json = await res.json();
      setLoans(json.loans ?? []);
      setTreasury(json.treasury ?? null);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => { load(); }, [load]);

  /** Step 1 of repayment: prove you're still the human who pledged this house. */
  const startRepay = async (vaultId: string) => {
    setGateError(null);
    setRepaying(vaultId);
    try {
      setGateCtx(await fetchRpContext("selfie"));
      setGateVault(vaultId);
    } catch {
      setGateError({ vaultId, msg: t.gateErr });
      setRepaying(null);
    }
  };

  /** Step 2: the backend re-checks the nullifier against the one bound at origination. */
  const finishRepay = async (vaultId: string, result: unknown) => {
    try {
      const { token } = await submitProof("selfie", result);
      const res = await fetch("/api/sui/repay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vaultId, kycToken: token }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "repay_failed");
      await load();
    } catch (e) {
      const code = e instanceof Error ? e.message : "";
      setGateError({ vaultId, msg: code === "kyc_mismatch" ? t.mismatch : t.gateErr });
    } finally {
      setGateVault(null);
      setGateCtx(null);
      setRepaying(null);
    }
  };

  const gateFailed = (vaultId: string, code: IDKitErrorCodes) => {
    setGateError({
      vaultId,
      msg: code === IDKitErrorCodes.UserRejected ? "" : t.gateErr,
    });
    setGateVault(null);
    setGateCtx(null);
    setRepaying(null);
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 sm:text-3xl">{t.title}</h1>
      <p className="mt-1 max-w-2xl text-slate-600 dark:text-slate-400">{t.sub}</p>

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

      {/* Loans */}
      <div className="mt-8 space-y-4">
        {loading ? (
          <p className="text-sm text-slate-500">…</p>
        ) : loans.length === 0 ? (
          <div className="rounded-3xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-200/70 dark:bg-[var(--color-card)] dark:ring-slate-700">
            <p className="text-slate-600 dark:text-slate-400">{t.empty}</p>
            <Link href={`/${lang}/bridge`} className="mt-4 inline-flex h-11 items-center justify-center rounded-lg bg-[var(--color-primary)] px-6 text-sm font-semibold text-white transition hover:bg-blue-700">
              {t.start} →
            </Link>
          </div>
        ) : (
          loans.map((l) => {
            const drawn = l.live?.drawnUsdc ?? l.drawnUsdc;
            const isRepaid = l.status === "repaid" || l.live?.repaid;
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

                <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-xs">
                  <a href={onChain(l.vaultId) ? suiscanObject(l.vaultId) : undefined} target="_blank" rel="noreferrer" className="text-[var(--color-primary)] hover:underline">{t.vaultL} ↗</a>
                  <a href={onChain(l.disburseDigest) ? suiscanTx(l.disburseDigest) : undefined} target="_blank" rel="noreferrer" className="text-[var(--color-primary)] hover:underline">{t.disburseL} ↗</a>
                  {l.coinType && onChain(l.coinType) && <a href={suiscanCoin(l.coinType)} target="_blank" rel="noreferrer" className="text-[var(--color-primary)] hover:underline">{t.coinL} ↗</a>}
                  {l.repayDigest && onChain(l.repayDigest) && <a href={suiscanTx(l.repayDigest)} target="_blank" rel="noreferrer" className="text-emerald-600 hover:underline dark:text-emerald-400">{t.repayL} ↗</a>}
                </div>

                {!isRepaid && (
                  <div className="mt-5">
                    <button
                      type="button"
                      onClick={() => startRepay(l.vaultId)}
                      disabled={repaying === l.vaultId}
                      className="inline-flex h-11 items-center justify-center rounded-lg bg-[var(--color-primary)] px-6 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
                    >
                      {repaying === l.vaultId ? (gateVault === l.vaultId ? t.gate : t.repayingT) : `↩ ${t.repay}`}
                    </button>
                    <p className="mt-2 max-w-md text-xs leading-relaxed text-slate-500 dark:text-slate-400">🤳 {t.gateNote}</p>
                    {gateError?.vaultId === l.vaultId && <p className="mt-2 text-sm text-[var(--color-danger)]">{gateError.msg}</p>}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Continuity gate — Selfie Check only. The document attributes were established at
          origination and don't change; what we re-check is that the same human is present. */}
      {gateVault && gateCtx && (
        <IDKitRequestWidget
          open
          onOpenChange={(o) => { if (!o) { setGateVault(null); setGateCtx(null); setRepaying(null); } }}
          app_id={APP_ID}
          action={WORLD_ACTIONS.selfie}
          rp_context={gateCtx}
          allow_legacy_proofs
          require_user_presence
          language="en"
          preset={selfieCheckLegacy({ signal: gateVault })}
          handleVerify={(result) => finishRepay(gateVault, result)}
          onSuccess={() => { /* finishRepay already reloaded the list */ }}
          onError={(code) => gateFailed(gateVault, code)}
        />
      )}
    </div>
  );
}
