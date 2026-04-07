import { deployLiveBazaar, getLiveDashboardStatus } from "../../../../lib/onchain/flow";
import { errorResponse, jsonResponse } from "../../../../lib/server/http";
import { sanitizeManifestPayload } from "../../../../lib/server/public";

export const runtime = "nodejs";

export async function POST() {
  try {
    const deployment = await deployLiveBazaar();
    const status = sanitizeManifestPayload(await getLiveDashboardStatus());

    return jsonResponse(
      {
        ok: true,
        deployment,
        status,
      },
      { status: 200 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
