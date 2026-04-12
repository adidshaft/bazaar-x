import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  AUTONOMOUS_EXECUTOR_PREFERENCE,
  EXECUTION_MODE,
  ONCHAIN_OS_CHAIN_ALIAS,
} from "../server/config";
import type {
  AutonomousExecutor,
  ExecutionMode,
  ExecutionResolution,
  OnchainOsSnapshot,
} from "./types";

type OnchainOsEnvelope<T> = {
  ok: boolean;
  data?: T;
  error?: string;
};

type GatewayGasRow = {
  normal?: string;
  min?: string;
  max?: string;
  supportEip1559?: boolean;
};

type GatewayOrder = {
  address?: string;
  chainIndex?: string;
  failReason?: string;
  orderId?: string;
  txHash?: string;
  txStatus?: string;
  txstatus?: string;
};

type GatewayOrdersPage = {
  cursor?: string;
  orders?: GatewayOrder[];
};

type WalletStatusPayload = {
  accountCount?: number;
  currentAccountId?: string;
  currentAccountName?: string;
  email?: string;
  loggedIn?: boolean;
};

type GatewaySimulationRow = {
  assetChange?: unknown[];
  failReason?: string;
  gasUsed?: string;
  intention?: string;
  risks?: unknown[];
};

type GatewayBroadcastRow = {
  orderId?: string;
  txHash?: string;
};

type GatewayGasLimitRow = {
  gasLimit?: string;
};

type ChainDescriptor = {
  alias?: string[];
  chainIndex?: number;
  chainName?: string;
  realChainIndex?: number;
  showName?: string;
};

function onchainosPath() {
  return resolve(process.env.HOME ?? "", ".local/bin/onchainos");
}

function normalizeOnchainOsError(error: unknown) {
  if (
    error &&
    typeof error === "object" &&
    "stdout" in error &&
    typeof (error as { stdout?: unknown }).stdout === "string"
  ) {
    const stdout = (error as { stdout: string }).stdout.trim();
    if (stdout) {
      try {
        return JSON.parse(stdout) as Record<string, unknown>;
      } catch {
        return { error: stdout };
      }
    }
  }

  return {
    error: error instanceof Error ? error.message : "Unknown onchainos CLI failure.",
  };
}

function runOnchainos<T>(args: string[]) {
  const binary = onchainosPath();
  if (!existsSync(binary)) {
    throw new Error("onchainos CLI not installed.");
  }

  try {
    const raw = execFileSync(binary, args, {
      encoding: "utf8",
      env: process.env,
    }).trim();

    return (raw ? JSON.parse(raw) : null) as T;
  } catch (error) {
    throw normalizeOnchainOsError(error);
  }
}

function extractErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "object" && error && "error" in error) {
    return String((error as { error?: unknown }).error ?? "Unknown onchainos error.");
  }

  return "Unknown onchainos error.";
}

function readOnchainOsSafe<T>(reader: () => T) {
  try {
    return {
      value: reader(),
      error: undefined,
    };
  } catch (error) {
    return {
      value: undefined,
      error: extractErrorMessage(error),
    };
  }
}

function readEnvelopeData<T>(payload: unknown) {
  if (!payload || typeof payload !== "object" || !("data" in payload)) {
    return undefined;
  }

  return (payload as { data?: T }).data;
}

function readChainDescriptors(payload: unknown) {
  const rows = readEnvelopeData<ChainDescriptor[]>(payload);
  return Array.isArray(rows) ? rows : [];
}

function normalizeWalletStatus(payload: unknown): WalletStatusPayload {
  const data = readEnvelopeData<WalletStatusPayload>(payload);
  return data && typeof data === "object" ? data : {};
}

function matchesChainDescriptor(
  descriptor: ChainDescriptor,
  chainId: number,
  chainAlias: string | null,
) {
  if (descriptor.chainIndex === chainId || descriptor.realChainIndex === chainId) {
    return true;
  }

  if (!chainAlias) {
    return false;
  }

  const alias = chainAlias.toLowerCase();
  return (
    descriptor.chainName?.toLowerCase() === alias ||
    descriptor.showName?.toLowerCase() === alias ||
    descriptor.alias?.some((entry) => entry.toLowerCase() === alias) === true
  );
}

