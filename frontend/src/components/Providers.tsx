"use client";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { wagmiConfig, initAppKit } from "@/lib/wagmi";
import { useState } from "react";

// Initialize AppKit at module import (client-side only — this file is "use client")
if (typeof window !== "undefined") initAppKit();

import type { State } from "wagmi";
export function Providers({ children, initialState }: { children: React.ReactNode; initialState?: State }) {
  const [qc] = useState(() => new QueryClient());
  return (
    <WagmiProvider config={wagmiConfig} initialState={initialState}>
      <QueryClientProvider client={qc}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}
