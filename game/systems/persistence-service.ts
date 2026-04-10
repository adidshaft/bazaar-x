import { STORAGE_PREFIX } from "@/game/config/constants";
import type { PersistedPlayerState, WalletIdentity } from "@/game/core/live-types";

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
    return JSON.parse(raw) as PersistedPlayerState;
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

