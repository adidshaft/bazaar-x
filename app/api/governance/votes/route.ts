import { NextRequest, NextResponse } from "next/server";
import {
  castVote,
  persistAgentsSnapshot,
  loadLatestAgentsSnapshot,
} from "../../../../lib/server/agents";
import { errorResponse, readJsonBody } from "../../../../lib/server/http";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = await readJsonBody(request);
    const snapshot = await loadLatestAgentsSnapshot();

    if (!snapshot) {
      throw new Error("No agent snapshot found. Initialize agents first.");
    }

    const vote = castVote({
      governance: snapshot.governance,
      proposalId: body.proposalId,
      voterId: body.voterId,
      support: body.support ?? true,
      weight: body.weight,
    });

    await persistAgentsSnapshot(snapshot);

    return NextResponse.json(
      {
        ok: true,
        vote,
      },
      { status: 200 }
    );
  } catch (error) {
    return errorResponse(error);
  }
}
