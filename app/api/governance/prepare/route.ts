import { NextRequest } from "next/server";
import { createProposalDraft, initializeAgents, loadLatestAgentsSnapshot } from "../../../../lib/server/agents";
import { errorResponse, jsonResponse, readJsonBody } from "../../../../lib/server/http";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = await readJsonBody(request);
    const snapshot =
      (await loadLatestAgentsSnapshot()) ??
      initializeAgents({ count: body.count ?? 4, seed: body.seed ?? "bazaar-x", initialBudget: 1000 });

    const proposalDraft = createProposalDraft({
      proposerId: body.proposerId ?? snapshot.agents[0]?.id,
      title: body.title ?? "Adjust covenant policy",
      description:
        body.description ?? "Preview a treasury and balance rule update before posting it onchain.",
      policyPatch: body.policyPatch ?? {
        taxBps: body.taxBps ?? snapshot.economy.policy.taxBps,
        minimumBalance: body.minimumBalance ?? snapshot.economy.policy.minimumBalance,
      },
    });

    const votePlan = snapshot.agents.map((agent, index) => ({
      voterId: agent.id,
      role: agent.role,
      support:
        agent.role === "governor" ||
        agent.role === "shop" ||
        (agent.role === "treasury" ? true : index % 2 === 0),
      weight: Math.max(1, Math.floor(agent.budget / 250)),
    }));

    return jsonResponse(
      {
        ok: true,
        proposalDraft,
        votePlan,
        policyPreview: {
          current: snapshot.economy.policy,
          proposed: proposalDraft.policyPatch,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    return errorResponse(error);
  }
}
