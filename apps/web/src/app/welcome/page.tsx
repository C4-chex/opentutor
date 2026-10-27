"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { LearningProfileForm } from "@/components/learning-profile/profile-form";

function safeReturnPath(value:string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || /[\\\x00-\x20]/.test(value)) return "/";
  const pathname = value.split(/[?#]/)[0];
  if (["/welcome", "/setup", "/onboarding"].includes(pathname)) return "/";
  return value;
}

export default function WelcomePage() {
  const router = useRouter();
  return <div className="min-h-screen bg-background px-4 py-10 sm:px-6">
    <div className="mx-auto max-w-2xl space-y-6">
      <header className="space-y-2"><p className="text-sm font-medium text-brand">OpenTutor · 从自己的资料开始学习</p>
        <h1 className="text-2xl font-bold">欢迎，先认识一下你的学习习惯</h1>
        <p className="text-sm text-muted-foreground">完成设置后，就可以导入资料并继续学习。</p>
      </header>
      <section className="rounded-2xl border border-border bg-card p-5 sm:p-7">
        <LearningProfileForm firstRun onSaved={() => router.replace(safeReturnPath(new URLSearchParams(window.location.search).get("next")))} />
      </section>
      <Link href="/settings" className="text-sm underline text-muted-foreground">模型连接需要调整？打开设置</Link>
    </div>
  </div>;
}
