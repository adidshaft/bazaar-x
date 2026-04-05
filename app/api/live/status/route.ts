import { NextResponse } from "next/server";
import { getLiveDashboardStatus, initializeBazaarLiveState } from "../../../../lib/onchain/flow";
import { errorResponse } from "../../../../lib/server/http";

export const runtime = "nodejs";

export async function GET() {
  try {
    await initializeBazaarLiveState();
    const status = await getLiveDashboardStatus();
    return NextResponse.json({
      ok: true,
      status
    });
  } catch (error) {
    return errorResponse(error);
  }
}
