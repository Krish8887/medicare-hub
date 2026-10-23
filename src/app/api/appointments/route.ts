import { requireUser } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  routeErrorResponse,
  toDateStr,
  zodErrorResponse,
} from "@/lib/api-utils";
import {
  bookSlotFor,
  findLinkedPatient,
  freeSlotFor,
  hasConflictingAppointment,
  slotHolds,
} from "@/lib/appointment-utils";

export const dynamic = "force-dynamic";

const appointmentCreateSchema = z.object({
  patientId: z.string().min(1, "Patient is required").optional(),
  doctorId: z.string().min(1, "Doctor is required"),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format")
    .refine((v) => !Number.isNaN(new Date(`${v}T00:00:00`).getTime()), {
      message: "Date must be a valid calendar date",
    }),
  timeSlot: z.string().min(1, "Time slot is required"),
  status: z
    .enum(["Pending", "Scheduled", "Completed", "Cancelled"])
    .default("Scheduled"),
  reason: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export async function GET(req: NextRequest) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const sp = req.nextUrl.searchParams;
    const status = sp.get("status") ?? undefined;
    const date = sp.get("date") ?? undefined;
    const search = sp.get("search") ?? undefined;
    const upcoming = sp.get("upcoming") === "true";
    const mine = sp.get("mine") === "true";

    // Members may only read their own appointments.
    let scopePatientId: string | undefined;
    if (user.role !== "ADMIN") {
      const linked = await findLinkedPatient(user.email);
      if (!linked) return NextResponse.json({ data: [] });
      scopePatientId = linked.id;
    } else if (mine) {
      const linked = await findLinkedPatient(user.email);
      scopePatientId = linked?.id;
    }

    const where: Prisma.AppointmentWhereInput = {};
    if (scopePatientId) where.patientId = scopePatientId;
    if (status) {
      where.status = status;
    }
    if (date) {
      where.date = date;
    }
    if (upcoming) {
      where.date = { gte: toDateStr(new Date()) };
      where.status = { in: ["Pending", "Scheduled"] };
    }
    if (search) {
      where.OR = [
        { patient: { name: { contains: search } } },
        { doctor: { name: { contains: search } } },
        { reason: { contains: search } },
      ];
    }

    const appointments = await db.appointment.findMany({
      where,
      orderBy: [{ date: "desc" }, { timeSlot: "asc" }],
      include: {
        patient: { select: { id: true, name: true, email: true, phone: true } },
        doctor: {
          select: { id: true, name: true, specialty: true, department: true },
        },
      },
    });

    return NextResponse.json({ data: appointments });
  } catch (error) {
    return routeErrorResponse(error);
  }
}

export async function POST(req: NextRequest) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const body = await req.json();
    const parsed = appointmentCreateSchema.safeParse(body);
    if (!parsed.success) {
      return zodErrorResponse(parsed.error);
    }

    const isAdmin = user.role === "ADMIN";
    const { doctorId, date, timeSlot } = parsed.data;

    /* ------------------------- resolve the patient ------------------------- */
    let patientId: string;
    let status: string;

    if (isAdmin) {
      // Front-desk booking: patient must be supplied explicitly.
      if (!parsed.data.patientId) {
        return NextResponse.json(
          { error: "Patient is required" },
          { status: 400 }
        );
      }
      const patient = await db.patient.findUnique({
        where: { id: parsed.data.patientId },
        select: { id: true },
      });
      if (!patient) {
        return NextResponse.json(
          { error: `Patient with id ${parsed.data.patientId} does not exist` },
          { status: 400 }
        );
      }
      patientId = parsed.data.patientId;
      status = parsed.data.status ?? "Scheduled";
    } else {
      // Member self-booking: linked patient only, always starts as Pending.
      const linked = await findLinkedPatient(user.email);
      if (!linked) {
        return NextResponse.json(
          {
            error:
              "No patient profile is linked to your account yet. Please contact the front desk to link your email.",
          },
          { status: 403 }
        );
      }
      patientId = linked.id;
      status = "Pending";
    }

    /* --------------------------- validate doctor --------------------------- */
    const doctor = await db.doctor.findUnique({
      where: { id: doctorId },
      select: { id: true, name: true, availability: true },
    });
    if (!doctor) {
      return NextResponse.json(
        { error: `Doctor with id ${doctorId} does not exist` },
        { status: 400 }
      );
    }

    if (date < toDateStr(new Date())) {
      return NextResponse.json(
        { error: "Appointments cannot be booked in the past." },
        { status: 400 }
      );
    }

    if (!isAdmin && doctor.availability !== "Available") {
      return NextResponse.json(
        {
          error: `${doctor.name} is currently ${doctor.availability.toLowerCase()} and not accepting bookings. Please choose another doctor.`,
        },
        { status: 400 }
      );
    }

    /* ------------------------- conflict / slot rules ------------------------ */
    if (await hasConflictingAppointment(doctorId, date, timeSlot)) {
      return NextResponse.json(
        {
          error:
            "That time slot is already taken for this doctor. Please pick a different slot.",
        },
        { status: 409 }
      );
    }

    if (!isAdmin) {
      // Members must book one of the slots published by the admin.
      const booked = await bookSlotFor(doctorId, date, timeSlot);
      if (!booked) {
        return NextResponse.json(
          {
            error:
              "No open slot matches that date and time. Choose from the available slots.",
          },
          { status: 400 }
        );
      }
    } else if (slotHolds(status)) {
      // Front-desk bookings also hold a matching slot when one exists.
      await bookSlotFor(doctorId, date, timeSlot);
    }

    const appointment = await db.appointment.create({
      data: {
        patientId,
        doctorId,
        date,
        timeSlot,
        status,
        reason: parsed.data.reason ?? null,
        notes: parsed.data.notes ?? null,
      },
      include: {
        patient: { select: { id: true, name: true, email: true, phone: true } },
        doctor: {
          select: { id: true, name: true, specialty: true, department: true },
        },
      },
    });

    return NextResponse.json({ data: appointment }, { status: 201 });
  } catch (error) {
    return routeErrorResponse(error);
  }
}

export async function PUT(req: NextRequest) {
  // Bulk approve/cancel helper for the admin dashboard.
  const { user, response } = await requireUser();
  if (!user) return response;
  if (user.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Only administrators can bulk-update appointments." },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const bulkSchema = z.object({
      ids: z.array(z.string().min(1)).min(1).max(100),
      status: z.enum(["Pending", "Scheduled", "Cancelled"]),
    });
    const parsed = bulkSchema.safeParse(body);
    if (!parsed.success) {
      return zodErrorResponse(parsed.error);
    }

    const { ids, status } = parsed.data;
    const targets = await db.appointment.findMany({
      where: { id: { in: ids } },
      select: { id: true, doctorId: true, date: true, timeSlot: true, status: true },
    });

    for (const appt of targets) {
      if (status === "Cancelled" && slotHolds(appt.status)) {
        await freeSlotFor(appt.doctorId, appt.date, appt.timeSlot);
      }
      if (status === "Scheduled") {
        await bookSlotFor(appt.doctorId, appt.date, appt.timeSlot);
      }
    }

    await db.appointment.updateMany({
      where: { id: { in: targets.map((t) => t.id) } },
      data: { status },
    });

    return NextResponse.json({ data: { updated: targets.length } });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
