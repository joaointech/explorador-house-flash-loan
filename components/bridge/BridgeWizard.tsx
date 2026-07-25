"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Locale } from "@/lib/i18n";
import type { BridgeSession } from "@/lib/types";
import { useWallet } from "@/components/WalletProvider";
import Stepper, { type StepMeta } from "./Stepper";
import StepConnect from "./steps/StepConnect";
import StepDocuments from "./steps/StepDocuments";
import StepIdentity from "./steps/StepIdentity";
import StepSelfie from "./steps/StepSelfie";
import StepTokenize from "./steps/StepTokenize";
import StepCollateralize from "./steps/StepCollateralize";
import StepSign from "./steps/StepSign";
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
  pt: ["Ligar carteira", "Documentos", "Identity Check", "Selfie Check", "Tokenizar", "Colateralizar", "Assinar termo", "Levantar"],
  en: ["Connect wallet", "Documents", "Identity Check", "Selfie Check", "Tokenize", "Collateralize", "Sign debt acknowledgement", "Withdraw"],
};

export default function BridgeWizard({ lang }: { lang: Locale }) {
  const router = useRouter();
  const { accountId } = useWallet();
  const [step, setStep] = useState(0);
  const [done, setDone] = useState<Set<number>>(new Set());
  const [session, setSession] = useState<BridgeSession>({});
  // One loan per account: if this address already has an active position, this
  // is the wrong page — send them to their account instead of re-running the wizard.
  const [checkedAccount, setCheckedAccount] = useState(false);

  useEffect(() => {
    if (!accountId) {
      setCheckedAccount(true);
      return;
    }
    let cancelled = false;
    setCheckedAccount(false);
    fetch(`/api/sui/loans?owner=${encodeURIComponent(accountId)}`)
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return;
        const hasActive = (json.loans ?? []).some((l: { status: string }) => l.status === "active");
        if (hasActive) router.replace(`/${lang}/dashboard`);
        else setCheckedAccount(true);
      })
      .catch(() => !cancelled && setCheckedAccount(true));
    return () => {
      cancelled = true;
    };
  }, [accountId, lang, router]);

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

  // Blank while we check for an existing loan — avoids flashing step 0 before a redirect.
  if (!checkedAccount) return <div className="mx-auto max-w-5xl px-4 py-14" />;

  const patch = (p: Partial<BridgeSession>) => setSession((s) => ({ ...s, ...p }));
  const next = () => {
    setDone((d) => new Set(d).add(step));
    setStep((s) => Math.min(s + 1, steps.length - 1));
  };
  const back = () => setStep((s) => Math.max(s - 1, 0));
  // Jump straight to an already-completed step (from the rail) to re-check or edit.
  const goTo = (i: number) => {
    if (i !== step && done.has(i)) setStep(i);
  };

  const props: StepProps = { lang, session, patch, next, back, canBack: step > 0 };

  const body = [
    <StepConnect key="c" {...props} />,
    <StepDocuments key="d" {...props} />,
    <StepIdentity key="i" {...props} />,
    <StepSelfie key="sf" {...props} />,
    <StepTokenize key="t" {...props} />,
    <StepCollateralize key="co" {...props} />,
    <StepSign key="s" {...props} />,
    <StepWithdraw key="w" {...props} />,
  ][step];

  return (
    <div className="mx-auto grid max-w-5xl gap-8 px-4 py-10 lg:grid-cols-[16rem_1fr] lg:py-14">
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <Stepper steps={steps} current={step} done={done} onSelect={goTo} />
      </aside>
      <section className="min-w-0">{body}</section>
    </div>
  );
}
