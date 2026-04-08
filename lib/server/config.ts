export const ARTIFACT_DIR = process.env.BAZAAR_X_ARTIFACT_DIR ?? ".bazaarx/runtime";
export const DEFAULT_SEED = process.env.BAZAAR_X_SEED ?? "bazaar-x";
export const NETWORK = process.env.X_LAYER_NETWORK ?? "testnet";
export const DEFAULT_CHAIN_ID = Number(
  process.env.X_LAYER_CHAIN_ID ?? (NETWORK === "mainnet" ? "196" : "1952"),
);
export const RPC_URL =
  process.env.X_LAYER_RPC_URL ??
  process.env.RPC_URL ??
  (DEFAULT_CHAIN_ID === 196
    ? process.env.X_LAYER_MAINNET_RPC_URL ?? "https://rpc.xlayer.tech"
    : "https://testrpc.xlayer.tech/terigon");
export const MAINNET_RPC_URL =
  process.env.X_LAYER_MAINNET_RPC_URL ?? "https://rpc.xlayer.tech";
export const MAINNET_CHAIN_ID = Number(process.env.X_LAYER_MAINNET_CHAIN_ID ?? "196");
export const EXPLORER_BASE_URL =
  process.env.X_LAYER_EXPLORER_BASE_URL ??
  (DEFAULT_CHAIN_ID === 196
    ? "https://www.oklink.com/x-layer"
    : "https://www.oklink.com/x-layer-testnet");
export const CONTRACT_ADDRESS = process.env.BAZAAR_X_CONTRACT_ADDRESS ?? "";
export const CONTRACT_ABI_JSON = process.env.BAZAAR_X_CONTRACT_ABI_JSON ?? "";
export const STATUS_ARTIFACT_PATH = process.env.BAZAAR_X_STATUS_ARTIFACT ?? "status/latest.json";
export const AGENTS_ARTIFACT_PATH = process.env.BAZAAR_X_AGENTS_ARTIFACT ?? "agents/latest.json";
export const ECONOMY_ARTIFACT_PATH = process.env.BAZAAR_X_ECONOMY_ARTIFACT ?? "economy/latest.json";
export const GOVERNANCE_ARTIFACT_PATH =
  process.env.BAZAAR_X_GOVERNANCE_ARTIFACT ?? "governance/latest.json";
export const RUNTIME_ARTIFACT_PATH =
  process.env.BAZAAR_X_RUNTIME_ARTIFACT ?? "live/latest.json";
export const WALLETS_ARTIFACT_PATH =
  process.env.BAZAAR_X_WALLETS_ARTIFACT ?? "wallets/latest.json";
export const DEPLOYMENT_ARTIFACT_PATH =
  process.env.BAZAAR_X_DEPLOYMENT_ARTIFACT ?? "deployments/latest.json";
export const EXECUTION_MODE =
  process.env.BAZAAR_X_EXECUTION_MODE ?? "viem";
export const ONCHAIN_OS_CHAIN_ALIAS =
  process.env.BAZAAR_X_ONCHAINOS_CHAIN_ALIAS ?? "";
