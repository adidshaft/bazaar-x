import { NextRequest } from "next/server";
import {
  executeProposal,
  persistAgentsSnapshot,
  loadLatestAgentsSnapshot,
} from "../../../../lib/server/agents";
import { errorResponse, jsonResponse, readJsonBody } from "../../../../lib/server/http";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = await readJsonBody(request);
    const snapshot = await loadLatestAgentsSnapshot();

    if (!snapshot) {
      throw new Error("No agent snapshot found. Initialize agents first.");
    }

    const execution = executeProposal({
      governance: snapshot.governance,
      proposalId: body.proposalId,
    });

    await persistAgentsSnapshot(snapshot);

    return jsonResponse(
      {
        ok: true,
        execution,
      },
      { status: 200 }
    );
  } catch (error) {
    return errorResponse(error);
  }
}
