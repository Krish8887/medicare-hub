import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { routeErrorResponse, zodErrorResponse } from "@/lib/api-utils";

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
  status: z.enum(["Scheduled", "Completed", "Cancelled"]).optional(),
  reason: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: RouteContext) {
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
    return NextResponse.json({ data: appointment });
  } catch (error) {
    return routeErrorResponse(error);
  }
}

export async function PUT(req: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    const body = await req.json();
    const parsed = appointmentUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return zodErrorResponse(parsed.error);
    }

    const { patientId, doctorId } = parsed.data;
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
  try {
    const { id } = await params;
    await db.appointment.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
