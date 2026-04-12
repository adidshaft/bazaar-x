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
export const UNISWAP_DEPLOYMENT_ARTIFACT_PATH =
  process.env.BAZAAR_X_UNISWAP_DEPLOYMENT_ARTIFACT ?? "defi/uniswap-v2/latest.json";
export const UNISWAP_WRAPPED_NATIVE_ADDRESS =
  process.env.BAZAAR_X_UNISWAP_WRAPPED_NATIVE_ADDRESS ??
  (DEFAULT_CHAIN_ID === 1952 ? "0xBec7859BC3d0603BeC454F7194173E36BF2Aa5C8" : "");
export const UNISWAP_SUPPLIER_SWAP_INPUT_OKB =
  process.env.BAZAAR_X_UNISWAP_SUPPLIER_SWAP_INPUT_OKB ?? "0.031";
export const UNISWAP_SUPPLIER_SERVICE_PRICE_TOKEN =
  process.env.BAZAAR_X_UNISWAP_SUPPLIER_SERVICE_PRICE_TOKEN ?? "1.9";
export const UNISWAP_INITIAL_LP_OKB =
  process.env.BAZAAR_X_UNISWAP_INITIAL_LP_OKB ?? "0.06";
export const UNISWAP_INITIAL_LP_TOKEN =
  process.env.BAZAAR_X_UNISWAP_INITIAL_LP_TOKEN ?? "6";
export const UNISWAP_SLIPPAGE_BPS = Number(
  process.env.BAZAAR_X_UNISWAP_SLIPPAGE_BPS ?? "100",
);
