import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { routeErrorResponse, zodErrorResponse } from "@/lib/api-utils";

export const dynamic = "force-dynamic";

const articleCreateSchema = z.object({
  title: z.string().min(1, "Title is required"),
  category: z.string().min(1, "Category is required"),
  summary: z.string().min(1, "Summary is required"),
  content: z.string().min(1, "Content is required"),
  author: z.string().min(1, "Author is required"),
  readTime: z.coerce.number().int().positive("Read time must be positive").default(5),
});

export async function GET(req: NextRequest) {
  try {
    const category = req.nextUrl.searchParams.get("category") ?? undefined;

    const where: Prisma.HealthArticleWhereInput = {};
    if (category) {
      where.category = category;
    }

    const articles = await db.healthArticle.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ data: articles });
  } catch (error) {
    return routeErrorResponse(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = articleCreateSchema.safeParse(body);
    if (!parsed.success) {
      return zodErrorResponse(parsed.error);
    }

    const article = await db.healthArticle.create({ data: parsed.data });

    return NextResponse.json({ data: article }, { status: 201 });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
