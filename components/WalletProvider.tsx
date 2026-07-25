"use client";

/**
 * Wallet context — Privy embedded **Sui** wallet.
 *
 * Login is email / social / passkey (no extension); Privy provisions a
 * non-custodial Sui embedded wallet (`chainType: 'sui'`). We expose the Sui
 * address as `accountId` behind a small `useWallet()` context so the wizard
 * steps stay wallet-agnostic.
 *
 * When NEXT_PUBLIC_PRIVY_APP_ID isn't set we mount a demo-only provider so the
 * whole flow still runs in a pitch.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { PrivyProvider, usePrivy } from "@privy-io/react-auth";
// Sui lives under Privy's "extended chains" surface.
import { useCreateWallet } from "@privy-io/react-auth/extended-chains";

type WalletMode = "privy" | "demo" | null;

type WalletCtx = {
  accountId: string | null;
  email: string | null;
  name: string | null;
  mode: WalletMode;
  connecting: boolean;
  ready: boolean;
  error: string | null;
  connectPrivy: () => Promise<void>;
  connectDemo: () => void;
  disconnect: () => void;
};

const Ctx = createContext<WalletCtx | null>(null);
const DEMO_SUI = "0x00000000000000000000000000000000000000000000000000000000dec0ded0";

export function useWallet(): WalletCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useWallet must be used inside <WalletProvider>");
  return ctx;
}

// ── Privy-backed implementation ──────────────────────────────────────
function PrivyBridge({ children }: { children: React.ReactNode }) {
  const { ready, authenticated, user, login, logout } = usePrivy();
  const { createWallet } = useCreateWallet();
  const [connecting, setConnecting] = useState(false);
  const [wantWallet, setWantWallet] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [demoAcc, setDemoAcc] = useState<string | null>(null);

  // Find the Sui embedded wallet on the Privy user.
  const suiWallet = (user?.linkedAccounts ?? []).find(
    (a) => a.type === "wallet" && (a as { chainType?: string }).chainType === "sui",
  ) as { address?: string } | undefined;
  const accountId = demoAcc ?? suiWallet?.address ?? null;
  const email = user?.email?.address ?? user?.google?.email ?? null;
  const name = user?.google?.name ?? null;

  // Once authenticated with intent, ensure a Sui wallet exists.
  useEffect(() => {
    (async () => {
      if (!wantWallet || !authenticated || suiWallet || creating) return;
      setCreating(true);
      try {
        await createWallet({ chainType: "sui" });
      } catch (e) {
        setError(e instanceof Error ? e.message : "wallet_create_failed");
      } finally {
        setCreating(false);
        setConnecting(false);
        setWantWallet(false);
      }
    })();
  }, [wantWallet, authenticated, suiWallet, creating, createWallet]);

  useEffect(() => {
    if (suiWallet?.address) setConnecting(false);
  }, [suiWallet?.address]);

  const connectPrivy = useCallback(async () => {
    setError(null);
    setDemoAcc(null);
    setConnecting(true);
    setWantWallet(true);
    try {
      if (!authenticated) login();
    } catch (e) {
      setError(e instanceof Error ? e.message : "login_failed");
      setConnecting(false);
    }
  }, [authenticated, login]);

  const connectDemo = useCallback(() => {
    setError(null);
    setDemoAcc(DEMO_SUI);
  }, []);

  const disconnect = useCallback(() => {
    setDemoAcc(null);
    if (authenticated) logout();
  }, [authenticated, logout]);

  const value = useMemo<WalletCtx>(
    () => ({
      accountId,
      email,
      name,
      mode: demoAcc ? "demo" : suiWallet ? "privy" : null,
      connecting: connecting || creating,
      ready,
      error,
      connectPrivy,
      connectDemo,
      disconnect,
    }),
    [accountId, email, name, demoAcc, suiWallet, connecting, creating, ready, error, connectPrivy, connectDemo, disconnect],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

// ── Demo-only implementation (no Privy app configured) ───────────────
function DemoOnlyProvider({ children }: { children: React.ReactNode }) {
  const [accountId, setAccountId] = useState<string | null>(null);
  const value = useMemo<WalletCtx>(
    () => ({
      accountId,
      email: null,
      name: null,
      mode: accountId ? "demo" : null,
      connecting: false,
      ready: true,
      error: accountId ? null : null,
      connectPrivy: async () => setAccountId(DEMO_SUI),
      connectDemo: () => setAccountId(DEMO_SUI),
      disconnect: () => setAccountId(null),
    }),
    [accountId],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  if (!appId) return <DemoOnlyProvider>{children}</DemoOnlyProvider>;
  return (
    <PrivyProvider
      appId={appId}
      config={{
        appearance: { theme: "light", accentColor: "#2563eb" },
        loginMethods: ["google", "email"],
      }}
    >
      <PrivyBridge>{children}</PrivyBridge>
    </PrivyProvider>
  );
}
