import { requireUser } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { routeErrorResponse } from "@/lib/api-utils";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/** ADMIN only — remove a published slot (impossible once it has been booked). */
export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const { user, response } = await requireUser();
  if (!user) return response;
  if (user.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Only administrators can remove appointment slots." },
      { status: 403 }
    );
  }

  try {
    const { id } = await params;
    const slot = await db.appointmentSlot.findUnique({
      where: { id },
      select: { id: true, isBooked: true },
    });
    if (!slot) {
      return NextResponse.json({ error: "Slot not found" }, { status: 404 });
    }
    if (slot.isBooked) {
      return NextResponse.json(
        { error: "This slot is already booked — cancel the linked appointment first." },
        { status: 409 }
      );
    }

    await db.appointmentSlot.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
