import {
  getLiveDashboardStatus,
  initializeBazaarLiveState,
  runBazaarLiveFlow
} from "../../../../lib/onchain/flow";
import { errorResponse, jsonResponse } from "../../../../lib/server/http";
import { sanitizeManifestPayload } from "../../../../lib/server/public";

export const runtime = "nodejs";

export async function POST() {
  try {
    await initializeBazaarLiveState();
    const runtimeArtifact = await runBazaarLiveFlow();
    const status = sanitizeManifestPayload(await getLiveDashboardStatus());

    return jsonResponse(
      {
        ok: true,
        runtime: runtimeArtifact,
        status,
      },
      { status: 200 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
