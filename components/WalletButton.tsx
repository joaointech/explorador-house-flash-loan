"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useWallet } from "./WalletProvider";
import { suiscanObject } from "@/lib/types";

const short = (a: string) => (a.length > 14 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a);

/** Header wallet chip — Privy login (Google/email) → Sui wallet, or demo.
 * Signed in, it shows your email; click it for a popover with the full Sui
 * address (copyable), a Suiscan link, your account page, and sign out. */
export default function WalletButton({ lang = "pt" }: { lang?: "pt" | "en" }) {
  const { accountId, email, mode, connecting, connectPrivy, disconnect } = useWallet();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const t =
    lang === "en"
      ? { connect: "Sign in", connecting: "Connecting…", disconnect: "Disconnect", account: "Your account", address: "Sui address", copy: "Copy", copied: "Copied", view: "View on Suiscan" }
      : { connect: "Entrar", connecting: "A ligar…", disconnect: "Sair", account: "A sua conta", address: "Endereço Sui", copy: "Copiar", copied: "Copiado", view: "Ver no Suiscan" };

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const copy = async () => {
    if (!accountId) return;
    try {
      await navigator.clipboard.writeText(accountId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable — ignore */
    }
  };

  if (accountId) {
    return (
      <div ref={ref} className="relative">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="inline-flex items-center gap-2 rounded-lg bg-white/15 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/25"
        >
          <span className="h-2 w-2 rounded-full bg-emerald-400" />
          <span className="max-w-[10rem] truncate">{email ?? <span className="font-mono">{short(accountId)}</span>}</span>
          {mode === "demo" && <span className="rounded bg-white/20 px-1.5 py-0.5 text-[10px] uppercase tracking-wide">demo</span>}
        </button>

        {open && (
          <div className="absolute right-0 top-full z-40 mt-2 w-72 rounded-2xl bg-white p-4 text-left shadow-lg ring-1 ring-slate-200/70 dark:bg-[var(--color-card)] dark:ring-slate-700">
            {email && <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{email}</p>}
            <p className="mt-2 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{t.address}</p>
            <p className="mt-1 break-all font-mono text-xs text-slate-700 dark:text-slate-300">{accountId}</p>
            <div className="mt-3 flex items-center gap-3 text-xs">
              <button type="button" onClick={copy} className="font-semibold text-[var(--color-primary)] hover:underline">
                {copied ? `✓ ${t.copied}` : t.copy}
              </button>
              <a href={suiscanObject(accountId)} target="_blank" rel="noreferrer" className="font-semibold text-[var(--color-primary)] hover:underline">
                {t.view} ↗
              </a>
            </div>
            <div className="mt-3 border-t border-[var(--color-border)] pt-3">
              <Link
                href={`/${lang}/dashboard`}
                onClick={() => setOpen(false)}
                className="block rounded-lg px-2 py-1.5 text-sm font-medium text-slate-700 hover:bg-stone-50 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                {t.account}
              </Link>
              <button
                type="button"
                onClick={() => { setOpen(false); disconnect(); }}
                className="mt-1 block w-full rounded-lg px-2 py-1.5 text-left text-sm font-medium text-[var(--color-danger)] hover:bg-stone-50 dark:hover:bg-slate-800"
              >
                {t.disconnect}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={connectPrivy}
      disabled={connecting}
      className="inline-flex min-w-[6rem] items-center justify-center rounded-lg bg-white/15 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/25 disabled:opacity-60"
    >
      {connecting ? t.connecting : t.connect}
    </button>
  );
}
