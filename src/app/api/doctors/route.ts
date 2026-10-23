import { requireUser } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { routeErrorResponse, zodErrorResponse } from "@/lib/api-utils";

export const dynamic = "force-dynamic";

const doctorCreateSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("A valid email is required"),
  phone: z.string().min(1, "Phone is required"),
  specialty: z.string().min(1, "Specialty is required"),
  department: z.string().min(1, "Department is required"),
  experience: z.coerce.number().int().positive("Experience must be positive").default(1),
  rating: z.coerce.number().min(0, "Rating must be between 0 and 5").max(5, "Rating must be between 0 and 5").default(4.5),
  consultationFee: z.coerce.number().positive("Consultation fee must be positive").default(100),
  availability: z.enum(["Available", "On Leave", "Off Duty"]).default("Available"),
  image: z.string().nullable().optional(),
});

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

export async function GET(req: NextRequest) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const search = req.nextUrl.searchParams.get("search") ?? undefined;
    const department = req.nextUrl.searchParams.get("department") ?? undefined;

    const where: Prisma.DoctorWhereInput = {};
    if (department) {
      where.department = department;
    }
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { specialty: { contains: search } },
        { department: { contains: search } },
      ];
    }

    const doctors = await db.doctor.findMany({
      where,
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ data: doctors });
  } catch (error) {
    return routeErrorResponse(error);
  }
}

export async function POST(req: NextRequest) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const body = await req.json();
    const parsed = doctorCreateSchema.safeParse(body);
    if (!parsed.success) {
      return zodErrorResponse(parsed.error);
    }

    const doctor = await db.doctor.create({
      data: parsed.data,
    });

    return NextResponse.json({ data: doctor }, { status: 201 });
  } catch (error) {
    return routeErrorResponse(error, "Email already in use");
  }
}
