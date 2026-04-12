import { zeroAddress, type Hex } from "viem";
import type {
  BazaarEconomicState,
  BazaarGatewayState,
  BazaarGovernanceState,
  BazaarSnapshot,
  LiveRuntimeStatus,
} from "@/game/core/live-types";
import type { DeploymentArtifact } from "@/lib/onchain/types";
import { getBazaarAbi, loadDeploymentArtifact } from "../onchain/contract";
import { createXLayerPublicClient, explorerTxUrl } from "../xlayer";

const DAY_MS = 24 * 60 * 60 * 1000;
const LIVE_MONITOR_CACHE_MS = 12_000;
const LABOR_DISPATCHER_HEARTBEAT_MS = 100;
const LIVE_MONITOR_NOTE =
  "X Layer RPC reads are cached for 12s while the dispatcher heartbeat keeps HUD-facing metrics fresh at 100ms.";

type LiveMonitorCoreSnapshot = {
  economics: BazaarEconomicState;
  governance: BazaarGovernanceState;
  gateway: BazaarGatewayState;
};

type LiveMonitorTelemetry = {
  cacheAgeMs: number;
  cacheHitCount: number;
  dispatcherHeartbeatMs: number;
  healthLabel: "healthy" | "steady" | "strained";
  hudGlow: number;
  hudOpacity: number;
  lastFetchMs: number;
  lastSyncedAt: string;
  note: string;
  pulseMs: number;
  refreshInMs: number;
  rpcFetchCount: number;
  rpcThrottleMs: number;
  villageHealth: number;
};

type LiveMonitorSnapshot = LiveMonitorCoreSnapshot & {
  monitor: LiveMonitorTelemetry;
};

type RuntimeStepSample = NonNullable<LiveRuntimeStatus>["steps"][number] & {
  completedAt: string;
};

let cachedLiveMonitor:
  | {
      snapshot: LiveMonitorCoreSnapshot;
      cachedAt: number;
      fetchCount: number;
      cacheHitCount: number;
      lastFetchMs: number;
    }
  | null = null;
let pendingLiveMonitor: Promise<LiveMonitorSnapshot> | null = null;

function defaultEconomics(): BazaarEconomicState {
  return {
    tvlOkb: 0,
    dailyVolumeOkb: 0,
    dailyTransactionCount: 0,
    treasuryInflowOkb: 0,
    gdpScore: 0,
    worldTier: 0,
  };
}

function defaultGovernance(): BazaarGovernanceState {
  return {
    activeProposalCount: 0,
    activeProposalIds: [],
    latestProposalId: 0,
    ayeVotes: 0,
    nayVotes: 0,
  };
}

function defaultGateway(): BazaarGatewayState {
  return {
    blockHeight: 0,
  };
}

