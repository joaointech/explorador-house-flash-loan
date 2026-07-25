import TreasuryView from "@/components/TreasuryView";
import type { Locale } from "@/lib/i18n";

export default async function TreasuryPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang: raw } = await params;
  const lang: Locale = raw === "en" ? "en" : "pt";
  return <TreasuryView lang={lang} />;
}
