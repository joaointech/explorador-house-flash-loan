"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useWallet } from "@/components/WalletProvider";
import RepayPanel from "@/components/RepayPanel";
import type { Locale } from "@/lib/i18n";
import type { DocKind } from "@/lib/types";
import { suiscanCoin, suiscanObject, suiscanTx, onChain, walruscanBlob, onWalrus } from "@/lib/types";

type Loan = {
  vaultId: string;
  owner: string;
  article: string;
  morada?: string;
  vpt: number;
  drawnUsdc: number; // original principal drawn
  collateralPct: number;
  coinType: string;
  disburseDigest: string;
  docAnchorDigest?: string;
  repayDigest?: string;
  repaidUsdc?: number;
  documents?: { kind: DocKind; blobId: string; filename: string }[];
  status: "active" | "repaid";
  live?: {
    drawnUsdc: number; // outstanding principal
    locked: number;
    rateBps?: number;
    interestUsdc?: number;
    owedUsdc?: number;
    houseBalance?: number;
  } | null;
};

const DOC_LABEL: Record<DocKind, { en: string; pt: string }> = {
  cartaoCidadao: { en: "Cartão de Cidadão (ID)", pt: "Cartão de Cidadão" },
  cadernetaPredial: { en: "Caderneta Predial", pt: "Caderneta Predial" },
  declaracaoImi: { en: "Declaração de IMI", pt: "Declaração de IMI" },
  termo: { en: "Signed debt acknowledgement", pt: "Termo de Reconhecimento de Dívida" },
};

