import { NextRequest } from "next/server";
import { aiSkillCatalog } from "@/lib/skills/ai-skills";
import { ApiError, errorResponse, jsonResponse, readJsonBody } from "@/lib/server/http";

export const runtime = "nodejs";

const delegationMap: Record<string, string> = {
  "bazaar-x-logistics-v1": "supplier",
  "bazaar-x-combat-v1": "worker",
  "bazaar-x-governance-v1": "governor",
};

export async function POST(request: NextRequest) {
  try {
    const body = (await readJsonBody(request)) as {
      skillId?: string;
      action?: string;
    };
    const skill = aiSkillCatalog.find((entry) => entry.skill_id === body.skillId);
    if (!skill) {
      throw new ApiError("Unknown skill delegation request.", 404, "SKILL_NOT_FOUND");
    }

    const delegatedAction = body.action ?? skill.execution.delegated_action ?? "Trade";

    return jsonResponse(
      {
        ok: true,
        skillId: skill.skill_id,
        delegatedAction,
        agentNpcId: delegationMap[skill.skill_id] ?? "supplier",
        protocol: skill.execution.delegation_protocol ?? "okx-agentic-wallet",
        routedAt: new Date().toISOString(),
      },
      { status: 200 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
