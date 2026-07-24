export const locales = ['pt', 'en'] as const;
export type Locale = typeof locales[number];

export const defaultLocale: Locale = 'pt';

/** UI locale from a `/[lang]/…` pathname (the user's chosen account language). */
export function localeFromPathname(pathname: string | null | undefined): Locale {
  const seg = pathname?.split('/').filter(Boolean)[0];
  return seg === 'en' ? 'en' : 'pt';
}