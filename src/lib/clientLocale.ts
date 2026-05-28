import { getMessages, SUPPORTED_LOCALES, type Locale } from "@/lib/i18n";

function normalizeLocale(value: string | null | undefined): Locale | undefined {
  if (!value) return undefined;
  const candidate = value.toLowerCase() as Locale;
  return SUPPORTED_LOCALES.includes(candidate) ? candidate : undefined;
}

export function readClientLocale(): Locale | undefined {
  if (typeof document === "undefined") return undefined;
  const cookieMatch = document.cookie.match(/(?:^|; )lang=([^;]+)/);
  const cookieLocale = normalizeLocale(cookieMatch?.[1]);
  if (cookieLocale) return cookieLocale;
  const htmlLocale = normalizeLocale(document.documentElement.lang);
  if (htmlLocale) return htmlLocale;
  return undefined;
}

export function getClientMessages() {
  return getMessages(readClientLocale());
}
