import type {
  ActionControlMode,
  DashboardResponse,
  GameActionResponse,
  PreparedGameActionResponse,
  ProofArtifact,
  QuestActionId,
  WalletIdentity,
  X402PaymentReceipt,
} from "@/game/core/live-types";
import { bazaarEventBridge } from "@/game/core/event-bridge";
import { findSkillById } from "@/lib/skills/ai-skills";
import { explorerAddressUrl } from "@/lib/xlayer";
import {
  clearPersistedPaymentSessions,
  claimX402StipendRequest,
  fetchX402Status,
  postWithX402Retry,
  type X402ClientPhase,
} from "./x402-client";

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

type SkillUnlockResponse = {
  ok: true;
  skillId: string;
  protocol: string;
  amountOkb: string;
  amountLabel?: string;
  assetSymbol?: string;
  paidAt: string;
  receiptId: string;
  paymentReceipt?: X402PaymentReceipt;
  manifestJsonLd?: unknown;
  proofs?: ProofArtifact[];
  proof?: ProofArtifact;
};

type SkillUnlockErrorResponse = {
  ok: false;
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
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

type X402ClientContext = {
  wallet: WalletIdentity;
  payerAddress: `0x${string}`;
  walletClient: Parameters<typeof postWithX402Retry>[0]["walletClient"];
};

let activeX402ClientContext: X402ClientContext | null = null;

function resolveX402ClientContext(input?: Partial<X402ClientContext>) {
  const wallet = input?.wallet ?? activeX402ClientContext?.wallet;
  const payerAddress = input?.payerAddress ?? activeX402ClientContext?.payerAddress;
  const walletClient = input?.walletClient ?? activeX402ClientContext?.walletClient;

  if (!wallet || !payerAddress || !walletClient) {
    throw new Error("Connect a wallet on X Layer before using paid agent actions.");
  }

  return {
    wallet,
    payerAddress,
    walletClient,
  } satisfies X402ClientContext;
}

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

export async function executeAgentQuestAction(
  actionId: QuestActionId,
  input: {
    wallet?: WalletIdentity;
    payerAddress?: `0x${string}`;
    walletClient?: Parameters<typeof postWithX402Retry>[0]["walletClient"];
    onPhaseChange?: (phase: X402ClientPhase) => void;
  } = {},
) {
  const clientContext = resolveX402ClientContext(input);
  const response = await postWithX402Retry({
    url: "/api/game/action",
    body: {
      actionId,
      controlMode: "agent" satisfies ActionControlMode,
    },
    wallet: clientContext.wallet,
    payerAddress: clientContext.payerAddress,
    walletClient: clientContext.walletClient,
    kind: "agent-action",
    resourceId: actionId,
    onPhaseChange: input.onPhaseChange,
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

export async function unlockSkill(
  skillId: string,
  input: {
    wallet?: WalletIdentity;
    payerAddress?: `0x${string}`;
    walletClient?: Parameters<typeof postWithX402Retry>[0]["walletClient"];
    onPhaseChange?: (phase: X402ClientPhase) => void;
  } = {},
): Promise<SkillUnlockResponse> {
  const clientContext = resolveX402ClientContext(input);
  const response = await postWithX402Retry({
    url: "/api/skills/unlock",
    body: { skillId },
    wallet: clientContext.wallet,
    payerAddress: clientContext.payerAddress,
    walletClient: clientContext.walletClient,
    kind: "skill-unlock",
    resourceId: skillId,
    onPhaseChange: input.onPhaseChange,
  });
  const payload = await parseJson<SkillUnlockResponse | SkillUnlockErrorResponse>(response);

  if (!response.ok || !payload) {
    throw new Error(extractError(payload, `Failed to unlock ${skillId}.`));
  }

  const successPayload = payload as SkillUnlockResponse;

  if (successPayload.proofs?.length) {
    successPayload.proofs.forEach((proof) => {
      bazaarEventBridge.emit("proof:verified", { proof });
    });
    bazaarEventBridge.emit("proof:scroll-picked", {
      proof: successPayload.proofs[successPayload.proofs.length - 1]!,
    });
  } else if (successPayload.proof) {
    bazaarEventBridge.emit("proof:verified", { proof: successPayload.proof });
    bazaarEventBridge.emit("proof:scroll-picked", { proof: successPayload.proof });
  } else {
    const createdAt = successPayload.paidAt ?? new Date().toISOString();
    const proof = createSkillProof(
      skillId,
      "unlock",
      `${skillId} Unlocked`,
      `${skillId} unlock payment settled and the skill is now active in the grimoire.`,
      `${skillId} unlock payment settled through x402 exact EVM on X Layer.`,
      successPayload.amountLabel ?? (successPayload.amountOkb ? `${successPayload.amountOkb} BXC` : "Confirmed"),
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

export function configureX402ClientContext(context: X402ClientContext | null) {
  activeX402ClientContext = context;
}

export { claimX402StipendRequest, fetchX402Status, clearPersistedPaymentSessions };

export const transactionService = {
  configureX402ClientContext,
  executeAgentQuestAction,
  prepareManualQuestAction,
  recordManualQuestAction,
  fetchDashboardStatus,
  vote,
  unlockSkill,
  delegateTradeSkill,
  exportSkillManifest,
  fetchX402Status,
  claimX402StipendRequest,
  clearPersistedPaymentSessions,
};
