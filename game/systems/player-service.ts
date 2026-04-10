import { XRAY_CHAIN_IDS } from "@/game/config/constants";
import type { PersistedPlayerState, WalletIdentity } from "@/game/core/live-types";

export function resolveWalletIdentity(input: {
  address?: `0x${string}`;
  chainId?: number;
  isConnected: boolean;
}): WalletIdentity {
  return {
    connected: input.isConnected,
    validNetwork: Boolean(input.chainId && XRAY_CHAIN_IDS.includes(input.chainId as 1952 | 196)),
    address: input.address,
    chainId: input.chainId,
  };
}

export function createDefaultPlayerPersistence(): PersistedPlayerState {
  return {
    currentMapId: "village-exterior",
    lastSpawnId: "gate-spawn",
    revealedProofIds: [],
    unlockedLocations: ["village-exterior", "forge-interior", "depot-interior"],
    activeQuestStepId: "meet-keeper",
    muted: false,
    lowEffects: false,
  };
}

