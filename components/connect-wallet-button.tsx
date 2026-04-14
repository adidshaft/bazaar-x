"use client";

import { useEffect, useState } from "react";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { defaultXLayerChain } from "@/lib/xlayer";

function shortAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

type ConnectWalletButtonProps = {
  variant?: "default" | "pixel";
  fullWidth?: boolean;
  connectedLabel?: string;
};

export function ConnectWalletButton({
  variant = "default",
  fullWidth = false,
  connectedLabel,
}: ConnectWalletButtonProps) {
  const [hasMounted, setHasMounted] = useState(false);
  const { address, chain, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();

  const isPixel = variant === "pixel";
  const widthClass = fullWidth ? "w-full justify-center" : "";
  const baseClass = isPixel
    ? `px-btn ${widthClass}`
    : `inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm transition ${widthClass}`;

  useEffect(() => {
    setHasMounted(true);
  }, []);

  if (!hasMounted) {
    return (
      <button
        type="button"
        disabled
        className={`${baseClass} ${isPixel ? "opacity-50 cursor-wait" : "rounded-full border border-[#69f0d2]/20 bg-[#69f0d2]/8 font-medium text-[#bffdf1]/80 opacity-70"}`}
      >
        <span className={isPixel ? "hud-dot" : "h-2 w-2 rounded-full bg-[#69f0d2]"} />
        Connect wallet
      </button>
    );
  }

  if (isConnected && address) {
    const wrongChain = Boolean(chain && chain.id !== defaultXLayerChain.id);
    const disconnectLabel = connectedLabel ?? (wrongChain
      ? `Disconnect ${shortAddress(address)} · X Layer Testnet Required`
      : `Disconnect ${shortAddress(address)}${chain ? ` · ${chain.name}` : ""}`);

    return (
      <button
        type="button"
        onClick={() => disconnect()}
        aria-label={`Disconnect wallet ${address}`}
        title={`Disconnect wallet ${address}`}
        className={`${baseClass} ${isPixel ? "" : "rounded-full border border-white/10 bg-white/[0.05] text-slate-200 hover:border-[#69f0d2]/40 hover:text-white"}`}
      >
        <span
          className={
            isPixel
              ? `hud-dot ${wrongChain ? "is-gold" : "is-green"}`
              : `h-2 w-2 rounded-full ${wrongChain ? "bg-[#f6c453]" : "bg-[#69f0d2]"}`
          }
        />
        {disconnectLabel}
      </button>
    );
  }

  const connector = connectors[0];

  return (
    <button
      type="button"
      onClick={() => connector && connect({ connector })}
      disabled={!connector || isPending}
      className={`${baseClass} ${isPixel ? "primary" : "rounded-full border border-[#69f0d2]/30 bg-[#69f0d2]/10 font-medium text-[#bffdf1] hover:border-[#69f0d2]/60 hover:bg-[#69f0d2]/15 disabled:cursor-not-allowed disabled:opacity-60"}`}
    >
      <span className={isPixel ? "hud-dot" : "h-2 w-2 rounded-full bg-[#69f0d2]"} />
      {isPending ? "Connecting…" : "Connect Wallet"}
    </button>
  );
}
