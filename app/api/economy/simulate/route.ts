import { NextRequest } from "next/server";
import {
  loadLatestAgentsSnapshot,
  persistAgentsSnapshot,
  persistEconomySnapshot,
  initializeAgents,
} from "../../../../lib/server/agents";
import { runEconomySimulation } from "../../../../lib/server/economy";
import { errorResponse, jsonResponse, readJsonBody } from "../../../../lib/server/http";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = await readJsonBody(request);
    const rounds = body.rounds ?? 1;
    const seed = body.seed ?? "bazaar-x";
    const taxBps = body.taxBps ?? 250;

    const snapshot =
      (await loadLatestAgentsSnapshot()) ??
      initializeAgents({ count: body.count ?? 4, seed, initialBudget: body.initialBudget ?? 1000 });

    const result = runEconomySimulation({
      agents: snapshot.agents,
      governance: snapshot.governance,
      economy: snapshot.economy,
      rounds,
      taxBps,
      seed,
    });

    const nextSnapshot = {
      ...snapshot,
      agents: result.agents,
      economy: result.economy,
      governance: result.governance,
    };

    await persistAgentsSnapshot(nextSnapshot);
    await persistEconomySnapshot(result.economy);

    return jsonResponse(
      {
        ok: true,
        result,
      },
      { status: 200 }
    );
  } catch (error) {
    return errorResponse(error);
  }
}
