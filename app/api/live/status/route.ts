import { getLiveDashboardStatus, initializeBazaarLiveState } from "../../../../lib/onchain/flow";
import { errorResponse, jsonResponse } from "../../../../lib/server/http";
import { sanitizeManifestPayload } from "../../../../lib/server/public";

export const runtime = "nodejs";

export async function GET() {
  try {
    await initializeBazaarLiveState();
    const status = sanitizeManifestPayload(await getLiveDashboardStatus());
    return jsonResponse({
      ok: true,
      status
    });
  } catch (error) {
    return errorResponse(error);
  }
}
