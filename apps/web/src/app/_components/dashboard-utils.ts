import type { Course, AppNotification } from "@/lib/api";
import type { LearningMode, SpaceLayout } from "@/lib/block-system/types";
import { getStoredSpaceLayoutMode } from "@/lib/block-system/layout-storage";

export const CARD_COLORS = [
  { bg: "bg-brand-muted", text: "text-brand" },
  { bg: "bg-success-muted", text: "text-success" },
  { bg: "bg-warning-muted", text: "text-warning" },
  { bg: "bg-info-muted", text: "text-info" },
];

export function getInitials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || "")
    .join("");
}

export function formatDate(value?: string | null) {
  if (!value) return null;
  return new Date(value).toLocaleDateString();
}

export function resolveNotificationPath(notification: AppNotification): string | null {
  const actionUrl = notification.action_url?.trim();
  if (actionUrl?.startsWith("/")) return actionUrl;
  const data = notification.data;
  if (!data || typeof data !== "object") return null;
  const candidate = (data as Record<string, unknown>).action_url;
  if (typeof candidate === "string" && candidate.trim().startsWith("/")) {
    return candidate.trim();
  }
  return null;
}

export function getCourseMode(course: Course): LearningMode | undefined {
  if (typeof window === "undefined") return undefined;
  const localMode = getStoredSpaceLayoutMode(course.id);
  if (localMode) return localMode;
  const metadata = (course.metadata ?? {}) as Record<string, unknown>;
  const layout = metadata.spaceLayout as SpaceLayout | undefined;
  const mode = layout?.mode ?? metadata.learning_mode;
  return typeof mode === "string" ? (mode as LearningMode) : undefined;
}
