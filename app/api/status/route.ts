import { NextResponse } from "next/server";
import { getLiveStatus } from "../../../lib/server/status";
import { errorResponse } from "../../../lib/server/http";

export const runtime = "nodejs";

export async function GET() {
  try {
    const status = await getLiveStatus();
    return NextResponse.json(
      {
        ok: true,
        status,
      },
      { status: 200 }
    );
  } catch (error) {
    return errorResponse(error);
  }
}
