import Link from "next/link";
import Logo from "./Logo";
import LanguageSwitcher from "./LanguageSwitcher";
import WalletButton from "./WalletButton";
import type { Locale } from "@/lib/i18n";
import type { Dictionary } from "@/lib/dictionaries";

/** Sticky brand-blue header — logo + wordmark left, nav + lang + wallet right. */
export default function Header({ lang, dict }: { lang: Locale; dict: Dictionary }) {
  const nav = [
    { href: `/${lang}#how`, label: dict.nav.how },
    { href: `/${lang}/loan`, label: dict.nav.bridge },
    { href: `/${lang}/loans`, label: dict.nav.loans },
    { href: `/${lang}/treasury`, label: dict.nav.treasury },
    { href: `/${lang}/dashboard`, label: dict.nav.dashboard },
  ];

  return (
    <header className="sticky top-0 z-30 bg-[var(--color-primary)] dark:bg-slate-900 lg:bg-[var(--color-primary)]/95 lg:backdrop-blur lg:dark:bg-slate-900/95">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:py-4">
        <Link href={`/${lang}`} className="inline-flex items-center gap-2">
          <Logo type="icon" variant="white" size={30} />
          <span className="text-xl font-bold lowercase tracking-tight text-white">explorador</span>
          <span className="hidden rounded bg-white/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/90 sm:inline">
            loans
          </span>
        </Link>

        <nav className="hidden items-center gap-6 lg:flex">
          {nav.map((n) => (
            <Link key={n.href} href={n.href} className="text-sm font-medium text-white/90 transition-opacity hover:opacity-80">
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <LanguageSwitcher lang={lang} />
          <WalletButton lang={lang} />
        </div>
      </div>
    </header>
  );
}
