import { NextRequest } from "next/server";
import { aiSkillCatalog } from "@/lib/skills/ai-skills";
import { ApiError, errorResponse, jsonResponse, readJsonBody } from "@/lib/server/http";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = (await readJsonBody(request)) as { skillId?: string };
    const skill = aiSkillCatalog.find((entry) => entry.skill_id === body.skillId);
    if (!skill) {
      throw new ApiError("Unknown skill unlock request.", 404, "SKILL_NOT_FOUND");
    }

    return jsonResponse(
      {
        ok: true,
        skillId: skill.skill_id,
        protocol: skill.execution.monetization_protocol ?? "okx-x402-payment",
        amountOkb: skill.execution.unlock_price_okb ?? "0.000",
        paidAt: new Date().toISOString(),
        receiptId: `x402_${skill.skill_id}_${Date.now()}`,
      },
      { status: 200 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
