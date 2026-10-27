"use client";

import { LearningPaceButton } from "@/components/learning-profile/learning-pace-button";
import { RuntimeAlert } from "@/components/shared/runtime-alert";
import { useDashboardData } from "./_hooks/use-dashboard-data";
import { CourseCardsSkeleton } from "./_components/dash-section";
import { DashboardSidebar } from "./_components/dashboard-sidebar";
import { AgentInsightsSection } from "./_components/agent-insights-section";
import { CourseSpacesSection, DashboardEmptyState } from "./_components/dashboard-spaces";

export default function DashboardPage() {
  const { router, t, courses, loading, error, health, notifications } = useDashboardData();
  const navigate = (path:string) => router.push(path);

  return <div className="min-h-screen bg-background">
    <div className="flex min-h-screen flex-col md:flex-row">
      <DashboardSidebar health={health} t={t} onNavigate={navigate} />
      <main className="flex-1 overflow-y-auto scrollbar-thin">
        <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-8 sm:px-6 md:px-10 md:py-12">
          <RuntimeAlert health={health} />
          {error && <div role="alert" className="rounded-2xl bg-destructive/5 px-5 py-4 text-sm text-destructive card-shadow">{t("dashboard.loadErrorPrefix")}: {error}</div>}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex flex-col gap-1.5">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">{t("dashboard.title")}</h1>
              <p className="text-sm text-muted-foreground">{t("dashboard.subtitle")}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto"><LearningPaceButton />
            <button type="button" onClick={() => navigate("/new")} className="h-10 px-6 bg-brand text-brand-foreground rounded-full text-sm font-medium hover:opacity-90 transition-all shrink-0 self-start sm:self-auto">+ {t("dashboard.create")}</button></div>
          </div>
          {loading && <CourseCardsSkeleton />}
          {courses.length > 0 && <CourseSpacesSection courses={courses} onNavigate={navigate} t={t} />}
          {!loading && courses.length === 0 && <DashboardEmptyState onNavigate={navigate} t={t} />}
          <AgentInsightsSection notifications={notifications} onNavigate={navigate} t={t} />
        </div>
      </main>
    </div>
  </div>;
}
