import { XRAY_CHAIN_IDS } from "@/game/config/constants";
import type { PersistedPlayerState, WalletIdentity } from "@/game/core/live-types";

const agentPrefixes = ["Lattice", "Signal", "Relay", "Vector", "Nimbus", "Cinder", "Harbor", "Nova"] as const;
const agentSuffixes = ["Runner", "Pilot", "Circuit", "Ledger", "Courier", "Anchor", "Beacon", "Thread"] as const;

export function resolveDefaultPlayerName(address?: `0x${string}`) {
  if (!address) {
    return "Agent Echo";
  }

  const seed = address
    .slice(2, 10)
    .split("")
    .reduce((total, char) => total + char.charCodeAt(0), 0);
  const prefix = agentPrefixes[seed % agentPrefixes.length];
  const suffix = agentSuffixes[seed % agentSuffixes.length];
  return `${prefix} ${suffix}-${address.slice(2, 6).toUpperCase()}`;
}

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
    playerName: "Agent Echo",
    revealedProofIds: [],
    unlockedLocations: ["village-exterior", "forge-interior", "depot-interior"],
    activeQuestStepId: "meet-keeper",
    muted: false,
    lowEffects: false,
  };
}
