import type { WalletManifest } from "../onchain/types";

export function sanitizeWalletManifest(manifest: WalletManifest) {
  const { deployer, treasury, agents, ...rest } = manifest;

  return {
    ...rest,
    deployer: {
      label: deployer.label,
      address: deployer.address,
    },
    treasury: {
      label: treasury.label,
      address: treasury.address,
    },
    agents: agents.map((agent) => {
      const publicAgent = { ...agent };
      delete (publicAgent as { privateKey?: string }).privateKey;
      return publicAgent;
    }),
  };
}

function sanitizeWalletStatusPayload(walletStatus: unknown) {
  if (!walletStatus || typeof walletStatus !== "object") {
    return walletStatus;
  }

  const envelope = { ...(walletStatus as Record<string, unknown>) };
  const data =
    envelope.data && typeof envelope.data === "object"
      ? { ...(envelope.data as Record<string, unknown>) }
      : null;

  if (data) {
    delete data.email;
    delete data.apiKey;
    envelope.data = data;
  }

  return envelope;
}

function sanitizeOnchainSnapshot(snapshot: unknown) {
  if (!snapshot || typeof snapshot !== "object") {
    return snapshot;
  }

  const next = { ...(snapshot as Record<string, unknown>) };

  if ("walletStatus" in next) {
    next.walletStatus = sanitizeWalletStatusPayload(next.walletStatus);
  }

  return next;
}

export function sanitizeManifestPayload<T extends { manifest: WalletManifest }>(payload: T) {
  const next = {
    ...payload,
    manifest: sanitizeWalletManifest(payload.manifest),
  } as T & {
    onchainSnapshot?: unknown;
    runtime?: { onchainOs?: unknown } | null;
  };

  if (next.onchainSnapshot) {
    next.onchainSnapshot = sanitizeOnchainSnapshot(next.onchainSnapshot);
  }

  if (next.runtime?.onchainOs) {
    next.runtime = {
      ...next.runtime,
      onchainOs: sanitizeOnchainSnapshot(next.runtime.onchainOs),
    };
  }

  return next;
}
