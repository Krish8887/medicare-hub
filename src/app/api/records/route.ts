import { requireUser } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { routeErrorResponse, zodErrorResponse } from "@/lib/api-utils";

export const dynamic = "force-dynamic";

const recordCreateSchema = z.object({
  patientId: z.string().min(1, "Patient is required"),
  doctorId: z.string().min(1, "Doctor is required"),
  diagnosis: z.string().min(1, "Diagnosis is required"),
  prescription: z.string().nullable().optional(),
  treatment: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  visitType: z
    .enum(["Consultation", "Follow-up", "Emergency", "Surgery"])
    .default("Consultation"),
  recordDate: z.preprocess(
    (v) => (v === "" ? undefined : v),
    z.coerce.date().optional()
  ),
});

export async function GET(req: NextRequest) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const sp = req.nextUrl.searchParams;
    const patientId = sp.get("patientId") ?? undefined;
    const doctorId = sp.get("doctorId") ?? undefined;
    const search = sp.get("search") ?? undefined;

    const where: Prisma.MedicalRecordWhereInput = {};
    if (patientId) {
      where.patientId = patientId;
    }
    if (doctorId) {
      where.doctorId = doctorId;
    }
    if (search) {
      where.diagnosis = { contains: search };
    }

    const records = await db.medicalRecord.findMany({
      where,
      orderBy: { recordDate: "desc" },
      include: {
        patient: { select: { id: true, name: true } },
        doctor: { select: { id: true, name: true, specialty: true } },
      },
    });

    return NextResponse.json({ data: records });
  } catch (error) {
    return routeErrorResponse(error);
  }
}

export async function POST(req: NextRequest) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const body = await req.json();
    const parsed = recordCreateSchema.safeParse(body);
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

    const record = await db.medicalRecord.create({ data: parsed.data });

    return NextResponse.json({ data: record }, { status: 201 });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
