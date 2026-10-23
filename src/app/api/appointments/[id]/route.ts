import { requireUser } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { routeErrorResponse, zodErrorResponse } from "@/lib/api-utils";
import {
  bookSlotFor,
  freeSlotFor,
  hasConflictingAppointment,
  slotHolds,
} from "@/lib/appointment-utils";

export const dynamic = "force-dynamic";

const appointmentUpdateSchema = z.object({
  patientId: z.string().min(1, "Patient cannot be empty").optional(),
  doctorId: z.string().min(1, "Doctor cannot be empty").optional(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format")
    .refine((v) => !Number.isNaN(new Date(`${v}T00:00:00`).getTime()), {
      message: "Date must be a valid calendar date",
    })
    .optional(),
  timeSlot: z.string().min(1, "Time slot cannot be empty").optional(),
  status: z.enum(["Pending", "Scheduled", "Completed", "Cancelled"]).optional(),
  reason: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

/** The only change a member may make to their own appointment. */
const memberCancelSchema = z.object({ status: z.literal("Cancelled") });

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const { id } = await params;
    const appointment = await db.appointment.findUnique({
      where: { id },
      include: {
        patient: { select: { id: true, name: true, email: true, phone: true } },
        doctor: {
          select: { id: true, name: true, specialty: true, department: true },
        },
      },
    });
    if (!appointment) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (user.role !== "ADMIN" && appointment.patient?.email !== user.email) {
      return NextResponse.json(
        { error: "You can only view your own appointments." },
        { status: 403 }
      );
    }
    return NextResponse.json({ data: appointment });
  } catch (error) {
    return routeErrorResponse(error);
  }
}

export async function PUT(req: NextRequest, { params }: RouteContext) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const { id } = await params;
    const existing = await db.appointment.findUnique({
      where: { id },
      include: {
        patient: { select: { id: true, email: true } },
      },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const isAdmin = user.role === "ADMIN";

    /* ---------------------------- member cancel ---------------------------- */
    if (!isAdmin) {
      if (existing.patient?.email !== user.email) {
        return NextResponse.json(
          { error: "You can only cancel your own appointments." },
          { status: 403 }
        );
      }
      const parsed = memberCancelSchema.safeParse(await req.json());
      if (!parsed.success) {
        return NextResponse.json(
          {
            error:
              "Members can only cancel appointments. Contact the front desk to change other details.",
          },
          { status: 403 }
        );
      }
      if (!slotHolds(existing.status)) {
        return NextResponse.json(
          {
            error: `This appointment is already ${existing.status.toLowerCase()} and can no longer be cancelled.`,
          },
          { status: 400 }
        );
      }
      await freeSlotFor(existing.doctorId, existing.date, existing.timeSlot);
      const cancelled = await db.appointment.update({
        where: { id },
        data: { status: "Cancelled" },
        include: {
          patient: { select: { id: true, name: true, email: true, phone: true } },
          doctor: {
            select: { id: true, name: true, specialty: true, department: true },
          },
        },
      });
      return NextResponse.json({ data: cancelled });
    }

    /* ----------------------------- admin update ---------------------------- */
    const body = await req.json();
    const parsed = appointmentUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return zodErrorResponse(parsed.error);
    }

    const { patientId, doctorId, date, timeSlot, status } = parsed.data;

    if (patientId) {
      const patient = await db.patient.findUnique({
        where: { id: patientId },
        select: { id: true },
      });
      if (!patient) {
        return NextResponse.json(
          { error: `Patient with id ${patientId} does not exist` },
          { status: 400 }
        );
      }
    }

    const nextDoctorId = doctorId ?? existing.doctorId;
    const nextDate = date ?? existing.date;
    const nextTimeSlot = timeSlot ?? existing.timeSlot;
    const nextStatus = status ?? existing.status;
    const scheduleChanged =
      nextDoctorId !== existing.doctorId ||
      nextDate !== existing.date ||
      nextTimeSlot !== existing.timeSlot;

    if (doctorId) {
      const doctor = await db.doctor.findUnique({
        where: { id: doctorId },
        select: { id: true },
      });
      if (!doctor) {
        return NextResponse.json(
          { error: `Doctor with id ${doctorId} does not exist` },
          { status: 400 }
        );
      }
    }

    // Release the previously held slot when the schedule moves or it is cancelled.
    if ((scheduleChanged || nextStatus === "Cancelled") && slotHolds(existing.status)) {
      await freeSlotFor(existing.doctorId, existing.date, existing.timeSlot);
    }

    if (scheduleChanged && slotHolds(nextStatus)) {
      if (await hasConflictingAppointment(nextDoctorId, nextDate, nextTimeSlot, id)) {
        return NextResponse.json(
          {
            error:
              "That time slot is already taken for this doctor. Please pick a different slot.",
          },
          { status: 409 }
        );
      }
      await bookSlotFor(nextDoctorId, nextDate, nextTimeSlot);
    }

    const appointment = await db.appointment.update({
      where: { id },
      data: parsed.data,
      include: {
        patient: { select: { id: true, name: true, email: true, phone: true } },
        doctor: {
          select: { id: true, name: true, specialty: true, department: true },
        },
      },
    });

    return NextResponse.json({ data: appointment });
  } catch (error) {
    return routeErrorResponse(error);
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const { user, response } = await requireUser();
  if (!user) return response;
  if (user.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Only administrators can delete appointments. Cancel instead." },
      { status: 403 }
    );
  }

  try {
    const { id } = await params;
    const existing = await db.appointment.findUnique({
      where: { id },
      select: { doctorId: true, date: true, timeSlot: true, status: true },
    });
    if (existing && slotHolds(existing.status)) {
      await freeSlotFor(existing.doctorId, existing.date, existing.timeSlot);
    }
    await db.appointment.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
