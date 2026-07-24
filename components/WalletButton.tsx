"use client";

import { useState } from "react";
import { useWallet } from "./WalletProvider";

/** Header wallet chip — connect (HashPack or demo) / show account / disconnect. */
export default function WalletButton({ lang = "pt" }: { lang?: "pt" | "en" }) {
  const { accountId, mode, connecting, error, connectHashPack, connectDemo, disconnect } = useWallet();
  const [open, setOpen] = useState(false);

  const t =
    lang === "en"
      ? { connect: "Connect wallet", hashpack: "HashPack", demo: "Use demo account", disconnect: "Disconnect", connecting: "Connecting…" }
      : { connect: "Ligar carteira", hashpack: "HashPack", demo: "Usar conta demo", disconnect: "Desligar", connecting: "A ligar…" };

  if (accountId) {
    return (
      <button
        type="button"
        onClick={disconnect}
        title={t.disconnect}
        className="inline-flex items-center gap-2 rounded-lg bg-white/15 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/25"
      >
        <span className="h-2 w-2 rounded-full bg-emerald-400" />
        <span className="font-mono">{accountId}</span>
        {mode === "demo" && <span className="rounded bg-white/20 px-1.5 py-0.5 text-[10px] uppercase tracking-wide">demo</span>}
      </button>
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={connecting}
        className="inline-flex min-w-[6.5rem] items-center justify-center rounded-lg bg-white/15 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/25 disabled:opacity-60"
      >
        {connecting ? t.connecting : t.connect}
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 w-56 overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-lg">
          <button
            type="button"
            onClick={() => { setOpen(false); connectHashPack(); }}
            className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm text-slate-700 transition-colors hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <span className="text-base">🔷</span> {t.hashpack}
          </button>
          <button
            type="button"
            onClick={() => { setOpen(false); connectDemo(); }}
            className="flex w-full items-center gap-2 border-t border-[var(--color-border)] px-4 py-3 text-left text-sm text-slate-700 transition-colors hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <span className="text-base">🧪</span> {t.demo}
          </button>
          {error && <p className="border-t border-[var(--color-border)] px-4 py-2 text-xs text-[var(--color-danger)]">{error}</p>}
        </div>
      )}
    </div>
  );
}
