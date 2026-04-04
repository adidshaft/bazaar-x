"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { http, createConfig, WagmiProvider } from "wagmi";
import { injected } from "wagmi/connectors";
import { xLayerMainnet, xLayerTestnet } from "../lib/xlayer";

const wagmiConfig = createConfig({
  chains: [xLayerMainnet, xLayerTestnet],
  connectors: [injected()],
  transports: {
    [xLayerMainnet.id]: http(xLayerMainnet.rpcUrls.default.http[0]),
    [xLayerTestnet.id]: http(xLayerTestnet.rpcUrls.default.http[0]),
  },
});

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
