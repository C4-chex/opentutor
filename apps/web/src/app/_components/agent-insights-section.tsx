"use client";
import { Sparkles } from "lucide-react";
import type { AppNotification } from "@/lib/api";
import { DashSection } from "./dash-section";
import { formatDate, resolveNotificationPath } from "./dashboard-utils";

export function AgentInsightsSection({
  notifications,
  onNavigate,
  t,
}: {
  notifications: AppNotification[];
  onNavigate: (path: string) => void;
  t: (key: string) => string;
}) {
  return (
    <DashSection title={t("home.agentInsights")} icon={Sparkles} badge={notifications.length}>
      {notifications.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("home.agentInsights.empty")}</p>
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => {
            const path = resolveNotificationPath(n);
            const coursePath = n.course_id ? `/course/${n.course_id}` : null;
            const ctaPath = path ?? coursePath;
            const ctaLabel = n.action_label || t("home.agentInsights.open");
            return (
              <div key={n.id} className="flex items-start gap-3 rounded-xl bg-muted/30 p-3.5">
                <Sparkles className="size-4 text-brand shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{n.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{n.body}</p>
                  {ctaPath && (
                    <button type="button" onClick={() => onNavigate(ctaPath)} className="mt-1.5 text-[11px] font-medium text-brand hover:underline">
                      {ctaLabel}
                    </button>
                  )}
                </div>
                <span className="text-[10px] text-muted-foreground shrink-0">{formatDate(n.created_at)}</span>
              </div>
            );
          })}
        </div>
      )}
    </DashSection>
  );
}

