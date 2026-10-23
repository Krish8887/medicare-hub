/**
 * Billing domain helpers shared by /api/billing routes and the seed script.
 *
 * Invoice "items" and "payments" are stored as JSON strings in SQLite
 * (Prisma scalar lists are not supported on SQLite), so every read goes
 * through parseItems/parsePayments and every write through the zod schemas
 * in the route files.
 */

import type { InvoiceDisplayStatus, InvoiceItem, InvoicePayment, InvoiceStatus } from "@/lib/medicare-types";

/** Raw row shape as Prisma returns it (items/payments still JSON strings). */
export interface InvoiceRow {
  id: string;
  invoiceNumber: string;
  patientId: string;
  appointmentId: string | null;
  items: string;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  discount: number;
  total: number;
  amountPaid: number;
  payments: string;
  status: string;
  issueDate: string;
  dueDate: string;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  patient?: { id: string; name: string; email: string; phone: string } | null;
}

/** "YYYY-MM-DD" for today, local time. */
export function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Round to 2 decimals to avoid float drift (e.g. 0.1 + 0.2). */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function parseItems(raw: string): InvoiceItem[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (it): it is InvoiceItem =>
        typeof it === "object" &&
        it !== null &&
        typeof (it as InvoiceItem).description === "string" &&
        typeof (it as InvoiceItem).quantity === "number" &&
        typeof (it as InvoiceItem).unitPrice === "number"
    );
  } catch {
    return [];
  }
}

export function parsePayments(raw: string): InvoicePayment[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (p): p is InvoicePayment =>
        typeof p === "object" &&
        p !== null &&
        typeof (p as InvoicePayment).date === "string" &&
        typeof (p as InvoicePayment).amount === "number" &&
        typeof (p as InvoicePayment).method === "string"
    );
  } catch {
    return [];
  }
}

/**
 * UI status: a Pending invoice past its due date displays as "Overdue".
 * The stored status is never mutated for this — it stays "Pending".
 */
export function deriveDisplayStatus(status: string, dueDate: string): InvoiceDisplayStatus {
  if (status === "Pending" && /^\d{4}-\d{2}-\d{2}$/.test(dueDate) && dueDate < todayISO()) {
    return "Overdue";
  }
  return status as InvoiceDisplayStatus;
}

/** Map a Prisma invoice row (with optional patient include) to the API/JSON shape. */
export function serializeInvoice(row: InvoiceRow) {
  return {
    id: row.id,
    invoiceNumber: row.invoiceNumber,
    patientId: row.patientId,
    appointmentId: row.appointmentId,
    items: parseItems(row.items),
    subtotal: row.subtotal,
    taxRate: row.taxRate,
    taxAmount: row.taxAmount,
    discount: row.discount,
    total: row.total,
    amountPaid: row.amountPaid,
    payments: parsePayments(row.payments),
    status: row.status as InvoiceStatus,
    displayStatus: deriveDisplayStatus(row.status, row.dueDate),
    issueDate: row.issueDate,
    dueDate: row.dueDate,
    notes: row.notes,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    patient: row.patient ?? undefined,
  };
}

/** Unpaid amount (never negative due to float drift). */
export function balanceOf(total: number, amountPaid: number): number {
  return round2(Math.max(total - amountPaid, 0));
}

/**
 * Sequential invoice number, e.g. "INV-2025-0042".
 * Scans forward past any collisions (after deletions) and falls back to a
 * timestamp suffix if the sequence is somehow exhausted.
 */
export async function nextInvoiceNumber(
  countFn: () => Promise<number>,
  findFn: (invoiceNumber: string) => Promise<unknown>
): Promise<string> {
  const year = new Date().getFullYear();
  let seq = (await countFn()) + 1;
  for (let attempt = 0; attempt < 25; attempt++) {
    const candidate = `INV-${year}-${String(seq).padStart(4, "0")}`;
    const exists = await findFn(candidate);
    if (!exists) return candidate;
    seq += 1;
  }
  return `INV-${year}-${String(Date.now()).slice(-6)}`;
}
