import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { WalletProvider } from "@/components/WalletProvider";
import { getDictionary } from "@/lib/dictionaries";
import { locales, type Locale } from "@/lib/i18n";

export function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang: raw } = await params;
  const lang: Locale = raw === "en" ? "en" : "pt";
  const dict = getDictionary(lang);

  return (
    <WalletProvider>
      <div className="flex min-h-screen flex-col bg-[var(--color-bg)]">
        <Header lang={lang} dict={dict} />
        <main className="flex-1">{children}</main>
        <Footer lang={lang} dict={dict} />
      </div>
    </WalletProvider>
  );
}
