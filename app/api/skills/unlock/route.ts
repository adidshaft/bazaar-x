import { NextRequest } from "next/server";
import {
  buildSkillManifestJsonLd,
  findSkillById,
} from "@/lib/skills/ai-skills";
import { ApiError, errorResponse, jsonResponse, readJsonBody } from "@/lib/server/http";
import {
  buildPaymentRequiredEnvelope,
  buildSkillPaymentProof,
  getX402Session,
  markX402SessionFulfilled,
  settleX402PaymentSession,
} from "@/lib/onchain/x402";
import { explorerAddressUrl } from "@/lib/xlayer";
import { EXPLORER_BASE_URL } from "@/lib/server/config";

export const runtime = "nodejs";

function resolveExplorerUrl(targetContract: string) {
  return /^0x[a-fA-F0-9]{40}$/.test(targetContract)
    ? explorerAddressUrl(targetContract, EXPLORER_BASE_URL)
    : undefined;
}

function readPaymentHeader(request: NextRequest) {
  return request.headers.get("payment-signature") ?? request.headers.get("x-payment");
}

export async function POST(request: NextRequest) {
  try {
    const body = (await readJsonBody(request)) as {
      skillId?: string;
      paymentSessionId?: string;
    };
    const skill = findSkillById(body.skillId ?? "");
    if (!skill) {
      throw new ApiError("Unknown skill unlock request.", 404, "SKILL_NOT_FOUND");
    }

    const existingSession = await getX402Session(body.paymentSessionId);
    const matchingSession =
      existingSession?.kind === "skill-unlock" && existingSession.resourceId === skill.skill_id
        ? existingSession
        : null;

    if (matchingSession?.fulfilledResponse) {
      const recoveredResponse = {
        ...(matchingSession.fulfilledResponse as Record<string, unknown>),
        recovered: true,
        paymentReceipt: matchingSession.receipt
          ? {
              ...matchingSession.receipt,
              status: "recovered" as const,
              recovered: true,
            }
          : null,
      };
      return jsonResponse(recoveredResponse);
    }

    const paymentHeader = readPaymentHeader(request);
    if (!matchingSession?.receipt && !paymentHeader) {
      const { paymentRequired, paymentRequiredHeader } = await buildPaymentRequiredEnvelope({
        kind: "skill-unlock",
        resourceId: skill.skill_id,
        requestUrl: request.nextUrl.href,
        description: `Unlock ${skill.identity.name} in the Bazaar X grimoire.`,
        amountDisplay: skill.execution.unlock_price_okb ?? "0.000",
        existingSessionId: matchingSession?.id,
      });

      return jsonResponse(
        {
          ok: false,
          error: {
            code: "PAYMENT_REQUIRED",
            message: "x402 payment required to unlock the skill.",
          },
          paymentRequired,
        },
        {
          status: 402,
          headers: {
            "PAYMENT-REQUIRED": paymentRequiredHeader,
            "X-PAYMENT-SESSION-ID": paymentRequired.sessionId,
            "Cache-Control": "no-store",
          },
        },
      );
    }

    const settled = matchingSession?.receipt
      ? {
          receipt: {
            ...matchingSession.receipt,
            status: "recovered" as const,
            recovered: true,
          },
        }
      : await settleX402PaymentSession({
          sessionId: body.paymentSessionId ?? "",
          paymentHeader: paymentHeader ?? "",
        });

    const paymentReceipt = settled.receipt;
    const manifestJsonLd = buildSkillManifestJsonLd(skill);
    const paidAt = paymentReceipt.settledAt;
    const explorerUrl = resolveExplorerUrl(skill.execution.target_contract);
    const paymentProof = buildSkillPaymentProof({
      skillId: skill.skill_id,
      skillName: skill.identity.name,
      receipt: paymentReceipt,
    });
    const unlockProof = {
      id: `${paymentReceipt.id}:unlock`,
      kind: "unlock" as const,
      title: `${skill.identity.name} Unlocked`,
      body: `${skill.identity.name} is now slotted into the grimoire.`,
      statement: `${skill.skill_id} unlock receipt cleared and the skill is now active in the village.`,
      label: paymentReceipt.amountLabel,
      districtId: "council-hall" as const,
      actionId: "open-guild" as const,
      createdAt: paidAt,
      explorerUrl,
    };

    const responsePayload = {
      ok: true as const,
      skillId: skill.skill_id,
      protocol: skill.execution.monetization_protocol ?? "x402-exact-evm",
      amountOkb: skill.execution.unlock_price_okb ?? "0.000",
      amountLabel: paymentReceipt.amountLabel,
      assetSymbol: paymentReceipt.assetSymbol,
      paidAt,
      receiptId: paymentReceipt.id,
      paymentReceipt,
      manifestJsonLd,
      proofs: [paymentProof, unlockProof],
      proof: unlockProof,
    };

    await markX402SessionFulfilled(paymentReceipt.sessionId, responsePayload);

    return jsonResponse(responsePayload, { status: 200 });
  } catch (error) {
    return errorResponse(error);
  }
}
