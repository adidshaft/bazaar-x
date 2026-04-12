import { NextRequest } from "next/server";
import { claimX402Stipend } from "@/lib/onchain/x402";
import { errorResponse, jsonResponse, readJsonBody } from "@/lib/server/http";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = (await readJsonBody(request)) as { address?: `0x${string}` };
    if (!body.address) {
      throw new Error("Missing address.");
    }

    const stipend = await claimX402Stipend(body.address);
    return jsonResponse(
      {
        ok: true,
        stipend,
      },
      { status: 200 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
