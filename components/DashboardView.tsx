"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Locale } from "@/lib/i18n";
import type { BridgeSession } from "@/lib/types";
import { suiscanCoin, suiscanObject, suiscanTx, onChain } from "@/lib/types";

export default function DashboardView({ lang }: { lang: Locale }) {
  const [session, setSession] = useState<BridgeSession | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("bridge.session");
      if (raw) setSession(JSON.parse(raw));
    } catch {
      /* ignore */
    }
    setReady(true);
  }, []);

  const t = lang === "en"
    ? {
        title: "Your bridge position", empty: "No active position yet.", start: "Start the bridge",
        property: "Property", token: "House token", collateral: "Collateral locked", drawn: "Liquidity drawn",
        status: "Status", active: "Active — repaid on sale", audit: "Audit trail",
        walrus: "Documents (Walrus)", anchor: "Doc hash (Sui)", kyc: "KYC (World ID)", coin: "HOUSE equity (Sui)", vault: "Collateral vault", pay: "Disbursement (Sui tx)",
        vpt: "VPT value", human: "Verified unique human",
      }
    : {
        title: "A sua posição-ponte", empty: "Ainda não há posição ativa.", start: "Iniciar a ponte",
        property: "Imóvel", token: "Token do imóvel", collateral: "Garantia bloqueada", drawn: "Liquidez levantada",
        status: "Estado", active: "Ativa — reembolsada na venda", audit: "Rasto de auditoria",
        walrus: "Documentos (Walrus)", anchor: "Hash do doc (Sui)", kyc: "KYC (World ID)", coin: "Capital HOUSE (Sui)", vault: "Vault de garantia", pay: "Pagamento (Transação Sui)",
        vpt: "Valor VPT", human: "Humano único verificado",
      };

  const fmt = (n: number) => n.toLocaleString(lang === "en" ? "en-US" : "pt-PT");

  if (!ready) return <div className="mx-auto max-w-5xl px-4 py-14" />;

  const hasPosition = session?.disbursement?.digest || session?.token;

  if (!hasPosition) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 sm:text-3xl">{t.title}</h1>
        <p className="mt-3 text-slate-600 dark:text-slate-400">{t.empty}</p>
        <Link href={`/${lang}/bridge`} className="mt-6 inline-flex h-11 items-center justify-center rounded-lg bg-[var(--color-primary)] px-6 text-sm font-semibold text-white transition hover:bg-blue-700">
          {t.start} →
        </Link>
      </div>
    );
  }

  const s = session!;

  const stat = (label: string, value: string, accent = false) => (
    <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/70 dark:bg-[var(--color-card)] dark:ring-slate-700">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${accent ? "text-[var(--color-primary)]" : "text-slate-800 dark:text-slate-100"}`}>{value}</p>
    </div>
  );

  const auditRow = (label: string, value: string, href?: string) => (
    <div className="flex items-center justify-between gap-3 border-b border-[var(--color-border)] py-3 text-sm last:border-0">
      <span className="flex-none text-slate-500 dark:text-slate-400">{label}</span>
      {href ? (
        <a href={href} target="_blank" rel="noreferrer" className="min-w-0 truncate font-mono text-[var(--color-primary)] hover:underline">{value} ↗</a>
      ) : (
        <span className="min-w-0 truncate font-mono text-slate-800 dark:text-slate-200">{value}</span>
      )}
    </div>
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 sm:text-3xl">{t.title}</h1>
      {s.property && (
        <p className="mt-1 text-slate-600 dark:text-slate-400">
          {s.property.morada}, {s.property.freguesia} · {s.property.concelho} — {t.vpt} €{fmt(s.property.vpt)}
        </p>
      )}

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stat(t.token, s.token?.symbol ?? "—")}
        {stat(t.collateral, `${Math.round((s.collateralPct ?? 0) * 100)}%`)}
        {stat(t.drawn, `$${fmt(s.disbursement?.amountUsdc ?? 0)}`, true)}
        {stat(t.status, "●", false)}
      </div>
      <p className="mt-2 text-sm text-emerald-600 dark:text-emerald-400">{t.active}</p>

      <div className="mt-10 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200/70 dark:bg-[var(--color-card)] dark:ring-slate-700 sm:p-8">
        <h2 className="mb-2 text-lg font-bold text-slate-800 dark:text-slate-100">{t.audit}</h2>
        <div>
          {s.storage && auditRow(t.walrus, s.storage.blobId)}
          {s.storage && auditRow(t.anchor, s.storage.anchorDigest, onChain(s.storage.anchorDigest) ? suiscanTx(s.storage.anchorDigest) : undefined)}
          {s.kyc && auditRow(t.kyc, `${t.human} · 🇵🇹 18+ · PRT (attested)`)}
          {s.token && auditRow(t.coin, s.token.coinType, onChain(s.token.coinType) ? suiscanCoin(s.token.coinType) : undefined)}
          {s.token?.vaultId && auditRow(t.vault, s.token.vaultId, onChain(s.token.vaultId) ? suiscanObject(s.token.vaultId) : undefined)}
          {s.disbursement?.digest && auditRow(t.pay, s.disbursement.digest, onChain(s.disbursement.digest) ? suiscanTx(s.disbursement.digest) : undefined)}
        </div>
        {s.disbursement?.agentRationale && (
          <p className="mt-4 rounded-xl border border-[var(--color-border)] bg-stone-50/60 p-3 text-sm text-slate-600 dark:bg-slate-800/40 dark:text-slate-300">
            🤖 {s.disbursement.agentRationale}
          </p>
        )}
      </div>
    </div>
  );
}
