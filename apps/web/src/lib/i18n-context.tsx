"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { type Locale, setLocale as setI18nLocale, initLocale, getLocale, t as rawT, tf as rawTF } from "./i18n";

import { usePathname } from "next/navigation";

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string) => string;
  tf: (key: string, vars?: Record<string, string | number | null | undefined>) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [locale, setLocaleState] = useState<Locale>("zh");

  useEffect(() => {
    initLocale();
    const initialLocale = getLocale();
    document.documentElement.lang = initialLocale;
    setLocaleState(initialLocale);
  }, []);

  useEffect(() => {
    document.title = locale === "zh" ? "OpenTutor — 个性化学习助手" : "OpenTutor — Personalized Learning Assistant";
  }, [locale, pathname]);

  const setLocale = useCallback((newLocale: Locale) => {
    setI18nLocale(newLocale);
    document.documentElement.lang = newLocale;
    setLocaleState(newLocale);
  }, []);

  const t = useCallback(
    (key: string) => rawT(key),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [locale],
  );
  const tf = useCallback(
    (key: string, vars?: Record<string, string | number | null | undefined>) => rawTF(key, vars),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [locale],
  );

  return (
    <I18nContext.Provider value={{ locale, setLocale, t, tf }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useT() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useT must be used inside <LocaleProvider>");
  return ctx.t;
}

export function useLocale() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useLocale must be used inside <LocaleProvider>");
  return { locale: ctx.locale, setLocale: ctx.setLocale };
}

export function useTF() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useTF must be used inside <LocaleProvider>");
  return ctx.tf;
}
