import { requireUser } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  BadRequestError,
  routeErrorResponse,
  zodErrorResponse,
} from "@/lib/api-utils";
import {
  balanceOf,
  nextInvoiceNumber,
  round2,
  serializeInvoice,
  todayISO,
} from "@/lib/billing";

export const dynamic = "force-dynamic";

const invoiceItemSchema = z.object({
  description: z.string().trim().min(1, "Item description is required").max(200),
  quantity: z.number().int("Quantity must be a whole number").min(1, "Quantity must be at least 1").max(999),
  unitPrice: z.number().min(0, "Unit price cannot be negative").max(1_000_000),
});

const invoiceCreateSchema = z.object({
  patientId: z.string().min(1, "Patient is required"),
  items: z.array(invoiceItemSchema).min(1, "At least one line item is required").max(50),
  taxRate: z.number().min(0, "Tax rate cannot be negative").max(100).default(0),
  discount: z.number().min(0, "Discount cannot be negative").default(0),
  status: z.enum(["Draft", "Pending"]).default("Pending"),
  issueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Issue date must be in YYYY-MM-DD format"),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Due date must be in YYYY-MM-DD format"),
  notes: z.string().trim().max(2000).nullable().optional(),
});

const patientSelect = { id: true, name: true, email: true, phone: true } as const;

/* --------------------------------- list ----------------------------------- */

export async function GET(req: NextRequest) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const sp = req.nextUrl.searchParams;
    const status = sp.get("status") ?? undefined;
    const patientId = sp.get("patientId") ?? undefined;
    const search = sp.get("search") ?? undefined;

    const where: Prisma.InvoiceWhereInput = {};
    if (status === "Overdue") {
      // "Overdue" is derived: still Pending in the DB, but past its due date
      where.status = "Pending";
      where.dueDate = { lt: todayISO() };
    } else if (status === "Pending") {
      where.status = "Pending";
      where.dueDate = { gte: todayISO() };
    } else if (status) {
      where.status = status;
    }
    if (patientId) {
      where.patientId = patientId;
    }
    if (search) {
      where.OR = [
        { invoiceNumber: { contains: search } },
        { patient: { name: { contains: search } } },
      ];
    }

    const invoices = await db.invoice.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { patient: { select: patientSelect } },
    });

    return NextResponse.json({ data: invoices.map(serializeInvoice) });
  } catch (error) {
    return routeErrorResponse(error);
  }
}

/* --------------------------------- create --------------------------------- */

export async function POST(req: NextRequest) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const body = await req.json();
    const parsed = invoiceCreateSchema.safeParse(body);
    if (!parsed.success) {
      return zodErrorResponse(parsed.error);
    }

    const { patientId, items, taxRate, discount, status, issueDate, dueDate, notes } = parsed.data;

    const patient = await db.patient.findUnique({
      where: { id: patientId },
      select: { id: true },
    });
    if (!patient) {
      return NextResponse.json(
        { error: `Patient with id ${patientId} does not exist` },
        { status: 400 }
      );
    }

    // Recompute all money math server-side — never trust client totals.
    const subtotal = round2(items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0));
    const taxAmount = round2((subtotal * taxRate) / 100);
    const total = round2(subtotal + taxAmount - discount);
    if (total < 0) {
      throw new BadRequestError("Discount cannot exceed the invoice subtotal plus tax");
    }

    const invoiceNumber = await nextInvoiceNumber(
      () => db.invoice.count(),
      (candidate) => db.invoice.findUnique({ where: { invoiceNumber: candidate }, select: { id: true } })
    );

    const invoice = await db.invoice.create({
      data: {
        invoiceNumber,
        patientId,
        items: JSON.stringify(items),
        subtotal,
        taxRate,
        taxAmount,
        discount,
        total,
        amountPaid: 0,
        payments: "[]",
        status,
        issueDate,
        dueDate,
        notes: notes ?? null,
      },
      include: { patient: { select: patientSelect } },
    });

    return NextResponse.json(
      { data: serializeInvoice(invoice), balance: balanceOf(invoice.total, invoice.amountPaid) },
      { status: 201 }
    );
  } catch (error) {
    return routeErrorResponse(error, "Invoice number conflict, please retry");
  }
}
