import { NextRequest, NextResponse } from "next/server";
import { jsonClone } from "./json";

export class ApiError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(message: string, status = 400, code = "BAD_REQUEST", details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export async function readJsonBody(request: NextRequest) {
  try {
    return await request.json();
  } catch {
    throw new ApiError("Request body must be valid JSON.", 400, "INVALID_JSON");
  }
}

export function jsonResponse(payload: unknown, init?: ResponseInit) {
  return NextResponse.json(jsonClone(payload), init);
}

export function errorResponse(error: unknown) {
  if (error instanceof ApiError) {
    return jsonResponse(
      {
        ok: false,
        error: {
          code: error.code,
          message: error.message,
          details: error.details ?? null,
        },
      },
      { status: error.status }
    );
  }

  const message = error instanceof Error ? error.message : "Unexpected server error.";
  return jsonResponse(
    {
      ok: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message,
      },
    },
    { status: 500 }
  );
}
