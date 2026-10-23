import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import type { ZodError } from "zod";

/**
 * Error thrown for client-side bad requests (maps to HTTP 400).
 */
export class BadRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BadRequestError";
  }
}

/**
 * Format a Date as a local "YYYY-MM-DD" string (used for Appointment.date).
 */
export function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Convert a zod validation error into a 400 response.
 */
export function zodErrorResponse(error: ZodError): NextResponse {
  const first = error.issues[0];
  const message = first
    ? `${first.path.length ? `${first.path.join(".")}: ` : ""}${first.message}`
    : "Invalid request body";
  return NextResponse.json(
    { error: message, details: error.issues },
    { status: 400 }
  );
}

/**
 * Convert an unknown thrown error into the proper HTTP error response.
 * - Prisma P2002 (unique constraint) -> 409 with `conflictMessage`
 * - Prisma P2025 (record not found)  -> 404
 * - everything else                  -> 500 "Internal server error"
 */
export function routeErrorResponse(
  error: unknown,
  conflictMessage = "Record already exists"
): NextResponse {
  console.error("API route error:", error);
  if (error instanceof BadRequestError) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      return NextResponse.json({ error: conflictMessage }, { status: 409 });
    }
    if (error.code === "P2025") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
  }
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}

/**
 * Parse a request body as JSON, tolerating empty bodies.
 */
export async function readJson(req: NextRequest): Promise<unknown> {
  try {
    const text = await req.text();
    if (!text) return {};
    return JSON.parse(text);
  } catch {
    throw new Error("Invalid JSON body");
  }
}
