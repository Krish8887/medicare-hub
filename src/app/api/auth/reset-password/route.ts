import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { routeErrorResponse, zodErrorResponse } from "@/lib/api-utils";

export const dynamic = "force-dynamic";

const resetSchema = z.object({
  email: z.string().trim().toLowerCase().email("A valid email is required"),
  code: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit reset code"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(72),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = resetSchema.safeParse(body);
    if (!parsed.success) {
      return zodErrorResponse(parsed.error);
    }

    const { email, code, password } = parsed.data;

    const user = await db.user.findUnique({
      where: { email },
      select: { id: true, resetToken: true, resetTokenExpiry: true },
    });

    const valid =
      user &&
      user.resetToken &&
      user.resetTokenExpiry &&
      user.resetToken === code &&
      user.resetTokenExpiry.getTime() >= Date.now();

    if (!valid) {
      return NextResponse.json(
        { error: "Invalid or expired reset code. Please request a new one." },
        { status: 400 }
      );
    }

    await db.user.update({
      where: { id: user.id },
      data: {
        passwordHash: hashPassword(password),
        resetToken: null,
        resetTokenExpiry: null,
      },
    });

    return NextResponse.json({
      success: true,
      message:
        "Your password has been updated. You can now sign in with your new password.",
    });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
