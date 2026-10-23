import { requireUser } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { routeErrorResponse, toDateStr, zodErrorResponse } from "@/lib/api-utils";
import { TIME_SLOTS } from "@/lib/medicare-types";
import { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

/**
 * Bookable consultation slots published by admins ("provide slot").
 * - GET    — any signed-in user (members need them to book)
 * - POST   — ADMIN only: publish slots for a doctor on a date
 * - DELETE /api/slots/[id] — ADMIN only: remove an unbooked slot
 */

const slotCreateSchema = z.object({
  doctorId: z.string().min(1, "Doctor is required"),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format")
    .refine((v) => !Number.isNaN(new Date(`${v}T00:00:00`).getTime()), {
      message: "Date must be a valid calendar date",
    }),
  timeSlots: z
    .array(z.string().min(1))
    .min(1, "Pick at least one time slot")
    .max(TIME_SLOTS.length, "Too many time slots"),
});

export async function GET(req: NextRequest) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const sp = req.nextUrl.searchParams;
    const doctorId = sp.get("doctorId") ?? undefined;
    const date = sp.get("date") ?? undefined;
    const available = sp.get("available") === "true";
    const fromDate = sp.get("from") ?? undefined;

    const where: Prisma.AppointmentSlotWhereInput = {};
    if (doctorId) where.doctorId = doctorId;
    if (date) where.date = date;
    if (fromDate) where.date = { gte: fromDate };
    if (available) where.isBooked = false;

    const slots = await db.appointmentSlot.findMany({
      where,
      orderBy: [{ date: "asc" }, { sortKey: "asc" }],
      include: {
        doctor: { select: { id: true, name: true, specialty: true, department: true } },
      },
    });

    return NextResponse.json({ data: slots });
  } catch (error) {
    return routeErrorResponse(error);
  }
}

export async function POST(req: NextRequest) {
  const { user, response } = await requireUser();
  if (!user) return response;
  if (user.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Only administrators can publish appointment slots." },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const parsed = slotCreateSchema.safeParse(body);
    if (!parsed.success) {
      return zodErrorResponse(parsed.error);
    }

    const { doctorId, date, timeSlots } = parsed.data;

    const doctor = await db.doctor.findUnique({
      where: { id: doctorId },
      select: { id: true, name: true },
    });
    if (!doctor) {
      return NextResponse.json(
        { error: `Doctor with id ${doctorId} does not exist` },
        { status: 400 }
      );
    }
    if (date < toDateStr(new Date())) {
      return NextResponse.json(
        { error: "Slots must be published for today or a future date." },
        { status: 400 }
      );
    }

    // Deduplicate + validate against the canonical slot list.
    const uniqueSlots = Array.from(new Set(timeSlots));
    const invalid = uniqueSlots.filter(
      (slot) => !(TIME_SLOTS as readonly string[]).includes(slot)
    );
    if (invalid.length > 0) {
      return NextResponse.json(
        { error: `Unknown time slot(s): ${invalid.join(", ")}` },
        { status: 400 }
      );
    }

    let created = 0;
    let skipped = 0;
    for (const timeSlot of uniqueSlots) {
      const sortKey = (TIME_SLOTS as readonly string[]).indexOf(timeSlot);
      try {
        await db.appointmentSlot.create({
          data: { doctorId, date, timeSlot, sortKey },
        });
        created += 1;
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        ) {
          skipped += 1; // slot already published for that doctor/date
          continue;
        }
        throw error;
      }
    }

    return NextResponse.json(
      { data: { created, skipped } },
      { status: created > 0 ? 201 : 200 }
    );
  } catch (error) {
    return routeErrorResponse(error);
  }
}
