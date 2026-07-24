import DashboardView from "@/components/DashboardView";
import type { Locale } from "@/lib/i18n";

export default async function DashboardPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang: raw } = await params;
  const lang: Locale = raw === "en" ? "en" : "pt";
  return <DashboardView lang={lang} />;
}
