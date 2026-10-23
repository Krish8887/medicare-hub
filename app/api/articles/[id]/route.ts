import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { routeErrorResponse } from "@/lib/api-utils";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    const article = await db.healthArticle.findUnique({ where: { id } });
    if (!article) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ data: article });
  } catch (error) {
    return routeErrorResponse(error);
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    await db.healthArticle.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
