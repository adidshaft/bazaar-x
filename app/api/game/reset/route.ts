import { existsSync, unlinkSync } from "node:fs";
import { artifactPath } from "@/lib/server/artifacts";
import { RUNTIME_ARTIFACT_PATH } from "@/lib/server/config";
import { errorResponse, jsonResponse } from "@/lib/server/http";

export const runtime = "nodejs";

export async function POST() {
  try {
    const runtimePath = artifactPath(RUNTIME_ARTIFACT_PATH);
    if (existsSync(runtimePath)) {
      unlinkSync(runtimePath);
    }

    return jsonResponse({ ok: true }, { status: 200 });
  } catch (error) {
    return errorResponse(error);
  }
}
