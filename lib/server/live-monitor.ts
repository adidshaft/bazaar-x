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

type LiveMonitorSnapshot = {
  economics: BazaarEconomicState;
  governance: BazaarGovernanceState;
  gateway: BazaarGatewayState;
};

type RuntimeStepSample = NonNullable<LiveRuntimeStatus>["steps"][number] & {
  completedAt: string;
};

let cachedLiveMonitor:
  | {
      snapshot: LiveMonitorSnapshot;
      cachedAt: number;
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

function defaultSnapshot(): LiveMonitorSnapshot {
  return {
    economics: defaultEconomics(),
    governance: defaultGovernance(),
    gateway: defaultGateway(),
  };
}

function resolveWorldTier(gdpScore: number) {
  if (gdpScore >= 20) {
    return 2;
  }

  if (gdpScore >= 8) {
    return 1;
  }

  return 0;
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
    return cachedLiveMonitor.snapshot;
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

    const [latestBlockNumber, latestBlock, governance] = await Promise.all([
      client.getBlockNumber(),
      client.getBlock({ blockTag: "latest" }),
      readGovernanceState(deployment, bazaarSnapshot).catch((error) => {
        console.warn("[live-monitor] governance sync failed", error);
        return defaultGovernance();
      }),
    ]);

    const gatewayLatestTxHash = runtime?.txHashes.at(-1);
    const snapshot = {
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
    } satisfies LiveMonitorSnapshot;

    cachedLiveMonitor = {
      snapshot,
      cachedAt: Date.now(),
    };
    return snapshot;
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