export default function DashboardView({ lang }: { lang: Locale }) {
  const { accountId, ready: walletReady, connecting } = useWallet();
  const [loan, setLoan] = useState<Loan | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    // Wait for the wallet to hydrate before deciding anything — otherwise we'd
    // flash "no active position" while accountId is still resolving.
    if (!walletReady) return;
    if (!accountId) {
      setLoan(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/sui/loans?owner=${encodeURIComponent(accountId)}`);
      const json = await res.json();
      const active = (json.loans ?? []).find((l: Loan) => l.status === "active") ?? null;
      setLoan(active);
    } catch {
      setLoan(null);
    } finally {
      setLoading(false);
    }
  }, [accountId, walletReady]);

  useEffect(() => { load(); }, [load]);

  const t = lang === "en"
    ? {
        title: "Your account", empty: "No active position yet.", start: "Start the bridge",
        loaned: "Loaned", outstanding: "Outstanding", owed: "Owed now", paidBack: "Paid back", apr: "Borrow APR",
        houseTitle: "HOUSE tokens", minted: "Total minted", inVault: "In the collateral vault", inWalletL: "In your wallet",
        collateralPledged: "pledged as collateral", releaseNote: "Repaying in full releases all HOUSE to your wallet.",
        docsTitle: "Documents", anchor: "Doc hash (Sui)", vault: "Collateral vault", pay: "Disbursement (Sui tx)", repayTx: "Repayment (Sui tx)",
        property: "Property", vpt: "VPT value",
      }
    : {
        title: "A sua conta", empty: "Ainda não há posição ativa.", start: "Iniciar a ponte",
        loaned: "Emprestado", outstanding: "Em dívida (capital)", owed: "Em dívida agora", paidBack: "Reembolsado", apr: "TAN",
        houseTitle: "Tokens HOUSE", minted: "Total emitido", inVault: "No vault de garantia", inWalletL: "Na sua carteira",
        collateralPledged: "dados como garantia", releaseNote: "Reembolsar na totalidade liberta todos os HOUSE para a sua carteira.",
        docsTitle: "Documentos", anchor: "Hash do doc (Sui)", vault: "Vault de garantia", pay: "Pagamento (Transação Sui)", repayTx: "Reembolso (Transação Sui)",
        property: "Imóvel", vpt: "Valor VPT",
      };

  const fmt = (n: number) => n.toLocaleString(lang === "en" ? "en-US" : "pt-PT", { maximumFractionDigits: 2 });
  const pct = (bps: number) => `${(bps / 100).toFixed(bps % 100 === 0 ? 0 : 2)}%`;

  if (!walletReady || connecting || loading) return <DashboardSkeleton />;

  if (!loan) {
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

  const outstanding = loan.live?.drawnUsdc ?? loan.drawnUsdc;
  const owedNow = loan.live?.owedUsdc ?? outstanding;
  const locked = loan.live?.locked ?? 0;
  // What the borrower actually holds on-chain right now. All the HOUSE equity
  // stays in the collateral vault until the loan is repaid in full, at which
  // point the whole supply is released to the wallet — so until then this is 0.
  const inWallet = loan.live?.houseBalance ?? 0;
  const inVault = Math.max(0, loan.vpt - inWallet);

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 sm:text-3xl">{t.title}</h1>
      <p className="mt-1 text-slate-600 dark:text-slate-400">
        {loan.morada}{loan.morada ? " · " : ""}{t.vpt} €{fmt(loan.vpt)}
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stat(t.loaned, `$${fmt(loan.drawnUsdc)}`)}
        {stat(t.outstanding, `$${fmt(outstanding)}`)}
        {stat(t.owed, `$${fmt(owedNow)}`, true)}
        {stat(t.paidBack, `$${fmt(loan.repaidUsdc ?? 0)}`)}
      </div>
      {loan.live?.rateBps ? <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{t.apr}: {pct(loan.live.rateBps)}</p> : null}

      <div className="mt-8 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200/70 dark:bg-[var(--color-card)] dark:ring-slate-700 sm:p-8">
        <h2 className="mb-4 text-lg font-bold text-slate-800 dark:text-slate-100">{t.houseTitle}</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {stat(t.minted, `${fmt(loan.vpt)} HOUSE`)}
          {stat(t.inVault, `${fmt(inVault)} HOUSE`)}
          {stat(t.inWalletL, `${fmt(inWallet)} HOUSE`, true)}
        </div>
        <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
          {fmt(locked)} HOUSE {t.collateralPledged}. {t.releaseNote}
        </p>
      </div>

      {loan.documents && loan.documents.length > 0 && (
        <div className="mt-8 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200/70 dark:bg-[var(--color-card)] dark:ring-slate-700 sm:p-8">
          <h2 className="mb-2 text-lg font-bold text-slate-800 dark:text-slate-100">{t.docsTitle}</h2>
          <div>
            {loan.documents.map((doc) => (
              <div key={doc.kind}>
                {auditRow(DOC_LABEL[doc.kind]?.[lang] ?? doc.kind, doc.blobId, onWalrus(doc.blobId) ? walruscanBlob(doc.blobId) : undefined)}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-8 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200/70 dark:bg-[var(--color-card)] dark:ring-slate-700 sm:p-8">
        <div>
          {loan.docAnchorDigest && auditRow(t.anchor, loan.docAnchorDigest, onChain(loan.docAnchorDigest) ? suiscanTx(loan.docAnchorDigest) : undefined)}
          {auditRow(t.vault, loan.vaultId, onChain(loan.vaultId) ? suiscanObject(loan.vaultId) : undefined)}
          {loan.coinType && auditRow("HOUSE", loan.coinType, onChain(loan.coinType) ? suiscanCoin(loan.coinType) : undefined)}
          {auditRow(t.pay, loan.disburseDigest, onChain(loan.disburseDigest) ? suiscanTx(loan.disburseDigest) : undefined)}
          {loan.repayDigest && auditRow(t.repayTx, loan.repayDigest, onChain(loan.repayDigest) ? suiscanTx(loan.repayDigest) : undefined)}
        </div>
      </div>

      <div className="mt-8">
        <RepayPanel lang={lang} vaultId={loan.vaultId} owedUsdc={owedNow} onRepaid={load} />
      </div>
    </div>
  );
}

/** Loading placeholder that mirrors the dashboard layout so nothing flashes. */
function DashboardSkeleton() {
  const block = "animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800";
  return (
    <div className="mx-auto max-w-5xl px-4 py-12" aria-busy="true" aria-label="Loading">
      <div className={`${block} h-8 w-56`} />
      <div className={`${block} mt-3 h-4 w-72`} />
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/70 dark:bg-[var(--color-card)] dark:ring-slate-700">
            <div className={`${block} h-3 w-20`} />
            <div className={`${block} mt-2 h-7 w-24`} />
          </div>
        ))}
      </div>
      <div className={`${block} mt-8 h-40 w-full`} />
      <div className={`${block} mt-8 h-48 w-full`} />
    </div>
  );
}
