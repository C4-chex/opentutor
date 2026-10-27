"use client";

import { useUiText } from "@/hooks/use-ui-text";

import { PracticeSection } from "@/components/sections/practice-section";
import type { BlockComponentProps } from "@/lib/block-system/registry";

export default function QuizBlock({ courseId, aiActionsEnabled }: BlockComponentProps) {
  const ui = useUiText();
  return (
    <div role="region" aria-label={ui("Quiz")}>
      <PracticeSection
        courseId={courseId}
        aiActionsEnabled={aiActionsEnabled}
        defaultTab="quiz"
      />
    </div>
  );
}
