"use client";

/**
 * Tracks whether the browser window is narrower than IDKit's own mobile/desktop
 * breakpoint (`@media (max-width: 1024px)` inside @worldcoin/idkit). Below it, the
 * widget silently swaps its QR code for a plain "Open World App" deep-link — which,
 * on a desktop with no World App installed to catch it, just navigates the browser
 * to world.org's generic download page. Used to warn before a user hits that trap.
 */

import { useEffect, useState } from "react";

const BREAKPOINT = 1025;

export function useNarrowWindow(): boolean {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const read = () => setNarrow(window.innerWidth < BREAKPOINT);
    read();
    window.addEventListener("resize", read);
    return () => window.removeEventListener("resize", read);
  }, []);
  return narrow;
}
