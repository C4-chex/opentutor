"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useT } from "@/lib/i18n-context";
import { uiText } from "@/lib/i18n";
import {
  extractQuiz,
  listProblems,
  submitAnswer,
  getQuizAttempts,
  reviewQuizAnswer,
  type SavedQuizAttempt,
  type QuizProblem,
  type AnswerResult,
} from "@/lib/api";
import { useWorkspaceStore } from "@/store/workspace";
import type { BlockType } from "@/lib/block-system/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { AiFeatureBlocked } from "@/components/shared/ai-feature-blocked";
import { SkeletonCard } from "@/components/ui/skeleton";
import { updateUnlockContext, getUnlockContext } from "@/lib/block-system/feature-unlock";
import { QuizOptions } from "./quiz-options";
import { QuizResult } from "./quiz-result";
import { AnswerReveal } from "./answer-reveal";
import { useQuizPersistence } from "./use-quiz-persistence";

interface QuizViewProps {
  courseId: string;
  aiActionsEnabled?: boolean;
  modeHint?: "course_following" | "self_paced" | "exam_prep" | "maintenance";
  difficultyHint?: "easy" | "medium" | "hard";
}

function layerBadgeClass(layer: number): string {
  if (layer >= 3) return "bg-destructive/10 text-destructive";
  if (layer === 2) return "bg-warning/10 text-warning";
  return "bg-success/10 text-success";
}

