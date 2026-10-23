import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Return the currently signed-in user, or 401 when there is no session. */
export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized. Please sign in to continue." },
      { status: 401 }
    );
  }
  return NextResponse.json({ data: user });
}
