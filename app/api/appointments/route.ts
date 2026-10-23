import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  routeErrorResponse,
  toDateStr,
  zodErrorResponse,
} from "@/lib/api-utils";

export const dynamic = "force-dynamic";

const appointmentCreateSchema = z.object({
  patientId: z.string().min(1, "Patient is required"),
  doctorId: z.string().min(1, "Doctor is required"),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format")
    .refine((v) => !Number.isNaN(new Date(`${v}T00:00:00`).getTime()), {
      message: "Date must be a valid calendar date",
    }),
  timeSlot: z.string().min(1, "Time slot is required"),
  status: z.enum(["Scheduled", "Completed", "Cancelled"]).default("Scheduled"),
  reason: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

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
  status: z.enum(["Scheduled", "Completed", "Cancelled"]).optional(),
  reason: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const status = sp.get("status") ?? undefined;
    const date = sp.get("date") ?? undefined;
    const search = sp.get("search") ?? undefined;
    const upcoming = sp.get("upcoming") === "true";

    const where: Prisma.AppointmentWhereInput = {};
    if (status) {
      where.status = status;
    }
    if (date) {
      where.date = date;
    }
    if (upcoming) {
      where.date = { gte: toDateStr(new Date()) };
      where.status = "Scheduled";
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
      orderBy: [{ date: "asc" }, { timeSlot: "asc" }],
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
  try {
    const body = await req.json();
    const parsed = appointmentCreateSchema.safeParse(body);
    if (!parsed.success) {
      return zodErrorResponse(parsed.error);
    }

    const { patientId, doctorId } = parsed.data;
    const [patient, doctor] = await Promise.all([
      db.patient.findUnique({ where: { id: patientId }, select: { id: true } }),
      db.doctor.findUnique({ where: { id: doctorId }, select: { id: true } }),
    ]);
    if (!patient) {
      return NextResponse.json(
        { error: `Patient with id ${patientId} does not exist` },
        { status: 400 }
      );
    }
    if (!doctor) {
      return NextResponse.json(
        { error: `Doctor with id ${doctorId} does not exist` },
        { status: 400 }
      );
    }

    const appointment = await db.appointment.create({ data: parsed.data });

    return NextResponse.json({ data: appointment }, { status: 201 });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
