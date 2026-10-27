"use client";

import { useT, useTF } from "@/lib/i18n-context";
import { useUiText } from "@/hooks/use-ui-text";
import { CollapsibleSection } from "@/components/shared/collapsible-section";
import { ErrorBoundary } from "@/components/shared/error-boundary";
import { ErrorAnalysis } from "./error-analysis";
import { MasteryTimeline } from "./mastery-timeline";
import { StatsRow } from "./stats-row";
import { UnitNavigation } from "./unit-navigation";
import type { useUnitData } from "./use-unit-data";

type LearningDetailsProps = Pick<ReturnType<typeof useUnitData>,
  "node"|"nodePath"|"parentNode"|"siblingNodes"|"focusTerms"|
  "wrongAnswers"|"reviewItems"|"loadingSignals"|"urgentReviews"
> & {courseId:string};

export function LearningDetails({courseId,node,nodePath,parentNode,siblingNodes,focusTerms,
  wrongAnswers,reviewItems,loadingSignals,urgentReviews}:LearningDetailsProps) {
  const t=useT();const tf=useTF();const ui=useUiText();
  return <CollapsibleSection title={ui("Learning details")} keepMounted>
    <div className="space-y-5">
      <UnitNavigation courseId={courseId} nodePath={nodePath} parentNode={parentNode}
        siblingNodes={siblingNodes} focusTerms={focusTerms} wrongAnswerCount={wrongAnswers.length}
        reviewItemCount={reviewItems.length} t={t} tf={tf}/>
      <StatsRow subsectionCount={node?.children?.length??0} wrongAnswerCount={wrongAnswers.length}
        urgentReviewCount={urgentReviews} t={t}/>
      <ErrorBoundary section="error analysis">
        <section className="rounded-2xl bg-muted/20 p-4">
          <h3 className="text-base font-semibold mb-3">{t("unit.errorAnalysis")}</h3>
          {loadingSignals?<p role="status" className="text-sm text-muted-foreground">{t("unit.loading.errorSignals")}</p>:
            <ErrorAnalysis items={wrongAnswers} t={t}/>}
        </section>
      </ErrorBoundary>
      <ErrorBoundary section="mastery history">
        <section className="rounded-2xl bg-muted/20 p-4">
          <h3 className="text-base font-semibold mb-3">{t("unit.masteryTimeline")}</h3>
          {loadingSignals?<p role="status" className="text-sm text-muted-foreground">{t("unit.loading.masteryTimeline")}</p>:
            <MasteryTimeline items={reviewItems} t={t}/>}
        </section>
      </ErrorBoundary>
    </div>
  </CollapsibleSection>;
}
