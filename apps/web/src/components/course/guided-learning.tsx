"use client";

import { useEffect, useRef, useState } from "react";
import { t } from "@/lib/i18n";
import { useUiText } from "@/hooks/use-ui-text";
import { MarkdownRenderer } from "@/components/shared/markdown-renderer";
import { actOnGuidedLesson, loadGuidedLesson, type GuidedLesson, type LearningAction, type FoundationConcept } from "@/lib/api/guided-learning";

import { TeachingFeedback } from "./teaching-feedback";
import { LessonSources } from "./lesson-sources";
import { useClassroomNotebook } from "./classroom-notebook";
import { lectureMarkdown } from "@/lib/classroom-notes";

export const LESSON_STAGES = ["learn", "diagnose", "socratic", "feynman", "practice", "transfer"] as const;
export const STAGE_LABELS = {learn:"Build the foundations", diagnose:"Quick understanding check", socratic:"Socratic questions", feynman:"Explain it yourself", practice:"Independent practice", transfer:"Transfer check", complete:"Session verified"};

function FoundationCards({concepts,onSave}: {concepts: FoundationConcept[];onSave?:(concept:FoundationConcept)=>void}) {
  const ui = useUiText();
  return <div className="space-y-4">
    {concepts.map((concept,index) => <article key={index} className="rounded-xl border border-border bg-background/60 p-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2"><h4 className="font-semibold">{concept.title}</h4>{onSave&&<button type="button" onClick={()=>onSave(concept)} className="shrink-0 text-xs text-brand underline underline-offset-4">{ui("Save this point to notes")}</button>}</div>
      {concept.is_supplement && <p className="text-xs text-amber-600 dark:text-amber-400">{ui("AI supplement: prerequisite knowledge not covered by the source.")}</p>}
      <MarkdownRenderer teaching content={concept.explanation} className="prose prose-sm dark:prose-invert max-w-none" />
      <div className="border-t border-border pt-3 space-y-2">
        <p className="text-sm font-medium text-brand">{ui("Worked example")}</p>
        <MarkdownRenderer teaching content={concept.worked_example} className="prose prose-sm dark:prose-invert max-w-none" />
      </div>
      {concept.common_mistake && <div className="rounded-lg bg-muted p-3 space-y-1">
        <p className="text-xs font-medium">{ui("Common pitfall")}</p>
        <MarkdownRenderer teaching content={concept.common_mistake} className="prose prose-sm dark:prose-invert max-w-none" />
      </div>}
    </article>)}
  </div>;
}

