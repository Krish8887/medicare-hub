"use client";

import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  CalendarCheck,
  FileHeart,
  Stethoscope,
  Users,
  type LucideIcon,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "./status-badge";
import { formatDate, formatShortDate, getInitials, getJSON } from "@/lib/medicare-api";
import type { AppointmentStatus, Stats } from "@/lib/medicare-types";
import { cn } from "@/lib/utils";

const TOOLTIP_STYLE = {
  backgroundColor: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: "8px",
  fontSize: "12px",
  color: "var(--popover-foreground)",
} as const;

const STATUS_COLORS: Record<AppointmentStatus, string> = {
  Pending: "var(--chart-3)",
  Scheduled: "var(--chart-1)",
  Completed: "var(--chart-2)",
  Cancelled: "var(--chart-4)",
};

interface StatCardConfig {
  label: string;
  value: number;
  caption: string;
  icon: LucideIcon;
  tint: string;
}

function StatCard({ label, value, caption, icon: Icon, tint }: StatCardConfig) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-1 text-3xl font-bold tracking-tight">{value.toLocaleString()}</p>
          <p className="mt-2 truncate text-xs text-muted-foreground">{caption}</p>
        </div>
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
            tint
          )}
        >
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
      </CardContent>
    </Card>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading dashboard">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[124px] rounded-xl" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-5">
        <Skeleton className="h-[356px] rounded-xl lg:col-span-3" />
        <Skeleton className="h-[356px] rounded-xl lg:col-span-2" />
      </div>
      <div className="grid gap-4 lg:grid-cols-5">
        <Skeleton className="h-[400px] rounded-xl lg:col-span-2" />
        <Skeleton className="h-[400px] rounded-xl lg:col-span-3" />
      </div>
    </div>
  );
}

function DashboardError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Card className="border-destructive/40">
      <CardContent className="flex flex-col items-center gap-4 py-14 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
          <AlertCircle className="h-6 w-6 text-destructive" aria-hidden="true" />
        </div>
        <div>
          <p className="font-medium text-destructive">Failed to load dashboard</p>
          <p className="mt-1 text-sm text-muted-foreground">{message}</p>
        </div>
        <Button onClick={onRetry}>Try again</Button>
      </CardContent>
    </Card>
  );
}

