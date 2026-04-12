import { STORAGE_PREFIX } from "@/game/config/constants";
import type {
  LaborRoutingState,
  PersistedPlayerState,
  WalletIdentity,
} from "@/game/core/live-types";

function createEmptyLaborRoutingState(): LaborRoutingState {
  return {
    jobs: [],
    npcStates: {},
    observedStepKeys: [],
  };
}

export function createWalletStorageKey(wallet: WalletIdentity) {
  if (!wallet.address || !wallet.chainId) {
    return null;
  }

  return `${STORAGE_PREFIX}:${wallet.chainId}:${wallet.address.toLowerCase()}`;
}

export function loadPersistedPlayerState(wallet: WalletIdentity): PersistedPlayerState | null {
  const key = createWalletStorageKey(wallet);
  if (!key || typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(key);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<PersistedPlayerState>;
    return {
      currentMapId: parsed.currentMapId ?? "village-exterior",
      lastSpawnId: parsed.lastSpawnId,
      playerName: parsed.playerName,
      revealedProofIds: parsed.revealedProofIds ?? [],
      unlockedLocations: parsed.unlockedLocations ?? ["village-exterior"],
      activeQuestStepId: parsed.activeQuestStepId,
      unlockedSkillIds: parsed.unlockedSkillIds ?? [],
      activeSkillId: parsed.activeSkillId ?? null,
      muted: parsed.muted ?? false,
      lowEffects: parsed.lowEffects ?? false,
      laborRouting: parsed.laborRouting ?? createEmptyLaborRoutingState(),
    };
  } catch {
    return null;
  }
}

export function savePersistedPlayerState(
  wallet: WalletIdentity,
  state: PersistedPlayerState,
) {
  const key = createWalletStorageKey(wallet);
  if (!key || typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(key, JSON.stringify(state));
}

export function clearPersistedPlayerState(wallet: WalletIdentity) {
  const key = createWalletStorageKey(wallet);
  if (!key || typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(key);
}
