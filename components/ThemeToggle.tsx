"use client";

/**
 * Light / System / Dark segmented control.
 *
 * Persists the *preference* via lib/theme (so "System" keeps tracking the OS),
 * and while on "System" attaches a matchMedia listener so a live OS switch
 * repaints without a reload. The no-flash head script (THEME_INIT_SCRIPT) has
 * already set the correct class on first paint; this component only owns the
 * user-facing switch + writing the choice back.
 *
 * Two visual variants:
 *  - "onLight"   — sits on a card/page surface (settings). Self-themes in dark.
 *  - "onPrimary" — sits on the brand-blue footer. White-on-translucent track.
 *
 * Hydration: the selected pill depends on localStorage, which the server can't
 * know, so we render an inert (nothing-selected) track on the server and light
 * up the active pill only after mount — avoids an SSR/client mismatch.
 */

import { useEffect, useState } from "react";

import {
  applyTheme,
  getStoredTheme,
  setStoredTheme,
  type ThemePref,
} from "@/lib/theme";

type Variant = "onLight" | "onPrimary";

function SunIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden className={className}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  );
}

function MonitorIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden className={className}>
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </svg>
  );
}

function MoonIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden className={className}>
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
    </svg>
  );
}

const ICONS: Record<ThemePref, ({ className }: { className?: string }) => React.JSX.Element> = {
  light: SunIcon,
  system: MonitorIcon,
  dark: MoonIcon,
};

export default function ThemeToggle({
  lang = "pt",
  variant = "onLight",
  className = "",
}: {
  lang?: "pt" | "en";
  variant?: Variant;
  className?: string;
}) {
  const [pref, setPref] = useState<ThemePref>("system");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setPref(getStoredTheme());
    setMounted(true);
  }, []);

  // While on "System", repaint when the OS scheme flips.
  useEffect(() => {
    if (pref !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [pref]);

  const choose = (p: ThemePref) => {
    setPref(p);
    setStoredTheme(p);
  };

  const t =
    lang === "en"
      ? { group: "Theme", light: "Light", system: "System", dark: "Dark" }
      : { group: "Tema", light: "Claro", system: "Sistema", dark: "Escuro" };

  const opts: { key: ThemePref; label: string }[] = [
    { key: "light", label: t.light },
    { key: "system", label: t.system },
    { key: "dark", label: t.dark },
  ];

  const track =
    variant === "onPrimary"
      ? "bg-white/10 ring-1 ring-white/15"
      : "bg-slate-100 ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700";

  const idle =
    variant === "onPrimary"
      ? "text-white/70 hover:text-white"
      : "text-slate-500 hover:text-slate-800 dark:text-slate-300 dark:hover:text-white";

  // Active = a clearly elevated pill that reads on any background: a white pill
  // with dark text on the coloured/dark chrome, and a lighter-than-track slate
  // pill in dark mode (slate-600 on a slate-800 track) so the selection pops
  // instead of sinking.
  const activeCls =
    variant === "onPrimary"
      ? "bg-white text-slate-900 shadow-sm"
      : "bg-white text-slate-900 shadow-sm dark:bg-slate-600 dark:text-white";

  return (
    <div
      role="radiogroup"
      aria-label={t.group}
      className={`inline-flex items-center gap-0.5 rounded-full p-0.5 ${track} ${className}`}
    >
      {opts.map((o) => {
        const Icon = ICONS[o.key];
        const active = mounted && pref === o.key;
        return (
          <button
            key={o.key}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={o.label}
            title={o.label}
            onClick={() => choose(o.key)}
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-semibold transition-colors ${
              active ? activeCls : idle
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
