import type { Address, Hex } from "viem";

export type AgentRole = "shop" | "supplier" | "worker" | "governor";
export type ExecutionMode = "viem" | "onchainos-gateway";

export interface AgentWallet {
  id: string;
  role: AgentRole;
  name: string;
  handle: string;
  goal: string;
  bootstrapOkb: string;
  privateKey: Hex;
  address: Address;
}

export interface SystemWallet {
  label: string;
  privateKey: Hex;
  address: Address;
}

export interface WalletManifest {
  network: string;
  chainId: number;
  rpcUrl: string;
  explorerBaseUrl: string;
  createdAt: string;
  deployer: SystemWallet;
  treasury: SystemWallet;
  agents: AgentWallet[];
}

export interface InitialRules {
  taxBps: number;
  minimumBalanceWei: string;
  quorumBps: number;
  supportBps: number;
  votingPeriodSeconds: number;
}

export interface DeploymentArtifact {
  chainId: number;
  rpcUrl: string;
  explorerBaseUrl: string;
  contractAddress: Address;
  deployTxHash: Hex;
  executionMode?: ExecutionMode;
  gatewayOrderId?: string;
  treasury: Address;
  deployedAt: string;
  initialRules: InitialRules;
}

export type StepStatus = "pending" | "success" | "failed";

export interface StepRecord {
  key: string;
  label: string;
  status: StepStatus;
  startedAt: string;
  completedAt?: string;
  txHash?: Hex;
  explorerUrl?: string;
  detail?: string;
  meta?: Record<string, string | number | boolean | null>;
}

export interface BalanceRecord {
  label: string;
  address: Address;
  balanceWei: string;
  balanceOkb: string;
  funded: boolean;
}

export interface FundingSnapshot {
  readyForDeploy: boolean;
  readyForFlow: boolean;
  deployer: BalanceRecord;
  treasury: BalanceRecord;
  agents: BalanceRecord[];
  requiredDeployerBalanceOkb: string;
}

export interface OnchainOsSnapshot {
  collectedAt: string;
  gatewayGas?: unknown;
  gatewayChains?: unknown;
  walletStatus?: unknown;
  execution?: {
    requestedMode: string;
    resolvedMode: ExecutionMode;
    chainAlias: string | null;
    supportsGatewayBroadcast: boolean;
    supportsAgenticWallet: boolean;
    note?: string;
  };
  error?: string;
}

export interface ExecutionSnapshot {
  requestedMode: string;
  resolvedMode: ExecutionMode;
  chainAlias: string | null;
  simulateBeforeBroadcast: boolean;
  usesOnchainOsGateway: boolean;
  usesAgenticWallet: boolean;
  note?: string;
}

export interface LiveRuntimeArtifact {
  runId?: string;
  deployment?: DeploymentArtifact;
  funding?: FundingSnapshot;
  onchainOs?: OnchainOsSnapshot;
  execution?: ExecutionSnapshot;
  status: "idle" | "ready" | "running" | "completed" | "failed";
  lastUpdatedAt: string;
  proposalId?: number;
  shopIds?: Partial<Record<AgentRole, number>>;
  serviceIds?: Partial<Record<AgentRole, number>>;
  firstTaxWei?: string;
  secondTaxWei?: string;
  txHashes: Hex[];
  steps: StepRecord[];
  error?: string;
}
