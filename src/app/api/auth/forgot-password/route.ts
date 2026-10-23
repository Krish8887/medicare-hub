import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { randomInt } from "crypto";
import { db } from "@/lib/db";
import { routeErrorResponse, zodErrorResponse } from "@/lib/api-utils";

export const dynamic = "force-dynamic";

const forgotSchema = z.object({
  email: z.string().trim().toLowerCase().email("A valid email is required"),
});

const CODE_TTL_MS = 15 * 60 * 1000; // 15 minutes

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = forgotSchema.safeParse(body);
    if (!parsed.success) {
      return zodErrorResponse(parsed.error);
    }

    const genericMessage =
      "If an account exists for this email, a 6-digit reset code has been generated and sent.";

    const user = await db.user.findUnique({
      where: { email: parsed.data.email },
      select: { id: true },
    });

    // Never reveal whether the account exists.
    if (!user) {
      return NextResponse.json({ data: { ok: true, message: genericMessage } });
    }

    const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
    await db.user.update({
      where: { id: user.id },
      data: {
        resetToken: code,
        resetTokenExpiry: new Date(Date.now() + CODE_TTL_MS),
      },
    });

    /**
     * DEMO MODE: this project has no SMTP/email provider configured, so instead
     * of emailing the code we return it in the response and the UI surfaces it.
     * Before production use, replace `demoCode` with a real email delivery
     * service (Resend / SendGrid / SES) and keep the generic message only.
     */
    return NextResponse.json({
      data: { ok: true, message: genericMessage, demoCode: code },
    });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
