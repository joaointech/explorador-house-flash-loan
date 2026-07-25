"use client";

import { useState } from "react";
import { IDKitRequestWidget, identityCheck, IDKitErrorCodes } from "@worldcoin/idkit";
import type { StepProps } from "../BridgeWizard";
import type { IdentityResult } from "@/lib/types";
import { WORLD_ACTIONS, IDENTITY_ATTRIBUTES } from "@/lib/types";
import { fetchRpContext, submitProof, SANDBOX, type RpContext } from "@/lib/worldid-client";
import { StepHeading, Card, PrimaryButton, SecondaryButton, Badge, Spinner, ProofRow } from "../ui";

const APP_ID = (process.env.NEXT_PUBLIC_WORLD_APP_ID || "app_") as `app_${string}`;
const short = (s: string) => (s.length > 18 ? `${s.slice(0, 10)}…${s.slice(-6)}` : s);

export default function StepIdentity({ lang, session, patch, next, back, canBack }: StepProps) {
  const en = lang === "en";
  const [open, setOpen] = useState(false);
  const [ctx, setCtx] = useState<RpContext | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [identity, setIdentity] = useState<IdentityResult | null>(session.identity ?? null);

  const t = en
    ? {
        kicker: "Step 3", title: "Identity Check",
        sub: "Document-backed proof you're 18+ and hold a Portuguese-issued ID — the first of two World ID checks.",
        why: "Pledging a caderneta predial requires an adult under PT jurisdiction. World answers “yes, 18+ and PRT”, never your name, birth date or document number.",
        start: "Verify with World ID", starting: "Preparing…", waiting: "Open World App to continue",
        okTitle: "Identity verified", age: "Age 18+ attested", jur: "🇵🇹 PT-issued document",
        idNull: "Identity nullifier",
        cont: "Continue", back: "Back", retry: "Try again",
        sandbox: "SANDBOX — not a real proof",
        err: "Verification failed. Try again.",
      }
    : {
        kicker: "Passo 3", title: "Identity Check",
        sub: "Prova documental de que tem 18+ anos e um documento emitido em Portugal — a primeira das duas verificações World ID.",
        why: "Dar uma caderneta predial como garantia exige um adulto sob jurisdição PT. A World responde “sim, 18+ e PRT”, nunca o seu nome, data de nascimento ou número do documento.",
        start: "Verificar com World ID", starting: "A preparar…", waiting: "Abra a World App para continuar",
        okTitle: "Identidade verificada", age: "Idade 18+ atestada", jur: "🇵🇹 Documento emitido em PT",
        idNull: "Nullifier de identidade",
        cont: "Continuar", back: "Voltar", retry: "Tentar de novo",
        sandbox: "SANDBOX — não é uma prova real",
        err: "Falha na verificação. Tente novamente.",
      };

  const errorCopy: Partial<Record<IDKitErrorCodes, string>> = en
    ? {
        [IDKitErrorCodes.IdentityAttributesNotMatched]: "Your World ID doesn't meet the eligibility requirements for this loan (18+ with a Portuguese-issued document).",
        [IDKitErrorCodes.CredentialUnavailable]: "You don't have this credential yet. Open World App to add it, then try again.",
        [IDKitErrorCodes.NullifierReplayed]: "This World ID has already been used for this step.",
        [IDKitErrorCodes.MaxVerificationsReached]: "This World ID has reached the verification limit for this action.",
        [IDKitErrorCodes.UserRejected]: "You cancelled the verification.",
        [IDKitErrorCodes.Timeout]: "The request timed out before World App responded.",
      }
    : {
        [IDKitErrorCodes.IdentityAttributesNotMatched]: "O seu World ID não cumpre os requisitos de elegibilidade deste crédito (18+ com documento emitido em Portugal).",
        [IDKitErrorCodes.CredentialUnavailable]: "Ainda não tem esta credencial. Abra a World App para a adicionar e tente de novo.",
        [IDKitErrorCodes.NullifierReplayed]: "Este World ID já foi usado neste passo.",
        [IDKitErrorCodes.MaxVerificationsReached]: "Este World ID atingiu o limite de verificações para esta ação.",
        [IDKitErrorCodes.UserRejected]: "Cancelou a verificação.",
        [IDKitErrorCodes.Timeout]: "O pedido expirou antes de a World App responder.",
      };

  const start = async () => {
    setLoading(true); setError(null);
    try {
      if (SANDBOX) {
        const json = await submitProof("identity", {});
        const result: IdentityResult = {
          token: json.token, identityAttested: json.identityAttested, identityNullifier: json.identityNullifier, sandbox: json.sandbox,
        };
        setIdentity(result);
        patch({ identity: result });
        return;
      }
      setCtx(await fetchRpContext("identity"));
      setOpen(true);
    } catch {
      setError(t.err);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (result: unknown) => {
    const json = await submitProof("identity", result);
    const next: IdentityResult = {
      token: json.token, identityAttested: json.identityAttested, identityNullifier: json.identityNullifier, sandbox: json.sandbox,
    };
    setIdentity(next);
    patch({ identity: next });
  };

  const fail = (code: IDKitErrorCodes) => {
    setError(errorCopy[code] ?? t.err);
    setOpen(false);
  };

  return (
    <div>
      <StepHeading kicker={t.kicker} title={t.title} subtitle={t.sub} />
      <Card>
        {identity ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="green">🪪 {t.okTitle}</Badge>
              <Badge tone="green">✓ {t.age}</Badge>
              <Badge tone="blue">{t.jur}</Badge>
              {identity.sandbox && <Badge tone="amber">⚠ {t.sandbox}</Badge>}
            </div>
            <ProofRow label={t.idNull} value={short(identity.identityNullifier)} />
            <div className="flex items-center gap-3 pt-1">
              {canBack && <SecondaryButton onClick={back}>← {t.back}</SecondaryButton>}
              <PrimaryButton onClick={next}>{t.cont} →</PrimaryButton>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-2xl border border-[var(--color-border)] bg-stone-50/60 p-4 dark:bg-slate-800/40">
              <span className="text-2xl">🪪</span>
              <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">{t.why}</p>
            </div>
            <div className="flex items-center gap-3">
              <PrimaryButton onClick={start} disabled={loading || open}>
                {loading || open ? (
                  <><Spinner /> <span className="ml-2">{open ? t.waiting : t.starting}</span></>
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

      {ctx && open && (
        <IDKitRequestWidget
          open
          onOpenChange={(o) => { if (!o) setOpen(false); }}
          app_id={APP_ID}
          action={WORLD_ACTIONS.identity}
          rp_context={ctx}
          environment="staging"
          allow_legacy_proofs={false}
          // IDKit ships en|es|th only — no pt. English beats serving Spanish to a
          // Portuguese audience. Logged in WORLDID_TESTING.md §3.9.
          language="en"
          preset={identityCheck({ attributes: [...IDENTITY_ATTRIBUTES] })}
          handleVerify={handleVerify}
          onSuccess={() => setOpen(false)}
          onError={fail}
        />
      )}
    </div>
  );
}
