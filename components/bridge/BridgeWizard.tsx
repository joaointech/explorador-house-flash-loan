"use client";

import { useEffect, useMemo, useState } from "react";
import type { Locale } from "@/lib/i18n";
import type { BridgeSession } from "@/lib/types";
import Stepper, { type StepMeta } from "./Stepper";
import StepConnect from "./steps/StepConnect";
import StepDocuments from "./steps/StepDocuments";
import StepKyc from "./steps/StepKyc";
import StepTokenize from "./steps/StepTokenize";
import StepCollateralize from "./steps/StepCollateralize";
import StepWithdraw from "./steps/StepWithdraw";

export type StepProps = {
  lang: Locale;
  session: BridgeSession;
  patch: (p: Partial<BridgeSession>) => void;
  next: () => void;
  back: () => void;
  canBack: boolean;
};

const STEP_LABELS: Record<Locale, string[]> = {
  pt: ["Ligar carteira", "Documentos", "KYC World ID", "Tokenizar", "Colateralizar", "Levantar"],
  en: ["Connect wallet", "Documents", "World ID KYC", "Tokenize", "Collateralize", "Withdraw"],
};

export default function BridgeWizard({ lang }: { lang: Locale }) {
  const [step, setStep] = useState(0);
  const [done, setDone] = useState<Set<number>>(new Set());
  const [session, setSession] = useState<BridgeSession>({});

  const steps: StepMeta[] = useMemo(
    () => STEP_LABELS[lang].map((label, i) => ({ key: String(i), label })),
    [lang],
  );

  // Persist the position so the dashboard can read it after the wizard.
  useEffect(() => {
    try {
      sessionStorage.setItem("bridge.session", JSON.stringify(session));
    } catch {
      /* ignore */
    }
  }, [session]);

  const patch = (p: Partial<BridgeSession>) => setSession((s) => ({ ...s, ...p }));
  const next = () => {
    setDone((d) => new Set(d).add(step));
    setStep((s) => Math.min(s + 1, steps.length - 1));
  };
  const back = () => setStep((s) => Math.max(s - 1, 0));

  const props: StepProps = { lang, session, patch, next, back, canBack: step > 0 };

  const body = [
    <StepConnect key="c" {...props} />,
    <StepDocuments key="d" {...props} />,
    <StepKyc key="k" {...props} />,
    <StepTokenize key="t" {...props} />,
    <StepCollateralize key="co" {...props} />,
    <StepWithdraw key="w" {...props} />,
  ][step];

  return (
    <div className="mx-auto grid max-w-5xl gap-8 px-4 py-10 lg:grid-cols-[16rem_1fr] lg:py-14">
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <Stepper steps={steps} current={step} done={done} />
      </aside>
      <section className="min-w-0">{body}</section>
    </div>
  );
}
