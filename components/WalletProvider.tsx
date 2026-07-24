"use client";

/**
 * Hedera wallet context.
 *
 * Two ways to obtain the user's account id:
 *  1. Real HashPack via Hedera WalletConnect (DAppConnector) — the authentic
 *     path. Requires a WalletConnect projectId + a paired HashPack wallet.
 *  2. Demo account — a testnet account whose key the server holds, so the whole
 *     flow (associate → receive tokens → receive USDC) runs end-to-end during a
 *     pitch without a live mobile pairing. Enabled when
 *     NEXT_PUBLIC_DEMO_ACCOUNT_ID is set.
 *
 * The connector is imported lazily inside connect() so SSR/build never touches
 * the WalletConnect runtime.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

type WalletMode = "walletconnect" | "demo" | null;

type WalletCtx = {
  accountId: string | null;
  mode: WalletMode;
  connecting: boolean;
  error: string | null;
  connectHashPack: () => Promise<void>;
  connectDemo: () => void;
  disconnect: () => void;
};

const Ctx = createContext<WalletCtx | null>(null);
const STORAGE_KEY = "bridge.wallet";

export function useWallet(): WalletCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useWallet must be used inside <WalletProvider>");
  return ctx;
}

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [accountId, setAccountId] = useState<string | null>(null);
  const [mode, setMode] = useState<WalletMode>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Restore a prior session.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        const { accountId, mode } = JSON.parse(raw);
        setAccountId(accountId);
        setMode(mode);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const persist = useCallback((acc: string, m: WalletMode) => {
    setAccountId(acc);
    setMode(m);
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ accountId: acc, mode: m }));
    } catch {
      /* ignore */
    }
  }, []);

  const connectHashPack = useCallback(async () => {
    setConnecting(true);
    setError(null);
    const log = (...a: unknown[]) => console.log("[wallet]", ...a);
    try {
      const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;
      log("projectId present?", Boolean(projectId), projectId ? `(${projectId.slice(0, 6)}…)` : "");
      if (!projectId) throw new Error("missing_projectid — set NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID in .env.local (free at cloud.reown.com), then restart dev");

      log("importing @hashgraph/hedera-wallet-connect…");
      const { DAppConnector, HederaJsonRpcMethod, HederaSessionEvent, HederaChainId } = await import(
        "@hashgraph/hedera-wallet-connect"
      );
      const { LedgerId } = await import("@hashgraph/sdk");
      log("SDK loaded, building DAppConnector");

      const connector = new DAppConnector(
        {
          name: "explorador Bridge",
          description: "Home-equity bridge liquidity on Hedera",
          url: typeof window !== "undefined" ? window.location.origin : "https://bridge.explorador.pt",
          icons: [typeof window !== "undefined" ? `${window.location.origin}/icon-192.png` : ""],
        },
        LedgerId.TESTNET,
        projectId,
        Object.values(HederaJsonRpcMethod),
        [HederaSessionEvent.ChainChanged, HederaSessionEvent.AccountsChanged],
        [HederaChainId.Testnet],
      );

      log("connector.init()…");
      await connector.init({ logger: "error" });
      log("opening WalletConnect modal — approve in HashPack");
      const session = await connector.openModal();
      log("session", session);
      const acc = session.namespaces?.hedera?.accounts?.[0]?.split(":").pop();
      log("resolved account", acc);
      if (!acc) throw new Error("no_account — modal returned no Hedera account");
      persist(acc, "walletconnect");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[wallet] connect failed:", e);
      setError(msg);
    } finally {
      setConnecting(false);
    }
  }, [persist]);

  const connectDemo = useCallback(() => {
    const demo = process.env.NEXT_PUBLIC_DEMO_ACCOUNT_ID;
    if (!demo) {
      setError("missing_demo_account");
      return;
    }
    persist(demo, "demo");
  }, [persist]);

  const disconnect = useCallback(() => {
    setAccountId(null);
    setMode(null);
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo<WalletCtx>(
    () => ({ accountId, mode, connecting, error, connectHashPack, connectDemo, disconnect }),
    [accountId, mode, connecting, error, connectHashPack, connectDemo, disconnect],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
