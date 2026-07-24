"use client";

import { useState } from "react";
import type { StepProps } from "../BridgeWizard";
import type { KycResult } from "@/lib/types";
import { StepHeading, Card, PrimaryButton, SecondaryButton, Badge, Spinner, ProofRow } from "../ui";

export default function StepKyc({ lang, session, patch, next, back, canBack }: StepProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [kyc, setKyc] = useState<KycResult | null>(session.kyc ?? null);

  const t = lang === "en"
    ? {
        kicker: "Step 3", title: "World ID KYC",
        sub: "Prove you're a unique human resident in Portugal — without revealing personal data. Identity Check attests your jurisdiction and age with a zero-knowledge proof.",
        verify: "Verify with World ID", verifying: "Verifying…",
        okTitle: "Verified", human: "Unique human", jur: "Jurisdiction", age: "Age 18+", level: "Verification", nullifier: "Nullifier",
        cont: "Continue", back: "Back",
        note: "The treasury AI agent only releases funds on behalf of a World-ID-verified human.",
        err: "Verification failed. Try again.",
      }
    : {
        kicker: "Passo 3", title: "KYC World ID",
        sub: "Prove que é um humano único residente em Portugal — sem revelar dados pessoais. O Identity Check atesta a sua jurisdição e idade com uma prova de conhecimento-zero.",
        verify: "Verificar com World ID", verifying: "A verificar…",
        okTitle: "Verificado", human: "Humano único", jur: "Jurisdição", age: "Idade 18+", level: "Verificação", nullifier: "Nullifier",
        cont: "Continuar", back: "Voltar",
        note: "O agente de IA da tesouraria só liberta fundos em nome de um humano verificado com World ID.",
        err: "Falha na verificação. Tente novamente.",
      };

  const verify = async () => {
    setLoading(true); setError(null);
    try {
      // Demo-first: in a configured World app, replace `demo:true` with the
      // proof produced by the IDKit widget (proofOfHuman + identityCheck).
      const res = await fetch("/api/worldid/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ demo: true, jurisdiction: "PT", nullifier_hash: session.accountId ?? "user" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "verify_failed");
      setKyc(json.kyc);
      patch({ kyc: json.kyc });
    } catch {
      setError(t.err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <StepHeading kicker={t.kicker} title={t.title} subtitle={t.sub} />
      <Card>
        {kyc?.verified ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="green">🌐 {t.okTitle}</Badge>
              <Badge tone="green">✓ {t.human}</Badge>
              <Badge tone="blue">{t.age}</Badge>
            </div>
            <div className="space-y-2">
              <ProofRow label={t.jur} value={`🇵🇹 ${kyc.jurisdiction ?? "PT"}`} mono={false} />
              <ProofRow label={t.level} value={kyc.verificationLevel ?? "orb"} mono={false} />
              <ProofRow label={t.nullifier} value={kyc.nullifierHash} />
            </div>
            <div className="flex items-center gap-3 pt-1">
              {canBack && <SecondaryButton onClick={back}>← {t.back}</SecondaryButton>}
              <PrimaryButton onClick={next}>{t.cont} →</PrimaryButton>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-2xl border border-[var(--color-border)] bg-stone-50/60 p-4 dark:bg-slate-800/40">
              <span className="text-2xl">🌐</span>
              <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">{t.note}</p>
            </div>
            <div className="flex items-center gap-3">
              <PrimaryButton onClick={verify} disabled={loading}>
                {loading ? <><Spinner /> <span className="ml-2">{t.verifying}</span></> : `🌐 ${t.verify}`}
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
