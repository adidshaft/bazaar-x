import { NextResponse } from "next/server";
import { initializeBazaarLiveState } from "../../../../lib/onchain/flow";
import { errorResponse } from "../../../../lib/server/http";
import { sanitizeManifestPayload } from "../../../../lib/server/public";

export const runtime = "nodejs";

export async function POST() {
  try {
    const result = await initializeBazaarLiveState();
    const payload = sanitizeManifestPayload(result);

    return NextResponse.json(
      {
        ok: true,
        manifest: payload.manifest,
        funding: payload.funding,
        onchainOs: payload.onchainOs,
        runtime: payload.runtime,
      },
      { status: 200 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
