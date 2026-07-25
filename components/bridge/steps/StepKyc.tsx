"use client";

import { useRef, useState } from "react";
import { IDKitRequestWidget, identityCheck, selfieCheckLegacy, IDKitErrorCodes } from "@worldcoin/idkit";
import type { StepProps } from "../BridgeWizard";
import type { KycResult, WorldCredential } from "@/lib/types";
import { WORLD_ACTIONS, IDENTITY_ATTRIBUTES } from "@/lib/types";
import { fetchRpContext, submitProof, type RpContext } from "@/lib/worldid-client";
import { StepHeading, Card, PrimaryButton, SecondaryButton, Badge, Spinner, ProofRow } from "../ui";

type Phase = "idle" | "identity" | "selfie" | "done";

const APP_ID = (process.env.NEXT_PUBLIC_WORLD_APP_ID || "app_") as `app_${string}`;
const short = (s: string) => (s.length > 18 ? `${s.slice(0, 10)}…${s.slice(-6)}` : s);

export default function StepKyc({ lang, session, patch, next, back, canBack }: StepProps) {
  const en = lang === "en";
  const [phase, setPhase] = useState<Phase>(session.kyc ? "done" : "idle");
  const [ctx, setCtx] = useState<RpContext | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [kyc, setKyc] = useState<KycResult | null>(session.kyc ?? null);
  // The KYC session token, threaded from the first verification into the second.
  const tokenRef = useRef<string | undefined>(session.kyc?.token);

  const t = en
    ? {
        kicker: "Step 3", title: "World ID eligibility check",
        sub: "Two checks, two different signals — and neither one reveals who you are.",
        why1: "Identity Check", why1b: "Document-backed proof you're 18+ and hold a Portuguese-issued ID. Pledging a caderneta predial requires an adult under PT jurisdiction.",
        why2: "Selfie Check", why2b: "A live selfie proves the document holder is actually here, and links this pledge to one human — so the same person can't borrow against two properties.",
        minim: "We request predicates, not data. World answers “yes, 18+ and PRT” — your name, birth date and document number never reach this app.",
        start: "Verify with World ID", starting: "Preparing…",
        step1: "1 · Identity Check", step2: "2 · Selfie Check",
        waiting: "Open World App to continue",
        okTitle: "Eligible", age: "Age 18+ attested", jur: "🇵🇹 PT-issued document", live: "Live human",
        idNull: "Identity nullifier", selfieNull: "Selfie nullifier",
        cont: "Continue", back: "Back", retry: "Try again",
        sandbox: "SANDBOX — not a real proof",
        err: "Verification failed. Try again.",
      }
    : {
        kicker: "Passo 3", title: "Verificação de elegibilidade World ID",
        sub: "Duas verificações, dois sinais diferentes — e nenhuma revela quem é.",
        why1: "Identity Check", why1b: "Prova documental de que tem 18+ anos e um documento emitido em Portugal. Dar uma caderneta predial como garantia exige um adulto sob jurisdição PT.",
        why2: "Selfie Check", why2b: "Uma selfie ao vivo prova que o titular do documento está mesmo presente e liga esta garantia a um único humano — a mesma pessoa não pode hipotecar dois imóveis.",
        minim: "Pedimos predicados, não dados. A World responde “sim, 18+ e PRT” — o seu nome, data de nascimento e número do documento nunca chegam a esta aplicação.",
        start: "Verificar com World ID", starting: "A preparar…",
        step1: "1 · Identity Check", step2: "2 · Selfie Check",
        waiting: "Abra a World App para continuar",
        okTitle: "Elegível", age: "Idade 18+ atestada", jur: "🇵🇹 Documento emitido em PT", live: "Humano presente",
        idNull: "Nullifier de identidade", selfieNull: "Nullifier da selfie",
        cont: "Continuar", back: "Voltar", retry: "Tentar de novo",
        sandbox: "SANDBOX — não é uma prova real",
        err: "Falha na verificação. Tente novamente.",
      };

  /** Human copy per IDKit failure — an eligibility rejection must not read as a bug. */
  const errorCopy: Partial<Record<IDKitErrorCodes, string>> = en
    ? {
        [IDKitErrorCodes.IdentityAttributesNotMatched]: "Your World ID doesn't meet the eligibility requirements for this loan (18+ with a Portuguese-issued document).",
        [IDKitErrorCodes.CredentialUnavailable]: "You don't have this credential yet. Open World App to add it, then try again.",
        [IDKitErrorCodes.NullifierReplayed]: "This World ID has already been used for this step.",
        [IDKitErrorCodes.MaxVerificationsReached]: "This World ID has reached the verification limit for this action.",
        [IDKitErrorCodes.UserRejected]: "You cancelled the verification.",
        [IDKitErrorCodes.UserPresenceFailed]: "We couldn't confirm you were present. Try the selfie again in better light.",
        [IDKitErrorCodes.Timeout]: "The request timed out before World App responded.",
      }
    : {
        [IDKitErrorCodes.IdentityAttributesNotMatched]: "O seu World ID não cumpre os requisitos de elegibilidade deste crédito (18+ com documento emitido em Portugal).",
        [IDKitErrorCodes.CredentialUnavailable]: "Ainda não tem esta credencial. Abra a World App para a adicionar e tente de novo.",
        [IDKitErrorCodes.NullifierReplayed]: "Este World ID já foi usado neste passo.",
        [IDKitErrorCodes.MaxVerificationsReached]: "Este World ID atingiu o limite de verificações para esta ação.",
        [IDKitErrorCodes.UserRejected]: "Cancelou a verificação.",
        [IDKitErrorCodes.UserPresenceFailed]: "Não conseguimos confirmar a sua presença. Repita a selfie com mais luz.",
        [IDKitErrorCodes.Timeout]: "O pedido expirou antes de a World App responder.",
      };

  /** Fetches a freshly-signed rp_context, then opens that credential's widget. */
  const openCredential = async (credential: WorldCredential) => {
    setLoading(true); setError(null);
    try {
      setCtx(await fetchRpContext(credential));
      setPhase(credential);
    } catch {
      setError(t.err);
      setPhase("idle");
    } finally {
      setLoading(false);
    }
  };

  const verify = async (credential: WorldCredential, result: unknown) => {
    const json = await submitProof(credential, result, tokenRef.current);
    tokenRef.current = json.token;
    return json;
  };

  const onIdentityVerified = async (result: unknown) => {
    await verify("identity", result);
  };

  const onSelfieVerified = async (result: unknown) => {
    const json = await verify("selfie", result);
    const next: KycResult = {
      token: json.token,
      identityAttested: json.identityAttested,
      identityNullifier: json.identityNullifier,
      selfieNullifier: json.selfieNullifier,
      sandbox: json.sandbox,
    };
    setKyc(next);
    patch({ kyc: next });
  };

  const fail = (code: IDKitErrorCodes) => {
    setError(errorCopy[code] ?? t.err);
    setPhase("idle");
  };

  const pending = phase === "identity" || phase === "selfie";

  return (
    <div>
      <StepHeading kicker={t.kicker} title={t.title} subtitle={t.sub} />
      <Card>
        {kyc ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="green">🪪 {t.okTitle}</Badge>
              <Badge tone="green">✓ {t.age}</Badge>
              <Badge tone="blue">{t.jur}</Badge>
              <Badge tone="green">🤳 {t.live}</Badge>
              {kyc.sandbox && <Badge tone="amber">⚠ {t.sandbox}</Badge>}
            </div>
            <div className="space-y-2">
              <ProofRow label={t.idNull} value={short(kyc.identityNullifier)} />
              <ProofRow label={t.selfieNull} value={short(kyc.selfieNullifier)} />
            </div>
            <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">{t.minim}</p>
            <div className="flex items-center gap-3 pt-1">
              {canBack && <SecondaryButton onClick={back}>← {t.back}</SecondaryButton>}
              <PrimaryButton onClick={next}>{t.cont} →</PrimaryButton>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-3">
              <Explainer icon="🪪" title={t.why1} body={t.why1b} active={phase === "identity"} />
              <Explainer icon="🤳" title={t.why2} body={t.why2b} active={phase === "selfie"} />
            </div>
            <p className="rounded-2xl border border-[var(--color-border)] bg-stone-50/60 p-4 text-xs leading-relaxed text-slate-600 dark:bg-slate-800/40 dark:text-slate-400">
              🔒 {t.minim}
            </p>
            <div className="flex items-center gap-3">
              <PrimaryButton onClick={() => openCredential("identity")} disabled={loading || pending}>
                {loading || pending ? (
                  <><Spinner /> <span className="ml-2">{pending ? t.waiting : t.starting}</span></>
                ) : (
                  `🌐 ${error ? t.retry : t.start}`
                )}
              </PrimaryButton>
              {canBack && <SecondaryButton onClick={back}>← {t.back}</SecondaryButton>}
            </div>
            {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}
          </div>
        )}
      </Card>

      {/* Identity Check — v4 only, so it cannot share a widget with the legacy selfie proof. */}
      {ctx && phase === "identity" && (
        <IDKitRequestWidget
          open
          onOpenChange={(o) => { if (!o) setPhase("idle"); }}
          app_id={APP_ID}
          action={WORLD_ACTIONS.identity}
          rp_context={ctx}
          allow_legacy_proofs={false}
          // IDKit ships en|es|th only — no pt. English beats serving Spanish to a
          // Portuguese audience. Logged in WORLDID_TESTING.md §3.9.
          language="en"
          preset={identityCheck({ attributes: [...IDENTITY_ATTRIBUTES] })}
          handleVerify={onIdentityVerified}
          onSuccess={() => openCredential("selfie")}
          onError={fail}
        />
      )}

      {/* Selfie Check — returns v3 proofs, hence allow_legacy_proofs. */}
      {ctx && phase === "selfie" && (
        <IDKitRequestWidget
          open
          onOpenChange={(o) => { if (!o) setPhase("idle"); }}
          app_id={APP_ID}
          action={WORLD_ACTIONS.selfie}
          rp_context={ctx}
          allow_legacy_proofs
          require_user_presence
          // IDKit ships en|es|th only — no pt. English beats serving Spanish to a
          // Portuguese audience. Logged in WORLDID_TESTING.md §3.9.
          language="en"
          preset={selfieCheckLegacy({ signal: session.accountId })}
          handleVerify={onSelfieVerified}
          onSuccess={() => setPhase("done")}
          onError={fail}
        />
      )}
    </div>
  );
}

/** One of the two checks, highlighted while its widget is open. */
function Explainer({ icon, title, body, active }: { icon: string; title: string; body: string; active: boolean }) {
  return (
    <div
      className={`flex items-start gap-3 rounded-2xl border p-4 transition ${
        active
          ? "border-[var(--color-primary)] bg-[#DBEAFE]/40 dark:bg-[var(--color-primary)]/10"
          : "border-[var(--color-border)] bg-stone-50/60 dark:bg-slate-800/40"
      }`}
    >
      <span className="text-2xl">{icon}</span>
      <div>
        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{title}</p>
        <p className="mt-0.5 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{body}</p>
      </div>
    </div>
  );
}
