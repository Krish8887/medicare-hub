import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { routeErrorResponse, zodErrorResponse } from "@/lib/api-utils";

export const dynamic = "force-dynamic";

const doctorUpdateSchema = z.object({
  name: z.string().min(1, "Name cannot be empty").optional(),
  email: z.string().email("A valid email is required").optional(),
  phone: z.string().min(1, "Phone cannot be empty").optional(),
  specialty: z.string().min(1, "Specialty cannot be empty").optional(),
  department: z.string().min(1, "Department cannot be empty").optional(),
  experience: z.coerce.number().int().positive("Experience must be positive").optional(),
  rating: z.coerce.number().min(0, "Rating must be between 0 and 5").max(5, "Rating must be between 0 and 5").optional(),
  consultationFee: z.coerce.number().positive("Consultation fee must be positive").optional(),
  availability: z.enum(["Available", "On Leave", "Off Duty"]).optional(),
  image: z.string().nullable().optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    const doctor = await db.doctor.findUnique({ where: { id } });
    if (!doctor) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ data: doctor });
  } catch (error) {
    return routeErrorResponse(error);
  }
}

export async function PUT(req: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    const body = await req.json();
    const parsed = doctorUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return zodErrorResponse(parsed.error);
    }

    const doctor = await db.doctor.update({
      where: { id },
      data: parsed.data,
    });

    return NextResponse.json({ data: doctor });
  } catch (error) {
    return routeErrorResponse(error, "Email already in use");
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    const appointmentCount = await db.appointment.count({
      where: { doctorId: id },
    });
    if (appointmentCount > 0) {
      return NextResponse.json(
        { error: "Cannot delete doctor with existing appointments" },
        { status: 409 }
      );
    }
    const recordCount = await db.medicalRecord.count({
      where: { doctorId: id },
    });
    if (recordCount > 0) {
      return NextResponse.json(
        { error: "Cannot delete doctor with existing medical records" },
        { status: 409 }
      );
    }

    await db.doctor.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
