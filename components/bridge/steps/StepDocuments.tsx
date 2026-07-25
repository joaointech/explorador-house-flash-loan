"use client";

import { useRef, useState } from "react";
import type { StepProps } from "../BridgeWizard";
import type { DocKind, PropertyData, StorageResult } from "@/lib/types";
import { walruscanBlob, onWalrus, onChain, suiscanTx } from "@/lib/types";
import { StepHeading, Card, PrimaryButton, SecondaryButton, Badge, Spinner, ProofRow } from "../ui";

/** The three slots the borrower uploads; `termo` (the signed debt acknowledgement)
 * only joins `StoredDoc[]` later, at disburse time, and is never picked here. */
type UploadKind = Exclude<DocKind, "termo">;
const SLOTS: UploadKind[] = ["cartaoCidadao", "cadernetaPredial", "declaracaoImi"];

export default function StepDocuments({ lang, session, patch, next, back, canBack }: StepProps) {
  const inputRefs = { cartaoCidadao: useRef<HTMLInputElement>(null), cadernetaPredial: useRef<HTMLInputElement>(null), declaracaoImi: useRef<HTMLInputElement>(null) };
  const [docs, setDocs] = useState<Partial<Record<UploadKind, File>>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [demo, setDemo] = useState(false);
  const [data, setData] = useState<PropertyData | null>(session.property ?? null);
  const [storing, setStoring] = useState(false);
  const [storage, setStorage] = useState<StorageResult | null>(session.storage ?? null);

  const t = lang === "en"
    ? {
        kicker: "Step 2", title: "Documents + AI",
        sub: "Upload your Cartão de Cidadão, the caderneta predial (property tax register) and the Declaração de IMI. AI extracts the key fields for you to confirm.",
        drop: "Click to choose a file (PDF or photo)", parse: "Extract with AI", parsing: "Reading documents…",
        extracted: "Extracted", demoNote: "Demo data (no AI key configured)", seal: "Seal & store", sealing: "Encrypting & storing…",
        back: "Back", reparse: "Re-upload", cont: "Continue",
        storedTitle: "Encrypted & anchored", anchor: "Sui anchor", sealBadge: "Seal-encrypted", aesBadge: "AES-encrypted",
        f: { artigoMatricial: "Tax article", vpt: "VPT value (€)", morada: "Address", freguesia: "Parish", concelho: "Municipality", proprietario: "Owner", fracao: "Fraction" },
        d: { cartaoCidadao: "Cartão de Cidadão", cadernetaPredial: "Caderneta Predial", declaracaoImi: "Declaração de IMI" },
        err: "Couldn't read the documents. Try again.", storeErr: "Storage failed. Try again.",
      }
    : {
        kicker: "Passo 2", title: "Documentos + IA",
        sub: "Carregue o Cartão de Cidadão, a caderneta predial e a Declaração de IMI. A IA extrai os campos-chave para confirmar.",
        drop: "Clique para escolher um ficheiro (PDF ou foto)", parse: "Extrair com IA", parsing: "A ler os documentos…",
        extracted: "Extraído", demoNote: "Dados demo (sem chave de IA)", seal: "Selar & guardar", sealing: "A cifrar e guardar…",
        back: "Voltar", reparse: "Recarregar", cont: "Continuar",
        storedTitle: "Cifrado & ancorado", anchor: "Âncora Sui", sealBadge: "Cifrado com Seal", aesBadge: "Cifrado (AES)",
        f: { artigoMatricial: "Artigo matricial", vpt: "Valor VPT (€)", morada: "Morada", freguesia: "Freguesia", concelho: "Concelho", proprietario: "Proprietário", fracao: "Fração" },
        d: { cartaoCidadao: "Cartão de Cidadão", cadernetaPredial: "Caderneta Predial", declaracaoImi: "Declaração de IMI" },
        err: "Não foi possível ler os documentos. Tente novamente.", storeErr: "Falha ao guardar. Tente novamente.",
      };

  const allPicked = SLOTS.every((k) => docs[k]);

  const onPick = (kind: UploadKind) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) setDocs((d) => ({ ...d, [kind]: f }));
    setError(null);
  };

  const parse = async () => {
    if (!allPicked) return;
    setLoading(true); setError(null);
    try {
      const fd = new FormData();
      SLOTS.forEach((k) => fd.append("files", docs[k]!));
      const res = await fetch("/api/parse-docs", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "parse_failed");
      setData(json.property);
      setDemo(Boolean(json.demo));
    } catch {
      setError(t.err);
    } finally {
      setLoading(false);
    }
  };

  const setField = (k: keyof PropertyData, v: string) => {
    if (!data) return;
    setData({ ...data, [k]: k === "vpt" ? Number(v) || 0 : v });
  };

  const sealAndStore = async () => {
    if (!data || !allPicked) return;
    patch({ property: data });
    setStoring(true); setError(null);
    try {
      const fd = new FormData();
      SLOTS.forEach((k) => fd.append(k, docs[k]!));
      fd.append("article", data.artigoMatricial);
      const res = await fetch("/api/store-docs", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "store_failed");
      setStorage(json.storage);
      patch({ storage: json.storage });
    } catch {
      setError(t.storeErr);
    } finally {
      setStoring(false);
    }
  };

  const FIELDS: [keyof PropertyData, string][] = [
    ["artigoMatricial", t.f.artigoMatricial], ["vpt", t.f.vpt], ["morada", t.f.morada],
    ["freguesia", t.f.freguesia], ["concelho", t.f.concelho], ["proprietario", t.f.proprietario], ["fracao", t.f.fracao],
  ];

  return (
    <div>
      <StepHeading kicker={t.kicker} title={t.title} subtitle={t.sub} />
      <Card>
        {!data ? (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              {SLOTS.map((kind) => (
                <div key={kind}>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{t.d[kind]}</p>
                  <button
                    type="button"
                    onClick={() => inputRefs[kind].current?.click()}
                    className="flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-[var(--color-border)] bg-stone-50/50 px-4 py-8 text-center transition hover:border-[var(--color-primary)] hover:bg-blue-50/40 dark:bg-slate-800/40"
                  >
                    <span className="text-3xl">{docs[kind] ? "✅" : "📄"}</span>
                    <span className="text-sm font-medium text-slate-600 dark:text-slate-300">{t.drop}</span>
                    {docs[kind] && <span className="mt-1 truncate text-xs text-[var(--color-primary)]">{docs[kind]!.name}</span>}
                  </button>
                  <input ref={inputRefs[kind]} type="file" accept="application/pdf,image/*" hidden onChange={onPick(kind)} />
                </div>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <PrimaryButton onClick={parse} disabled={!allPicked || loading}>
                {loading ? <><Spinner /> <span className="ml-2">{t.parsing}</span></> : `✨ ${t.parse}`}
              </PrimaryButton>
              {canBack && <SecondaryButton onClick={back}>← {t.back}</SecondaryButton>}
            </div>
            {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}
          </div>
        ) : (
          <div className="space-y-5">
            <div className="flex items-center gap-2">
              <Badge tone="green">✓ {t.extracted}</Badge>
              {demo && <Badge tone="amber">{t.demoNote}</Badge>}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {FIELDS.map(([key, label]) => (
                <label key={key} className="block">
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</span>
                  <input
                    value={String(data[key] ?? "")}
                    onChange={(e) => setField(key, e.target.value)}
                    className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-base outline-none transition focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary-light)] dark:border-slate-700 dark:bg-slate-900"
                  />
                </label>
              ))}
            </div>
            {storage ? (
              <div className="space-y-3 rounded-2xl border border-[var(--color-border)] bg-stone-50/60 p-4 dark:bg-slate-800/40">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="green">🔒 {t.storedTitle}</Badge>
                  <Badge tone={storage.sealed ? "blue" : "amber"}>{storage.sealed ? t.sealBadge : t.aesBadge}</Badge>
                </div>
                {storage.documents.map((doc) => (
                  <ProofRow
                    key={doc.kind}
                    label={t.d[doc.kind as keyof typeof t.d] ?? doc.kind}
                    value={doc.blobId}
                    href={onWalrus(doc.blobId) ? walruscanBlob(doc.blobId) : undefined}
                  />
                ))}
                <ProofRow
                  label={t.anchor}
                  value={storage.anchorDigest}
                  href={onChain(storage.anchorDigest) ? suiscanTx(storage.anchorDigest) : undefined}
                />
              </div>
            ) : null}

            <div className="flex items-center gap-3 pt-1">
              {canBack && <SecondaryButton onClick={back}>← {t.back}</SecondaryButton>}
              {!storage && <SecondaryButton onClick={() => { setData(null); setDocs({}); }}>{t.reparse}</SecondaryButton>}
              {storage ? (
                <PrimaryButton onClick={next}>{t.cont} →</PrimaryButton>
              ) : (
                <PrimaryButton onClick={sealAndStore} disabled={storing}>
                  {storing ? <><Spinner /> <span className="ml-2">{t.sealing}</span></> : `🔒 ${t.seal}`}
                </PrimaryButton>
              )}
            </div>
            {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}
          </div>
        )}
      </Card>
    </div>
  );
}
