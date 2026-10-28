"use client";

import { useCallback, useSyncExternalStore } from "react";
import { getLocale, subscribeLocale, uiText, type Locale } from "@/lib/i18n";

const serverLocale = (): Locale => "en";

/** Keep supplementary UI translations reactive to the language selector. */
export function useUiText() {
  const locale = useSyncExternalStore(subscribeLocale, getLocale, serverLocale);
  return useCallback((text: string) => uiText(text, locale), [locale]);
}
