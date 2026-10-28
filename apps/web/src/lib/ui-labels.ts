import { uiText } from "./i18n";
import type { BlockType } from "./block-system/types";

const blockLabels: Record<BlockType, string> = {
  notes: "Notes", quiz: "Quiz", flashcards: "Flashcards", progress: "Progress",
  review: "Review", chapter_list: "Chapters",
  plan: "Study Plan", wrong_answers: "Wrong Answers", forecast: "Forecast",
  agent_insight: "Agent Insight", summary: "Daily Digest",
};

export function blockLabel(type: BlockType): string {
  return uiText(blockLabels[type] ?? type.replace(/_/g, " "));
}
