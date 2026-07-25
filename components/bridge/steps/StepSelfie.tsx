"use client";

import type { KycResult } from "@/lib/types";
import { WORLD_ACTIONS } from "@/lib/types";
import {
  fetchRpContext,
  SANDBOX,
  submitProof,
  type RpContext,
} from "@/lib/worldid-client";
import {
  IDKitErrorCodes,
  IDKitRequestWidget,
  selfieCheckLegacy,
} from "@worldcoin/idkit";
import { useState } from "react";
import type { StepProps } from "../BridgeWizard";
import {
  Badge,
  Card,
  PrimaryButton,
  ProofRow,
  SecondaryButton,
  Spinner,
  StepHeading,
} from "../ui";

const APP_ID = (process.env.NEXT_PUBLIC_WORLD_APP_ID ||
  "app_") as `app_${string}`;
const short = (s: string) =>
  s.length > 18 ? `${s.slice(0, 10)}…${s.slice(-6)}` : s;

export default function StepSelfie({
  lang,
  session,
  patch,
  next,
  back,
  canBack,
}: StepProps) {
  const en = lang === "en";
  const [open, setOpen] = useState(false);
  const [ctx, setCtx] = useState<RpContext | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [kyc, setKyc] = useState<KycResult | null>(session.kyc ?? null);

  const t = en
    ? {
        kicker: "Step 4",
        title: "Selfie Check",
        sub: "A live selfie proves the document holder is here right now — the second of two World ID checks.",
        why: "This links the pledge to one human, so the same person can't borrow against two properties. No selfie image or face template is ever stored.",
        start: "Verify with World ID",
        starting: "Preparing…",
        waiting: "Open World App to continue",
        okTitle: "Eligible",
        live: "Live human",
        selfieNull: "Selfie nullifier",
        cont: "Continue",
        back: "Back",
        retry: "Try again",
        sandbox: "SANDBOX — not a real proof",
        err: "Verification failed. Try again.",
      }
    : {
        kicker: "Passo 4",
        title: "Selfie Check",
        sub: "Uma selfie ao vivo prova que o titular do documento está mesmo presente — a segunda das duas verificações World ID.",
        why: "Isto liga a garantia a um único humano, para que a mesma pessoa não possa hipotecar dois imóveis. Nenhuma imagem ou modelo facial é armazenado.",
        start: "Verificar com World ID",
        starting: "A preparar…",
        waiting: "Abra a World App para continuar",
        okTitle: "Elegível",
        live: "Humano presente",
        selfieNull: "Nullifier da selfie",
        cont: "Continuar",
        back: "Voltar",
        retry: "Tentar de novo",
        sandbox: "SANDBOX — não é uma prova real",
        err: "Falha na verificação. Tente novamente.",
      };

  const errorCopy: Partial<Record<IDKitErrorCodes, string>> = en
    ? {
        [IDKitErrorCodes.CredentialUnavailable]:
          "You don't have this credential yet. Open World App to add it, then try again.",
        [IDKitErrorCodes.NullifierReplayed]:
          "This World ID has already been used for this step.",
        [IDKitErrorCodes.MaxVerificationsReached]:
          "This World ID has reached the verification limit for this action.",
        [IDKitErrorCodes.UserRejected]: "You cancelled the verification.",
        [IDKitErrorCodes.UserPresenceFailed]:
          "We couldn't confirm you were present. Try again in better light.",
        [IDKitErrorCodes.Timeout]:
          "The request timed out before World App responded.",
      }
    : {
        [IDKitErrorCodes.CredentialUnavailable]:
          "Ainda não tem esta credencial. Abra a World App para a adicionar e tente de novo.",
        [IDKitErrorCodes.NullifierReplayed]:
          "Este World ID já foi usado neste passo.",
        [IDKitErrorCodes.MaxVerificationsReached]:
          "Este World ID atingiu o limite de verificações para esta ação.",
        [IDKitErrorCodes.UserRejected]: "Cancelou a verificação.",
        [IDKitErrorCodes.UserPresenceFailed]:
          "Não conseguimos confirmar a sua presença. Repita com mais luz.",
        [IDKitErrorCodes.Timeout]:
          "O pedido expirou antes de a World App responder.",
      };

  const start = async () => {
    setLoading(true);
    setError(null);
    try {
      if (SANDBOX) {
        const json = await submitProof("selfie", {}, session.identity?.token);
        const next: KycResult = {
          token: json.token,
          identityAttested: json.identityAttested,
          identityNullifier: json.identityNullifier,
          selfieNullifier: json.selfieNullifier,
          sandbox: json.sandbox,
        };
        setKyc(next);
        patch({ kyc: next });
        return;
      }
      setCtx(await fetchRpContext("selfie"));
      setOpen(true);
    } catch {
      setError(t.err);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (result: unknown) => {
    const json = await submitProof("selfie", result, session.identity?.token);
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
    setOpen(false);
  };

  return (
    <div>
      <StepHeading kicker={t.kicker} title={t.title} subtitle={t.sub} />
      <Card>
        {kyc ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="green">🤳 {t.okTitle}</Badge>
              <Badge tone="green">✓ {t.live}</Badge>
              {kyc.sandbox && <Badge tone="amber">⚠ {t.sandbox}</Badge>}
            </div>
            <ProofRow label={t.selfieNull} value={short(kyc.selfieNullifier)} />
            <div className="flex items-center gap-3 pt-1">
              {canBack && (
                <SecondaryButton onClick={back}>← {t.back}</SecondaryButton>
              )}
              <PrimaryButton onClick={next}>{t.cont} →</PrimaryButton>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-2xl border border-[var(--color-border)] bg-stone-50/60 p-4 dark:bg-slate-800/40">
              <span className="text-2xl">🤳</span>
              <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                {t.why}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <PrimaryButton onClick={start} disabled={loading || open}>
                {loading || open ? (
                  <>
                    <Spinner />{" "}
                    <span className="ml-2">
                      {open ? t.waiting : t.starting}
                    </span>
                  </>
                ) : (
                  `🌐 ${error ? t.retry : t.start}`
                )}
              </PrimaryButton>
              {canBack && (
                <SecondaryButton onClick={back}>← {t.back}</SecondaryButton>
              )}
            </div>
            {error && (
              <p className="text-sm text-[var(--color-danger)]">{error}</p>
            )}
          </div>
        )}
      </Card>

      {ctx && open && (
        <IDKitRequestWidget
          open
          onOpenChange={(o) => {
            if (!o) setOpen(false);
          }}
          app_id={APP_ID}
          action={WORLD_ACTIONS.selfie}
          rp_context={ctx}
          allow_legacy_proofs
          require_user_presence
          // IDKit ships en|es|th only — no pt. English beats serving Spanish to a
          // Portuguese audience. Logged in WORLDID_TESTING.md §3.9.
          language="en"
          preset={selfieCheckLegacy({ signal: session.accountId })}
          handleVerify={handleVerify}
          onSuccess={() => setOpen(false)}
          onError={fail}
        />
      )}
    </div>
  );
}
