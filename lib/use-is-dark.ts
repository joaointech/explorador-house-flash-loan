"use client";

/**
 * Reactively tracks whether the dark theme is active — i.e. whether the `.dark`
 * class is on <html>. That class is the single source of truth for theme (set
 * pre-paint by THEME_INIT_SCRIPT and maintained by ThemeToggle/applyTheme,
 * including live OS-scheme changes), so a MutationObserver on it catches every
 * transition: toggle, system flip, all of it.
 *
 * Used by the map components to pick a light vs dark basemap and swap it live.
 * For correctness AT map-init time (this hook's state starts false and only
 * syncs after mount), read the class directly instead — see `isDarkNow()`.
 */

import { useEffect, useState } from "react";

/** Imperative read of the current theme — safe to call inside effects/init. */
export function isDarkNow(): boolean {
  return typeof document !== "undefined" && document.documentElement.classList.contains("dark");
}

export function useIsDark(): boolean {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const root = document.documentElement;
    const read = () => setDark(root.classList.contains("dark"));
    read();
    const mo = new MutationObserver(read);
    mo.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => mo.disconnect();
  }, []);
  return dark;
}
