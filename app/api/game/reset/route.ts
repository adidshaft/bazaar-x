import { restoreCanonicalRuntime } from "@/lib/onchain/runtime";
import { errorResponse, jsonResponse } from "@/lib/server/http";

export const runtime = "nodejs";

export async function POST() {
  try {
    const restored = await restoreCanonicalRuntime();
    return jsonResponse(
      {
        ok: true,
        restored: Boolean(restored),
        txCount: restored?.txHashes.length ?? 0,
        stepCount: restored?.steps.length ?? 0,
      },
      { status: 200 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
