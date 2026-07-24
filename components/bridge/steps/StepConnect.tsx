"use client";

import { useEffect } from "react";
import { useWallet } from "@/components/WalletProvider";
import type { StepProps } from "../BridgeWizard";
import { StepHeading, Card, PrimaryButton, SecondaryButton, ProofRow, Badge } from "../ui";

export default function StepConnect({ lang, session, patch, next }: StepProps) {
  const { accountId, mode, connecting, error, connectHashPack, connectDemo } = useWallet();

  // Mirror the wallet account into the bridge session.
  useEffect(() => {
    if (accountId && accountId !== session.accountId) patch({ accountId });
  }, [accountId, session.accountId, patch]);

  const t =
    lang === "en"
      ? {
          kicker: "Step 1",
          title: "Connect your Hedera wallet",
          sub: "We use your Hedera account to receive the house-equity token and the USDC you draw. Connect HashPack, or use a demo account to try the full flow.",
          hashpack: "Connect HashPack",
          demo: "Use demo account",
          connected: "Wallet connected",
          account: "Account",
          cont: "Continue",
          err: "Couldn't connect. Try the demo account instead.",
        }
      : {
          kicker: "Passo 1",
          title: "Ligue a sua carteira Hedera",
          sub: "Usamos a sua conta Hedera para receber o token do imóvel e o USDC que levantar. Ligue o HashPack, ou use uma conta demo para experimentar todo o fluxo.",
          hashpack: "Ligar HashPack",
          demo: "Usar conta demo",
          connected: "Carteira ligada",
          account: "Conta",
          cont: "Continuar",
          err: "Não foi possível ligar. Experimente a conta demo.",
        };

  return (
    <div>
      <StepHeading kicker={t.kicker} title={t.title} subtitle={t.sub} />
      <Card>
        {accountId ? (
          <div className="space-y-4">
            <Badge tone="green">● {t.connected}</Badge>
            <ProofRow label={t.account} value={`${accountId}${mode === "demo" ? "  (demo)" : ""}`} />
            <div className="pt-2">
              <PrimaryButton onClick={next}>{t.cont} →</PrimaryButton>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-3">
              <PrimaryButton onClick={connectHashPack} disabled={connecting}>
                🔷 {t.hashpack}
              </PrimaryButton>
              <SecondaryButton onClick={connectDemo}>🧪 {t.demo}</SecondaryButton>
            </div>
            {error && (
              <div className="space-y-1">
                <p className="text-sm text-[var(--color-danger)]">{t.err}</p>
                <p className="break-words font-mono text-xs text-slate-500 dark:text-slate-400">{error}</p>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
