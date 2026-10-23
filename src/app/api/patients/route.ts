import { requireUser } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { routeErrorResponse, zodErrorResponse } from "@/lib/api-utils";

export const dynamic = "force-dynamic";

const patientCreateSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("A valid email is required"),
  phone: z.string().min(1, "Phone is required"),
  dateOfBirth: z.preprocess(
    (v) => (v === "" ? null : v),
    z.coerce.date().nullable().optional()
  ),
  gender: z.enum(["Male", "Female", "Other"]).default("Male"),
  bloodGroup: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  allergies: z.string().nullable().optional(),
});

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

export async function GET(req: NextRequest) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const search = req.nextUrl.searchParams.get("search") ?? undefined;

    const where: Prisma.PatientWhereInput = {};
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { email: { contains: search } },
        { phone: { contains: search } },
      ];
    }

    const patients = await db.patient.findMany({
      where,
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ data: patients });
  } catch (error) {
    return routeErrorResponse(error);
  }
}

export async function POST(req: NextRequest) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const body = await req.json();
    const parsed = patientCreateSchema.safeParse(body);
    if (!parsed.success) {
      return zodErrorResponse(parsed.error);
    }

    const { dateOfBirth, ...rest } = parsed.data;
    const patient = await db.patient.create({
      data: { ...rest, dateOfBirth: dateOfBirth ?? null },
    });

    return NextResponse.json({ data: patient }, { status: 201 });
  } catch (error) {
    return routeErrorResponse(error, "Email already in use");
  }
}