export function QuizView({
  courseId,
  aiActionsEnabled = true,
  modeHint,
  difficultyHint,
}: QuizViewProps) {
  const t = useT();
  const refreshKey = useWorkspaceStore((s) => s.sectionRefreshKey["practice"]);
  const [problems, setProblems] = useState<QuizProblem[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [extractStatus, setExtractStatus] = useState<string | null>(null);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [codeInput, setCodeInput] = useState<string>("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [result, setResult] = useState<AnswerResult | null>(null);
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const [answeredMap, setAnsweredMap] = useState<Record<string, string>>({});
  const [reviewing, setReviewing] = useState(false);
  const attemptsRef = useRef<Record<string, SavedQuizAttempt>>({});
  const pendingRequestRef = useRef<{ answer: string; id: string; problem: string } | null>(null);
  const activeProblemRef = useRef<string | undefined>(undefined);
  const consecutiveWrongRef = useRef(0);
  const questionStartTimeRef = useRef(Date.now());
  const restoredRef = useRef(false);
  const { save, load } = useQuizPersistence(courseId);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [items, attempts] = await Promise.all([listProblems(courseId), getQuizAttempts(courseId)]);
      attemptsRef.current = Object.fromEntries(attempts.map(a=>[a.problem_id,a]));
      setProblems(items);

      // Restore session from localStorage (only once per mount)
      if (!restoredRef.current) {
        restoredRef.current = true;
        const saved = load();
        if (saved && saved.currentIdx < items.length) {
          setCurrentIdx(saved.currentIdx);
          setScore(saved.score);
          setAnsweredMap(saved.answeredMap);
          consecutiveWrongRef.current = saved.consecutiveWrong;
        }
      }
      const current = attemptsRef.current[items[Math.min(currentIdx,Math.max(0,items.length-1))]?.id];
      setResult(current ?? null);
      setCodeInput(current?.user_answer ?? "");
      const finalized = attempts.filter(a=>a.is_correct !== null);
      setAnsweredMap(Object.fromEntries(finalized.map(a=>[a.problem_id,a.user_answer])));
      setScore({ correct: attempts.filter(a=>a.counted && a.is_correct).length,
        total: attempts.filter(a=>a.counted).length });
    } catch {
      setSubmitError(t("grading.restoreFailed"));
      setProblems([]);
    } finally {
      setLoading(false);
    }
  }, [courseId, load]);

  useEffect(() => {
    void fetchData();
  }, [fetchData, refreshKey]);

  useEffect(() => {
    const pid = problems[currentIdx]?.id;
    activeProblemRef.current = pid;
    const saved = pid ? attemptsRef.current[pid] : undefined;
    setResult(saved ?? null);
    let draft = "";
    try { draft = localStorage.getItem(`opentutor-answer-draft:${courseId}:${pid}`) ?? ""; } catch { /* best effort */ }
    setCodeInput(saved?.user_answer ?? draft);
    setSelectedOption(saved?.user_answer ?? null);
    setSubmitError(null);
    pendingRequestRef.current = null;
    questionStartTimeRef.current = Date.now();
  }, [currentIdx, problems[currentIdx]?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleExtract = async () => {
    setExtracting(true);
    setExtractStatus(null);
    try {
      const layoutMode = useWorkspaceStore.getState().spaceLayout.mode ?? undefined;
      const mode = modeHint ?? layoutMode;
      const res = await extractQuiz(courseId, undefined, mode, difficultyHint);
      let status = t("quiz.extract.success").replace("{count}", String(res.problems_created));
      if (res.discarded_count > 0) {
        status += ` (${res.discarded_count} discarded)`;
      }
      if (res.warnings?.length) {
        status += ` (${res.warnings[0]})`;
      }
      setExtractStatus(status);
      await fetchData();
    } catch (error) {
      const message = (error as Error).message;
      setExtractStatus(`${t("quiz.extract.failed")} ${message}`);
    } finally {
      setExtracting(false);
    }
  };

  const handleOptionClick = async (option: string) => {
    if (result?.is_correct === true || result?.status === "invalid_question" || submitting || reviewing) return;

    const problemId = problems[currentIdx].id;

    // Idempotency: if already answered (e.g. after refresh), don't re-submit
    if (attemptsRef.current[problemId]?.is_correct === true) return;

    setSubmitError(null);
    setSelectedOption(option);
    setSubmitting(true);
    try {
      const answerTimeMs = Date.now() - questionStartTimeRef.current;
      if (!pendingRequestRef.current || pendingRequestRef.current.answer !== option || pendingRequestRef.current.problem !== problemId) {
        pendingRequestRef.current = { answer: option, problem: problemId, id: crypto.randomUUID() };
      }
      const res = await submitAnswer(problemId, option, answerTimeMs, {
        requestId: pendingRequestRef.current.id, parentAttemptId: result?.attempt_id,
      });
      attemptsRef.current[problemId] = { ...res, problem_id: problemId, user_answer: option };
      if (activeProblemRef.current !== problemId) return;
      setResult(res);
      pendingRequestRef.current = null;
      if (res.is_correct === null || res.counted === false) {
        // Partial, uncertain and assisted answers remain evidence, never automatic errors.
        const current = Object.values(attemptsRef.current);
        setScore({correct:current.filter(a=>a.counted && a.is_correct).length,total:current.filter(a=>a.counted).length});
        return;
      }
      // Show toast if backend reported warnings (e.g. progress tracking failed)
      if (res.warnings && res.warnings.length > 0) {
        toast.warning(t("quiz.progressWarning"));
      } else if (!res.explanation) {
        toast.warning(t("quiz.feedbackWarning"));
      }
      const newScore = {
        correct: Object.values(attemptsRef.current).filter(a=>(a.counted ?? true) && a.is_correct).length,
        total: Object.values(attemptsRef.current).filter(a=>(a.counted ?? true) && a.is_correct !== null).length,
      };
      setScore(newScore);
      const newAnswered = { ...answeredMap, [problemId]: option };
      setAnsweredMap(newAnswered);

      // Persist immediately after answer
      save({ currentIdx, score: newScore, answeredMap: newAnswered, consecutiveWrong: consecutiveWrongRef.current });

      // Track feature-unlock context
      const ctx = getUnlockContext(courseId, 0);
      updateUnlockContext(courseId, {
        practiceAttempts: ctx.practiceAttempts + 1,
        hasWrongAnswer: ctx.hasWrongAnswer || !res.is_correct,
      });
      // Track consecutive wrong answers to surface wrong_answers block
      if (!res.is_correct) {
        consecutiveWrongRef.current += 1;
        if (consecutiveWrongRef.current >= 3) {
          const store = useWorkspaceStore.getState();
          const blocks = store.spaceLayout.blocks;
          const hasWrongAnswersBlock = blocks.some(b => b.type === "wrong_answers");
          if (!hasWrongAnswersBlock) {
            store.addBlock("wrong_answers", {}, "agent");
          } else {
            const wrongFirst = ["wrong_answers", ...blocks.filter(b => b.type !== "wrong_answers").map(b => b.type)];
            store.reorderBlocks(wrongFirst as BlockType[]);
          }
          consecutiveWrongRef.current = 0;
        }
      } else {
        consecutiveWrongRef.current = 0;
      }
    } catch (error) {
      if (activeProblemRef.current !== problemId) return;
      setSelectedOption(null);
      setSubmitError(error instanceof Error ? error.message : t("quiz.submitFailed"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleReview = async (reason: string) => {
    if (!result?.attempt_id || reviewing || submitting) return;
    const problemId = problems[currentIdx].id;
    setReviewing(true);
    setSubmitError(null);
    try {
      const res = await reviewQuizAnswer(result.attempt_id, result.revision ?? 1, reason);
      const previous = attemptsRef.current[problemId];
      attemptsRef.current[problemId] = { ...previous, ...res };
      if (activeProblemRef.current !== problemId) return;
      setResult(res);
      const values = Object.values(attemptsRef.current);
      const newScore = {correct:values.filter(a=>a.counted && a.is_correct).length,total:values.filter(a=>a.counted).length};
      const newAnswered = Object.fromEntries(values.filter(a=>a.is_correct !== null).map(a=>[a.problem_id,a.user_answer]));
      setScore(newScore); setAnsweredMap(newAnswered);
      save({currentIdx,score:newScore,answeredMap:newAnswered,consecutiveWrong:0});
    } catch (error) {
      if (activeProblemRef.current === problemId) setSubmitError((error as Error).message);
    } finally { setReviewing(false); }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8" data-testid="quiz-panel" role="status" aria-live="polite">
        <SkeletonCard className="w-full max-w-md" />
      </div>
    );
  }

  if (problems.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center" data-testid="quiz-panel">
        <h3 className="text-sm font-medium mb-1">{t("quiz.title")}</h3>
        <p className="text-xs text-muted-foreground max-w-xs">{t("quiz.empty")}</p>
        {!aiActionsEnabled ? <AiFeatureBlocked compact className="mt-3 w-full max-w-sm text-left" /> : null}
        <Button className="mt-3" size="sm" onClick={() => void handleExtract()} disabled={!aiActionsEnabled || extracting}>
          {extracting ? `${t("quiz.generating")}...` : t("quiz.generate")}
        </Button>
        {extractStatus ? (
          <p role="status" aria-live="polite" className="mt-3 text-xs text-muted-foreground" data-testid="quiz-extract-status">
            {extractStatus}
          </p>
        ) : null}
      </div>
    );
  }

  const problem = problems[currentIdx];
  const options = problem.options ?? ((problem.question_type === "tf" || problem.question_type === "true_false")
    ? { true: t("grading.correct"), false: t("grading.incorrect") } : {});
  const optionKeys = Object.keys(options).sort();
  const isText = problem.question_type === "coding" || (!optionKeys.length && problem.question_type !== "select_all");
  const finalized = result?.is_correct === true || result?.status === "invalid_question";
  const multiSelected: string[] = (()=>{ try { const a=JSON.parse(codeInput); return Array.isArray(a) ? a : []; } catch { return []; } })();
  const difficultyLayer = problem.difficulty_layer ?? null;
  const metadata = (problem.problem_metadata ?? {}) as Record<string, unknown>;
  const coreConcept = typeof metadata.core_concept === "string" ? metadata.core_concept : null;
  const bloomLevel = typeof metadata.bloom_level === "string" ? metadata.bloom_level : null;

  return (
    <div role="form" aria-label={t("quiz.ariaLabel")} className="flex-1 flex flex-col overflow-hidden" data-testid="quiz-panel">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border/60 shrink-0">
        <span className="ml-auto text-xs text-muted-foreground">
          {t("quiz.question")} {currentIdx + 1} {t("quiz.of")} {problems.length}
        </span>
        {aiActionsEnabled ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-xs h-6 px-2"
            disabled={extracting || submitting || reviewing}
            onClick={() => void handleExtract()}
          >
            {extracting ? "..." : "+"}
          </Button>
        ) : null}
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-4">
        <div className="flex flex-wrap items-center gap-1.5">
          {difficultyHint ? (
            <Badge variant="outline" className="text-[10px]">
              {t("quiz.strategy")}: {t(`quiz.difficulty.${difficultyHint}`)}
            </Badge>
          ) : null}
          {difficultyLayer ? (
            <Badge variant="outline" className={`text-[10px] ${layerBadgeClass(difficultyLayer)}`}>
              {t("quiz.layer").replace("{layer}", String(difficultyLayer))}
            </Badge>
          ) : null}
          {coreConcept ? (
            <Badge variant="outline" className="text-[10px]">
              {coreConcept}
            </Badge>
          ) : null}
          {bloomLevel ? (
            <Badge variant="outline" className="text-[10px]">
              {t("quiz.bloom").replace("{level}", uiText(bloomLevel))}
            </Badge>
          ) : null}
        </div>

        <p id="quiz-question-text" className="text-sm font-medium leading-relaxed" data-testid="quiz-question">
          {problem.question}
        </p>

        {isText ? (
          <div className="space-y-2">
            <textarea
              className="w-full rounded-lg border border-border bg-muted/30 font-mono text-sm p-3 min-h-[140px] resize-y focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
              placeholder={t(problem.question_type === "coding" ? "quiz.coding.placeholder" : "grading.answerPlaceholder")}
              value={codeInput}
              onChange={(e) => {
                setCodeInput(e.target.value);
                try { localStorage.setItem(`opentutor-answer-draft:${courseId}:${problem.id}`,e.target.value); } catch { /* best effort */ }
              }}
              disabled={finalized || submitting || reviewing}
              aria-label={t(problem.question_type === "coding" ? "quiz.coding.ariaLabel" : "grading.answerLabel")}
              spellCheck={false}
            />
            {!finalized && (
              <Button
                type="button"
                size="sm"
                disabled={submitting || reviewing || result?.status === "invalid_question" || codeInput.trim().length === 0}
                onClick={() => void handleOptionClick(codeInput.trim())}
              >
                {submitting ? `${t("quiz.coding.submitting")}...` : t(result ? "grading.supplement" : "grading.submit")}
              </Button>
            )}
          </div>
        ) : problem.question_type === "select_all" ? (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">{t("grading.multiHint")}</p>
            {optionKeys.map(key=><label key={key} className="flex gap-2 rounded-lg border p-3 text-sm">
              <input type="checkbox" checked={multiSelected.includes(key)} disabled={finalized || submitting || reviewing}
                onChange={e=>setCodeInput(JSON.stringify(e.target.checked ? [...multiSelected,key] : multiSelected.filter(k=>k!==key)))}/>
              {key.toUpperCase()}. {options[key]}
            </label>)}
            {!finalized ? <Button disabled={submitting || reviewing || !multiSelected.length} onClick={()=>void handleOptionClick(codeInput)}>{t("grading.submit")}</Button> : null}
          </div>
        ) : (
          <QuizOptions
            optionKeys={optionKeys}
            options={options}
            selectedOption={selectedOption}
            result={result}
            submitting={submitting || reviewing || result?.status === "invalid_question"}
            onOptionClick={handleOptionClick}
          />
        )}

        {submitError && (
          <p role="alert" className="text-xs text-destructive mt-2">{submitError}</p>
        )}

        {result ? <QuizResult key={result.attempt_id ?? problem.id} result={result} onReview={handleReview} reviewing={reviewing} /> : null}
        <AnswerReveal key={`reference:${problem.id}`} problemId={problem.id} answerViewed={problem.answer_viewed||result?.answer_viewed} disabled={submitting||reviewing}/>
      </div>

      <div className="flex items-center justify-between px-3 py-2 border-t border-border/60 shrink-0">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={currentIdx === 0 || submitting || reviewing}
          onClick={() => setCurrentIdx((i) => i - 1)}
        >
          {t("quiz.prev")}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={currentIdx >= problems.length - 1 || submitting || reviewing}
          onClick={() => setCurrentIdx((i) => i + 1)}
        >
          {t("quiz.next")}
        </Button>
      </div>
    </div>
  );
}
