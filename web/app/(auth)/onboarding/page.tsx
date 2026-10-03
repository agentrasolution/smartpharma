"use client";

import { useRouter } from "next/navigation";
import Onboarding from "@/components/pages/Onboarding";

export default function OnboardingPage() {
  const router = useRouter();

  return (
    <Onboarding
      onComplete={() => {
        localStorage.removeItem("smartpharma_onboarding_pending");
        router.push("/");
      }}
    />
  );
}
