/**
 * Shared helpers for the appointment booking workflow.
 *
 * Lifecycle:
 *   member books  ->  Pending  ->  admin approves  ->  Scheduled  ->  Completed
 *                            \-> admin declines   ->  Cancelled  <- member cancels
 *
 * "Pending" and "Scheduled" appointments hold their slot; cancelling frees it.
 */
import { db } from "@/lib/db";

export const SLOT_HOLDING_STATUSES = ["Pending", "Scheduled"] as const;

export function slotHolds(status: string): boolean {
  return (SLOT_HOLDING_STATUSES as readonly string[]).includes(status);
}

/** Release any booked slot matching this doctor/date/time (idempotent). */
export async function freeSlotFor(
  doctorId: string,
  date: string,
  timeSlot: string
): Promise<void> {
  await db.appointmentSlot.updateMany({
    where: { doctorId, date, timeSlot, isBooked: true },
    data: { isBooked: false },
  });
}

/**
 * Mark the matching published slot as booked (idempotent).
 * Returns false when no unbooked slot exists for that doctor/date/time.
 */
export async function bookSlotFor(
  doctorId: string,
  date: string,
  timeSlot: string
): Promise<boolean> {
  const result = await db.appointmentSlot.updateMany({
    where: { doctorId, date, timeSlot, isBooked: false },
    data: { isBooked: true },
  });
  return result.count > 0;
}

/** Whether another active appointment already occupies doctor+date+time. */
export async function hasConflictingAppointment(
  doctorId: string,
  date: string,
  timeSlot: string,
  ignoreAppointmentId?: string
): Promise<boolean> {
  const conflict = await db.appointment.findFirst({
    where: {
      doctorId,
      date,
      timeSlot,
      status: { in: [...SLOT_HOLDING_STATUSES] },
      ...(ignoreAppointmentId ? { id: { not: ignoreAppointmentId } } : {}),
    },
    select: { id: true },
  });
  return Boolean(conflict);
}

/**
 * The patient record linked to a member account (matched by email).
 * Returns null when the account has no patient profile.
 */
export async function findLinkedPatient(email: string) {
  return db.patient.findUnique({
    where: { email: email.trim().toLowerCase() },
    select: { id: true, name: true, email: true },
  });
}
