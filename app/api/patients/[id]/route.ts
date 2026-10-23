import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { routeErrorResponse, zodErrorResponse } from "@/lib/api-utils";

export const dynamic = "force-dynamic";

const patientUpdateSchema = z.object({
  name: z.string().min(1, "Name cannot be empty").optional(),
  email: z.string().email("A valid email is required").optional(),
  phone: z.string().min(1, "Phone cannot be empty").optional(),
  dateOfBirth: z.preprocess(
    (v) => (v === "" ? null : v),
    z.coerce.date().nullable().optional()
  ),
  gender: z.enum(["Male", "Female", "Other"]).optional(),
  bloodGroup: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  allergies: z.string().nullable().optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    const patient = await db.patient.findUnique({
      where: { id },
      include: {
        appointments: {
          orderBy: { date: "desc" },
          include: {
            doctor: { select: { id: true, name: true, specialty: true } },
          },
        },
        records: {
          orderBy: { recordDate: "desc" },
          include: {
            doctor: { select: { id: true, name: true, specialty: true } },
          },
        },
      },
    });
    if (!patient) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ data: patient });
  } catch (error) {
    return routeErrorResponse(error);
  }
}

export async function PUT(req: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    const body = await req.json();
    const parsed = patientUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return zodErrorResponse(parsed.error);
    }

    const patient = await db.patient.update({
      where: { id },
      data: parsed.data,
    });

    return NextResponse.json({ data: patient });
  } catch (error) {
    return routeErrorResponse(error, "Email already in use");
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    // Appointments & medical records cascade-delete with the patient.
    await db.patient.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
