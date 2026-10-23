import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { routeErrorResponse, toDateStr } from "@/lib/api-utils";

export const dynamic = "force-dynamic";

interface DeptCountRow {
  department: string;
  count: number;
}

export async function GET() {
  try {
    const now = new Date();
    const todayStr = toDateStr(now);

    // Last 7 days (including today), ascending
    const trendDates: string[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      trendDates.push(toDateStr(d));
    }

    const [
      patients,
      doctors,
      appointments,
      records,
      departments,
      articles,
      todayAppointments,
      upcomingAppointments,
      statusGroups,
      trendAppointments,
      deptRows,
      recentAppointments,
    ] = await Promise.all([
      db.patient.count(),
      db.doctor.count(),
      db.appointment.count(),
      db.medicalRecord.count(),
      db.department.count(),
      db.healthArticle.count(),
      db.appointment.count({ where: { date: todayStr } }),
      db.appointment.count({
        where: { date: { gte: todayStr }, status: "Scheduled" },
      }),
      db.appointment.groupBy({ by: ["status"], _count: { _all: true } }),
      db.appointment.findMany({
        where: { date: { in: trendDates } },
        select: { date: true },
      }),
      db.$queryRaw<DeptCountRow[]>`
        SELECT d.department AS department, COUNT(*) AS count
        FROM Appointment a
        INNER JOIN Doctor d ON a.doctorId = d.id
        GROUP BY d.department
        ORDER BY count DESC
      `,
      db.appointment.findMany({
        take: 6,
        orderBy: { createdAt: "desc" },
        include: {
          patient: { select: { id: true, name: true } },
          doctor: { select: { id: true, name: true, specialty: true } },
        },
      }),
    ]);

    const statusBreakdown: Record<string, number> = {
      Scheduled: 0,
      Completed: 0,
      Cancelled: 0,
    };
    for (const group of statusGroups) {
      if (group.status in statusBreakdown) {
        statusBreakdown[group.status] = group._count._all;
      }
    }

    const trendCountMap = new Map<string, number>();
    for (const appt of trendAppointments) {
      trendCountMap.set(appt.date, (trendCountMap.get(appt.date) ?? 0) + 1);
    }
    const weeklyTrend = trendDates.map((date) => ({
      date,
      count: trendCountMap.get(date) ?? 0,
    }));

    return NextResponse.json({
      data: {
        totals: {
          patients,
          doctors,
          appointments,
          records,
          departments,
          articles,
        },
        todayAppointments,
        upcomingAppointments,
        statusBreakdown,
        appointmentsByDepartment: deptRows.map((row) => ({
          department: row.department,
          count: Number(row.count),
        })),
        recentAppointments,
        weeklyTrend,
      },
    });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
