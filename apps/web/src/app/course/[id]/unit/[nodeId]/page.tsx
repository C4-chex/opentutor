"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useWorkspaceStore } from "@/store/workspace";
import { extractQuiz } from "@/lib/api";
import { ClassroomNotebook } from "@/components/course/classroom-notebook";
import { useUiText } from "@/hooks/use-ui-text";
import { GuidedLearning } from "@/components/course/guided-learning";
import { ChapterHeader } from "@/components/course/chapter-header";
import { toast } from "sonner";
import { useT, useTF } from "@/lib/i18n-context";

import { ErrorBoundary } from "@/components/shared/error-boundary";
import { useUnitData } from "./_components/use-unit-data";
import { OriginalMaterial } from "./_components/content-block";
import { SubsectionsNav } from "./_components/unit-navigation";
import { LearningDetails } from "./_components/learning-details";
import { PracticePanel } from "./_components/practice-panel";
import { ChapterSummary } from "./_components/chapter-summary";
import type { GuidedLesson } from "@/lib/api/guided-learning";

export default function UnitPage() {
  const params = useParams();
  const courseId = params.id as string;
  const nodeId = params.nodeId as string;
  const t = useT();
  const ui = useUiText();
  const tf = useTF();
  const triggerRefresh = useWorkspaceStore((s) => s.triggerRefresh);
  const [generatingFocusedQuiz, setGeneratingFocusedQuiz] = useState(false);
  const [lessonProgress,setLessonProgress] = useState<{sessionId:string;revision:number;stage:GuidedLesson["stage"]}|null>(null);

  // Track last visited node for continue-learning CTA
  useEffect(() => {
    try {
      localStorage.setItem(`opentutor_last_node_${courseId}`, nodeId);
    } catch (e) {
      console.warn("[UnitPage] Failed to persist last node:", e);
    }
  }, [courseId, nodeId]);

  const {
    course, node, nodePath, parentNode, siblingNodes, focusTerms,
    wrongAnswers, reviewItems, loadingSignals, aiActionsEnabled,
    difficultyRec, quizModeHint, urgentReviews,
  } = useUnitData(courseId, nodeId);

  const handleGenerateFocusedQuiz = async () => {
    setGeneratingFocusedQuiz(true);
    try {
      const res = await extractQuiz(courseId, nodeId, quizModeHint, difficultyRec.level);
      triggerRefresh("practice");
      toast.success(tf("unit.focusedQuiz.generated", { count: res.problems_created }));
    } catch (error) {
      toast.error((error as Error).message || t("unit.focusedQuiz.failed"));
    } finally {
      setGeneratingFocusedQuiz(false);
    }
  };

  if (!node) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-sm text-muted-foreground animate-pulse">{t("general.loading")}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <ChapterHeader courseId={courseId} courseName={course?.name ?? t("course.home")} chapterTitle={node.title} />

      <main className="max-w-7xl mx-auto px-4 pt-8 pb-28">
        <ClassroomNotebook key={`${courseId}:${nodeId}`} courseId={courseId} nodeId={nodeId} title={node.title} aiActionsEnabled={aiActionsEnabled}>
        <ErrorBoundary section="guided learning"><GuidedLearning key={`${courseId}:${nodeId}`} courseId={courseId} nodeId={nodeId} onProgressChange={setLessonProgress} /></ErrorBoundary>

        <ErrorBoundary section="chapter summary"><ChapterSummary key={`${courseId}:${nodeId}`} courseId={courseId} nodeId={nodeId}
          progressKey={lessonProgress?`${lessonProgress.sessionId}:${lessonProgress.revision}:${lessonProgress.stage}`:"initial"}
          aiActionsEnabled={aiActionsEnabled}/></ErrorBoundary>

        <ErrorBoundary section="notes">
          <OriginalMaterial node={node} title={ui("Original material")} />
        </ErrorBoundary>

        <ErrorBoundary section="practice">
          <PracticePanel courseId={courseId} difficultyLevel={difficultyRec.level} aiActionsEnabled={aiActionsEnabled} generatingFocusedQuiz={generatingFocusedQuiz} onGenerateFocusedQuiz={() => void handleGenerateFocusedQuiz()} t={t} tf={tf} />
        </ErrorBoundary>

        {node.children && node.children.length > 0 ? (
          <SubsectionsNav courseId={courseId} subsections={node.children} t={t} />
        ) : null}
        <ErrorBoundary section="learning details">
          <LearningDetails key={`${courseId}:${nodeId}`} courseId={courseId} node={node} nodePath={nodePath}
            parentNode={parentNode} siblingNodes={siblingNodes} focusTerms={focusTerms}
            wrongAnswers={wrongAnswers} reviewItems={reviewItems} loadingSignals={loadingSignals}
            urgentReviews={urgentReviews}/>
        </ErrorBoundary>
        </ClassroomNotebook>
      </main>

    </div>
  );
}
