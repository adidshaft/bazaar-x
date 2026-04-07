import { NextResponse } from "next/server";
import { deployLiveBazaar, getLiveDashboardStatus } from "../../../../lib/onchain/flow";
import { errorResponse } from "../../../../lib/server/http";
import { sanitizeManifestPayload } from "../../../../lib/server/public";

export const runtime = "nodejs";

export async function POST() {
  try {
    const deployment = await deployLiveBazaar();
    const status = sanitizeManifestPayload(await getLiveDashboardStatus());

    return NextResponse.json(
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
