import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { routeErrorResponse } from "@/lib/api-utils";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    await db.department.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
