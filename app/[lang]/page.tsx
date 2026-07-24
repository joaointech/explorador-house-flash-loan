import Link from "next/link";
import { getDictionary } from "@/lib/dictionaries";
import type { Locale } from "@/lib/i18n";

const DOT_TEXTURE: React.CSSProperties = {
  backgroundImage: "radial-gradient(circle, rgba(37, 99, 235, 0.08) 1px, transparent 1px)",
  backgroundSize: "28px 28px",
  maskImage: "radial-gradient(ellipse 80% 70% at 50% 40%, black 40%, transparent 90%)",
  WebkitMaskImage: "radial-gradient(ellipse 80% 70% at 50% 40%, black 40%, transparent 90%)",
};

export default async function Landing({ params }: { params: Promise<{ lang: string }> }) {
  const { lang: raw } = await params;
  const lang: Locale = raw === "en" ? "en" : "pt";
  const dict = getDictionary(lang);

  return (
    <div className="relative overflow-hidden">
      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="relative bg-stone-50 dark:bg-slate-950">
        <div className="pointer-events-none absolute inset-0" style={DOT_TEXTURE} aria-hidden />
        <div className="relative mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:py-20 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
              {dict.hero.kicker}
            </p>
            <h1 className="mt-4 text-4xl font-bold leading-[1.05] text-slate-800 dark:text-slate-100 sm:text-5xl lg:text-[3.25rem] xl:text-6xl">
              {dict.hero.title1}{" "}
              <span className="bg-gradient-to-r from-blue-700 via-blue-500 to-sky-500 bg-clip-text text-transparent">
                {dict.hero.title2}
              </span>
            </h1>
            <p className="mt-6 max-w-xl text-base font-medium leading-relaxed text-slate-700 dark:text-slate-300 sm:text-lg">
              {dict.hero.lead}
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href={`/${lang}/bridge`}
                className="inline-flex h-12 items-center justify-center rounded-xl bg-[var(--color-primary)] px-7 text-base font-semibold text-white shadow-[0_8px_24px_rgba(37,99,235,0.35)] transition-all duration-200 hover:scale-[1.02] hover:bg-[var(--color-primary-dark)] hover:shadow-[0_12px_32px_rgba(37,99,235,0.5)]"
              >
                {dict.hero.ctaPrimary}
              </Link>
              <a
                href="#how"
                className="inline-flex h-12 items-center justify-center rounded-xl border border-[var(--color-border)] px-6 text-base font-medium text-slate-700 transition hover:bg-white dark:text-slate-300 dark:hover:bg-slate-800"
              >
                {dict.hero.ctaSecondary}
              </a>
            </div>

            {/* Stats */}
            <div className="mt-10 flex flex-wrap gap-3">
              {[
                { v: dict.hero.stat1, l: dict.hero.stat1Label },
                { v: dict.hero.stat2, l: dict.hero.stat2Label },
                { v: dict.hero.stat3, l: dict.hero.stat3Label },
              ].map((s) => (
                <div
                  key={s.l}
                  className="inline-flex max-w-full flex-col rounded-2xl border border-slate-200/70 bg-white/60 px-5 py-3 shadow-[0_4px_16px_-8px_rgba(15,23,42,0.18)] backdrop-blur-sm dark:border-slate-700 dark:bg-slate-800/60"
                >
                  <span className="text-2xl font-bold text-slate-800 dark:text-slate-100">{s.v}</span>
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{s.l}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Hero card — the flow at a glance */}
          <div className="relative">
            <div className="group relative flex flex-col gap-4 overflow-hidden rounded-3xl bg-gradient-to-br from-[var(--color-primary)] to-blue-700 p-7 text-white shadow-[0_18px_40px_-12px_rgba(37,99,235,0.45)] sm:p-9">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/70">
                {lang === "en" ? "Your house, on-chain" : "A sua casa, on-chain"}
              </p>
              <div className="rounded-2xl bg-white/10 p-4 ring-1 ring-white/15">
                <p className="text-sm text-white/70">{lang === "en" ? "Property (VPT)" : "Imóvel (VPT)"}</p>
                <p className="text-3xl font-bold">€250 000</p>
                <p className="mt-1 text-xs text-white/60">Artigo 1234 · Lisboa</p>
              </div>
              <div className="flex items-center justify-center text-white/60">↓</div>
              <div className="rounded-2xl bg-white p-4 text-slate-900 shadow-lg">
                <p className="text-sm text-slate-500">{lang === "en" ? "Liquidity drawn (USDC)" : "Liquidez levantada (USDC)"}</p>
                <p className="text-3xl font-bold text-[var(--color-primary)]">$45 000</p>
                <p className="mt-1 text-xs text-slate-400">{lang === "en" ? "collateral 30% · disbursed by AI agent" : "garantia 30% · pago por agente IA"}</p>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {["Hedera HTS", "Walrus", "World ID", "HCS"].map((b) => (
                  <span key={b} className="rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold text-white/90">{b}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Problem ──────────────────────────────────────────── */}
      <section className="mx-auto max-w-5xl px-4 py-14 sm:py-20">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">{dict.problem.kicker}</p>
        <h2 className="mt-3 font-[family-name:var(--font-display)] text-[1.6rem] font-bold leading-tight tracking-tight text-slate-800 dark:text-slate-100 sm:text-4xl">
          {dict.problem.title}
        </h2>
        <p className="mt-5 max-w-3xl text-base leading-relaxed text-slate-600 dark:text-slate-400 sm:text-lg">{dict.problem.body}</p>
      </section>

      {/* ── How it works ─────────────────────────────────────── */}
      <section id="how" className="relative scroll-mt-24 bg-stone-50 dark:bg-slate-950">
        <div className="pointer-events-none absolute inset-0" style={DOT_TEXTURE} aria-hidden />
        <div className="relative mx-auto max-w-7xl px-4 py-14 sm:py-20">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">{dict.how.kicker}</p>
          <h2 className="mt-3 font-[family-name:var(--font-display)] text-[1.6rem] font-bold leading-tight tracking-tight text-slate-800 dark:text-slate-100 sm:text-4xl">
            {dict.how.title}
          </h2>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {dict.how.steps.map((s) => (
              <div key={s.title} className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200/70 transition-shadow hover:shadow-md dark:bg-[var(--color-card)] dark:ring-slate-700">
                <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 sm:text-lg">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Trust ────────────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-4 py-14 sm:py-20">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">{dict.trust.kicker}</p>
        <h2 className="mt-3 font-[family-name:var(--font-display)] text-[1.6rem] font-bold leading-tight tracking-tight text-slate-800 dark:text-slate-100 sm:text-4xl">
          {dict.trust.title}
        </h2>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {dict.trust.items.map((it) => (
            <div key={it.title} className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200/70 dark:bg-[var(--color-card)] dark:ring-slate-700">
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 sm:text-lg">{it.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{it.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────── */}
      <section className="mx-auto max-w-5xl px-4 pb-20">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[var(--color-primary)] to-blue-700 px-6 py-12 text-center text-white shadow-[0_18px_40px_-12px_rgba(37,99,235,0.45)] sm:px-12">
          <h2 className="mx-auto max-w-2xl text-2xl font-bold sm:text-3xl">{dict.cta.title}</h2>
          <p className="mx-auto mt-3 max-w-xl text-white/85">{dict.cta.body}</p>
          <Link
            href={`/${lang}/bridge`}
            className="mt-8 inline-flex h-12 items-center justify-center rounded-xl bg-white px-7 text-base font-semibold text-[var(--color-primary)] shadow-lg transition-all hover:scale-[1.02]"
          >
            {dict.cta.button}
          </Link>
        </div>
      </section>
    </div>
  );
}
