/**
 * One-off incremental migration for the live demo DB:
 *  1. Publishes appointment slots for the next 14 days (available doctors only).
 *  2. Converts up to two future "Scheduled" appointments (member-linked first)
 *     into "Pending" so the admin has approval requests to review.
 *  3. Marks slots booked for every active (Pending/Scheduled) appointment.
 *
 * Safe to re-run: uses skipDuplicates / idempotent updateMany.
 * Run with: bun run prisma/migrate-slots.ts
 */
import { PrismaClient } from '@prisma/client'
import { TIME_SLOTS } from '../src/lib/medicare-types'

const db = new PrismaClient()

function isoDate(offsetDays: number) {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return d.toISOString().slice(0, 10)
}

async function main() {
  const doctors = await db.doctor.findMany({ where: { availability: 'Available' } })
  const baseSlots = [
    '09:00 AM - 09:30 AM',
    '10:00 AM - 10:30 AM',
    '11:00 AM - 11:30 AM',
    '02:00 PM - 02:30 PM',
    '03:00 PM - 03:30 PM',
    '04:00 PM - 04:30 PM',
  ]

  console.log('1) Publishing slots for the next 14 days...')
  const today = isoDate(0)
  let created = 0
  for (let day = 0; day < 14; day++) {
    const date = isoDate(day)
    for (const [doctorIdx, doctor] of doctors.entries()) {
      for (const [slotIdx, timeSlot] of baseSlots.entries()) {
        if ((day + doctorIdx + slotIdx) % 4 === 3) continue
        if (timeSlot === '09:00 AM - 09:30 AM' && date === today && doctorIdx % 2 === 0) continue
        try {
          await db.appointmentSlot.create({
            data: {
              doctorId: doctor.id,
              date,
              timeSlot,
              sortKey: (TIME_SLOTS as readonly string[]).indexOf(timeSlot),
            },
          })
          created += 1
        } catch (error) {
          if ((error as { code?: string }).code === 'P2002') continue // already published
          throw error
        }
      }
    }
  }
  console.log(`   slots created: ${created}`)

  console.log('2) Converting up to 2 future Scheduled appointments to Pending...')
  const memberPatient = await db.patient.findUnique({
    where: { email: 'user@medicarehub.com' },
    select: { id: true },
  })
  const futureScheduled = await db.appointment.findMany({
    where: { status: 'Scheduled', date: { gte: today } },
    orderBy: [{ date: 'asc' }],
    select: { id: true, patientId: true },
  })
  const ordered = [
    ...futureScheduled.filter((a) => memberPatient && a.patientId === memberPatient.id),
    ...futureScheduled.filter((a) => !memberPatient || a.patientId !== memberPatient.id),
  ]
  for (const appt of ordered.slice(0, 2)) {
    await db.appointment.update({ where: { id: appt.id }, data: { status: 'Pending' } })
    console.log(`   -> Pending: ${appt.id}`)
  }

  console.log('3) Marking slots booked for active appointments...')
  const active = await db.appointment.findMany({
    where: { status: { in: ['Pending', 'Scheduled'] } },
    select: { doctorId: true, date: true, timeSlot: true },
  })
  for (const appt of active) {
    await db.appointmentSlot.updateMany({
      where: { doctorId: appt.doctorId, date: appt.date, timeSlot: appt.timeSlot, isBooked: false },
      data: { isBooked: true },
    })
  }
  console.log(`   active appointments: ${active.length}`)

  console.log('✅ Incremental migration complete')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
