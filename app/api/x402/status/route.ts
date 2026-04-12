import { NextRequest } from "next/server";
import { getX402Status } from "@/lib/onchain/x402";
import { errorResponse, jsonResponse } from "@/lib/server/http";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get("address");
    if (!address) {
      throw new Error("Missing address.");
    }

    const status = await getX402Status(address as `0x${string}`);
    return jsonResponse({ ok: true, status }, { status: 200 });
  } catch (error) {
    return errorResponse(error);
  }
}
