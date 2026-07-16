"use client";

import React, { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MotionConfig } from "motion/react";

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute stale time
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <MotionConfig reducedMotion="user" transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </MotionConfig>
  );
}
