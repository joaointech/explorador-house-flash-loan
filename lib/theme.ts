/**
 * Theme (light / dark / system) — single source of truth.
 *
 * The site is light by default but follows the OS preference unless the
 * visitor pins a mode. We store the *preference* ("system" | "light" | "dark"),
 * not the resolved value, so "system" keeps tracking the OS live (handled by
 * the ThemeToggle's matchMedia listener). The resolved value is applied as a
 * `.dark` class on <html> plus `color-scheme`, which drives the `.dark` palette
 * override + the `dark:` Tailwind variant (see globals.css).
 *
 * THEME_INIT_SCRIPT runs render-blocking in the document <head> so the class is
 * on <html> before first paint (zero flash). Keep it in sync with the helpers
 * below — they encode the same resolution rule.
 */

export type ThemePref = "light" | "dark" | "system";

export const THEME_KEY = "theme";

/** Apply the resolved theme to <html>. Client-only. */
export function applyTheme(pref: ThemePref): void {
  const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const dark = pref === "dark" || (pref === "system" && systemDark);
  const root = document.documentElement;
  root.classList.toggle("dark", dark);
  root.style.colorScheme = dark ? "dark" : "light";
}

/** Read the stored preference, defaulting to "system" when unset/invalid. */
export function getStoredTheme(): ThemePref {
  try {
    const v = localStorage.getItem(THEME_KEY);
    if (v === "light" || v === "dark" || v === "system") return v;
  } catch {
    /* private mode / blocked storage — fall through to system */
  }
  return "system";
}

/** Persist the preference (clearing it for "system") and apply it now. */
export function setStoredTheme(pref: ThemePref): void {
  try {
    if (pref === "system") localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, pref);
  } catch {
    /* ignore — applyTheme below still updates the live document */
  }
  applyTheme(pref);
}

// Inline, render-blocking head script. Mirrors getStoredTheme + applyTheme.
// `e !== 'light'` folds "dark already handled" + "system" + null into the
// system-preference branch. Wrapped in try/catch so a storage exception can
// never block the parse.
export const THEME_INIT_SCRIPT = `(function(){try{var e=localStorage.getItem('${THEME_KEY}');var m=window.matchMedia('(prefers-color-scheme: dark)').matches;var d=e==='dark'||(e!=='light'&&m);var r=document.documentElement;r.classList.toggle('dark',d);r.style.colorScheme=d?'dark':'light';}catch(_){}})();`;
