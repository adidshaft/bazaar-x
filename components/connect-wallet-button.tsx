"use client";

import { useAccount, useConnect, useDisconnect } from "wagmi";

function shortAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function ConnectWalletButton() {
  const { address, chain, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();

  if (isConnected && address) {
    return (
      <button
        type="button"
        onClick={() => disconnect()}
        className="rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-sm text-slate-200 transition hover:border-[#69f0d2]/40 hover:text-white"
      >
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
      className="rounded-full border border-[#69f0d2]/30 bg-[#69f0d2]/10 px-4 py-2 text-sm font-medium text-[#bffdf1] transition hover:border-[#69f0d2]/60 hover:bg-[#69f0d2]/15 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {isPending ? "Connecting..." : "Connect viewer wallet"}
    </button>
  );
}
