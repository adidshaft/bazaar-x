import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { EXECUTION_MODE, ONCHAIN_OS_CHAIN_ALIAS } from "../server/config";
import type { ExecutionMode, OnchainOsSnapshot } from "./types";

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

export function resolveOnchainOsExecution(chainId: number) {
  const requestedMode = EXECUTION_MODE;
  const chainAlias = ONCHAIN_OS_CHAIN_ALIAS || (chainId === 196 ? "xlayer" : null);
  const requestedGateway = requestedMode === "onchainos-gateway";
  const supportsGatewayBroadcast = Boolean(chainAlias);
  const resolvedMode: ExecutionMode =
    requestedGateway && supportsGatewayBroadcast ? "onchainos-gateway" : "viem";

  let note: string | undefined;
  if (requestedGateway && !supportsGatewayBroadcast) {
    note =
      `Onchain OS gateway execution is not configured for chain ${chainId}. ` +
      `The current CLI only exposes X Layer mainnet by default. Set BAZAAR_X_ONCHAINOS_CHAIN_ALIAS ` +
      `if your CLI build supports another alias, or switch back to viem for testnet runs.`;
  }

  return {
    requestedMode,
    resolvedMode,
    chainAlias,
    supportsGatewayBroadcast,
    supportsAgenticWallet: Boolean(chainAlias),
    note,
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
  const execution = resolveOnchainOsExecution(chainId);

  try {
    return {
      collectedAt: new Date().toISOString(),
      gatewayChains: runOnchainos(["gateway", "chains"]),
      gatewayGas: execution.chainAlias
        ? runOnchainos(["gateway", "gas", "--chain", execution.chainAlias])
        : undefined,
      walletStatus: getWalletStatus(),
      execution,
    };
  } catch (error) {
    return {
      collectedAt: new Date().toISOString(),
      execution,
      error:
        error instanceof Error
          ? error.message
          : typeof error === "object" && error && "error" in error
            ? String((error as { error?: unknown }).error)
            : "Failed to collect Onchain OS data.",
    };
  }
}
