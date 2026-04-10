import { createHmac } from "node:crypto";
import { NextRequest } from "next/server";
import { aiSkillCatalog, stableStringify } from "@/lib/skills/ai-skills";
import { ApiError, errorResponse, jsonResponse, readJsonBody } from "@/lib/server/http";

export const runtime = "nodejs";

const delegationMap: Record<string, string> = {
  "bazaar-x-logistics-v1": "supplier",
  "bazaar-x-combat-v1": "worker",
  "bazaar-x-governance-v1": "governor",
};

function resolveOkxConfig() {
  const projectId =
    process.env.OKX_PROJECT_ID ??
    process.env.BAZAAR_X_OKX_PROJECT_ID ??
    "bazaar-x-skill-grimoire";
  const apiKey = process.env.OKX_API_KEY ?? process.env.BAZAAR_X_OKX_API_KEY ?? "";
  const secretKey = process.env.OKX_SECRET_KEY ?? process.env.BAZAAR_X_OKX_SECRET_KEY ?? "";
  const passphrase = process.env.OKX_PASSPHRASE ?? process.env.BAZAAR_X_OKX_PASSPHRASE ?? "";

  return {
    projectId,
    apiKey,
    passphrase,
    signingKey: `${secretKey}:${passphrase}`,
  };
}

function inferIntent(command: string, skillId: string) {
  const normalized = command.trim();
  const lower = normalized.toLowerCase();

  if (lower.includes("inventory") || lower.includes("stock") || lower.includes("supply")) {
    return "inventory-management";
  }

  if (lower.includes("trade") || lower.includes("sell") || lower.includes("buy") || lower.includes("swap")) {
    return "trade-routing";
  }

  if (lower.includes("defend") || lower.includes("escort") || lower.includes("guard") || lower.includes("secure")) {
    return "route-defense";
  }

  if (lower.includes("vote") || lower.includes("proposal") || lower.includes("govern")) {
    return "governance-routing";
  }

  if (skillId === "bazaar-x-governance-v1") {
    return "governance-routing";
  }

  return "general-execution";
}

export async function POST(request: NextRequest) {
  try {
    const body = (await readJsonBody(request)) as {
      skillId?: string;
      action?: string;
      command?: string;
    };
    const skill = aiSkillCatalog.find((entry) => entry.skill_id === body.skillId);
    if (!skill) {
      throw new ApiError("Unknown skill delegation request.", 404, "SKILL_NOT_FOUND");
    }

    const okx = resolveOkxConfig();
    const resolvedCommand = (body.command ?? body.action ?? skill.execution.delegated_action ?? "Trade").trim();
    const normalizedIntent = inferIntent(resolvedCommand, skill.skill_id);
    const routedAt = new Date().toISOString();
    const unsignedPermission = {
      projectId: okx.projectId,
      skillId: skill.skill_id,
      command: resolvedCommand,
      normalizedIntent,
      permissionScope: skill.execution.permission_scope,
      routedAt,
      apiKeyId: okx.apiKey.slice(0, 8) || "anonymous",
    };
    const signature = createHmac("sha256", okx.signingKey)
      .update(stableStringify(unsignedPermission) ?? "{}")
      .digest("base64url");

    return jsonResponse(
      {
        ok: true,
        skillId: skill.skill_id,
        delegatedAction: resolvedCommand,
        agentNpcId: delegationMap[skill.skill_id] ?? "supplier",
        protocol: skill.execution.delegation_protocol ?? "okx-agentic-wallet",
        routedAt,
        command: resolvedCommand,
        normalizedIntent,
        sessionPermission: {
          projectId: okx.projectId,
          permissionScope: skill.execution.permission_scope,
          signedAt: routedAt,
          signature,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
