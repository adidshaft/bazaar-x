"use client";

import { useEffect, useState } from "react";
import { useAccount, useConnect, useDisconnect } from "wagmi";

function shortAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function ConnectWalletButton() {
  const [hasMounted, setHasMounted] = useState(false);
  const { address, chain, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();

  useEffect(() => {
    setHasMounted(true);
  }, []);

  if (!hasMounted) {
    return (
      <button
        type="button"
        disabled
        className="inline-flex items-center gap-2 rounded-full border border-[#69f0d2]/20 bg-[#69f0d2]/8 px-4 py-2 text-sm font-medium text-[#bffdf1]/80 opacity-70"
      >
        <span className="h-2 w-2 rounded-full bg-[#69f0d2]" />
        Connect viewer wallet
      </button>
    );
  }

  if (isConnected && address) {
    return (
      <button
        type="button"
        onClick={() => disconnect()}
        className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-sm text-slate-200 transition hover:border-[#69f0d2]/40 hover:text-white"
      >
        <span className="h-2 w-2 rounded-full bg-[#69f0d2]" />
        {shortAddress(address)}
        {chain ? ` • ${chain.name}` : ""}
      </button>
    );
  }

  const connector = connectors[0];

  return (
    <button
      type="button"
      onClick={() => connector && connect({ connector })}
      disabled={!connector || isPending}
      className="inline-flex items-center gap-2 rounded-full border border-[#69f0d2]/30 bg-[#69f0d2]/10 px-4 py-2 text-sm font-medium text-[#bffdf1] transition hover:border-[#69f0d2]/60 hover:bg-[#69f0d2]/15 disabled:cursor-not-allowed disabled:opacity-60"
    >
      <span className="h-2 w-2 rounded-full bg-[#69f0d2]" />
      {isPending ? "Connecting..." : "Connect viewer wallet"}
    </button>
  );
}
