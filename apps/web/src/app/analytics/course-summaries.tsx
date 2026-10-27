
"use client";

import { useUiText } from "@/hooks/use-ui-text";
import { Badge } from "@/components/ui/badge";
import type { LearningOverview } from "@/lib/api";

interface CourseSummariesProps {
  courseSummaries: LearningOverview["course_summaries"];
}

export function CourseSummaries({ courseSummaries }: CourseSummariesProps) {
  const ui = useUiText();
  return (
    <section className="rounded-xl border border-border bg-card" data-testid="analytics-course-summaries">
      <div className="px-4 py-3 border-b border-border">
        <h2 className="font-medium text-foreground">{ui("Course Summaries")}</h2>
      </div>
      <div className="divide-y divide-border">
        {courseSummaries.map((course) => (
          <div
            key={course.course_id}
            className="p-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between"
            data-testid={`analytics-course-${course.course_id}`}
          >
            <div>
              <h3 className="font-medium text-foreground">{course.course_name}</h3>
              <p className="text-sm text-muted-foreground">
                {ui("Mastery")}{(course.average_mastery * 100).toFixed(0)}{ui("% · Study")} {course.study_minutes}{ui("m · Wrong answers")} {course.wrong_answers}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {Object.entries(course.gap_types).map(([gap, count]) => (
                <Badge key={gap} variant="secondary" className="capitalize">
                  {gap.replaceAll("_", " ")}: {count}
                </Badge>
              ))}
              {course.diagnosed_count > 0 && (
                <Badge variant="outline">{ui("Diagnosed:")} {course.diagnosed_count}</Badge>
              )}
            </div>
          </div>
        ))}
        {courseSummaries.length === 0 && (
          <div className="p-8 text-center text-sm text-muted-foreground">
            {ui("No learning analytics yet. Start practicing in a course first.")}</div>
        )}
      </div>
    </section>
  );
}
