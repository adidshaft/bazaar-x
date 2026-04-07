import { jsonResponse } from "../../../lib/server/http";

export const runtime = "nodejs";

export function GET() {
  return jsonResponse(
    {
      ok: true,
      service: "bazaar-x-backend",
      status: "healthy",
    },
    { status: 200 },
  );
}
