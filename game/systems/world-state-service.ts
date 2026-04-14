import type {
  BazaarEconomicState,
  LiveDashboardStatus,
  WorldReactionState,
} from "@/game/core/live-types";

function hasStep(status: LiveDashboardStatus | null, key: string) {
  return Boolean(status?.liveDashboard?.runtime?.steps.some((step) => step.key === key && step.status === "success"));
}

function resolveEconomics(status: LiveDashboardStatus | null): BazaarEconomicState {
  return (
    status?.economics ?? {
      tvlOkb: 0,
      dailyVolumeOkb: 0,
      dailyTransactionCount: 0,
      treasuryInflowOkb: 0,
      gdpScore: 0,
      worldTier: 0,
    }
  );
}

export class EconomicMonitor {
  private lastTreasuryTxHash: string | null = null;
  private bootstrapped = false;

  detectTaxCollection(status: LiveDashboardStatus | null) {
    const economics = resolveEconomics(status);
    if (!economics.latestTreasuryTxHash) {
      return null;
    }

    if (!this.bootstrapped) {
      this.bootstrapped = true;
      this.lastTreasuryTxHash = economics.latestTreasuryTxHash;
      return null;
    }

    if (economics.latestTreasuryTxHash === this.lastTreasuryTxHash) {
      return null;
    }

    this.lastTreasuryTxHash = economics.latestTreasuryTxHash;
    return {
      id: economics.latestTreasuryTxHash,
      amountOkb: economics.latestTaxAmountOkb ?? "0.000",
      txHash: economics.latestTreasuryTxHash,
      explorerUrl: economics.latestTreasuryExplorerUrl,
    };
  }
}

export function deriveWorldState(status: LiveDashboardStatus | null): WorldReactionState {
  const economics = resolveEconomics(status);
  const treasuryBalanceOkb = Number(status?.liveDashboard?.bazaarSnapshot?.treasuryBalanceOkb ?? 0);
  const taxRateBps = Number(
    status?.liveDashboard?.bazaarSnapshot?.rules?.[0] ??
      status?.liveDashboard?.runtime?.deployment?.initialRules.taxBps ??
      500,
  );

  const shopOpen = hasStep(status, "shop-create");
  const supplierReady = hasStep(status, "supplier-service");
  const workerReady = hasStep(status, "worker-service");
  const governancePassed = hasStep(status, "execute");
  const treasuryUnlocked = hasStep(status, "supplier-hires-worker");
  const councilUnlocked = hasStep(status, "proposal");
  const governancePassedTier = governancePassed ? 2 : economics.worldTier;

  const objectiveTargetId = !shopOpen
    ? "forge-door"
    : !supplierReady
      ? "depot-door"
      : !workerReady
        ? "guild-yard"
        : !governancePassed
          ? "council-door"
          : !hasStep(status, "post-governance-hire")
            ? "supplier-desk"
            : "treasury-board";

  return {
    shopOpen,
    supplierReady,
    workerReady,
    treasuryUnlocked,
    councilUnlocked,
    governancePassed,
    worldTier: Math.max(governancePassedTier, economics.worldTier) as WorldReactionState["worldTier"],
    tvlOkb: economics.tvlOkb,
    dailyVolumeOkb: economics.dailyVolumeOkb,
    gdpScore: economics.gdpScore,
    activeProposalCount: status?.governance?.activeProposalCount ?? 0,
    blockHeight: status?.gateway?.blockHeight ?? 0,
    latestTxHash: status?.gateway?.latestTxHash,
    treasuryGlow: Math.min(1, 0.22 + treasuryBalanceOkb * 2.2),
    lanternGlow: governancePassed ? 1 : economics.worldTier >= 1 ? 0.84 : 0.68,
    taxRateBps,
    treasuryBalanceOkb,
    objectiveTargetId,
  };
}
