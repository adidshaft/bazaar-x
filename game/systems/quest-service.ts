import { goldenPathQuest } from "@/game/data/quests";
import type {
  LiveDashboardStatus,
  QuestState,
  WalletIdentity,
} from "@/game/core/live-types";

function hasAnyStep(status: LiveDashboardStatus | null, stepKeys: string[] | undefined) {
  if (!stepKeys?.length) {
    return false;
  }

  return Boolean(
    status?.liveDashboard.runtime?.steps.some(
      (step) => step.status === "success" && stepKeys.includes(step.key),
    ),
  );
}

export function deriveQuestRail(status: LiveDashboardStatus | null, wallet: WalletIdentity) {
  return goldenPathQuest.steps.map((step, index) => {
    const complete = hasAnyStep(status, step.confirmationStepKeys);
    const priorComplete =
      index === 0
        ? wallet.connected && wallet.validNetwork
        : hasAnyStep(status, goldenPathQuest.steps[index - 1]?.confirmationStepKeys);

    const state: QuestState = complete
      ? "complete"
      : priorComplete || index === 0
        ? "active"
        : "locked";

    return {
      ...step,
      state,
    };
  });
}

export function getActiveQuestStep(status: LiveDashboardStatus | null, wallet: WalletIdentity) {
  const rail = deriveQuestRail(status, wallet);
  return rail.find((step) => step.state === "active") ?? rail[0];
}

