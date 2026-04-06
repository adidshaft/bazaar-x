import { NextResponse } from "next/server";
import { initializeBazaarLiveState } from "../../../../lib/onchain/flow";
import { errorResponse } from "../../../../lib/server/http";

export const runtime = "nodejs";

export async function POST() {
  try {
    const result = await initializeBazaarLiveState();

    return NextResponse.json(
      {
        ok: true,
        manifest: result.manifest,
        funding: result.funding,
        onchainOs: result.onchainOs,
        runtime: result.runtime,
      },
      { status: 200 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
