"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function SetupPage() {
  const router = useRouter();
  useEffect(() => { router.replace("/welcome"); }, [router]);
  return <p role="status" className="p-6 text-sm">正在打开学习画像设置…</p>;
}
