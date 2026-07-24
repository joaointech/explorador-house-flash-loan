"use client";

import { useWallet } from "./WalletProvider";

const short = (a: string) => (a.length > 14 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a);

/** Header wallet chip — Privy login (email/social) → Sui wallet, or demo. */
export default function WalletButton({ lang = "pt" }: { lang?: "pt" | "en" }) {
  const { accountId, mode, connecting, connectPrivy, disconnect } = useWallet();

  const t =
    lang === "en"
      ? { connect: "Sign in", connecting: "Connecting…", disconnect: "Disconnect" }
      : { connect: "Entrar", connecting: "A ligar…", disconnect: "Sair" };

  if (accountId) {
    return (
      <button
        type="button"
        onClick={disconnect}
        title={`${accountId} — ${t.disconnect}`}
        className="inline-flex items-center gap-2 rounded-lg bg-white/15 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/25"
      >
        <span className="h-2 w-2 rounded-full bg-emerald-400" />
        <span className="font-mono">{short(accountId)}</span>
        {mode === "demo" && <span className="rounded bg-white/20 px-1.5 py-0.5 text-[10px] uppercase tracking-wide">demo</span>}
      </button>
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
