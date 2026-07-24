"use client";

import { useState } from "react";
import type { StepProps } from "../BridgeWizard";
import type { HouseToken } from "@/lib/types";
import { hashscanToken } from "@/lib/types";
import { StepHeading, Card, PrimaryButton, SecondaryButton, Badge, Spinner, ProofRow } from "../ui";

export default function StepTokenize({ lang, session, patch, next, back, canBack }: StepProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<HouseToken | null>(session.token ?? null);
  const [demo, setDemo] = useState(false);

  const vpt = session.property?.vpt ?? 0;
  const article = session.property?.artigoMatricial ?? "0000";
  const symbol = `HSE${article}`.slice(0, 8).toUpperCase();

  const t = lang === "en"
    ? {
        kicker: "Step 4", title: "Tokenize the house",
        sub: "Your property is issued as a fungible equity token on Hedera (HTS) — SDK only, no smart contracts. Supply is pegged 1:1 to the VPT value in euros.",
        preview: "Token to mint", supply: "Supply", eq: "= €{v} equity", mint: "Mint on Hedera", minting: "Minting on Hedera…",
        minted: "Minted", tokenId: "Token", tx: "Mint tx", cont: "Continue", back: "Back",
        err: "Minting failed. Try again.",
      }
    : {
        kicker: "Passo 4", title: "Tokenizar o imóvel",
        sub: "O seu imóvel é emitido como token de capital fungível na Hedera (HTS) — apenas SDK, sem contratos inteligentes. O fornecimento é indexado 1:1 ao valor VPT em euros.",
        preview: "Token a emitir", supply: "Fornecimento", eq: "= €{v} de capital", mint: "Emitir na Hedera", minting: "A emitir na Hedera…",
        minted: "Emitido", tokenId: "Token", tx: "Transação", cont: "Continuar", back: "Voltar",
        err: "Falha na emissão. Tente novamente.",
      };

  const fmt = (n: number) => n.toLocaleString(lang === "en" ? "en-US" : "pt-PT");

  const mint = async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/hedera/tokenize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vpt, article, accountId: session.accountId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "tokenize_failed");
      setToken(json.token);
      setDemo(Boolean(json.demo));
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
          <div className="space-y-4">
            <Badge tone="green">🪙 {t.minted}</Badge>
            <ProofRow label={t.tokenId} value={`${token.symbol} · ${token.tokenId}`} href={demo ? undefined : hashscanToken(token.tokenId)} />
            <ProofRow label={t.supply} value={`${fmt(token.totalSupply)} ${token.symbol}`} mono={false} />
            <div className="flex items-center gap-3 pt-1">
              {canBack && <SecondaryButton onClick={back}>← {t.back}</SecondaryButton>}
              <PrimaryButton onClick={next}>{t.cont} →</PrimaryButton>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-2xl bg-gradient-to-br from-[var(--color-primary)] to-blue-700 p-5 text-white">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/70">{t.preview}</p>
              <p className="mt-2 text-2xl font-bold">{symbol}</p>
              <p className="mt-1 text-sm text-white/80">{fmt(vpt)} {symbol} · {t.eq.replace("{v}", fmt(vpt))}</p>
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
