import { NextResponse } from "next/server";
import {
  getLiveDashboardStatus,
  initializeBazaarLiveState,
  runBazaarLiveFlow
} from "../../../../lib/onchain/flow";
import { errorResponse } from "../../../../lib/server/http";
import { sanitizeManifestPayload } from "../../../../lib/server/public";

export const runtime = "nodejs";

export async function POST() {
  try {
    await initializeBazaarLiveState();
    const runtimeArtifact = await runBazaarLiveFlow();
    const status = sanitizeManifestPayload(await getLiveDashboardStatus());

    return NextResponse.json(
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
