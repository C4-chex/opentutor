"use client";
import { useUiText } from "@/hooks/use-ui-text";
export function SkipToContent() {
  const ui = useUiText();
  return <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:rounded-lg focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-foreground focus:shadow-lg focus:ring-2 focus:ring-ring">{ui("Skip to content")}</a>;
}
