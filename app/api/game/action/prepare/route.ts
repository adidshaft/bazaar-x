import { NextRequest } from "next/server";
import type { QuestActionId } from "@/game/core/live-types";
import { prepareManualGameAction } from "@/lib/onchain/manual-actions";
import { errorResponse, jsonResponse, readJsonBody } from "@/lib/server/http";
import { sanitizeManifestPayload } from "@/lib/server/public";
import { getLiveDashboardStatus } from "@/lib/onchain/flow";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = (await readJsonBody(request)) as {
      actionId?: QuestActionId;
      playerAddress?: `0x${string}`;
    };

    if (!body.actionId) {
      throw new Error("Missing actionId.");
    }

    if (!body.playerAddress) {
      throw new Error("Missing playerAddress.");
    }

    const plan = await prepareManualGameAction(body.actionId, body.playerAddress);
    const status = sanitizeManifestPayload(await getLiveDashboardStatus());

    return jsonResponse(
      {
        ...plan,
        status,
      },
      { status: 200 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
