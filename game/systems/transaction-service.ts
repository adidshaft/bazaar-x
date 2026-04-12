import type {
  ActionControlMode,
  DashboardResponse,
  GameActionResponse,
  PreparedGameActionResponse,
  ProofArtifact,
  QuestActionId,
} from "@/game/core/live-types";
import { bazaarEventBridge } from "@/game/core/event-bridge";
import { findSkillById } from "@/lib/skills/ai-skills";
import { explorerAddressUrl } from "@/lib/xlayer";

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

type SkillPaymentChallenge = {
  version: string;
  protocol: "okx-x402-payment";
  projectId: string;
  apiKeyId: string;
  chainId: number;
  skillId: string;
  payTo: string;
  amountOkb: string;
  issuedAt: string;
  expiresAt: string;
  nonce: string;
  statement: string;
  signature: string;
};

type SkillUnlockResponse = {
  ok: true;
  skillId: string;
  protocol: string;
  amountOkb: string;
  paidAt: string;
  receiptId: string;
  projectId?: string;
  paymentReceipt?: {
    id: string;
    mode: string;
    challenge?: SkillPaymentChallenge | null;
    settlementHeader?: string;
  };
  manifestJsonLd?: unknown;
  proof?: ProofArtifact;
};

type SkillUnlockErrorResponse = {
  ok: false;
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
  };
  paymentRequired?: {
    protocol?: string;
    header?: string;
    challenge?: SkillPaymentChallenge;
    settlementMode?: string;
  };
};

type SkillDelegationResponse = {
  ok: true;
  skillId: string;
  delegatedAction: string;
  agentNpcId: string;
  protocol: string;
  routedAt: string;
  command?: string;
  normalizedIntent?: string;
  sessionPermission?: {
    projectId: string;
    permissionScope: string[];
    signedAt: string;
    signature: string;
  };
};

type SkillExportResponse = {
  ok: true;
  skillId: string;
  exportId: string;
  exportedAt: string;
  protocol: string;
  projectId: string;
  signedBy: string;
  signature: string;
  manifestJsonLd: unknown;
  proof?: ProofArtifact;
};

function createSkillProof(
  skillId: string,
  kind: ProofArtifact["kind"],
  title: string,
  body: string,
  statement: string,
  label: string,
  createdAt: string,
): ProofArtifact | null {
  const skill = findSkillById(skillId);
  if (!skill) {
    return null;
  }

  const explorerUrl = /^0x[a-fA-F0-9]{40}$/.test(skill.execution.target_contract)
    ? explorerAddressUrl(skill.execution.target_contract)
    : undefined;

  return {
    id: `${kind}:${skillId}:${createdAt}`,
    kind,
    title,
    body,
    statement,
    label,
    districtId: "council-hall",
    actionId: "open-guild",
    createdAt,
    explorerUrl,
  };
}

function resolvePaymentChallenge(response: Response, payload: SkillUnlockErrorResponse | null) {
  const headerChallenge = response.headers.get("x-payment-request");
  if (headerChallenge) {
    return headerChallenge;
  }

  return payload?.paymentRequired?.challenge ? JSON.stringify(payload.paymentRequired.challenge) : null;
}

async function postWithPaymentRetry<TBody extends Record<string, unknown>>(url: string, body: TBody) {
  const firstResponse = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  if (firstResponse.status !== 402) {
    return firstResponse;
  }

  const challengePayload = await parseJson<SkillUnlockErrorResponse>(firstResponse);
  const paymentChallenge = resolvePaymentChallenge(firstResponse, challengePayload);
  if (!paymentChallenge) {
    throw new Error("The skill server requested x402 payment but did not return a challenge.");
  }

  return fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "X-PAYMENT": paymentChallenge,
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
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

export async function executeAgentQuestAction(actionId: QuestActionId) {
  const response = await postWithPaymentRetry("/api/game/action", {
    actionId,
    controlMode: "agent" satisfies ActionControlMode,
  });

  const payload = await parseJson<GameActionResponse>(response);
  if (!response.ok || !payload) {
    throw new Error(extractError(payload, `Failed to execute ${actionId}.`));
  }

  return payload;
}

export async function prepareManualQuestAction(
  actionId: QuestActionId,
  playerAddress: `0x${string}`,
) {
  const response = await fetch("/api/game/action/prepare", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ actionId, playerAddress }),
    cache: "no-store",
  });

  const payload = await parseJson<PreparedGameActionResponse>(response);
  if (!response.ok || !payload) {
    throw new Error(extractError(payload, `Failed to prepare ${actionId}.`));
  }

  return payload;
}

