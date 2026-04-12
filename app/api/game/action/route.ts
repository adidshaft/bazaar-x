import { NextRequest } from "next/server";
import type { QuestActionId, X402PaymentReceipt } from "@/game/core/live-types";
import { getActionControlPolicy } from "@/lib/game/action-controls";
import { runGameAction } from "../../../../lib/onchain/game-actions";
import {
  buildPaymentRequiredEnvelope,
  getX402Session,
  markX402SessionFulfilled,
  recordAgentPaymentStep,
  settleX402PaymentSession,
} from "../../../../lib/onchain/x402";
import { errorResponse, jsonResponse, readJsonBody } from "../../../../lib/server/http";
import { sanitizeManifestPayload } from "../../../../lib/server/public";

export const runtime = "nodejs";

function readPaymentHeader(request: NextRequest) {
  return request.headers.get("payment-signature") ?? request.headers.get("x-payment");
}

function isBootstrapAction(actionId: QuestActionId) {
  return actionId === "initialize-town" || actionId === "deploy-bazaar";
}

export async function POST(request: NextRequest) {
  try {
    const body = (await readJsonBody(request)) as {
      actionId?: QuestActionId;
      controlMode?: "manual" | "agent";
      paymentSessionId?: string;
    };

    if (!body.actionId) {
      throw new Error("Missing actionId.");
    }

    const controlMode = body.controlMode ?? "agent";
    let paymentReceipt: X402PaymentReceipt | null = null;

    if (controlMode === "agent" && !isBootstrapAction(body.actionId)) {
      const policy = getActionControlPolicy(body.actionId);
      const existingSession = await getX402Session(body.paymentSessionId);
      const matchingSession =
        existingSession?.kind === "agent-action" && existingSession.resourceId === body.actionId
          ? existingSession
          : null;

      if (matchingSession?.fulfilledResponse) {
        const recoveredResponse = {
          ...(matchingSession.fulfilledResponse as Record<string, unknown>),
          recovered: true,
          paymentReceipt: matchingSession.receipt
            ? {
                ...matchingSession.receipt,
                status: "recovered",
                recovered: true,
              }
            : null,
        };
        return jsonResponse(recoveredResponse);
      }

      if (matchingSession?.receipt) {
        paymentReceipt = {
          ...matchingSession.receipt,
          status: "recovered",
          recovered: true,
        };
      } else {
        const paymentHeader = readPaymentHeader(request);
        if (!paymentHeader) {
          const { paymentRequired, paymentRequiredHeader } = await buildPaymentRequiredEnvelope({
            kind: "agent-action",
            resourceId: body.actionId,
            requestUrl: request.nextUrl.href,
            description: `Paid delegation for ${body.actionId} in Bazaar X.`,
            amountDisplay: policy.agentPaymentOkb ?? "0.000",
            existingSessionId: matchingSession?.id,
          });

          return jsonResponse(
            {
              ok: false,
              error: {
                code: "PAYMENT_REQUIRED",
                message: "Paid delegation is required before the village agent can run this step.",
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

        const settled = await settleX402PaymentSession({
          sessionId: body.paymentSessionId ?? "",
          paymentHeader,
        });
        paymentReceipt = settled.receipt;
      }

      if (paymentReceipt) {
        await recordAgentPaymentStep({
          actionId: body.actionId,
          receipt: paymentReceipt,
          payerAddress: paymentReceipt.payer,
        });
      }
    }

    const result = await runGameAction(body.actionId);
    const responsePayload = {
      ok: true as const,
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
          ? paymentReceipt?.recovered
            ? "Paid delegation recovered and the district agent resumed the step."
            : "Paid delegation settled and the district agent executed the step."
          : "Server-side village action completed.",
      paymentReceipt,
      status: sanitizeManifestPayload(result.status),
    };

    if (paymentReceipt?.sessionId) {
      await markX402SessionFulfilled(paymentReceipt.sessionId, responsePayload);
    }

    return jsonResponse(responsePayload, { status: 200 });
  } catch (error) {
    return errorResponse(error);
  }
}
