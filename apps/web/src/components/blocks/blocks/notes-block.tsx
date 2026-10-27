"use client";

import { useUiText } from "@/hooks/use-ui-text";

import { useCourseStore } from "@/store/course";
import { NotesSection } from "@/components/sections/notes-section";
import type { BlockComponentProps } from "@/lib/block-system/registry";

export default function NotesBlock({ courseId, aiActionsEnabled, config }: BlockComponentProps) {
  const ui = useUiText();
  const githubSource = useCourseStore((s) => s.courses.find((course) => course.id === courseId)?.metadata?.github_source);
  const initialViewMode = config.initialViewMode === "source" || githubSource ? "source" : "ai";
  return (
    <div role="region" aria-label={ui("Notes")}>
      <NotesSection key={`${courseId}:${initialViewMode}`} courseId={courseId} aiActionsEnabled={aiActionsEnabled} initialViewMode={initialViewMode} />
    </div>
  );
}