function resolveWorldTier(gdpScore: number) {
  if (gdpScore >= 50000) {
    return 2;
  }

  if (gdpScore >= 10000) {
    return 1;
  }

  return 0;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function buildVillageHealth(core: LiveMonitorCoreSnapshot, cacheAgeMs: number) {
  const gdpHealth = clamp(core.economics.gdpScore / 50000, 0, 1);
  const treasuryHealth = clamp(core.economics.tvlOkb / 32, 0, 1);
  const throughputHealth = clamp(
    (core.economics.dailyVolumeOkb + core.economics.treasuryInflowOkb) / 24,
    0,
    1,
  );
  const governanceDrag = clamp(core.governance.activeProposalCount / 8, 0, 1);
  const freshnessHealth = clamp(1 - cacheAgeMs / (LIVE_MONITOR_CACHE_MS * 2), 0, 1);

  return clamp(
    0.18 +
      gdpHealth * 0.54 +
      treasuryHealth * 0.14 +
      throughputHealth * 0.1 +
      freshnessHealth * 0.12 -
      governanceDrag * 0.08,
    0,
    1,
  );
}

function buildMonitorTelemetry(
  core: LiveMonitorCoreSnapshot,
  cacheState: {
    cachedAt: number;
    fetchCount: number;
    cacheHitCount: number;
    lastFetchMs: number;
  },
  now = Date.now(),
): LiveMonitorTelemetry {
  const cacheAgeMs = Math.max(0, now - cacheState.cachedAt);
  const villageHealth = buildVillageHealth(core, cacheAgeMs);

  return {
    cacheAgeMs,
    cacheHitCount: cacheState.cacheHitCount,
    dispatcherHeartbeatMs: LABOR_DISPATCHER_HEARTBEAT_MS,
    healthLabel: villageHealth >= 0.75 ? "healthy" : villageHealth >= 0.45 ? "steady" : "strained",
    hudGlow: Number((0.08 + villageHealth * 0.34).toFixed(3)),
    hudOpacity: Number((0.8 + villageHealth * 0.16).toFixed(3)),
    lastFetchMs: cacheState.lastFetchMs,
    lastSyncedAt: new Date(cacheState.cachedAt).toISOString(),
    note: LIVE_MONITOR_NOTE,
    pulseMs: Math.max(3600, Math.round(6800 - villageHealth * 2200)),
    refreshInMs: Math.max(0, LIVE_MONITOR_CACHE_MS - cacheAgeMs),
    rpcFetchCount: cacheState.fetchCount,
    rpcThrottleMs: LIVE_MONITOR_CACHE_MS,
    villageHealth: Number(villageHealth.toFixed(3)),
  };
}

function decorateSnapshot(
  core: LiveMonitorCoreSnapshot,
  cacheState: {
    cachedAt: number;
    fetchCount: number;
    cacheHitCount: number;
    lastFetchMs: number;
  },
  now = Date.now(),
): LiveMonitorSnapshot {
  return {
    ...core,
    monitor: buildMonitorTelemetry(core, cacheState, now),
  };
}

function defaultSnapshot(): LiveMonitorSnapshot {
  const core = {
    economics: defaultEconomics(),
    governance: defaultGovernance(),
    gateway: defaultGateway(),
  };

  return decorateSnapshot(core, {
    cachedAt: Date.now(),
    fetchCount: 0,
    cacheHitCount: 0,
    lastFetchMs: 0,
  });
}

function extractOkbAmount(detail?: string | null) {
  if (!detail) {
    return 0;
  }

  const match = detail.match(/paid\s+([0-9]+(?:\.[0-9]+)?)\s+OKB/i);
  return match ? Number(match[1]) : 0;
}

function extractTaxAmount(step: NonNullable<LiveRuntimeStatus>["steps"][number]) {
  const rawTax = step.meta?.taxOkb;
  if (typeof rawTax === "string") {
    return Number(rawTax);
  }

  if (typeof rawTax === "number") {
    return rawTax;
  }

  return 0;
}

function getRecentEconomicSteps(runtime: LiveRuntimeStatus | null) {
  const cutoff = Date.now() - DAY_MS;

  return (runtime?.steps ?? [])
    .filter(
      (step): step is RuntimeStepSample =>
        step.status === "success" &&
        Boolean(step.completedAt) &&
        Boolean(step.txHash) &&
        new Date(step.completedAt as string).getTime() >= cutoff,
    )
    .filter((step) => extractOkbAmount(step.detail) > 0 || extractTaxAmount(step) > 0);
}

function buildEconomicState(
  bazaarSnapshot: BazaarSnapshot | null,
  runtime: LiveRuntimeStatus | null,
  deployment: DeploymentArtifact,
  governance: BazaarGovernanceState,
) {
  const recentEconomicSteps = getRecentEconomicSteps(runtime);
  const latestTaxStep = [...recentEconomicSteps]
    .reverse()
    .find((step) => extractTaxAmount(step) > 0);
  const dailyVolumeOkb = recentEconomicSteps.reduce(
    (total, step) => total + extractOkbAmount(step.detail),
    0,
  );
  const treasuryInflowOkb = recentEconomicSteps.reduce(
    (total, step) => total + extractTaxAmount(step),
    0,
  );
  const tvlOkb = Number(bazaarSnapshot?.treasuryBalanceOkb ?? 0);
  const dailyTransactionCount = recentEconomicSteps.length;
  const gdpScore = Number(
    (
      tvlOkb * 1000 +
      dailyVolumeOkb * 240 +
      treasuryInflowOkb * 160 +
      dailyTransactionCount * 4 +
      governance.activeProposalCount * 10
    ).toFixed(2),
  );

  return {
    tvlOkb,
    dailyVolumeOkb,
    dailyTransactionCount,
    treasuryInflowOkb,
    gdpScore,
    worldTier: resolveWorldTier(gdpScore),
    sampledAt: new Date().toISOString(),
    latestTreasuryTxHash: latestTaxStep?.txHash,
    latestTreasuryExplorerUrl: latestTaxStep?.txHash
      ? explorerTxUrl(latestTaxStep.txHash, deployment.explorerBaseUrl)
      : undefined,
    latestTaxAmountOkb:
      latestTaxStep && extractTaxAmount(latestTaxStep) > 0
        ? extractTaxAmount(latestTaxStep).toFixed(4)
        : undefined,
  } satisfies BazaarEconomicState;
}

async function resolveDeployment() {
  return (await loadDeploymentArtifact()) as DeploymentArtifact | null;
}

async function readGovernanceState(
  deployment: DeploymentArtifact,
  bazaarSnapshot: BazaarSnapshot | null,
) {
  const proposalCount = Math.max(0, (bazaarSnapshot?.nextProposalId ?? 1) - 1);
  if (proposalCount === 0) {
    return defaultGovernance();
  }

  const client = createXLayerPublicClient(
    deployment.chainId,
    deployment.rpcUrl,
    deployment.explorerBaseUrl,
  );

  const proposals = await Promise.all(
    Array.from({ length: proposalCount }, (_, index) =>
      client.readContract({
        address: deployment.contractAddress,
        abi: getBazaarAbi(),
        functionName: "getProposal",
        args: [BigInt(index + 1)],
      }),
    ),
  );

  const now = Date.now();
  const activeEntries = proposals
    .map((proposal, index) => {
      const [proposer, , votingEndsAt, yesVotes, noVotes, executed] = proposal as [
        `0x${string}`,
        bigint,
        bigint,
        bigint,
        bigint,
        boolean,
        string,
        unknown,
        Hex,
      ];

      return {
        id: index + 1,
        proposer,
        votingEndsAt: Number(votingEndsAt) * 1000,
        yesVotes: Number(yesVotes),
        noVotes: Number(noVotes),
        executed,
      };
    })
    .filter((proposal) => proposal.proposer !== zeroAddress);

  const activeProposals = activeEntries.filter(
    (proposal) => !proposal.executed && proposal.votingEndsAt > now,
  );
  const focusProposal = activeProposals.at(-1) ?? activeEntries.at(-1);

  return {
    activeProposalCount: activeProposals.length,
    activeProposalIds: activeProposals.map((proposal) => proposal.id),
    latestProposalId: activeEntries.at(-1)?.id ?? 0,
    ayeVotes: focusProposal?.yesVotes ?? 0,
    nayVotes: focusProposal?.noVotes ?? 0,
  } satisfies BazaarGovernanceState;
}

export async function readLiveMonitorSnapshot(
  bazaarSnapshot: BazaarSnapshot | null,
  runtime: LiveRuntimeStatus | null,
) {
  if (cachedLiveMonitor && Date.now() - cachedLiveMonitor.cachedAt < LIVE_MONITOR_CACHE_MS) {
    cachedLiveMonitor.cacheHitCount += 1;
    return decorateSnapshot(cachedLiveMonitor.snapshot, {
      cachedAt: cachedLiveMonitor.cachedAt,
      fetchCount: cachedLiveMonitor.fetchCount,
      cacheHitCount: cachedLiveMonitor.cacheHitCount,
      lastFetchMs: cachedLiveMonitor.lastFetchMs,
    });
  }

  if (pendingLiveMonitor) {
    return pendingLiveMonitor;
  }

  pendingLiveMonitor = (async () => {
    const deployment = await resolveDeployment();
    if (!deployment) {
      return defaultSnapshot();
    }

    const client = createXLayerPublicClient(
      deployment.chainId,
      deployment.rpcUrl,
      deployment.explorerBaseUrl,
    );
    const fetchStartedAt = Date.now();

    const [latestBlockNumber, latestBlock, governance] = await Promise.all([
      client.getBlockNumber(),
      client.getBlock({ blockTag: "latest" }),
      readGovernanceState(deployment, bazaarSnapshot).catch((error) => {
        console.warn("[live-monitor] governance sync failed", error);
        return defaultGovernance();
      }),
    ]);

    const gatewayLatestTxHash = runtime?.txHashes.at(-1);
    const coreSnapshot = {
      economics: buildEconomicState(bazaarSnapshot, runtime, deployment, governance),
      governance,
      gateway: {
        blockHeight: Number(latestBlockNumber),
        latestTxHash: gatewayLatestTxHash,
        latestExplorerUrl: gatewayLatestTxHash
          ? explorerTxUrl(gatewayLatestTxHash, deployment.explorerBaseUrl)
          : undefined,
        syncedAt: new Date(Number(latestBlock.timestamp) * 1000).toISOString(),
      } satisfies BazaarGatewayState,
    } satisfies LiveMonitorCoreSnapshot;
    const lastFetchMs = Date.now() - fetchStartedAt;

    cachedLiveMonitor = {
      snapshot: coreSnapshot,
      cachedAt: Date.now(),
      fetchCount: (cachedLiveMonitor?.fetchCount ?? 0) + 1,
      cacheHitCount: cachedLiveMonitor?.cacheHitCount ?? 0,
      lastFetchMs,
    };
    return decorateSnapshot(coreSnapshot, {
      cachedAt: cachedLiveMonitor.cachedAt,
      fetchCount: cachedLiveMonitor.fetchCount,
      cacheHitCount: cachedLiveMonitor.cacheHitCount,
      lastFetchMs,
    });
  })()
    .catch((error) => {
      console.warn("[live-monitor] falling back to defaults", error);
      return defaultSnapshot();
    })
    .finally(() => {
      pendingLiveMonitor = null;
    });

  return pendingLiveMonitor;
}
