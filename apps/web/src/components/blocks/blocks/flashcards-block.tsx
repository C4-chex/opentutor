"use client";

import { useUiText } from "@/hooks/use-ui-text";

import { PracticeSection } from "@/components/sections/practice-section";
import type { BlockComponentProps } from "@/lib/block-system/registry";

export default function FlashcardsBlock({ courseId, aiActionsEnabled }: BlockComponentProps) {
  const ui = useUiText();
  return (
    <div role="region" aria-label={ui("Flashcards")}>
      <PracticeSection
        courseId={courseId}
        aiActionsEnabled={aiActionsEnabled}
        defaultTab="flashcards"
      />
    </div>
  );
}
