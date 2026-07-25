"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Locale } from "@/lib/i18n";
import { PrimaryButton, SecondaryButton } from "@/components/bridge/ui";

type Pool = { capacity: number; totalDrawn: number; utilizationBps: number; currentRateBps: number; totalInterest: number };
type Pt = { t: number; rate: number };

const POLL_MS = 2000;   // read the real pool state
const SAMPLE_MS = 400;  // push an (interpolated) point for a smooth line
const TICK_MS = 12000;  // market-maker on-chain move cadence
const WINDOW_MS = 70000; // rolling chart window
const MAX_BPS = 5000;   // y-axis top (50% APR)

export default function YieldLab({ lang }: { lang: Locale }) {
  const en = lang === "en";
  const [pool, setPool] = useState<Pool | null>(null);
  const [running, setRunning] = useState(false);
  const [pts, setPts] = useState<Pt[]>([]);
  const targetRate = useRef(200);
  const displayRate = useRef(200);
  const ticking = useRef(false);
  const tickTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const fmt = (n: number) => n.toLocaleString(en ? "en-US" : "pt-PT", { maximumFractionDigits: 0 });
  const pct = (bps: number) => `${(bps / 100).toFixed(2)}%`;

  const t = en
    ? { title: "Live yield", sub: "Our €1M treasury is a lending pool. A market maker borrows and repays on Sui, moving utilization — so the borrow rate (yield) moves in real time.",
        start: "Start market maker", stop: "Stop", running: "Market maker running", apr: "Borrow APR now", util: "Utilization", treasury: "Treasury", earned: "Yield earned", note: "Each move is a real transaction on Sui testnet." }
    : { title: "Rendimento ao vivo", sub: "A nossa tesouraria de €1M é um pool de crédito. Um market maker levanta e reembolsa na Sui, movendo a utilização — por isso a TAN (rendimento) muda em tempo real.",
        start: "Iniciar market maker", stop: "Parar", running: "Market maker ativo", apr: "TAN agora", util: "Utilização", treasury: "Tesouraria", earned: "Rendimento gerado", note: "Cada movimento é uma transação real na Sui testnet." };

  // Poll the real pool state.
  useEffect(() => {
    let alive = true;
    const poll = async () => {
      try {
        const r = await fetch("/api/sui/pool", { cache: "no-store" });
        const j = await r.json();
        if (alive && j.pool) {
          setPool(j.pool);
          targetRate.current = j.pool.currentRateBps;
        }
      } catch { /* ignore */ }
    };
    poll();
    const id = setInterval(poll, POLL_MS);
    return () => { alive = false; clearInterval(id); };
  }, []);

  // Sample an interpolated point on a fixed cadence → smooth scrolling line.
  useEffect(() => {
    const id = setInterval(() => {
      displayRate.current += (targetRate.current - displayRate.current) * 0.18;
      const now = Date.now();
      setPts((prev) => [...prev, { t: now, rate: displayRate.current }].filter((p) => now - p.t <= WINDOW_MS));
    }, SAMPLE_MS);
    return () => clearInterval(id);
  }, []);

  const tick = useCallback(async () => {
    if (ticking.current) return;
    ticking.current = true;
    try { await fetch("/api/mm/tick", { method: "POST" }); } catch { /* ignore */ } finally { ticking.current = false; }
  }, []);

  const start = () => {
    if (running) return;
    setRunning(true);
    tick();
    tickTimer.current = setInterval(tick, TICK_MS);
  };
  const stop = async () => {
    setRunning(false);
    if (tickTimer.current) clearInterval(tickTimer.current);
    tickTimer.current = null;
    try { await fetch("/api/mm/tick", { method: "DELETE" }); } catch { /* ignore */ }
  };
  useEffect(() => () => { if (tickTimer.current) clearInterval(tickTimer.current); }, []);

  // Build the SVG path over the rolling window.
  const W = 720, H = 220;
  const now = Date.now();
  const win = pts.filter((p) => now - p.t <= WINDOW_MS);
  const x = (tt: number) => ((tt - (now - WINDOW_MS)) / WINDOW_MS) * W;
  const y = (bps: number) => H - Math.min(1, bps / MAX_BPS) * (H - 12) - 6;
  const line = win.map((p, i) => `${i === 0 ? "M" : "L"}${x(p.t).toFixed(1)},${y(p.rate).toFixed(1)}`).join(" ");
  const area = win.length > 1 ? `${line} L${x(win[win.length - 1].t).toFixed(1)},${H} L${x(win[0].t).toFixed(1)},${H} Z` : "";
  const cur = win.length ? win[win.length - 1] : null;

  const gridBps = [1000, 2000, 3000, 4000, 5000];

  return (
    <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200/70 dark:bg-[var(--color-card)] dark:ring-slate-700 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">📈 {t.title}</h2>
          <p className="mt-1 max-w-xl text-sm text-slate-500 dark:text-slate-400">{t.sub}</p>
        </div>
        {running ? (
          <SecondaryButton onClick={stop}>■ {t.stop}</SecondaryButton>
        ) : (
          <PrimaryButton onClick={start}>▶ {t.start}</PrimaryButton>
        )}
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label={t.treasury} value={`€${fmt(pool?.capacity ?? 1_000_000)}`} />
        <Stat label={t.util} value={pct(pool?.utilizationBps ?? 0)} />
        <Stat label={t.apr} value={pct(cur ? cur.rate : pool?.currentRateBps ?? 200)} accent />
        <Stat label={t.earned} value={`€${fmt(pool?.totalInterest ?? 0)}`} emerald />
      </div>

      <div className="mt-5 overflow-hidden rounded-2xl border border-[var(--color-border)] bg-slate-50/60 dark:bg-slate-800/40">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-56 w-full" preserveAspectRatio="none">
          <defs>
            <linearGradient id="yl" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.28" />
              <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0" />
            </linearGradient>
          </defs>
          {gridBps.map((b) => (
            <g key={b}>
              <line x1="0" x2={W} y1={y(b)} y2={y(b)} stroke="currentColor" strokeOpacity="0.08" className="text-slate-500" />
              <text x="6" y={y(b) - 3} fontSize="10" fill="currentColor" className="text-slate-400" opacity="0.7">{(b / 100).toFixed(0)}%</text>
            </g>
          ))}
          {area && <path d={area} fill="url(#yl)" />}
          {line && <path d={line} fill="none" stroke="var(--color-primary)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />}
          {cur && <circle cx={x(cur.t)} cy={y(cur.rate)} r="4" fill="var(--color-primary)" />}
        </svg>
      </div>

      <p className="mt-3 flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500">
        {running && <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-500" />}
        {running ? t.running + " · " : ""}{t.note}
      </p>
    </div>
  );
}

function Stat({ label, value, accent, emerald }: { label: string; value: string; accent?: boolean; emerald?: boolean }) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200/70 dark:bg-[var(--color-card)] dark:ring-slate-700">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</p>
      <p className={`mt-1 text-xl font-bold ${emerald ? "text-emerald-600 dark:text-emerald-400" : accent ? "text-[var(--color-primary)]" : "text-slate-800 dark:text-slate-100"}`}>{value}</p>
    </div>
  );
}
