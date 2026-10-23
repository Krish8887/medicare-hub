import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import {
  createSessionToken,
  SESSION_COOKIE,
  sessionCookieOptions,
} from "@/lib/auth";
import { routeErrorResponse, zodErrorResponse } from "@/lib/api-utils";

export const dynamic = "force-dynamic";

const registerSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(80),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("A valid email is required")
    .max(160),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(72),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      return zodErrorResponse(parsed.error);
    }

    const { name, email, password } = parsed.data;

    const existing = await db.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json(
        {
          error:
            "An account with this email already exists. Try signing in instead.",
        },
        { status: 409 }
      );
    }

    const user = await db.user.create({
      data: { name, email, passwordHash: hashPassword(password), role: "USER" },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    });

    // Give every new member a patient profile linked by email so they land on
    // a working client-side dashboard and can request appointments right away.
    const existingPatient = await db.patient.findUnique({
      where: { email },
      select: { id: true },
    });
    if (!existingPatient) {
      await db.patient.create({
        data: {
          name,
          email,
          phone: "To be updated",
          address: null,
          allergies: null,
        },
      });
    }

    const cookieStore = await cookies();
    const sessionToken = createSessionToken(user.id);
    cookieStore.set(SESSION_COOKIE, sessionToken, sessionCookieOptions(undefined, req));

    // sessionToken lets the client keep a Bearer fallback in localStorage —
    // required when cookies are blocked (cross-site iframe previews).
    return NextResponse.json(
      { data: { ...user, sessionToken } },
      { status: 201 }
    );
  } catch (error) {
    return routeErrorResponse(error, "An account with this email already exists");
  }
}
