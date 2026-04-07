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

export function sanitizeManifestPayload<T extends { manifest: WalletManifest }>(payload: T) {
  return {
    ...payload,
    manifest: sanitizeWalletManifest(payload.manifest),
  };
}
