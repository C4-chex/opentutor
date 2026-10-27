"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { loadLearningProfile } from "@/lib/api/learning-profile";

export function LearningProfileGate({children}: {children:React.ReactNode}) {
  const pathname = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const bypass = pathname === "/welcome" || pathname === "/settings" || pathname.startsWith("/auth") || pathname === "/login";

  useEffect(() => {
    if (bypass) return;
    let active = true;
    loadLearningProfile().then((result) => {
      if (!active) return;
      if (result.complete) { setReady(true); setError(""); }
      else { setReady(false); router.replace(`/welcome?next=${encodeURIComponent(pathname)}`); }
    }).catch((err) => { if (active) {setReady(false);setError(err instanceof Error ? err.message : "学习画像暂时无法读取。");} });
    return () => { active = false; };
  }, [pathname, router, reloadKey, bypass]);

  if (bypass || ready) return children;
  return <div className="min-h-screen flex items-center justify-center p-6"><div className="max-w-lg space-y-4">
    {error ? <><p role="alert" className="text-sm">{error}</p>
      <button type="button" onClick={() => {setError("");setReloadKey((n) => n+1);}} className="rounded-lg border border-border px-4 py-2">重新连接</button>
      <Link href="/settings" className="ml-4 text-sm underline">打开设置</Link></> : <p role="status" className="text-sm text-muted-foreground">正在检查学习设置…</p>}
  </div></div>;
}
