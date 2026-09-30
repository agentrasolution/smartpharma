"use client";

import { AuthProvider } from "@/contexts/AuthContext";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { useState, useEffect, type ReactNode } from "react";
import { initWebPolyfill } from "@/lib/webPolyfill";

import { ServerConnectionProvider } from "@/contexts/ServerConnectionContext";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      })
  );

  useEffect(() => {
    initWebPolyfill();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ServerConnectionProvider>
        <AuthProvider>
          {children}
          <Toaster richColors position="top-right" closeButton />
        </AuthProvider>
      </ServerConnectionProvider>
    </QueryClientProvider>
  );
}
