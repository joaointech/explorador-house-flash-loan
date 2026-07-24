"use client";

import { useState } from "react";
import type { StepProps } from "../BridgeWizard";
import type { HouseToken } from "@/lib/types";
import { suiscanCoin, suiscanObject, suiscanTx, onChain } from "@/lib/types";
import { StepHeading, Card, PrimaryButton, SecondaryButton, Badge, Spinner, ProofRow } from "../ui";

export default function StepTokenize({ lang, session, patch, next, back, canBack }: StepProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<HouseToken | null>(session.token ?? null);

  const vpt = session.property?.vpt ?? 0;
  const article = session.property?.artigoMatricial ?? "0000";

  const t = lang === "en"
    ? {
        kicker: "Step 4", title: "Tokenize the house",
        sub: "Your property is minted as HOUSE equity coins on Sui (a published Move package) — 1 HOUSE = €1 of VPT — held in a shared CollateralVault object.",
        preview: "Coins to mint", eq: "= €{v} equity", mint: "Mint on Sui", minting: "Minting on Sui…",
        minted: "Minted", coin: "Coin type", vault: "Vault object", tx: "Mint tx", cont: "Continue", back: "Back",
        err: "Minting failed. Try again.",
      }
    : {
        kicker: "Passo 4", title: "Tokenizar o imóvel",
        sub: "O seu imóvel é emitido como moedas de capital HOUSE na Sui (um pacote Move publicado) — 1 HOUSE = €1 de VPT — guardadas num objeto CollateralVault partilhado.",
        preview: "Moedas a emitir", eq: "= €{v} de capital", mint: "Emitir na Sui", minting: "A emitir na Sui…",
        minted: "Emitido", coin: "Tipo de moeda", vault: "Objeto vault", tx: "Transação", cont: "Continuar", back: "Voltar",
        err: "Falha na emissão. Tente novamente.",
      };

  const fmt = (n: number) => n.toLocaleString(lang === "en" ? "en-US" : "pt-PT");
  const shortType = (s: string) => (s.length > 30 ? `${s.slice(0, 12)}…::house::HOUSE` : s);

  const mint = async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/sui/tokenize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vpt, article, accountId: session.accountId, sha256: session.storage?.sha256 }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "tokenize_failed");
      setToken(json.token);
      patch({ token: json.token });
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
        {token ? (
          <div className="space-y-3">
            <Badge tone="green">🪙 {t.minted}</Badge>
            <ProofRow label={t.coin} value={shortType(token.coinType)} href={onChain(token.coinType) ? suiscanCoin(token.coinType) : undefined} />
            {token.vaultId && <ProofRow label={t.vault} value={token.vaultId} href={onChain(token.vaultId) ? suiscanObject(token.vaultId) : undefined} />}
            <ProofRow label={t.tx} value={token.digest} href={onChain(token.digest) ? suiscanTx(token.digest) : undefined} />
            <div className="flex items-center gap-3 pt-1">
              {canBack && <SecondaryButton onClick={back}>← {t.back}</SecondaryButton>}
              <PrimaryButton onClick={next}>{t.cont} →</PrimaryButton>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-2xl bg-gradient-to-br from-[var(--color-primary)] to-blue-700 p-5 text-white">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/70">{t.preview}</p>
              <p className="mt-2 text-2xl font-bold">{fmt(vpt)} HOUSE</p>
              <p className="mt-1 text-sm text-white/80">{t.eq.replace("{v}", fmt(vpt))}</p>
            </div>
            <div className="flex items-center gap-3">
              <PrimaryButton onClick={mint} disabled={loading || vpt <= 0}>
                {loading ? <><Spinner /> <span className="ml-2">{t.minting}</span></> : `🪙 ${t.mint}`}
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
