import type {
  DashboardResponse,
  GameActionResponse,
  QuestActionId,
} from "@/game/core/live-types";

async function parseJson<T>(response: Response) {
  return (await response.json().catch(() => null)) as T | null;
}

function extractError(payload: unknown, fallback: string) {
  if (!payload || typeof payload !== "object") {
    return fallback;
  }

  const maybeMessage =
    (payload as { error?: { message?: string }; message?: string }).error?.message ??
    (payload as { message?: string }).message;

  return maybeMessage ?? fallback;
}

export async function fetchDashboardStatus() {
  const response = await fetch("/api/status", {
    cache: "no-store",
  });
  const payload = await parseJson<DashboardResponse>(response);

  if (!response.ok || !payload) {
    throw new Error(extractError(payload, "Failed to load Bazaar X status."));
  }

  return payload.status;
}

export async function executeQuestAction(actionId: QuestActionId) {
  const response = await fetch("/api/game/action", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ actionId }),
  });

  const payload = await parseJson<GameActionResponse>(response);
  if (!response.ok || !payload) {
    throw new Error(extractError(payload, `Failed to execute ${actionId}.`));
  }

  return payload;
}

export async function vote(support: boolean) {
  if (support) {
    return executeQuestAction("vote-rule-change");
  }

  return {
    ok: true as const,
    simulated: true,
    support: false,
  };
}

export async function unlockSkill(skillId: string) {
  const response = await fetch("/api/skills/unlock", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ skillId }),
  });
  const payload = await parseJson<{
    ok: true;
    skillId: string;
    protocol: string;
    amountOkb: string;
    paidAt: string;
    receiptId: string;
  }>(response);

  if (!response.ok || !payload) {
    throw new Error(extractError(payload, `Failed to unlock ${skillId}.`));
  }

  return payload;
}

export async function delegateTradeSkill(skillId: string) {
  const response = await fetch("/api/skills/delegate", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      skillId,
      action: "Trade",
    }),
  });
  const payload = await parseJson<{
    ok: true;
    skillId: string;
    delegatedAction: string;
    agentNpcId: string;
    protocol: string;
    routedAt: string;
  }>(response);

  if (!response.ok || !payload) {
    throw new Error(extractError(payload, `Failed to delegate trade for ${skillId}.`));
  }

  return payload;
}

export const transactionService = {
  executeQuestAction,
  fetchDashboardStatus,
  vote,
  unlockSkill,
  delegateTradeSkill,
};
