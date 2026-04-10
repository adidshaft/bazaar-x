import type { LiveDashboardStatus, WorldReactionState } from "@/game/core/live-types";

function hasStep(status: LiveDashboardStatus | null, key: string) {
  return Boolean(status?.liveDashboard.runtime?.steps.some((step) => step.key === key && step.status === "success"));
}

export function deriveWorldState(status: LiveDashboardStatus | null): WorldReactionState {
  const treasuryBalanceOkb = Number(status?.liveDashboard.bazaarSnapshot?.treasuryBalanceOkb ?? 0);
  const taxRateBps = Number(
    status?.liveDashboard.bazaarSnapshot?.rules?.[0] ??
      status?.liveDashboard.runtime?.deployment?.initialRules.taxBps ??
      500,
  );

  const shopOpen = hasStep(status, "shop-create");
  const supplierReady = hasStep(status, "supplier-service");
  const workerReady = hasStep(status, "worker-service");
  const governancePassed = hasStep(status, "execute");
  const treasuryUnlocked = hasStep(status, "supplier-hires-worker");
  const councilUnlocked = hasStep(status, "proposal");

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
    treasuryGlow: Math.min(1, 0.22 + treasuryBalanceOkb * 2.2),
    lanternGlow: governancePassed ? 1 : 0.68,
    taxRateBps,
    treasuryBalanceOkb,
    objectiveTargetId,
  };
}