export default function DashboardView() {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["stats"],
    queryFn: () => getJSON<{ data: Stats }>("/api/stats"),
  });

  if (isLoading) return <DashboardSkeleton />;

  if (isError || !data?.data) {
    return (
      <DashboardError
        message={error instanceof Error ? error.message : "Something went wrong."}
        onRetry={() => void refetch()}
      />
    );
  }

  const stats = data.data;
  const { totals, statusBreakdown } = stats;

  const statCards: StatCardConfig[] = [
    {
      label: "Patients",
      value: totals.patients,
      caption: `${totals.records} medical records on file`,
      icon: Users,
      tint: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    },
    {
      label: "Doctors",
      value: totals.doctors,
      caption: `${totals.departments} departments`,
      icon: Stethoscope,
      tint: "bg-teal-500/10 text-teal-600 dark:text-teal-400",
    },
    {
      label: "Today's Appointments",
      value: stats.todayAppointments,
      caption:
        stats.pendingAppointments > 0
          ? `+${stats.upcomingAppointments} upcoming · ${stats.pendingAppointments} pending approval`
          : `+${stats.upcomingAppointments} upcoming`,
      icon: CalendarCheck,
      tint: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    },
    {
      label: "Medical Records",
      value: totals.records,
      caption: `${totals.patients} patients tracked`,
      icon: FileHeart,
      tint: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
    },
  ];

  const weeklyData = stats.weeklyTrend.map((d) => ({
    label: formatShortDate(d.date),
    count: d.count,
  }));

  const statusData: { name: AppointmentStatus; value: number }[] = [
    { name: "Pending", value: statusBreakdown.Pending },
    { name: "Scheduled", value: statusBreakdown.Scheduled },
    { name: "Completed", value: statusBreakdown.Completed },
    { name: "Cancelled", value: statusBreakdown.Cancelled },
  ];
  const totalStatusCount = statusData.reduce((sum, d) => sum + d.value, 0);

  const departmentData = stats.appointmentsByDepartment;
  const maxDeptCount = Math.max(...departmentData.map((d) => d.count), 1);

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <section aria-label="Key statistics" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map((card) => (
          <StatCard key={card.label} {...card} />
        ))}
      </section>

      {/* Charts row */}
      <section aria-label="Charts" className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-base">Weekly Appointments</CardTitle>
            <CardDescription>Appointments scheduled over the last 7 days</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklyData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                    tickMargin={8}
                  />
                  <YAxis
                    allowDecimals={false}
                    tickLine={false}
                    axisLine={false}
                    width={36}
                    tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                  />
                  <Tooltip
                    cursor={{ fill: "var(--muted)", opacity: 0.5 }}
                    contentStyle={TOOLTIP_STYLE}
                    labelStyle={{ color: "var(--muted-foreground)" }}
                    itemStyle={{ color: "var(--foreground)" }}
                  />
                  <Bar
                    dataKey="count"
                    name="Appointments"
                    fill="var(--chart-1)"
                    radius={[6, 6, 0, 0]}
                    maxBarSize={48}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Appointment Status</CardTitle>
            <CardDescription>Distribution across all appointments</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="relative h-[200px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={3}
                    strokeWidth={0}
                  >
                    {statusData.map((entry) => (
                      <Cell key={entry.name} fill={STATUS_COLORS[entry.name]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    itemStyle={{ color: "var(--foreground)" }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <p className="text-2xl font-bold">{totalStatusCount}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
            </div>
            <ul className="mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
              {statusData.map((entry) => (
                <li key={entry.name} className="flex items-center gap-2 text-sm">
                  <span
                    aria-hidden="true"
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: STATUS_COLORS[entry.name] }}
                  />
                  <span className="text-muted-foreground">{entry.name}</span>
                  <span className="font-medium">{entry.value}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </section>

      {/* Bottom row */}
      <section aria-label="Details" className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Appointments by Department</CardTitle>
            <CardDescription>Where patient demand is concentrated</CardDescription>
          </CardHeader>
          <CardContent>
            {departmentData.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No appointment data yet.
              </p>
            ) : (
              <ul className="max-h-80 space-y-4 overflow-y-auto pr-2 scrollbar-thin">
                {departmentData.map((d) => (
                  <li key={d.department} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium">{d.department}</span>
                      <BadgeCount count={d.count} />
                    </div>
                    <Progress
                      value={(d.count / maxDeptCount) * 100}
                      aria-label={`${d.department}: ${d.count} appointments`}
                    />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-base">Recent Appointments</CardTitle>
            <CardDescription>The latest bookings across your hospital</CardDescription>
          </CardHeader>
          <CardContent>
            {stats.recentAppointments.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No appointments yet.
              </p>
            ) : (
              <ul className="max-h-96 divide-y overflow-y-auto pr-2 scrollbar-thin">
                {stats.recentAppointments.map((a) => (
                  <li key={a.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                    <Avatar className="h-9 w-9 border">
                      <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                        {getInitials(a.patient?.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {a.patient?.name ?? "Unknown patient"}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {a.doctor?.name ?? "Unassigned"}
                        {a.doctor?.specialty ? ` · ${a.doctor.specialty}` : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <StatusBadge status={a.status} />
                      <p className="text-xs text-muted-foreground">
                        {formatDate(a.date)} · {a.timeSlot}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function BadgeCount({ count }: { count: number }) {
  return (
    <span className="inline-flex shrink-0 items-center justify-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
      {count}
    </span>
  );
}
