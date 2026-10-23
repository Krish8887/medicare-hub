import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  // Overwrite with an immediately-expired cookie to sign the user out.
  // Options must match the channel the cookie was set on (https gateway vs
  // local http) so the browser reliably replaces it.
  cookieStore.set(SESSION_COOKIE, "", sessionCookieOptions(0, req));
  return NextResponse.json({ success: true });
}
