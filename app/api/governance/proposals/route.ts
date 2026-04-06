import { NextRequest, NextResponse } from "next/server";
import {
  createProposalDraft,
  persistAgentsSnapshot,
  loadLatestAgentsSnapshot,
  initializeAgents,
} from "../../../../lib/server/agents";
import { errorResponse, readJsonBody } from "../../../../lib/server/http";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = await readJsonBody(request);
    const snapshot =
      (await loadLatestAgentsSnapshot()) ??
      initializeAgents({ count: 4, seed: body.seed ?? "bazaar-x", initialBudget: 1000 });

    const proposal = createProposalDraft({
      proposerId: body.proposerId ?? snapshot.agents[0]?.id,
      title: body.title ?? "Adjust covenant policy",
      description:
        body.description ?? "Tune the treasury tax and minimum balance for the next economy cycle.",
      policyPatch: body.policyPatch ?? {
        taxBps: body.taxBps ?? 250,
        minimumBalance: body.minimumBalance ?? 100,
      },
    });

    snapshot.governance.proposals.push(proposal);
    await persistAgentsSnapshot(snapshot);

    return NextResponse.json(
      {
        ok: true,
        proposal,
      },
      { status: 200 }
    );
  } catch (error) {
    return errorResponse(error);
  }
}
