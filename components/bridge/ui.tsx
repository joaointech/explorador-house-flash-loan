"use client";

import type { ReactNode } from "react";

/** Shared building blocks for the wizard steps — same class vocabulary as explorador. */

export function StepHeading({ kicker, title, subtitle }: { kicker: string; title: string; subtitle?: string }) {
  return (
    <div className="mb-6">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">{kicker}</p>
      <h2 className="mt-2 text-2xl font-bold text-slate-800 dark:text-slate-100 sm:text-3xl">{title}</h2>
      {subtitle && <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-600 dark:text-slate-400">{subtitle}</p>}
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200/70 dark:bg-[var(--color-card)] dark:ring-slate-700 sm:p-8 ${className}`}>
      {children}
    </div>
  );
}

export function PrimaryButton({
  children,
  onClick,
  disabled,
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="inline-flex h-11 items-center justify-center rounded-lg bg-[var(--color-primary)] px-6 text-sm font-semibold text-white transition hover:bg-blue-700 active:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {children}
    </button>
  );
}

export function SecondaryButton({ children, onClick, disabled }: { children: ReactNode; onClick?: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex h-11 items-center justify-center rounded-lg border border-[var(--color-border)] px-5 text-sm font-medium text-slate-700 transition hover:bg-stone-50 disabled:opacity-50 dark:text-slate-300 dark:hover:bg-slate-800"
    >
      {children}
    </button>
  );
}

/** A labelled proof row — links to Suiscan / shows an id returned by a chain call. */
export function ProofRow({ label, value, href, mono = true }: { label: string; value: string; href?: string; mono?: boolean }) {
  const body = (
    <span className={`truncate ${mono ? "font-mono" : ""} text-slate-800 dark:text-slate-200`}>{value}</span>
  );
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--color-border)] bg-stone-50/60 px-4 py-2.5 text-sm dark:bg-slate-800/50">
      <span className="flex-none text-slate-500 dark:text-slate-400">{label}</span>
      {href ? (
        <a href={href} target="_blank" rel="noreferrer" className="min-w-0 truncate text-[var(--color-primary)] underline-offset-2 hover:underline">
          {value} ↗
        </a>
      ) : (
        <span className="min-w-0 truncate">{body}</span>
      )}
    </div>
  );
}

export function Badge({ children, tone = "blue" }: { children: ReactNode; tone?: "blue" | "green" | "amber" }) {
  const tones = {
    blue: "bg-[#DBEAFE]/60 text-[var(--color-primary)] dark:bg-[var(--color-primary)]/20 dark:text-blue-200",
    green: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
    amber: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  };
  return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${tones[tone]}`}>{children}</span>;
}

export function Spinner({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}
