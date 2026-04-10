import { NextRequest } from "next/server";
import { runGameAction } from "../../../../lib/onchain/game-actions";
import { errorResponse, jsonResponse, readJsonBody } from "../../../../lib/server/http";
import { sanitizeManifestPayload } from "../../../../lib/server/public";
import type { QuestActionId } from "@/game/core/live-types";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = (await readJsonBody(request)) as { actionId?: QuestActionId };
    if (!body.actionId) {
      throw new Error("Missing actionId.");
    }

    const result = await runGameAction(body.actionId);

    return jsonResponse(
      {
        ok: true,
        actionId: result.actionId,
        txState: result.txState,
        recovered: result.recovered,
        stepKey: result.stepKey,
        txHash: result.txHash,
        status: sanitizeManifestPayload(result.status),
      },
      { status: 200 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
