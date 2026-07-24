"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Locale } from "@/lib/i18n";

/** PT / EN pill switch that swaps the leading locale segment of the path. */
export default function LanguageSwitcher({ lang }: { lang: Locale }) {
  const pathname = usePathname() ?? "/pt";
  const rest = pathname.replace(/^\/(pt|en)/, "") || "";

  const opts: Locale[] = ["pt", "en"];
  return (
    <div className="inline-flex items-center gap-0.5 rounded-full bg-white/10 p-0.5 ring-1 ring-white/15">
      {opts.map((l) => {
        const active = l === lang;
        return (
          <Link
            key={l}
            href={`/${l}${rest}`}
            className={`rounded-full px-2.5 py-1 text-xs font-semibold uppercase transition-colors ${
              active ? "bg-white text-slate-900" : "text-white/70 hover:text-white"
            }`}
          >
            {l}
          </Link>
        );
      })}
    </div>
  );
}
