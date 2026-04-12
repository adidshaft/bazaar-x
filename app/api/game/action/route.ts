import { NextRequest } from "next/server";
import { createHmac, randomUUID } from "node:crypto";
import { runGameAction } from "../../../../lib/onchain/game-actions";
import { errorResponse, jsonResponse, readJsonBody } from "../../../../lib/server/http";
import { sanitizeManifestPayload } from "../../../../lib/server/public";
import type { QuestActionId } from "@/game/core/live-types";
import { getActionControlPolicy } from "@/lib/game/action-controls";
import { DEFAULT_CHAIN_ID } from "@/lib/server/config";

export const runtime = "nodejs";

type AgentPaymentChallenge = {
  version: "2026.1.0";
  protocol: "okx-x402-payment";
  projectId: string;
  apiKeyId: string;
  chainId: number;
  actionId: QuestActionId;
  amountOkb: string;
  issuedAt: string;
  expiresAt: string;
  nonce: string;
  statement: string;
  signature: string;
};

function resolveOkxConfig() {
  const projectId =
    process.env.OKX_PROJECT_ID ??
    process.env.BAZAAR_X_OKX_PROJECT_ID ??
    "bazaar-x-autonomous-agents";
  const apiKey = process.env.OKX_API_KEY ?? process.env.BAZAAR_X_OKX_API_KEY ?? "";
  const secretKey = process.env.OKX_SECRET_KEY ?? process.env.BAZAAR_X_OKX_SECRET_KEY ?? "";
  const passphrase = process.env.OKX_PASSPHRASE ?? process.env.BAZAAR_X_OKX_PASSPHRASE ?? "";

  return {
    projectId,
    apiKey,
    passphrase,
    signingKey: `${secretKey}:${passphrase}`,
    hasCredentials: Boolean(secretKey && apiKey && passphrase),
  };
}

function stableStringify(value: unknown) {
  return JSON.stringify(value, Object.keys(value as Record<string, unknown>).sort());
}

function signChallenge(
  challenge: Omit<AgentPaymentChallenge, "signature">,
  signingKey: string,
) {
  return createHmac("sha256", signingKey)
    .update(stableStringify(challenge) ?? "{}")
    .digest("base64url");
}

function buildAgentChallenge(
  actionId: QuestActionId,
  amountOkb: string,
  okx: ReturnType<typeof resolveOkxConfig>,
) {
  const issuedAt = new Date();
  const expiresAt = new Date(issuedAt.getTime() + 2 * 60 * 1000);
  const base = {
    version: "2026.1.0" as const,
    protocol: "okx-x402-payment" as const,
    projectId: okx.projectId,
    apiKeyId: okx.apiKey.slice(0, 8) || "anonymous",
    chainId: DEFAULT_CHAIN_ID,
    actionId,
    amountOkb,
    issuedAt: issuedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    nonce: randomUUID(),
    statement: `Authorize autonomous district agents to execute ${actionId} in Bazaar X.`,
  };

  return {
    ...base,
    signature: signChallenge(base, okx.signingKey),
  };
}

function parsePaymentHeader(rawHeader: string | null) {
  if (!rawHeader) {
    return null;
  }

  try {
    return JSON.parse(rawHeader) as Partial<AgentPaymentChallenge>;
  } catch {
    return null;
  }
}

function isChallengeValid(
  challenge: Partial<AgentPaymentChallenge>,
  okx: ReturnType<typeof resolveOkxConfig>,
  actionId: QuestActionId,
  amountOkb: string,
) {
  if (!challenge || challenge.protocol !== "okx-x402-payment") {
    return false;
  }

  if (challenge.projectId !== okx.projectId || challenge.signature == null) {
    return false;
  }

  if (challenge.actionId !== actionId || challenge.amountOkb !== amountOkb) {
    return false;
  }

  const expiresAt = challenge.expiresAt ? new Date(challenge.expiresAt) : null;
  if (!expiresAt || Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() < Date.now()) {
    return false;
  }

  const unsigned = {
    version: challenge.version ?? "2026.1.0",
    protocol: "okx-x402-payment" as const,
    projectId: challenge.projectId,
    apiKeyId: challenge.apiKeyId ?? "anonymous",
    chainId: challenge.chainId ?? DEFAULT_CHAIN_ID,
    actionId,
    amountOkb,
    issuedAt: challenge.issuedAt ?? "",
    expiresAt: challenge.expiresAt ?? "",
    nonce: challenge.nonce ?? "",
    statement: challenge.statement ?? "",
  };

  return signChallenge(unsigned, okx.signingKey) === challenge.signature;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await readJsonBody(request)) as {
      actionId?: QuestActionId;
      controlMode?: "manual" | "agent";
    };
    if (!body.actionId) {
      throw new Error("Missing actionId.");
    }

    const controlMode = body.controlMode ?? "agent";
    if (controlMode === "agent" && body.actionId !== "initialize-town" && body.actionId !== "deploy-bazaar") {
      const okx = resolveOkxConfig();
      const paymentAmount = getActionControlPolicy(body.actionId).agentPaymentOkb ?? "0.000";
      const existingChallenge = parsePaymentHeader(request.headers.get("x-payment"));

      if (!existingChallenge) {
        const challenge = buildAgentChallenge(body.actionId, paymentAmount, okx);
        return jsonResponse(
          {
            ok: false,
            error: {
              code: "PAYMENT_REQUIRED",
              message: "x402 payment required to run autonomous village agents.",
            },
            paymentRequired: {
              protocol: challenge.protocol,
              header: "X-PAYMENT",
              challenge,
              settlementMode: okx.hasCredentials ? "okx-x402" : "mock-x402",
            },
          },
          {
            status: 402,
            headers: {
              "X-PAYMENT-REQUEST": JSON.stringify(challenge),
              "X-OKX-PROJECT-ID": okx.projectId,
            },
          },
        );
      }

      if (!isChallengeValid(existingChallenge, okx, body.actionId, paymentAmount)) {
        throw new Error("The supplied x402 payment header is invalid or expired.");
      }
    }

    const result = await runGameAction(body.actionId);

    return jsonResponse(
      {
        ok: true,
        actionId: result.actionId,
        txState: result.txState,
        controlMode,
        executionKind:
          body.actionId === "initialize-town" || (body.actionId === "deploy-bazaar" && result.recovered)
            ? "system"
            : "x402-agent",
        recovered: result.recovered,
        stepKey: result.stepKey,
        txHash: result.txHash,
        message:
          controlMode === "agent"
            ? "Autonomous district agents executed this village action."
            : "Server-side village action completed.",
        status: sanitizeManifestPayload(result.status),
      },
      { status: 200 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
