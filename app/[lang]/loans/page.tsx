import LoansView from "@/components/LoansView";
import type { Locale } from "@/lib/i18n";

export default async function LoansPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang: raw } = await params;
  const lang: Locale = raw === "en" ? "en" : "pt";
  return <LoansView lang={lang} />;
}
