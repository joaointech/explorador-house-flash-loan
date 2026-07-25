import BridgeWizard from "@/components/bridge/BridgeWizard";
import type { Locale } from "@/lib/i18n";

export default async function BridgePage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang: raw } = await params;
  const lang: Locale = raw === "en" ? "en" : "pt";
  return <BridgeWizard lang={lang} />;
}