export function GuidedLearning({courseId, nodeId, onProgressChange}: {
  courseId:string; nodeId:string;
  onProgressChange?:(progress: {sessionId:string;revision:number;stage:GuidedLesson["stage"]}|null)=>void;
}) {
  const ui = useUiText();
  const notebook = useClassroomNotebook();
  const [lesson, setLesson] = useState<GuidedLesson | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [sourceChanged, setSourceChanged] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const operation = useRef<{signature:string; id:string} | null>(null);
  const running = useRef(false);
  const draftKey = `opentutor:guided-draft:${courseId}:${nodeId}`;
  const [draftWarning, setDraftWarning] = useState("");

  function updateDraft(value:string) {
    setDraft(value);
    try { if (value) localStorage.setItem(draftKey,value); else localStorage.removeItem(draftKey); setDraftWarning(""); }
    catch { setDraftWarning("浏览器未能保存草稿，刷新前请先复制当前输入。"); }
  }

  useEffect(() => {
    let cancelled = false;
    try {setDraft(localStorage.getItem(draftKey) || "");} catch { /* storage unavailable */ }
    loadGuidedLesson(courseId, nodeId).then((data) => {
      if (!cancelled) { setLesson(data.lesson); setSourceChanged(data.source_changed); }
    }).catch((err) => { if (!cancelled) setError((err as Error).message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [courseId, nodeId, draftKey]);

  async function reloadProgress() {
    setError("");
    try { const data = await loadGuidedLesson(courseId,nodeId); setLesson(data.lesson); setSourceChanged(data.source_changed); }
    catch (err) { setError((err as Error).message); }
  }

  async function act(action: LearningAction) {
    if (running.current) return;
    running.current = true; setBusy(true); setError("");
    const answer = action === "answer" ? draft.trim() : "";
    const signature = JSON.stringify([lesson?.revision || 0, action, answer]);
    if (operation.current?.signature !== signature) operation.current = {signature, id:crypto.randomUUID()};
    try {
      const updated = await actOnGuidedLesson(courseId,nodeId,action,answer,lesson?.revision || 0,operation.current.id);
      setLesson(updated); setSourceChanged(false); operation.current = null;
      if (action === "answer") updateDraft("");
      if (action === "undo" && !draft.trim()) {
        const previousAnswer = [...(lesson?.turns || [])].reverse().find((turn) => turn.role === "learner" && !turn.is_help_request && !turn.is_navigation);
        if (previousAnswer) updateDraft(previousAnswer.text);
      }
    } catch (err) {
      const message = (err as Error).name === "AbortError" ? ui("The tutor took too long. Reload progress before retrying; your draft is preserved.") : (err as Error).message;
      setError(message);
    } finally { running.current = false; setBusy(false); }
  }

  useEffect(() => {
    if (!loading) onProgressChange?.(lesson ? {
      sessionId:lesson.session_id, revision:lesson.revision, stage:lesson.stage,
    } : null);
  }, [loading, lesson, onProgressChange]);

  const tutor = lesson?.turns.filter((turn) => turn.role === "tutor").at(-1);
  const complete = lesson?.stage === "complete";
  const learningBasics = lesson?.stage === "learn";
  const phaseIndex = complete ? LESSON_STAGES.length : LESSON_STAGES.indexOf(lesson?.stage as typeof LESSON_STAGES[number]);

  return <section id="guided-learning" aria-label={ui("AI guided learning")} className="rounded-2xl border border-brand/30 bg-card p-5 sm:p-6 space-y-5 shadow-sm">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="space-y-1.5">
        <h2 className="text-xl font-semibold">{ui("AI guided learning")}</h2>
        <p className="text-sm text-muted-foreground">{ui("Learn the basics with worked examples, then explain, practice and apply.")}</p>
      </div>
      {lesson && <span className="text-xs rounded-full bg-brand-muted text-brand px-3 py-1.5">{ui(STAGE_LABELS[lesson.stage])}</span>}
    </div>
    {lesson?.pace_plan?.mode ? <p className="text-xs text-muted-foreground">{t("pace.title")}: {t(`pace.${lesson.pace_plan.mode}`)}</p> : null}
    <ol aria-label={ui("Learning stages")} className="grid grid-cols-2 sm:grid-cols-6 gap-2 text-xs">
      {LESSON_STAGES.map((stage,index) => <li key={stage} aria-current={lesson?.stage === stage ? "step" : undefined}
        className={`rounded-lg border px-3 py-2 ${index === phaseIndex ? "border-brand bg-brand-muted text-brand" : "border-border text-muted-foreground"}`}>
        {index + 1}. {ui(STAGE_LABELS[stage])}{lesson && index < phaseIndex && (stage !== "learn" || lesson.turns.some((turn) => turn.stage === "learn" && turn.role === "tutor")) ? " ✓" : ""}
      </li>)}
    </ol>
    {error && <div role="alert" className="rounded-lg border border-destructive/30 p-3 text-sm space-y-2">
      <p className="text-destructive">{error}</p>
      <button type="button" className="underline" disabled={busy} onClick={() => void reloadProgress()}>{ui("Reload saved progress")}</button>
    </div>}
    {loading ? <p className="text-sm text-muted-foreground">{ui("Loading saved learning progress...")}</p> : !lesson ? <div className="space-y-4">
      <p className="text-sm leading-relaxed">{ui("Start with the concepts, necessary prerequisites and a complete worked example. You can read first, then choose when to begin a short understanding check.")}</p>
      <button type="button" disabled={busy} onClick={() => void act("start")} className="rounded-lg bg-brand text-brand-foreground px-5 py-3 font-medium text-sm disabled:opacity-50">
        {busy ? ui("Preparing your foundation lesson...") : ui("Start guided learning")}
      </button>
    </div> : <>
      {sourceChanged && <div role="status" className="text-sm rounded-lg bg-muted p-3">{ui("The source has changed. Start a new session to use the updated material; previous records are kept.")}</div>}
      <div className="space-y-2">
        <h3 className="font-medium text-sm">{ui("Goals for this session")}</h3>
        <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">{lesson.goals.map((goal,index) => <li key={index}>{goal}</li>)}</ul>
      </div>
      {notebook&&tutor&&<button type="button" onClick={()=>notebook.capture(lectureMarkdown(lesson,tutor))} className="text-sm text-brand underline underline-offset-4">{ui("Save this explanation to notes")}</button>}
      {tutor && <div aria-live="polite" className="rounded-xl bg-muted/40 p-4 space-y-3">
        <MarkdownRenderer teaching content={tutor.text} className="prose prose-sm dark:prose-invert max-w-none" />
        {!!tutor.concepts?.length && <>
          <p className="text-xs text-muted-foreground">{ui("AI-prepared explanation. Check details against the source material.")}</p>
          <FoundationCards concepts={tutor.concepts} onSave={notebook?(concept)=>notebook.capture(lectureMarkdown(lesson,tutor,concept)):undefined} />
        </>}
        {!learningBasics && tutor.question && <div className="border-t border-border pt-3">
          <p className="text-xs font-medium text-brand mb-2">{lesson.stage === "feynman" ? ui("Your turn to teach the beginner") : ui("Think about this one question")}</p>
          <MarkdownRenderer teaching content={tutor.question} className="prose prose-sm dark:prose-invert max-w-none" />
        </div>}
      </div>}
      <div className="space-y-3 border-t border-border pt-3">
        <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
          <span>每轮教学完成后自动保存到本机数据库；输入草稿保存在当前浏览器。</span>
          {lesson.can_undo && <button type="button" disabled={busy || sourceChanged} onClick={() => {
            if (window.confirm("撤回上一轮会恢复此前的教学问题与判定；刚才的记录仍保留在本地。是否撤回？")) void act("undo");
          }} className="underline disabled:opacity-50">撤回上一轮</button>}
        </div>
        <TeachingFeedback key={lesson.session_id} courseId={courseId} nodeId={nodeId} revision={lesson.revision} />
      </div>
      {draftWarning && <p role="status" className="text-xs text-destructive">{draftWarning}</p>}
      {learningBasics && !sourceChanged && <div className="space-y-3">
        <p className="text-sm text-muted-foreground">{ui("Read the explanation and example first. Reading is saved, but does not count as demonstrated understanding.")}</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={busy} onClick={() => void act("continue")} className="rounded-lg bg-brand text-brand-foreground px-4 py-2.5 text-sm disabled:opacity-50">
            {busy ? ui("Preparing the next step...") : lesson.is_foundation_review ? ui("Return to my current question") : ui("Ready for a short understanding check")}
          </button>
          <button type="button" disabled={busy} onClick={() => void act("explain")} className="rounded-lg border border-border px-4 py-2 text-sm disabled:opacity-50">{ui("Explain the basics more simply")}</button>
        </div>
      </div>}
      {!learningBasics && !sourceChanged && <button type="button" disabled={busy} onClick={() => void act("review_basics")} className="text-sm text-brand underline disabled:opacity-50">{ui("Teach me the basics first")}</button>}
      {!learningBasics && !complete && !sourceChanged && <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); if(draft.trim()) void act("answer"); }}>
        <label htmlFor={`guided-answer-${nodeId}`} className="block text-sm font-medium">{ui("Your explanation or attempt")}</label>
        <textarea id={`guided-answer-${nodeId}`} value={draft} onChange={(event) => updateDraft(event.target.value)} maxLength={6000} disabled={busy}
          placeholder={lesson.stage === "feynman" ? ui("Explain in your own words, include why it works and a small example.") : ui("Write what you think and how you arrived at it. It is fine to be unsure.")}
          className="w-full min-h-28 rounded-lg border border-border bg-background px-3 py-3 text-sm leading-relaxed focus:ring-2 focus:ring-brand/30" />
        <div className="flex flex-wrap gap-2">
          <button type="submit" disabled={busy || !draft.trim()} className="rounded-lg bg-brand text-brand-foreground px-4 py-2.5 text-sm disabled:opacity-50">{busy ? ui("The tutor is reading your reasoning...") : ui("Submit and continue")}</button>
          <button type="button" disabled={busy} onClick={() => void act("hint")} className="rounded-lg border border-border px-4 py-2 text-sm disabled:opacity-50">{ui("Give me a hint")} ({lesson.hint_level}/4)</button>
          <button type="button" disabled={busy} onClick={() => void act("explain")} className="rounded-lg border border-border px-4 py-2 text-sm disabled:opacity-50">{ui("Explain this step")}</button>
        </div>
        <p className="text-xs text-muted-foreground">{ui("Hints and explanations help you learn, but do not count as an independent pass. Your saved dialogue resumes after refreshing.")}</p>
      </form>}
      {complete && <div className="rounded-lg border border-brand/30 p-4 space-y-3">
        <h3 className="font-medium">{ui("This session is verified, long-term retention is not yet assessed.")}</h3>
        <p className="text-sm text-muted-foreground">{ui("You completed your own explanation, independent practice and a transfer check. Revisit the material later to check retention.")}</p>
        {lesson.evidence.map((item,index) => <details key={index} className="text-sm"><summary className="cursor-pointer">{ui(STAGE_LABELS[item.stage])} · {ui("View actual answer evidence")}</summary><p className="whitespace-pre-wrap py-2">{item.answer}</p></details>)}
      </div>}
      {(complete || sourceChanged) && <button type="button" disabled={busy} onClick={() => void act("restart")} className="rounded-lg border border-border px-4 py-2 text-sm">{busy ? ui("Preparing your foundation lesson...") : ui("Start a new session and keep this record")}</button>}
      <LessonSources courseId={courseId} sources={lesson.sources} />
      {lesson.limited_scope && <p className="text-xs text-muted-foreground">{ui("This session covers a bounded excerpt. Choose a smaller section to study the rest.")}</p>}
      <button type="button" onClick={() => setShowHistory((value) => !value)} className="text-xs underline text-muted-foreground">{showHistory ? ui("Hide learning dialogue") : ui("View saved learning dialogue")}</button>
      {showHistory && <div className="max-h-96 overflow-y-auto space-y-3 rounded-lg border border-border p-3">{lesson.turns.map((turn,index) => <div key={index} className="text-sm space-y-1"><p className="text-xs font-medium text-muted-foreground">{turn.role === "tutor" ? ui("AI tutor") : ui("Your attempt")}</p><p className="whitespace-pre-wrap">{turn.text}</p>{!!turn.concepts?.length && <FoundationCards concepts={turn.concepts} />}{turn.question && <p className="whitespace-pre-wrap font-medium">{turn.question}</p>}</div>)}</div>}
    </>}
  </section>;
}
