import Logo from "./Logo";
import ThemeToggle from "./ThemeToggle";
import type { Locale } from "@/lib/i18n";
import type { Dictionary } from "@/lib/dictionaries";

export default function Footer({ lang, dict }: { lang: Locale; dict: Dictionary }) {
  return (
    <footer className="bg-[var(--color-primary)]/95 dark:bg-slate-900">
      <div className="mx-auto grid w-full max-w-7xl gap-8 px-4 py-10 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2">
            <Logo type="icon" variant="white" size={26} />
            <span className="text-lg font-bold lowercase tracking-tight text-white">explorador bridge</span>
          </div>
          <p className="max-w-xs text-sm leading-relaxed text-white/80">{dict.footer.tagline}</p>
        </div>

        <div className="space-y-2 text-sm">
          <p className="font-[family-name:var(--font-display)] text-base font-bold text-white">{dict.nav.how}</p>
          <a href={`/${lang}#how`} className="block text-white/80 transition-opacity hover:opacity-80">{dict.nav.how}</a>
          <a href={`/${lang}/bridge`} className="block text-white/80 transition-opacity hover:opacity-80">{dict.nav.bridge}</a>
          <a href={`/${lang}/dashboard`} className="block text-white/80 transition-opacity hover:opacity-80">{dict.nav.dashboard}</a>
        </div>

        <div className="space-y-3 text-sm">
          <p className="font-[family-name:var(--font-display)] text-base font-bold text-white">{lang === "en" ? "Preferences" : "Preferências"}</p>
          <ThemeToggle lang={lang} variant="onPrimary" />
          <p className="pt-2 text-xs text-white/70">{dict.footer.built}</p>
        </div>
      </div>
      <div className="border-t border-white/10">
        <p className="mx-auto max-w-7xl px-4 py-4 text-xs text-white/60">
          © {new Date().getFullYear()} explorador Bridge. {dict.footer.rights}
        </p>
      </div>
    </footer>
  );
}
