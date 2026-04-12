import { goldenPathQuest } from "@/game/data/quests";
import type { QuestStepDefinition } from "@/game/data/quests";
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

function isImplicitlyComplete(step: QuestStepDefinition, wallet: WalletIdentity) {
  return step.id === "meet-keeper" && wallet.connected && wallet.validNetwork;
}

export function deriveQuestRail(status: LiveDashboardStatus | null, wallet: WalletIdentity) {
  return goldenPathQuest.steps.reduce<Array<QuestStepDefinition & { state: QuestState }>>((rail, step, index) => {
    const complete = hasAnyStep(status, step.confirmationStepKeys) || isImplicitlyComplete(step, wallet);
    const priorComplete =
      index === 0
        ? wallet.connected && wallet.validNetwork
        : rail[index - 1]?.state === "complete";

    const state: QuestState = complete
      ? "complete"
      : priorComplete || index === 0
        ? "active"
        : "locked";

    rail.push({
      ...step,
      state,
    });

    return rail;
  }, []);
}

export function getActiveQuestStep(status: LiveDashboardStatus | null, wallet: WalletIdentity) {
  const rail = deriveQuestRail(status, wallet);
  return rail.find((step) => step.state === "active") ?? rail[0];
}
