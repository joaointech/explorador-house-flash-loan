"use client";

import { useState } from "react";
import type { StepProps } from "../BridgeWizard";
import type { AgreementSignature, Disbursement } from "@/lib/types";
import { suiscanTx, onChain } from "@/lib/types";
import { StepHeading, Card, PrimaryButton, SecondaryButton, Badge, Spinner, ProofRow } from "../ui";

type Screen = "document" | "cmd-phone" | "cmd-otp" | "signing" | "result";

const PT_MOBILE = /^(\+351\s?)?9\d{2}\s?\d{3}\s?\d{3}$/;
const short = (s: string) => (s.length > 18 ? `${s.slice(0, 10)}…${s.slice(-6)}` : s);

export default function StepSign({ lang, session, patch, next, back, canBack }: StepProps) {
  const en = lang === "en";
  const alreadySigned = session.agreement && session.disbursement?.status === "executed";
  const [screen, setScreen] = useState<Screen>(alreadySigned ? "result" : "document");
  const [accepted, setAccepted] = useState(false);
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [agreement, setAgreement] = useState<AgreementSignature | null>(session.agreement ?? null);
  const [result, setResult] = useState<Disbursement | null>(session.disbursement ?? null);

  const drawAmount = session.drawAmount ?? 0;
  const fmt = (n: number) => n.toLocaleString(en ? "en-US" : "pt-PT");
  const today = new Date().toLocaleDateString(en ? "en-GB" : "pt-PT");

  const t = en
    ? {
        kicker: "Step 7", title: "Sign the debt acknowledgement",
        sub: "Before any liquidity moves, you formally acknowledge the debt — a Termo de Reconhecimento e Confissão de Dívida under article 458 of the Civil Code — and sign it with Chave Móvel Digital.",
        openDoc: "Open in a new tab", data: "Your details",
        debtor: "Debtor", property: "Property", debt: "Debt", wallet: "Wallet", date: "Date",
        accept: "I have read and accept the terms of this document.",
        sign: "Sign with Chave Móvel Digital", back: "Back",
        cmdTitle: "Chave Móvel Digital", demo: "DEMO",
        phoneLabel: "Mobile number", passwordLabel: "Password", noSms: "No SMS is sent — this is a simulation.",
        authenticate: "Authenticate", otpTitle: "Security code",
        otpNote: "Enter any 4 digits — simulation.", otpLabel: "Code",
        signDoc: "Sign document", signing: "Signing & executing…",
        agent: "Treasury AI agent", approved: "Approved & executed", declined: "Declined",
        tx: "Sui tx", amount: "Disbursed", docAnchor: "Document hash anchored",
        cont: "Continue", retry: "Adjust", err: "Something went wrong. Try again.",
        phoneErr: "Enter a Portuguese mobile number (9xx xxx xxx).",
        otpErr: "Enter the 4-digit code.",
      }
    : {
        kicker: "Passo 7", title: "Assinar o termo de dívida",
        sub: "Antes de qualquer liquidez ser transferida, reconhece formalmente a dívida — um Termo de Reconhecimento e Confissão de Dívida nos termos do artigo 458.º do Código Civil — e assina-o com a Chave Móvel Digital.",
        openDoc: "Abrir numa nova aba", data: "Os seus dados",
        debtor: "Devedor", property: "Imóvel", debt: "Dívida", wallet: "Carteira", date: "Data",
        accept: "Li e aceito os termos deste documento.",
        sign: "Assinar com Chave Móvel Digital", back: "Voltar",
        cmdTitle: "Chave Móvel Digital", demo: "DEMO",
        phoneLabel: "Número de telemóvel", passwordLabel: "Palavra-passe", noSms: "Não é enviado SMS — isto é uma simulação.",
        authenticate: "Autenticar", otpTitle: "Código de segurança",
        otpNote: "Introduza quaisquer 4 dígitos — simulação.", otpLabel: "Código",
        signDoc: "Assinar documento", signing: "A assinar & executar…",
        agent: "Agente IA da tesouraria", approved: "Aprovado & executado", declined: "Recusado",
        tx: "Transação Sui", amount: "Transferido", docAnchor: "Hash do documento ancorado",
        cont: "Continuar", retry: "Ajustar", err: "Algo correu mal. Tente novamente.",
        phoneErr: "Introduza um número de telemóvel português (9xx xxx xxx).",
        otpErr: "Introduza o código de 4 dígitos.",
      };

  const submitPhone = () => {
    if (!PT_MOBILE.test(phone.trim()) || password.trim().length === 0) {
      setError(t.phoneErr);
      return;
    }
    setError(null);
    setScreen("cmd-otp");
  };

  const submitOtp = async () => {
    if (!/^\d{4}$/.test(otp.trim())) {
      setError(t.otpErr);
      return;
    }
    setError(null);
    setScreen("signing");
    try {
      const signRes = await fetch("/api/agreement/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vaultId: session.token?.vaultId,
          accountId: session.accountId,
          amountEur: drawAmount,
          article: session.property?.artigoMatricial,
          morada: session.property?.morada,
          nome: session.property?.proprietario ?? "",
          phone,
        }),
      });
      const signJson = await signRes.json();
      if (!signRes.ok) throw new Error(signJson.error ?? "sign_failed");
      setAgreement(signJson.agreement);
      patch({ agreement: signJson.agreement });

      const disburseRes = await fetch("/api/agent/disburse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vpt: session.property?.vpt ?? 0, collateralPct: session.collateralPct, drawAmount,
          kycToken: session.kyc?.token, accountId: session.accountId, vaultId: session.token?.vaultId,
          article: session.property?.artigoMatricial, morada: session.property?.morada, coinType: session.token?.coinType,
        }),
      });
      const disburseJson = await disburseRes.json();
      if (!disburseRes.ok) throw new Error(disburseJson.error ?? "disburse_failed");
      setResult(disburseJson.disbursement);
      patch({ disbursement: disburseJson.disbursement });
      setScreen("result");
    } catch {
      setError(t.err);
      setScreen("document");
    }
  };

  const approved = result && result.status === "executed";

  return (
    <div>
      <StepHeading kicker={t.kicker} title={t.title} subtitle={t.sub} />
      <Card>
        {screen === "result" ? (
          <div className="space-y-4">
            <Badge tone={approved ? "green" : "amber"}>🤖 {approved ? t.approved : t.declined}</Badge>
            {result && (
              <div className="rounded-2xl border border-[var(--color-border)] bg-stone-50/60 p-4 text-sm leading-relaxed text-slate-700 dark:bg-slate-800/40 dark:text-slate-200">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">{t.agent}</p>
                {result.agentRationale}
              </div>
            )}
            {approved && result && (
              <div className="space-y-2">
                <ProofRow label={t.amount} value={`$${fmt(result.amountUsdc)} ${result.asset}`} mono={false} />
                <ProofRow label={t.tx} value={result.digest} href={onChain(result.digest) ? suiscanTx(result.digest) : undefined} />
                {agreement?.anchorDigest && (
                  <ProofRow label={t.docAnchor} value={short(agreement.anchorDigest)} href={onChain(agreement.anchorDigest) ? suiscanTx(agreement.anchorDigest) : undefined} />
                )}
              </div>
            )}
            <div className="flex items-center gap-3 pt-1">
              {!approved && <SecondaryButton onClick={() => setScreen("document")}>{t.retry}</SecondaryButton>}
              {approved && <PrimaryButton onClick={next}>{t.cont} →</PrimaryButton>}
            </div>
          </div>
        ) : screen === "signing" ? (
          <div className="flex items-center gap-3 py-6 text-sm text-slate-600 dark:text-slate-400">
            <Spinner /> {t.signing}
          </div>
        ) : screen === "cmd-phone" ? (
          <CmdScreen title={t.cmdTitle} demo={t.demo} note={t.noSms}>
            <Field label={t.phoneLabel} value={phone} onChange={setPhone} placeholder="912 345 678" />
            <Field label={t.passwordLabel} value={password} onChange={setPassword} type="password" />
            {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}
            <div className="flex items-center gap-3 pt-1">
              <PrimaryButton onClick={submitPhone}>{t.authenticate}</PrimaryButton>
              <SecondaryButton onClick={() => setScreen("document")}>{t.back}</SecondaryButton>
            </div>
          </CmdScreen>
        ) : screen === "cmd-otp" ? (
          <CmdScreen title={t.otpTitle} demo={t.demo} note={t.otpNote}>
            <Field label={t.otpLabel} value={otp} onChange={setOtp} placeholder="0000" maxLength={4} />
            {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}
            <div className="flex items-center gap-3 pt-1">
              <PrimaryButton onClick={submitOtp}>{t.signDoc}</PrimaryButton>
              <SecondaryButton onClick={() => setScreen("cmd-phone")}>{t.back}</SecondaryButton>
            </div>
          </CmdScreen>
        ) : (
          <div className="space-y-6">
            <div className="grid gap-6 md:grid-cols-[3fr_2fr]">
              <div className="aspect-[3/4] overflow-hidden rounded-2xl border border-[var(--color-border)]">
                <iframe src="/termo-reconhecimento-divida.pdf#toolbar=0&view=FitH" className="h-full w-full" title="Termo de Reconhecimento e Confissão de Dívida" />
              </div>
              <div className="space-y-3">
                <a href="/termo-reconhecimento-divida.pdf" target="_blank" rel="noreferrer" className="text-sm text-[var(--color-primary)] underline-offset-2 hover:underline">
                  {t.openDoc} ↗
                </a>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{t.data}</p>
                <div className="space-y-2">
                  <ProofRow label={t.debtor} value={session.property?.proprietario ?? "—"} mono={false} />
                  <ProofRow label={t.property} value={session.property?.morada ?? "—"} mono={false} />
                  <ProofRow label={t.debt} value={`€${fmt(drawAmount)}`} mono={false} />
                  <ProofRow label={t.wallet} value={short(session.accountId ?? "—")} />
                  <ProofRow label={t.date} value={today} mono={false} />
                </div>
              </div>
            </div>
            <label className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300">
              <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} className="mt-0.5 accent-[var(--color-primary)]" />
              {t.accept}
            </label>
            <div className="flex items-center gap-3">
              <PrimaryButton onClick={() => setScreen("cmd-phone")} disabled={!accepted}>🔐 {t.sign}</PrimaryButton>
              {canBack && <SecondaryButton onClick={back}>← {t.back}</SecondaryButton>}
            </div>
            {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}
          </div>
        )}
      </Card>
    </div>
  );
}

/** Wraps the two CMD mock screens with a shared DEMO-labelled header. */
function CmdScreen({ title, demo, note, children }: { title: string; demo: string; note: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-2xl">🔐</span>
        <p className="text-lg font-semibold text-slate-800 dark:text-slate-100">{title}</p>
        <Badge tone="amber">{demo}</Badge>
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400">{note}</p>
      {children}
    </div>
  );
}

function Field({
  label, value, onChange, type = "text", placeholder, maxLength,
}: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string; maxLength?: number;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-slate-700 dark:text-slate-300">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        className="w-full rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-sm text-slate-800 focus:border-[var(--color-primary)] focus:outline-none dark:bg-slate-800 dark:text-slate-100"
      />
    </label>
  );
}
