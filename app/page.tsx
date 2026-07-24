import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { locales, defaultLocale, type Locale } from "@/lib/i18n";

/**
 * Root entry. Every user-facing page lives under /[lang]; this picks the best
 * locale from the Accept-Language header and redirects there. (Next 16 replaced
 * the `middleware` convention with `proxy`; doing the redirect here keeps
 * routing simple and avoids that migration for a single redirect.)
 */
export default async function RootPage() {
  const h = await headers();
  const header = h.get("accept-language") ?? "";
  const preferred = header
    .split(",")
    .map((p) => p.split(";")[0].trim().slice(0, 2).toLowerCase());
  const match = preferred.find((p) => locales.includes(p as Locale));
  redirect(`/${match ?? defaultLocale}`);
}