function supportsChain(payload: unknown, chainId: number, chainAlias: string | null) {
  const descriptors = readChainDescriptors(payload);
  if (!descriptors.length) {
    return Boolean(chainAlias);
  }

  return descriptors.some((descriptor) => matchesChainDescriptor(descriptor, chainId, chainAlias));
}

export function resolveOnchainOsExecution(
  chainId: number,
  input?: {
    gatewayChains?: unknown;
    walletChains?: unknown;
    walletStatus?: unknown;
  },
): ExecutionResolution {
  const requestedMode = EXECUTION_MODE;
  const chainAlias = ONCHAIN_OS_CHAIN_ALIAS || (chainId === 196 ? "xlayer" : null);
  const requestedExecutor: AutonomousExecutor =
    AUTONOMOUS_EXECUTOR_PREFERENCE === "manifest-wallet"
      ? "manifest-wallet"
      : "agentic-wallet";
  const requestedGateway = requestedMode === "onchainos-gateway";
  const supportsGatewayBroadcast = supportsChain(input?.gatewayChains, chainId, chainAlias);
  const supportsAgenticWallet = supportsChain(input?.walletChains, chainId, chainAlias);
  const walletStatus = normalizeWalletStatus(input?.walletStatus);
  const walletLoggedIn = Boolean(walletStatus.loggedIn);
  const walletReady = supportsAgenticWallet && walletLoggedIn;
  const actualExecutor: AutonomousExecutor = "manifest-wallet";
  const resolvedMode: ExecutionMode =
    requestedGateway && supportsGatewayBroadcast ? "onchainos-gateway" : "viem";

  let fallbackReason: string | undefined;
  if (requestedExecutor === "agentic-wallet") {
    if (!supportsAgenticWallet) {
      fallbackReason =
        `Agentic Wallet does not currently expose chain ${chainId} in the installed OnchainOS CLI, ` +
        `so autonomous Bazaar X steps stay on the manifest-wallet fallback.`;
    } else if (!walletLoggedIn) {
      fallbackReason =
        "Agentic Wallet support is available on this chain, but no OnchainOS wallet account is logged in, so the manifest-wallet fallback stays active.";
    } else {
      fallbackReason =
        "Agentic Wallet readiness is visible, but this shared village still executes role-specific autonomous steps from manifest wallets in the current build.";
    }
  }

  const notes: string[] = [];
  if (requestedGateway && !supportsGatewayBroadcast) {
    notes.push(
      `Onchain OS gateway execution is not configured for chain ${chainId}. ` +
      `The current CLI only exposes X Layer mainnet by default. Set BAZAAR_X_ONCHAINOS_CHAIN_ALIAS ` +
      `if your CLI build supports another alias, or switch back to viem for testnet runs.`,
    );
  }

  if (fallbackReason) {
    notes.push(fallbackReason);
  }

  return {
    requestedMode,
    resolvedMode,
    requestedExecutor,
    actualExecutor,
    chainAlias,
    supportsGatewayBroadcast,
    supportsAgenticWallet,
    walletLoggedIn,
    walletReady,
    walletAccountId: walletStatus.currentAccountId || null,
    walletAccountName: walletStatus.currentAccountName || null,
    note: notes.length ? notes.join(" ") : undefined,
    fallbackReason,
  };
}

export function assertOnchainOsGatewayChain(chainId: number) {
  const execution = resolveOnchainOsExecution(chainId);
  if (execution.resolvedMode !== "onchainos-gateway" || !execution.chainAlias) {
    throw new Error(
      execution.note ??
        `Onchain OS gateway execution is unavailable for chain ${chainId}.`,
    );
  }

  return execution.chainAlias;
}

export function getGatewayGas(chainAlias: string) {
  return runOnchainos<OnchainOsEnvelope<GatewayGasRow[]>>([
    "gateway",
    "gas",
    "--chain",
    chainAlias,
  ]);
}

