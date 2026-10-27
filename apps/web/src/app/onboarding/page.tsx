"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Legacy /onboarding route — redirects to /welcome.
 * Kept for backwards compatibility with existing links and tests.
 */
export default function OnboardingRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/welcome");
  }, [router]);
  return null;
}
