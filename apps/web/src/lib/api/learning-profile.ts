import { API_BASE, buildSecureRequestInit, parseApiError } from "./client";

export type LearningPace = "slow" | "adaptive" | "fast";
export interface PacePlan {
  mode: LearningPace;
  foundation_level: "beginner" | "some" | "advanced" | "unsure";
  learning_depth: "essentials" | "applied" | "thorough" | "unsure";
  concepts_per_step: number;
  target_explanation_chars: number;
  practice_tasks: number;
  transfer_tasks: number;
  adjustment_reason: string;
  requires_verification: boolean;
}
export interface LearningPreferences {
  learning_pace?: LearningPace;
  foundation_level?: PacePlan["foundation_level"];
  learning_depth?: PacePlan["learning_depth"];
  teaching_mode: "explain_first" | "try_first";
  feedback_level: "hint" | "locate" | "explain";
  review_mode: "related" | "manual";
  background: string;
  current_progress: string;
  learning_goal: string;
}
export interface LearningProfileState {
  pace_plan?: PacePlan;
  complete: boolean;
  revision: number;
  profile: (LearningPreferences & {background_source: "self_report"; updated_at: string}) | null;
}

async function profileRequest(body?: LearningPreferences & {revision: number}): Promise<LearningProfileState> {
  const response = await fetch(`${API_BASE}/learning-profile`, {
    ...buildSecureRequestInit(body ? {method:"PUT", body:JSON.stringify(body)} : {method:"GET"}),
    signal: AbortSignal.timeout(20_000),
    cache: "no-store",
  });
  if (!response.ok) throw await parseApiError(response);
  return response.json();
}
export const loadLearningProfile = () => profileRequest();
export const saveLearningProfile = (profile: LearningPreferences, revision: number) => profileRequest({...profile, revision});


export async function updateLearningPace(learningPace: LearningPace, revision: number): Promise<LearningProfileState> {
  const response = await fetch(`${API_BASE}/learning-profile/pace`, {
    ...buildSecureRequestInit({method:"PATCH",body:JSON.stringify({learning_pace:learningPace,revision})}),
    signal:AbortSignal.timeout(20_000),cache:"no-store",
  });
  if (!response.ok) throw await parseApiError(response);
  return response.json();
}
