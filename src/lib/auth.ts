/**
 * Session auth for Medicare Hub.
 *
 * - Passwords: scrypt hashes (see ./password.ts)
 * - Sessions: stateless signed cookie "mh_session" = "<userId>.<expiryMs>.<hmac>"
 * - Guard: `requireUser()` used by every protected /api route
 */

import { createHmac, timingSafeEqual } from "crypto";
import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const SESSION_COOKIE = "mh_session";

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

function authSecret(): string {
  return process.env.AUTH_SECRET ?? "medicare-hub-dev-secret-change-me";
}

/* ------------------------------- sessions --------------------------------- */

function sign(payload: string): string {
  return createHmac("sha256", authSecret()).update(payload).digest("hex");
}

export function createSessionToken(userId: string): string {
  const expiresAt = Date.now() + SESSION_TTL_SECONDS * 1000;
  const payload = `${userId}.${expiresAt}`;
  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(
  token: string | undefined | null
): string | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [userId, expiresAt, signature] = parts;
  if (!userId || !expiresAt || !signature) return null;

  const a = Buffer.from(signature);
  const b = Buffer.from(sign(`${userId}.${expiresAt}`));
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  if (!/^\d+$/.test(expiresAt) || Number(expiresAt) < Date.now()) return null;
  return userId;
}

/**
 * Cookie options adapt to the access channel:
 * - HTTPS (the preview gateway forwards x-forwarded-proto: https):
 *     SameSite=None + Secure, so the cookie can also survive cross-site
 *     iframe previews (SameSite=Lax cookies are dropped in that context).
 * - Plain HTTP (e.g. local `npm run dev` on localhost):
 *     SameSite=Lax without Secure ("None" requires Secure and would be
 *     rejected outright over plain HTTP).
 */
export function sessionCookieOptions(
  maxAge: number = SESSION_TTL_SECONDS,
  req?: Request
) {
  const forwardedProto = (req?.headers.get("x-forwarded-proto") ?? "")
    .split(",")[0]
    .trim()
    .toLowerCase();
  const isHttps = forwardedProto === "https";
  return {
    httpOnly: true,
    sameSite: (isHttps ? "none" : "lax") as "none" | "lax",
    secure: isHttps,
    path: "/",
    maxAge,
  } as const;
}

/**
 * Extract the raw session token from the current request.
 * Priority: "Authorization: Bearer <token>" header first (immune to
 * browser third-party-cookie blocking inside iframe previews), then the
 * mh_session cookie.
 */
export async function extractSessionToken(): Promise<string | null> {
  try {
    const headerList = await headers();
    const auth = headerList.get("authorization");
    if (auth && auth.toLowerCase().startsWith("bearer ")) {
      const token = auth.slice(7).trim();
      if (token) return token;
    }
  } catch {
    // headers() unavailable in this context — fall through to the cookie.
  }
  try {
    const cookieStore = await cookies();
    return cookieStore.get(SESSION_COOKIE)?.value ?? null;
  } catch {
    return null;
  }
}

/* --------------------------------- guard ---------------------------------- */

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: Date;
};

/**
 * Read the session token (Bearer header or cookie), verify it, and load the
 * matching user (or null).
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  try {
    const token = await extractSessionToken();
    const userId = verifySessionToken(token);
    if (!userId) return null;
    return await db.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    });
  } catch {
    return null;
  }
}

/**
 * Guard helper for protected API route handlers:
 *
 *   const { user, response } = await requireUser();
 *   if (!user) return response;
 */
export async function requireUser(): Promise<
  { user: SessionUser; response: null } | { user: null; response: NextResponse }
> {
  const user = await getSessionUser();
  if (!user) {
    return {
      user: null,
      response: NextResponse.json(
        { error: "Unauthorized. Please sign in to continue." },
        { status: 401 }
      ),
    };
  }
  return { user, response: null };
}