export function getGatewayGasLimit(input: {
  chainAlias: string;
  from: string;
  to: string;
  amount?: bigint;
  data?: string;
}) {
  const args = [
    "gateway",
    "gas-limit",
    "--from",
    input.from,
    "--to",
    input.to,
    "--chain",
    input.chainAlias,
  ];

  if (input.amount && input.amount > 0n) {
    args.push("--amount", input.amount.toString());
  }

  if (input.data && input.data !== "0x") {
    args.push("--data", input.data);
  }

  return runOnchainos<OnchainOsEnvelope<GatewayGasLimitRow[]>>(args);
}

export function simulateGatewayTransaction(input: {
  chainAlias: string;
  from: string;
  to: string;
  amount?: bigint;
  data?: string;
}) {
  const args = [
    "gateway",
    "simulate",
    "--from",
    input.from,
    "--to",
    input.to,
    "--data",
    input.data && input.data !== "0x" ? input.data : "0x",
    "--chain",
    input.chainAlias,
  ];

  if (input.amount && input.amount > 0n) {
    args.push("--amount", input.amount.toString());
  }

  return runOnchainos<OnchainOsEnvelope<GatewaySimulationRow[]>>(args);
}

export function broadcastGatewayTransaction(input: {
  chainAlias: string;
  signedTx: string;
  address: string;
}) {
  return runOnchainos<OnchainOsEnvelope<GatewayBroadcastRow[]>>([
    "gateway",
    "broadcast",
    "--signed-tx",
    input.signedTx,
    "--address",
    input.address,
    "--chain",
    input.chainAlias,
  ]);
}

export function getGatewayOrder(input: {
  chainAlias: string;
  address: string;
  orderId: string;
}) {
  return runOnchainos<OnchainOsEnvelope<GatewayOrdersPage[]>>([
    "gateway",
    "orders",
    "--address",
    input.address,
    "--chain",
    input.chainAlias,
    "--order-id",
    input.orderId,
  ]);
}

export function getWalletStatus() {
  return runOnchainos<OnchainOsEnvelope<WalletStatusPayload>>([
    "wallet",
    "status",
  ]);
}

export function getWalletChains() {
  return runOnchainos<OnchainOsEnvelope<ChainDescriptor[]>>([
    "wallet",
    "chains",
  ]);
}

export function gatewayNormalGasPrice(chainAlias: string) {
  const response = getGatewayGas(chainAlias);
  const row = response.data?.[0];
  return row?.normal ? BigInt(row.normal) : null;
}

export function firstGatewaySimulationRow(
  response: OnchainOsEnvelope<GatewaySimulationRow[]>,
) {
  return response.data?.[0] ?? null;
}

export function firstGatewayBroadcastRow(
  response: OnchainOsEnvelope<GatewayBroadcastRow[]>,
) {
  return response.data?.[0] ?? null;
}

export function firstGatewayOrder(
  response: OnchainOsEnvelope<GatewayOrdersPage[]>,
) {
  return response.data?.[0]?.orders?.[0] ?? null;
}

export async function collectOnchainOsSnapshot(chainId: number = 196): Promise<OnchainOsSnapshot> {
  const gatewayChainsResult = readOnchainOsSafe(() => runOnchainos(["gateway", "chains"]));
  const walletChainsResult = readOnchainOsSafe(() => getWalletChains());
  const walletStatusResult = readOnchainOsSafe(() => getWalletStatus());
  const execution = resolveOnchainOsExecution(chainId, {
    gatewayChains: gatewayChainsResult.value,
    walletChains: walletChainsResult.value,
    walletStatus: walletStatusResult.value,
  });
  const gatewayGasResult =
    execution.chainAlias && execution.supportsGatewayBroadcast
      ? readOnchainOsSafe(() => runOnchainos(["gateway", "gas", "--chain", execution.chainAlias!]))
      : { value: undefined, error: undefined };

  const errors = [
    gatewayChainsResult.error,
    walletChainsResult.error,
    walletStatusResult.error,
    gatewayGasResult.error,
  ].filter((value): value is string => Boolean(value));

  return {
    collectedAt: new Date().toISOString(),
    gatewayChains: gatewayChainsResult.value,
    gatewayGas: gatewayGasResult.value,
    walletChains: walletChainsResult.value,
    walletStatus: walletStatusResult.value,
    execution,
    error: errors.length ? errors.join(" | ") : undefined,
  };
}
