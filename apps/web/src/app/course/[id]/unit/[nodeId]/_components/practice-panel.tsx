"use client";

import { useUiText } from "@/hooks/use-ui-text";
import { CollapsibleSection } from "@/components/shared/collapsible-section";
import { Suspense, lazy } from "react";
import { Button } from "@/components/ui/button";

const PracticeSection = lazy(() =>
  import("@/components/sections/practice-section").then((m) => ({ default: m.PracticeSection })),
);

type TranslateFn = (key: string) => string;
type TranslateFormatFn = (key: string, vars?: Record<string, string | number | null | undefined>) => string;

interface PracticePanelProps {
  courseId: string;
  difficultyLevel: string;
  aiActionsEnabled: boolean;
  generatingFocusedQuiz: boolean;
  onGenerateFocusedQuiz: () => void;
  t: TranslateFn;
  tf: TranslateFormatFn;
}

export function PracticePanel({
  courseId,
  difficultyLevel,
  aiActionsEnabled,
  generatingFocusedQuiz,
  onGenerateFocusedQuiz,
  t,
  tf,
}: PracticePanelProps) {
  const ui=useUiText();
  return (
    <CollapsibleSection title={ui("Additional practice")} keepMounted>
      <div className="flex flex-wrap items-center gap-2 pb-3 border-b border-border/60">
        <div>
          <p className="text-xs text-muted-foreground mt-0.5">{t("unit.practice.desc")}</p>
        </div>
        <div className="ml-auto">
          <Button
            size="sm"
            variant="outline"
            disabled={!aiActionsEnabled || generatingFocusedQuiz}
            onClick={onGenerateFocusedQuiz}
          >
            {generatingFocusedQuiz
              ? t("unit.generating")
              : tf("unit.generateFocusedQuizWithDifficulty", { level: t(`unit.difficulty.${difficultyLevel}`) })}
          </Button>
        </div>
      </div>
      <div className="min-h-[320px]">
        <Suspense fallback={<div className="p-4 text-sm text-muted-foreground animate-pulse">{t("unit.loading.practice")}</div>}>
          <PracticeSection courseId={courseId} showReview={false} aiActionsEnabled={aiActionsEnabled} defaultTab="quiz" />
        </Suspense>
      </div>
    </CollapsibleSection>
  );
}