export async function recordManualQuestAction(
  actionId: QuestActionId,
  playerAddress: `0x${string}`,
  records: Array<{ stepKey: string; txHash: `0x${string}` }>,
) {
  const response = await fetch("/api/game/action/record", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ actionId, playerAddress, records }),
    cache: "no-store",
  });

  const payload = await parseJson<GameActionResponse>(response);
  if (!response.ok || !payload) {
    throw new Error(extractError(payload, `Failed to record ${actionId}.`));
  }

  return payload;
}

export async function vote(support: boolean) {
  if (support) {
    return executeAgentQuestAction("vote-rule-change");
  }

  return {
    ok: true as const,
    simulated: true,
    support: false,
  };
}

export async function unlockSkill(skillId: string): Promise<SkillUnlockResponse> {
  const response = await postWithPaymentRetry("/api/skills/unlock", { skillId });
  const payload = await parseJson<SkillUnlockResponse | SkillUnlockErrorResponse>(response);

  if (!response.ok || !payload) {
    throw new Error(extractError(payload, `Failed to unlock ${skillId}.`));
  }

  const successPayload = payload as SkillUnlockResponse;

  if (successPayload.proof) {
    bazaarEventBridge.emit("proof:verified", { proof: successPayload.proof });
    bazaarEventBridge.emit("proof:scroll-picked", { proof: successPayload.proof });
  } else {
    const createdAt = successPayload.paidAt ?? new Date().toISOString();
    const proof = createSkillProof(
      skillId,
      "unlock",
      `${skillId} Unlocked`,
      `${skillId} unlock was confirmed through the x402 challenge flow and is now active in the grimoire.`,
      `${skillId} unlock was confirmed through the x402 challenge flow and activated in the village.`,
      successPayload.amountOkb ? `${successPayload.amountOkb} OKB` : "Confirmed",
      createdAt,
    );

    if (proof) {
      bazaarEventBridge.emit("proof:verified", { proof });
      bazaarEventBridge.emit("proof:scroll-picked", { proof });
    }
  }

  return successPayload;
}

export async function delegateTradeSkill(
  skillId: string,
  command?: string,
): Promise<SkillDelegationResponse> {
  const resolvedCommand = command?.trim() || "Trade";
  const response = await fetch("/api/skills/delegate", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      skillId,
      action: resolvedCommand,
      command: resolvedCommand,
    }),
  });
  const payload = await parseJson<SkillDelegationResponse>(response);

  if (!response.ok || !payload) {
    throw new Error(extractError(payload, `Failed to delegate trade for ${skillId}.`));
  }

  return payload;
}

export async function exportSkillManifest(skillId: string): Promise<SkillExportResponse> {
  const response = await fetch("/api/skills/export", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ skillId }),
    cache: "no-store",
  });
  const payload = await parseJson<SkillExportResponse>(response);

  if (!response.ok || !payload) {
    throw new Error(extractError(payload, `Failed to export ${skillId}.`));
  }

  if (payload.proof) {
    bazaarEventBridge.emit("proof:verified", { proof: payload.proof });
    bazaarEventBridge.emit("proof:scroll-picked", { proof: payload.proof });
  } else {
    const createdAt = payload.exportedAt ?? new Date().toISOString();
    const proof = createSkillProof(
      skillId,
      "decree",
      `${skillId} Exported`,
      `Signed JSON-LD manifest prepared for ${skillId}.`,
      `Skill manifest for ${skillId} was exported as a sovereign JSON-LD blob.`,
      "Manifest Signed",
      createdAt,
    );

    if (proof) {
      bazaarEventBridge.emit("proof:verified", { proof });
      bazaarEventBridge.emit("proof:scroll-picked", { proof });
    }
  }

  return payload;
}

export const transactionService = {
  executeAgentQuestAction,
  prepareManualQuestAction,
  recordManualQuestAction,
  fetchDashboardStatus,
  vote,
  unlockSkill,
  delegateTradeSkill,
  exportSkillManifest,
};
