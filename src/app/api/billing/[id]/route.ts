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
  parseItems,
  parsePayments,
  round2,
  serializeInvoice,
} from "@/lib/billing";
import type { InvoicePayment } from "@/lib/medicare-types";

export const dynamic = "force-dynamic";

const invoiceItemSchema = z.object({
  description: z.string().trim().min(1, "Item description is required").max(200),
  quantity: z.number().int("Quantity must be a whole number").min(1, "Quantity must be at least 1").max(999),
  unitPrice: z.number().min(0, "Unit price cannot be negative").max(1_000_000),
});

const invoiceUpdateSchema = z.object({
  patientId: z.string().min(1, "Patient cannot be empty").optional(),
  items: z.array(invoiceItemSchema).min(1, "At least one line item is required").max(50).optional(),
  taxRate: z.number().min(0, "Tax rate cannot be negative").max(100).optional(),
  discount: z.number().min(0, "Discount cannot be negative").optional(),
  status: z.enum(["Draft", "Pending", "Paid", "Cancelled"]).optional(),
  issueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Issue date must be in YYYY-MM-DD format")
    .optional(),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Due date must be in YYYY-MM-DD format")
    .optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  /** Record a payment; appended to the payment history. Independent of the field updates above. */
  payment: z
    .object({
      amount: z.number().positive("Payment amount must be greater than zero"),
      method: z.enum(["Cash", "Card", "Insurance", "Bank Transfer", "Other"]),
      note: z.string().trim().max(500).optional(),
    })
    .optional(),
});

const patientSelect = { id: true, name: true, email: true, phone: true } as const;

type RouteContext = { params: Promise<{ id: string }> };

/* --------------------------------- detail --------------------------------- */

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const { id } = await params;
    const invoice = await db.invoice.findUnique({
      where: { id },
      include: { patient: { select: patientSelect } },
    });
    if (!invoice) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ data: serializeInvoice(invoice) });
  } catch (error) {
    return routeErrorResponse(error);
  }
}

/* ------------------------- update / edit / payment ------------------------- */

export async function PUT(req: NextRequest, { params }: RouteContext) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const { id } = await params;
    const body = await req.json();
    const parsed = invoiceUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return zodErrorResponse(parsed.error);
    }

    const current = await db.invoice.findUnique({ where: { id } });
    if (!current) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const data: Prisma.InvoiceUpdateInput = {};
    let amountPaid = current.amountPaid;
    let payments = parsePayments(current.payments);
    let status = current.status;
    let paymentRecorded: InvoicePayment | null = null;

    /* ---- patient reassignment ---- */
    if (parsed.data.patientId && parsed.data.patientId !== current.patientId) {
      const patient = await db.patient.findUnique({
        where: { id: parsed.data.patientId },
        select: { id: true },
      });
      if (!patient) {
        return NextResponse.json(
          { error: `Patient with id ${parsed.data.patientId} does not exist` },
          { status: 400 }
        );
      }
      data.patient = { connect: { id: parsed.data.patientId } };
    }

    /* ---- record a payment ---- */
    if (parsed.data.payment) {
      if (current.status === "Draft") {
        throw new BadRequestError("Send the invoice (move it to Pending) before recording payments");
      }
      if (current.status === "Cancelled") {
        throw new BadRequestError("Cannot record a payment on a cancelled invoice");
      }
      const balance = balanceOf(current.total, current.amountPaid);
      if (balance <= 0.005) {
        throw new BadRequestError("This invoice is already fully paid");
      }
      const applied = round2(Math.min(parsed.data.payment.amount, balance));
      const newPaid = round2(current.amountPaid + applied);
      paymentRecorded = {
        date: new Date().toISOString(),
        amount: applied,
        method: parsed.data.payment.method,
        note: parsed.data.payment.note || null,
      };
      payments = [...payments, paymentRecorded];
      amountPaid = newPaid;
      data.amountPaid = amountPaid;
      data.payments = JSON.stringify(payments);
      // Full settlement flips the invoice to Paid automatically.
      if (newPaid >= current.total - 0.005) {
        status = "Paid";
      }
    }

    /* ---- editable fields: recompute totals when money inputs change ---- */
    const itemsChanged = parsed.data.items !== undefined;
    const taxChanged = parsed.data.taxRate !== undefined;
    const discountChanged = parsed.data.discount !== undefined;

    if (itemsChanged || taxChanged || discountChanged) {
      const nextItems = itemsChanged ? parsed.data.items! : parseItems(current.items);
      const nextTaxRate = taxChanged ? parsed.data.taxRate! : current.taxRate;
      const nextDiscount = discountChanged ? parsed.data.discount! : current.discount;

      const subtotal = round2(
        nextItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)
      );
      const taxAmount = round2((subtotal * nextTaxRate) / 100);
      const total = round2(subtotal + taxAmount - nextDiscount);
      if (total < 0) {
        throw new BadRequestError("Discount cannot exceed the invoice subtotal plus tax");
      }
      data.subtotal = subtotal;
      data.taxRate = nextTaxRate;
      data.taxAmount = taxAmount;
      data.discount = nextDiscount;
      data.total = total;
      if (itemsChanged) {
        data.items = JSON.stringify(parsed.data.items);
      }
    }

    /* ---- simple field updates ---- */
    if (parsed.data.issueDate) data.issueDate = parsed.data.issueDate;
    if (parsed.data.dueDate) data.dueDate = parsed.data.dueDate;
    if (parsed.data.notes !== undefined) data.notes = parsed.data.notes ?? null;

    /* ---- explicit status change ---- */
    if (parsed.data.status && parsed.data.status !== status) {
      status = parsed.data.status;
      if (status === "Paid") {
        // Marking as paid settles any remaining balance with an auto payment entry.
        const targetTotal = typeof data.total === "number" ? data.total : current.total;
        const remaining = round2(Math.max(targetTotal - amountPaid, 0));
        if (remaining > 0.005) {
          payments = [
            ...payments,
            {
              date: new Date().toISOString(),
              amount: remaining,
              method: "Other",
              note: "Marked as paid (full settlement)",
            },
          ];
          amountPaid = round2(amountPaid + remaining);
          data.amountPaid = amountPaid;
          data.payments = JSON.stringify(payments);
        }
      }
    }
    data.status = status;

    const invoice = await db.invoice.update({
      where: { id },
      data,
      include: { patient: { select: patientSelect } },
    });

    return NextResponse.json({ data: serializeInvoice(invoice), paymentRecorded });
  } catch (error) {
    return routeErrorResponse(error, "Invoice number conflict, please retry");
  }
}

/* --------------------------------- delete --------------------------------- */

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const { id } = await params;
    await db.invoice.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
