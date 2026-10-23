import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { routeErrorResponse, zodErrorResponse } from "@/lib/api-utils";

export const dynamic = "force-dynamic";

const departmentCreateSchema = z.object({
  name: z.string().min(1, "Department name is required"),
  description: z.string().nullable().optional(),
  headDoctor: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
});

export async function GET() {
  try {
    const [departments, doctorCounts] = await Promise.all([
      db.department.findMany({ orderBy: { name: "asc" } }),
      db.doctor.groupBy({ by: ["department"], _count: { _all: true } }),
    ]);

    const countMap = new Map<string, number>(
      doctorCounts.map((g) => [g.department, g._count._all])
    );

    const data = departments.map((dept) => ({
      ...dept,
      doctorCount: countMap.get(dept.name) ?? 0,
    }));

    return NextResponse.json({ data });
  } catch (error) {
    return routeErrorResponse(error, "Department name already exists");
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = departmentCreateSchema.safeParse(body);
    if (!parsed.success) {
      return zodErrorResponse(parsed.error);
    }

    const { description, headDoctor, location, phone, ...rest } = parsed.data;
    const department = await db.department.create({
      data: {
        ...rest,
        description: description ?? null,
        headDoctor: headDoctor ?? null,
        location: location ?? null,
        phone: phone ?? null,
      },
    });

    return NextResponse.json({ data: department }, { status: 201 });
  } catch (error) {
    return routeErrorResponse(error, "Department name already exists");
  }
}
