"use client";

import { useEffect } from "react";
import { useWallet } from "@/components/WalletProvider";
import type { StepProps } from "../BridgeWizard";
import { StepHeading, Card, PrimaryButton, SecondaryButton, Badge } from "../ui";

export default function StepConnect({ lang, session, patch, next }: StepProps) {
  const { accountId, connecting, error, connectPrivy, connectDemo } = useWallet();

  useEffect(() => {
    if (accountId && accountId !== session.accountId) patch({ accountId });
  }, [accountId, session.accountId, patch]);

  const t =
    lang === "en"
      ? {
          kicker: "Step 1",
          title: "Sign in to get your Sui wallet",
          sub: "No extension, no seed phrase — sign in with email or a social account and Privy provisions a non-custodial Sui wallet that receives your house token and the USDC you draw.",
          signin: "Sign in with Privy",
          demo: "Use demo wallet",
          connected: "Wallet ready",
          cont: "Continue",
          connecting: "Connecting…",
        }
      : {
          kicker: "Passo 1",
          title: "Entre para obter a sua carteira Sui",
          sub: "Sem extensão, sem seed phrase — entre com email ou uma conta social e a Privy cria uma carteira Sui não-custodial que recebe o token do imóvel e o USDC que levantar.",
          signin: "Entrar com Privy",
          demo: "Usar carteira demo",
          connected: "Carteira pronta",
          cont: "Continuar",
          connecting: "A ligar…",
        };

  return (
    <div>
      <StepHeading kicker={t.kicker} title={t.title} subtitle={t.sub} />
      <Card>
        {accountId ? (
          <div className="space-y-4">
            <Badge tone="green">● {t.connected}</Badge>
            <div className="pt-2">
              <PrimaryButton onClick={next}>{t.cont} →</PrimaryButton>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-3">
              <PrimaryButton onClick={connectPrivy} disabled={connecting}>
                {connecting ? t.connecting : `🔐 ${t.signin}`}
              </PrimaryButton>
              <SecondaryButton onClick={connectDemo}>🧪 {t.demo}</SecondaryButton>
            </div>
            {error && <p className="break-words font-mono text-xs text-[var(--color-danger)]">{error}</p>}
          </div>
        )}
      </Card>
    </div>
  );
}
