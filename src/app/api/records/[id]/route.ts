import { requireUser } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { routeErrorResponse } from "@/lib/api-utils";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const { id } = await params;
    const record = await db.medicalRecord.findUnique({
      where: { id },
      include: {
        patient: { select: { id: true, name: true } },
        doctor: { select: { id: true, name: true, specialty: true } },
      },
    });
    if (!record) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ data: record });
  } catch (error) {
    return routeErrorResponse(error);
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const { id } = await params;
    await db.medicalRecord.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
