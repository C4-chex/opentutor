import { API_BASE, buildSecureRequestInit, parseApiError, request } from "./client";
import type { PacePlan } from "./learning-profile";
import { getLocale } from "@/lib/i18n";

export type LearningStage = "learn" | "diagnose" | "socratic" | "feynman" | "practice" | "transfer" | "complete";
export type LearningAction = "start" | "answer" | "hint" | "explain" | "restart" | "undo" | "continue" | "review_basics";
export interface FoundationConcept {
  title: string;
  explanation: string;
  worked_example: string;
  common_mistake?: string;
  is_supplement: boolean;
}
export interface GuidedTurn {
  role: "learner" | "tutor";
  stage: LearningStage;
  text: string;
  question?: string;
  hint_level?: number;
  is_help_request?: boolean;
  is_navigation?: boolean;
  concepts?: FoundationConcept[];
}
export interface GuidedLesson {
  pace_plan?: PacePlan;
  session_id: string;
  course_id: string;
  node_id: string;
  title: string;
  revision: number;
  stage: LearningStage;
  hint_level: number;
  goals: string[];
  turns: GuidedTurn[];
  evidence: {stage: LearningStage; answer: string; quote: string; feedback: string; independent: boolean}[];
  gaps: {stage: LearningStage; gap: string; answer: string}[];
  sources: {node_id: string; title: string; url: string | null}[];
  limited_scope: boolean;
  can_undo?: boolean;
  is_foundation_review?: boolean;
}

async function lessonRequest<T>(courseId: string, nodeId: string, body?: unknown): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 180_000);
  try {
    const response = await fetch(`${API_BASE}/guided-learning/${courseId}/${nodeId}`, {
      ...buildSecureRequestInit(body ? {method:"POST", body:JSON.stringify(body)} : {method:"GET"}),
      signal:controller.signal,
    });
    if (!response.ok) throw await parseApiError(response);
    return await response.json();
  } finally { clearTimeout(timeout); }
}

export const loadGuidedLesson = (courseId: string, nodeId: string) =>
  lessonRequest<{lesson: GuidedLesson | null; source_changed: boolean}>(courseId, nodeId);
export const actOnGuidedLesson = (courseId: string, nodeId: string, action: LearningAction,
  answer: string, revision: number, actionId: string) =>
  lessonRequest<GuidedLesson>(courseId, nodeId, {action, answer, revision, action_id:actionId, locale:getLocale()});

export interface ChapterSummaryStatus {
  node_id: string;
  title: string;
  ready: boolean;
  verified_sources: number;
  total_sources: number;
}

export function getChapterSummaryStatus(courseId: string, nodeId: string) {
  return request<ChapterSummaryStatus>(`/guided-learning/${courseId}/${nodeId}/summary-status`);
}
