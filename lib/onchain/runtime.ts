import { formatEther, parseEther, type Address, type Hex } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { readArtifact, writeArtifactSnapshot } from "../server/artifacts";
import {
  DEFAULT_CHAIN_ID,
  EXPLORER_BASE_URL,
  NETWORK,
  RPC_URL,
  RUNTIME_ARTIFACT_PATH,
  WALLETS_ARTIFACT_PATH,
} from "../server/config";
import { createXLayerPublicClient } from "../xlayer";
import type { AgentWallet, BalanceRecord, FundingSnapshot, LiveRuntimeArtifact, WalletManifest } from "./types";

const AGENT_BLUEPRINTS: Array<
  Pick<AgentWallet, "role" | "name" | "handle" | "goal" | "bootstrapOkb">
> = [
  {
    role: "shop",
    name: "Bazaar Forge",
    handle: "bazaar-shop",
    goal: "Open shops, route work, and keep demand flowing.",
    bootstrapOkb: "0.045",
  },
  {
    role: "supplier",
    name: "Supply Coil",
    handle: "supply-coil",
    goal: "Sell supply services and hire workers when demand spikes.",
    bootstrapOkb: "0.040",
  },
  {
    role: "worker",
    name: "Node Pilot",
    handle: "node-pilot",
    goal: "Complete labor tasks, earn onchain revenue, and vote on policy.",
    bootstrapOkb: "0.015",
  },
  {
    role: "governor",
    name: "Covenant Council",
    handle: "covenant-council",
    goal: "Propose, vote, and execute treasury-aware rule changes.",
    bootstrapOkb: "0.015",
  },
];

const DEPLOYER_BUFFER = parseEther("0.08");

function buildWallet(label: string, privateKey?: Hex) {
  const resolvedKey = privateKey ?? generatePrivateKey();
  const account = privateKeyToAccount(resolvedKey);

  return {
    label,
    privateKey: resolvedKey,
    address: account.address,
  };
}

function buildAgentWallet(
  blueprint: (typeof AGENT_BLUEPRINTS)[number],
  index: number,
): AgentWallet {
  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);

  return {
    id: `${blueprint.role}_${index + 1}`,
    role: blueprint.role,
    name: blueprint.name,
    handle: blueprint.handle,
    goal: blueprint.goal,
    bootstrapOkb: blueprint.bootstrapOkb,
    privateKey,
    address: account.address,
  };
}

export async function loadWalletManifest() {
  return readArtifact<WalletManifest>(WALLETS_ARTIFACT_PATH);
}

export async function ensureWalletManifest() {
  const existing = await loadWalletManifest();
  if (existing) {
    return existing;
  }

  const deployer = buildWallet("Deployer", process.env.BAZAAR_X_DEPLOYER_PRIVATE_KEY as Hex | undefined);
  const treasury = buildWallet("Treasury", process.env.BAZAAR_X_TREASURY_PRIVATE_KEY as Hex | undefined);

  const manifest: WalletManifest = {
    network: NETWORK,
    chainId: DEFAULT_CHAIN_ID,
    rpcUrl: RPC_URL,
    explorerBaseUrl: EXPLORER_BASE_URL,
    createdAt: new Date().toISOString(),
    deployer,
    treasury,
    agents: AGENT_BLUEPRINTS.map((blueprint, index) => buildAgentWallet(blueprint, index)),
  };

  await writeArtifactSnapshot(WALLETS_ARTIFACT_PATH, manifest);
  return manifest;
}

export async function loadLiveRuntime() {
  return readArtifact<LiveRuntimeArtifact>(RUNTIME_ARTIFACT_PATH);
}

export async function saveLiveRuntime(runtime: LiveRuntimeArtifact) {
  await writeArtifactSnapshot(RUNTIME_ARTIFACT_PATH, runtime);
  return runtime;
}

export async function createEmptyRuntime() {
  return saveLiveRuntime({
    status: "idle",
    lastUpdatedAt: new Date().toISOString(),
    txHashes: [],
    steps: [],
  });
}

export async function upsertRuntime(partial: Partial<LiveRuntimeArtifact>) {
  const current = (await loadLiveRuntime()) ?? {
    status: "idle" as const,
    lastUpdatedAt: new Date().toISOString(),
    txHashes: [],
    steps: [],
  };

  const next: LiveRuntimeArtifact = {
    ...current,
    ...partial,
    txHashes: partial.txHashes ?? current.txHashes,
    steps: partial.steps ?? current.steps,
    lastUpdatedAt: new Date().toISOString(),
  };

  await saveLiveRuntime(next);
  return next;
}

function createBalanceRecord(label: string, address: Address, balanceWei: bigint, minimumWei: bigint): BalanceRecord {
  return {
    label,
    address,
    balanceWei: balanceWei.toString(),
    balanceOkb: formatEther(balanceWei),
    funded: balanceWei >= minimumWei,
  };
}

export async function getFundingSnapshot(manifest?: WalletManifest): Promise<FundingSnapshot> {
  const resolvedManifest = manifest ?? (await ensureWalletManifest());
  const publicClient = createXLayerPublicClient(
    resolvedManifest.chainId,
    resolvedManifest.rpcUrl,
    resolvedManifest.explorerBaseUrl,
  );

  const deployerBalance = await publicClient.getBalance({
    address: resolvedManifest.deployer.address,
  });
  const treasuryBalance = await publicClient.getBalance({
    address: resolvedManifest.treasury.address,
  });

  const agentBalances = await Promise.all(
    resolvedManifest.agents.map(async (agent) => {
      const balance = await publicClient.getBalance({ address: agent.address });
      const minimumWei = parseEther(agent.bootstrapOkb);
      return createBalanceRecord(agent.name, agent.address, balance, minimumWei);
    }),
  );

  const requiredDeployerBalance = resolvedManifest.agents.reduce(
    (sum, agent) => sum + parseEther(agent.bootstrapOkb),
    DEPLOYER_BUFFER,
  );
  const allAgentsFunded = agentBalances.every((entry) => entry.funded);

  return {
    readyForDeploy: deployerBalance >= DEPLOYER_BUFFER,
    readyForFlow: deployerBalance >= DEPLOYER_BUFFER && allAgentsFunded,
    deployer: createBalanceRecord(
      "Deployer",
      resolvedManifest.deployer.address,
      deployerBalance,
      DEPLOYER_BUFFER,
    ),
    treasury: createBalanceRecord(
      "Treasury",
      resolvedManifest.treasury.address,
      treasuryBalance,
      parseEther("0.001"),
    ),
    agents: agentBalances,
    requiredDeployerBalanceOkb: formatEther(requiredDeployerBalance),
  };
}
