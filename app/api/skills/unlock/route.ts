import { createHmac, randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import {
  buildSkillManifestJsonLd,
  findSkillById,
  stableStringify,
} from "@/lib/skills/ai-skills";
import { DEFAULT_CHAIN_ID, EXPLORER_BASE_URL } from "@/lib/server/config";
import { ApiError, errorResponse, jsonResponse, readJsonBody } from "@/lib/server/http";
import { explorerAddressUrl } from "@/lib/xlayer";

export const runtime = "nodejs";

function resolveExplorerUrl(targetContract: string) {
  return /^0x[a-fA-F0-9]{40}$/.test(targetContract)
    ? explorerAddressUrl(targetContract, EXPLORER_BASE_URL)
    : undefined;
}

type PaymentChallenge = {
  version: "2026.1.0";
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

function resolveOkxConfig() {
  const projectId =
    process.env.OKX_PROJECT_ID ??
    process.env.BAZAAR_X_OKX_PROJECT_ID ??
    "bazaar-x-skill-grimoire";
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

function signChallenge(challenge: Omit<PaymentChallenge, "signature">, signingKey: string) {
  return createHmac("sha256", signingKey).update(stableStringify(challenge) ?? "{}").digest("base64url");
}

function buildChallenge(skillId: string, okx: ReturnType<typeof resolveOkxConfig>): PaymentChallenge {
  const skill = findSkillById(skillId);
  if (!skill) {
    throw new ApiError("Unknown skill unlock request.", 404, "SKILL_NOT_FOUND");
  }

  const issuedAt = new Date();
  const expiresAt = new Date(issuedAt.getTime() + 2 * 60 * 1000);
  const challengeBase = {
    version: "2026.1.0" as const,
    protocol: "okx-x402-payment" as const,
    projectId: okx.projectId,
    apiKeyId: okx.apiKey.slice(0, 8) || "anonymous",
    chainId: DEFAULT_CHAIN_ID,
    skillId: skill.skill_id,
    payTo: skill.execution.target_contract,
    amountOkb: skill.execution.unlock_price_okb ?? "0.000",
    issuedAt: issuedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    nonce: randomUUID(),
    statement: `Unlock ${skill.identity.name} using x402 settlement on X Layer.`,
  };

  return {
    ...challengeBase,
    signature: signChallenge(challengeBase, okx.signingKey),
  };
}

function parsePaymentHeader(rawHeader: string | null) {
  if (!rawHeader) {
    return null;
  }

  try {
    return JSON.parse(rawHeader) as Partial<PaymentChallenge>;
  } catch {
    return null;
  }
}

function isChallengeValid(challenge: Partial<PaymentChallenge>, okx: ReturnType<typeof resolveOkxConfig>) {
  if (!challenge || challenge.protocol !== "okx-x402-payment") {
    return false;
  }

  if (challenge.projectId !== okx.projectId || !challenge.signature) {
    return false;
  }

  const expiresAt = challenge.expiresAt ? new Date(challenge.expiresAt) : null;
  if (!expiresAt || Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() < Date.now()) {
    return false;
  }

  const unsigned: Omit<PaymentChallenge, "signature"> = {
    version: challenge.version ?? "2026.1.0",
    protocol: "okx-x402-payment",
    projectId: challenge.projectId,
    apiKeyId: challenge.apiKeyId ?? "anonymous",
    chainId: challenge.chainId ?? DEFAULT_CHAIN_ID,
    skillId: challenge.skillId ?? "",
    payTo: challenge.payTo ?? "",
    amountOkb: challenge.amountOkb ?? "0.000",
    issuedAt: challenge.issuedAt ?? "",
    expiresAt: challenge.expiresAt ?? "",
    nonce: challenge.nonce ?? "",
    statement: challenge.statement ?? "",
  };

  const expected = signChallenge(unsigned, okx.signingKey);
  return expected === challenge.signature;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await readJsonBody(request)) as { skillId?: string };
    const skill = findSkillById(body.skillId ?? "");
    if (!skill) {
      throw new ApiError("Unknown skill unlock request.", 404, "SKILL_NOT_FOUND");
    }

    const okx = resolveOkxConfig();
    const existingChallenge = parsePaymentHeader(request.headers.get("x-payment"));
    const paymentChallenge = buildChallenge(skill.skill_id, okx);

    if (!existingChallenge) {
      const paymentRequest = JSON.stringify(paymentChallenge);
      return jsonResponse(
        {
          ok: false,
          error: {
            code: "PAYMENT_REQUIRED",
            message: "x402 payment required to unlock the skill.",
            details: {
              skillId: skill.skill_id,
              amountOkb: skill.execution.unlock_price_okb ?? "0.000",
            },
          },
          paymentRequired: {
            protocol: paymentChallenge.protocol,
            header: "X-PAYMENT",
            challenge: paymentChallenge,
            settlementMode: okx.hasCredentials ? "okx-x402" : "mock-x402",
          },
        },
        {
          status: 402,
          headers: {
            "X-PAYMENT-REQUEST": paymentRequest,
            "X-OKX-PROJECT-ID": okx.projectId,
          },
        },
      );
    }

    if (!isChallengeValid(existingChallenge, okx)) {
      throw new ApiError("The supplied x402 payment header is invalid or expired.", 403, "INVALID_PAYMENT");
    }

    const manifestJsonLd = buildSkillManifestJsonLd(skill);
    const paidAt = new Date().toISOString();
    const receiptId = `x402_${skill.skill_id}_${Date.now()}`;
    const explorerUrl = resolveExplorerUrl(skill.execution.target_contract);

    return jsonResponse(
      {
        ok: true,
        skillId: skill.skill_id,
        protocol: skill.execution.monetization_protocol ?? "okx-x402-payment",
        amountOkb: skill.execution.unlock_price_okb ?? "0.000",
        paidAt,
        receiptId,
        projectId: okx.projectId,
        paymentReceipt: {
          id: receiptId,
          mode: okx.hasCredentials ? "okx-x402" : "mock-x402",
          challenge: existingChallenge,
          settlementHeader: "X-PAYMENT",
        },
        manifestJsonLd,
        proof: {
          id: receiptId,
          kind: "unlock",
          title: `${skill.identity.name} Unlocked`,
          body: `${skill.identity.name} is now slotted into the grimoire.`,
          statement: `${skill.skill_id} settled through x402 and activated in the village.`,
          label: `${skill.execution.unlock_price_okb ?? "0.000"} OKB`,
          districtId: "council-hall",
          actionId: "open-guild",
          createdAt: paidAt,
          explorerUrl,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
