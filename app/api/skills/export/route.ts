import { createHmac } from "node:crypto";
import { NextRequest } from "next/server";
import {
  buildSkillManifestJsonLd,
  findSkillById,
  stableStringify,
} from "@/lib/skills/ai-skills";
import { EXPLORER_BASE_URL } from "@/lib/server/config";
import { ApiError, errorResponse, jsonResponse, readJsonBody } from "@/lib/server/http";
import { explorerAddressUrl } from "@/lib/xlayer";

export const runtime = "nodejs";

function resolveExplorerUrl(targetContract: string) {
  return /^0x[a-fA-F0-9]{40}$/.test(targetContract)
    ? explorerAddressUrl(targetContract, EXPLORER_BASE_URL)
    : undefined;
}

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
    hasCredentials: Boolean(secretKey && apiKey && passphrase),
  };
}

function signExportManifest(input: {
  manifestJsonLd: ReturnType<typeof buildSkillManifestJsonLd>;
  projectId: string;
  signingKey: string;
  skillId: string;
}) {
  const digest = stableStringify(input.manifestJsonLd) ?? "{}";
  return createHmac("sha256", input.signingKey)
    .update(`${input.projectId}:${input.skillId}:${digest}`)
    .digest("base64url");
}

export async function POST(request: NextRequest) {
  try {
    const body = (await readJsonBody(request)) as { skillId?: string };
    const skill = findSkillById(body.skillId ?? "");
    if (!skill) {
      throw new ApiError("Unknown skill export request.", 404, "SKILL_NOT_FOUND");
    }

    const okx = resolveOkxConfig();
    const manifestJsonLd = buildSkillManifestJsonLd(skill);
    const signedAt = new Date().toISOString();
    const signature = signExportManifest({
      manifestJsonLd,
      projectId: okx.projectId,
      signingKey: okx.signingKey,
      skillId: skill.skill_id,
    });
    const proofValue = `okx-${signature}`;
    const exportId = `skill-export-${skill.skill_id}-${Date.now()}`;
    const explorerUrl = resolveExplorerUrl(skill.execution.target_contract);

    return jsonResponse(
      {
        ok: true,
        skillId: skill.skill_id,
        exportedAt: signedAt,
        exportId,
        protocol: skill.execution.protocol,
        projectId: okx.projectId,
        signedBy: okx.hasCredentials ? "okx-api-key" : "mock-signature",
        signature,
        manifestJsonLd: {
          ...manifestJsonLd,
          proof: {
            type: "DataIntegrityProof",
            cryptosuite: "hmac-sha256",
            created: signedAt,
            verificationMethod: `okx://projects/${okx.projectId}`,
            proofPurpose: "assertionMethod",
            proofValue,
          },
        },
        proof: {
          id: exportId,
          kind: "decree",
          title: `${skill.identity.name} Exported`,
          body: `Signed JSON-LD manifest prepared for ${skill.skill_id}.`,
          statement: `Skill manifest for ${skill.skill_id} exported with ${skill.execution.logic_hash}.`,
          label: `${skill.execution.permission_scope.join(", ")}`,
          districtId: "council-hall",
          actionId: "open-guild",
          createdAt: signedAt,
          explorerUrl,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
