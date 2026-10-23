import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/password";
import {
  createSessionToken,
  SESSION_COOKIE,
  sessionCookieOptions,
} from "@/lib/auth";
import { routeErrorResponse, zodErrorResponse } from "@/lib/api-utils";

export const dynamic = "force-dynamic";

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("A valid email is required"),
  password: z.string().min(1, "Password is required"),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return zodErrorResponse(parsed.error);
    }

    const { email, password } = parsed.data;

    const user = await db.user.findUnique({
      where: { email },
      select: { id: true, name: true, email: true, role: true, createdAt: true, passwordHash: true },
    });

    if (!user || !verifyPassword(password, user.passwordHash)) {
      return NextResponse.json(
        { error: "Invalid email or password." },
        { status: 401 }
      );
    }

    const cookieStore = await cookies();
    const sessionToken = createSessionToken(user.id);
    cookieStore.set(SESSION_COOKIE, sessionToken, sessionCookieOptions(undefined, req));

    // sessionToken lets the client keep a Bearer fallback in localStorage —
    // required when cookies are blocked (cross-site iframe previews).
    return NextResponse.json({
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
        sessionToken,
      },
    });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
