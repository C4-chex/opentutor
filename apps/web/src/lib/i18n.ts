import en from "@/locales/en.json";
import zh from "@/locales/zh.json";
import zhUi from "@/locales/zh-ui.json";

export type Locale = "en" | "zh";

const SUPPORTED_LOCALES: Locale[] = ["en", "zh"];

const translations: Record<Locale, Record<string, string>> = { en, zh };

let currentLocale: Locale = "zh";
const localeListeners = new Set<() => void>();

export function subscribeLocale(listener: () => void): () => void {
  localeListeners.add(listener);
  return () => { localeListeners.delete(listener); };
}

/** Translate presentation copy only; content, IDs and API payloads stay intact. */
export function uiText(text: string, locale: Locale = getLocale()): string {
  return locale === "zh" ? (zhUi as Record<string, string>)[text] ?? text : text;
}

export function setLocale(locale: Locale): void {
  currentLocale = locale;
  if (typeof window !== "undefined") {
    try { localStorage.setItem("opentutor-locale", locale); } catch { /* quota */ }
  }
  localeListeners.forEach((listener) => listener());
}

export function getLocale(): Locale {
  if (typeof window !== "undefined") {
    const saved = localStorage.getItem("opentutor-locale") as Locale | null;
    if (saved && SUPPORTED_LOCALES.includes(saved)) {
      currentLocale = saved;
    }
  }
  return currentLocale;
}

export function t(key: string): string {
  return translations[currentLocale]?.[key] ?? translations.en[key] ?? key;
}

export function tf(
  key: string,
  vars?: Record<string, string | number | null | undefined>,
): string {
  let message = t(key);
  if (!vars) return message;
  for (const [name, value] of Object.entries(vars)) {
    const token = `{${name}}`;
    message = message.split(token).join(value == null ? "" : String(value));
  }
  return message;
}

export function initLocale(): void {
  if (typeof window !== "undefined") {
    const saved = localStorage.getItem("opentutor-locale") as Locale | null;
    if (saved && SUPPORTED_LOCALES.includes(saved)) {
      currentLocale = saved;
    } else {
      currentLocale = "zh";
    }
  }
}
