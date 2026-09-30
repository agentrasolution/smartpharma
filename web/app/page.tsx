"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import POS from "@/components/pages/POS";

const emptySubscribe = () => () => {};
function useMounted() {
  return useSyncExternalStore(emptySubscribe, () => true, () => false);
}

export default function Home() {
  const { user, isAuthenticated } = useAuth();
  const router = useRouter();
  const mounted = useMounted();

  useEffect(() => {
    if (mounted && !isAuthenticated) {
      router.push("/login");
    } else if (mounted && isAuthenticated && user?.role === "platform") {
      router.push("/platform");
    }
  }, [mounted, isAuthenticated, user, router]);

  if (!mounted || !isAuthenticated || !user) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="h-6 w-6 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
      </div>
    );
  }

  return <POS />;
}
