"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useCourseStore } from "@/store/course";
import { getHealthStatus, listNotifications, type HealthStatus, type AppNotification } from "@/lib/api";
import { ttlCache } from "@/lib/cache";
import { useT } from "@/lib/i18n-context";

export function useDashboardData() {
  const router = useRouter();
  const t = useT();
  const { courses, loading, error } = useCourseStore();
  const [health, setHealth] = useState<HealthStatus | null>(() => ttlCache.get<HealthStatus>("dash:health") ?? null);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  useEffect(() => {
    let active = true;
    void useCourseStore.getState().fetchCourses();
    const refreshHealth = () => getHealthStatus().then((result) => {
      ttlCache.set("dash:health", result, 30_000);
      if (active) setHealth(result);
    }).catch((err) => console.error("[Dashboard] health check failed:", err));
    void refreshHealth();
    const interval = setInterval(() => void refreshHealth(), 30_000);
    return () => { active = false; clearInterval(interval); };
  }, []);

  useEffect(() => {
    let active = true;
    listNotifications({unreadOnly:true, limit:5}).then((result) => {
      if (active) setNotifications((result?.notifications ?? []).filter((item) => !item.read));
    }).catch((err) => console.error("[Dashboard] notifications fetch failed:", err));
    return () => { active = false; };
  }, []);

  return {router, t, courses, loading, error, health, notifications};
}
