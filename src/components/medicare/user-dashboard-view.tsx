"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  CalendarCheck,
  CalendarClock,
  CalendarPlus,
  Copy,
  FileHeart,
  HeartPulse,
  Hourglass,
  Phone,
  Receipt,
  ShieldCheck,
  UserRound,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/lib/auth-store";
import { useMedicareStore } from "@/lib/medicare-store";
import { formatDate, formatShortDate, getInitials, getJSON } from "@/lib/medicare-api";
import type {
  Appointment,
  Invoice,
  MedicalRecord,
  Patient,
} from "@/lib/medicare-types";
import { StatusBadge, InvoiceStatusBadge } from "./status-badge";

/**
 * "My Health" — the personal dashboard shown to MEMBER (role "USER") accounts.
 * Members see their own appointments, records and invoices, linked to the
 * patient record that matches their account email.
 */

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  tone: "emerald" | "teal" | "amber" | "rose";
}) {
  const tones = {
    emerald: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
    teal: "bg-teal-500/15 text-teal-700 dark:text-teal-400",
    amber: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
    rose: "bg-rose-500/15 text-rose-700 dark:text-rose-400",
  } as const;
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-1 truncate text-2xl font-bold tracking-tight">{value}</p>
          <p className="mt-1 truncate text-xs text-muted-foreground">{hint}</p>
        </div>
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${tones[tone]}`}
          aria-hidden="true"
        >
          <Icon className="h-5 w-5" />
        </span>
      </div>
    </Card>
  );
}

function NoLinkedProfile() {
  const setActiveView = useMedicareStore((s) => s.setActiveView);
  return (
    <Card className="mx-auto max-w-lg p-8 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <UserRound className="h-7 w-7" aria-hidden="true" />
      </div>
      <h2 className="mt-4 text-lg font-semibold">No patient profile linked yet</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Your account (<span className="font-medium">user@medicarehub.com</span>) isn&apos;t
        matched to a patient record, so there is no personal health data to show.
        Ask the front desk to link your email, or explore wellness guides in the
        meantime.
      </p>
      <Button className="mt-5" onClick={() => setActiveView("articles")}>
        <HeartPulse className="h-4 w-4" aria-hidden="true" />
        Browse Health Tips
      </Button>
    </Card>
  );
}

export default function UserDashboardView() {
  const user = useAuthStore((s) => s.user);
  const setActiveView = useMedicareStore((s) => s.setActiveView);

  const patientsQ = useQuery({
    queryKey: ["patients"],
    queryFn: () => getJSON<{ data: Patient[] }>("/api/patients"),
  });
  const appointmentsQ = useQuery({
    queryKey: ["appointments"],
    queryFn: () => getJSON<{ data: Appointment[] }>("/api/appointments"),
  });
  const recordsQ = useQuery({
    queryKey: ["records"],
    queryFn: () => getJSON<{ data: MedicalRecord[] }>("/api/records"),
  });
  const billingQ = useQuery({
    queryKey: ["billing"],
    queryFn: () => getJSON<{ data: Invoice[] }>("/api/billing"),
  });

  const me = useMemo(() => {
    const email = user?.email.trim().toLowerCase();
    if (!email) return undefined;
    return patientsQ.data?.data.find(
      (p) => p.email.trim().toLowerCase() === email
    );
  }, [patientsQ.data, user?.email]);

  const myAppointments = useMemo(
    () =>
      me && appointmentsQ.data
        ? appointmentsQ.data.data
            .filter((a) => a.patientId === me.id)
            .sort((a, b) => b.date.localeCompare(a.date))
        : [],
    [me, appointmentsQ.data]
  );

  const upcoming = useMemo(
    () =>
      myAppointments
        .filter((a) => a.status === "Pending" || a.status === "Scheduled")
        .sort((a, b) => a.date.localeCompare(b.date)),
    [myAppointments]
  );

  const pendingCount = useMemo(
    () => myAppointments.filter((a) => a.status === "Pending").length,
    [myAppointments]
  );

  const myRecords = useMemo(
    () =>
      me && recordsQ.data
        ? recordsQ.data.data
            .filter((r) => r.patientId === me.id)
            .sort((a, b) => b.recordDate.localeCompare(a.recordDate))
        : [],
    [me, recordsQ.data]
  );

  const myInvoices = useMemo(
    () =>
      me && billingQ.data
        ? billingQ.data.data
            .filter((inv) => inv.patientId === me.id)
            .sort((a, b) => b.issueDate.localeCompare(a.issueDate))
        : [],
    [me, billingQ.data]
  );

  const outstanding = useMemo(
    () =>
      myInvoices
        .filter((inv) => inv.displayStatus !== "Paid" && inv.displayStatus !== "Cancelled" && inv.displayStatus !== "Draft")
        .reduce((sum, inv) => sum + (inv.total - inv.amountPaid), 0),
    [myInvoices]
  );

  const fmtMoney = (n: number) =>
    n.toLocaleString("en-US", { style: "currency", currency: "USD" });

  if (patientsQ.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-36 w-full rounded-xl" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (!me) return <NoLinkedProfile />;

  const nextAppt = upcoming[0];
  const completedVisits = myAppointments.filter((a) => a.status === "Completed").length;
  const age =
    me.dateOfBirth &&
    Math.floor((Date.now() - new Date(me.dateOfBirth).getTime()) / 31557600000);

  return (
    <div className="space-y-6">
      {/* Welcome hero */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="overflow-hidden rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 p-6 text-white shadow-sm md:p-8"
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-medium text-emerald-50">Welcome back,</p>
            <h2 className="mt-1 truncate text-2xl font-bold md:text-3xl">
              {me.name}
            </h2>
            <p className="mt-2 max-w-xl text-sm text-emerald-50/90">
              This is your personal health space — appointments, medical records
              and invoices, all in one place.
            </p>
            <Button
              className="mt-4 bg-white text-emerald-700 shadow-sm hover:bg-emerald-50"
              onClick={() => setActiveView("my-appointments")}
            >
              <CalendarPlus className="h-4 w-4" aria-hidden="true" />
              Book appointment
            </Button>
          </div>
          <div className="flex items-center gap-3 rounded-xl bg-white/10 px-4 py-3 backdrop-blur-sm">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-sm font-bold text-emerald-700">
              {getInitials(me.name)}
            </span>
            <div className="text-sm">
              <p className="font-semibold">{me.bloodGroup ?? "—"}</p>
              <p className="text-emerald-50/80">Blood group</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Next appointment"
          value={nextAppt ? formatShortDate(nextAppt.date) : "None"}
          hint={
            nextAppt
              ? nextAppt.status === "Pending"
                ? `Pending approval · ${nextAppt.timeSlot}`
                : nextAppt.timeSlot
              : "Nothing scheduled"
          }
          icon={CalendarClock}
          tone="emerald"
        />
        <StatCard
          label="Upcoming visits"
          value={String(upcoming.length)}
          hint={
            pendingCount > 0
              ? `${pendingCount} awaiting approval`
              : `${completedVisits} completed so far`
          }
          icon={CalendarCheck}
          tone={pendingCount > 0 ? "amber" : "teal"}
        />
        <StatCard
          label="Health records"
          value={String(myRecords.length)}
          hint="On file with your doctors"
          icon={FileHeart}
          tone="teal"
        />
        <StatCard
          label="Outstanding balance"
          value={fmtMoney(outstanding)}
          hint={
            outstanding > 0
              ? "Across unpaid invoices"
              : "You're all settled up"
          }
          icon={Wallet}
          tone={outstanding > 0 ? "rose" : "emerald"}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* My appointments */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarCheck className="h-4 w-4 text-primary" aria-hidden="true" />
              My appointments
              {pendingCount > 0 && (
                <span className="flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">
                  <Hourglass className="h-3 w-3" aria-hidden="true" />
                  {pendingCount} pending
                </span>
              )}
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              className="h-7 gap-1 text-xs"
              onClick={() => setActiveView("my-appointments")}
            >
              <CalendarPlus className="h-3 w-3" aria-hidden="true" />
              Book / manage
            </Button>
          </CardHeader>
          <CardContent className="max-h-96 space-y-3 overflow-y-auto scrollbar-thin">
            {myAppointments.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-sm text-muted-foreground">No appointments yet.</p>
                <Button className="mt-4" onClick={() => setActiveView("my-appointments")}>
                  <CalendarPlus className="h-4 w-4" aria-hidden="true" />
                  Book an appointment
                </Button>
              </div>
            ) : (
              myAppointments.slice(0, 6).map((appt) => (
                <div
                  key={appt.id}
                  className="flex items-center justify-between gap-3 rounded-lg border p-3"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Activity className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {appt.doctor?.name ?? "Doctor"}
                        <span className="font-normal text-muted-foreground">
                          {" "}
                          · {appt.doctor?.specialty ?? ""}
                        </span>
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {formatDate(appt.date)} · {appt.timeSlot}
                        {appt.reason ? ` · ${appt.reason}` : ""}
                      </p>
                    </div>
                  </div>
                  <StatusBadge status={appt.status} className="shrink-0" />
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Profile snapshot */}
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <UserRound className="h-4 w-4 text-primary" aria-hidden="true" />
              My profile
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => setActiveView("profile")}
            >
              Edit
            </Button>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Full name</p>
              <p className="font-medium">{me.name}</p>
            </div>
            <Separator />
            <div>
              <p className="text-xs text-muted-foreground">Email</p>
              <p className="truncate font-medium">{me.email}</p>
            </div>
            <Separator />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-muted-foreground">Gender</p>
                <p className="font-medium">{me.gender}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Age</p>
                <p className="font-medium">{age ? `${age} yrs` : "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Blood group</p>
                <p className="font-medium">{me.bloodGroup ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Allergies</p>
                <p className="font-medium">{me.allergies ?? "None"}</p>
              </div>
            </div>
            <Separator />
            <div>
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Phone className="h-3 w-3" aria-hidden="true" /> Contact
              </p>
              <p className="font-medium">{me.phone}</p>
            </div>
          </CardContent>
        </Card>

        {/* My invoices */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <Receipt className="h-4 w-4 text-primary" aria-hidden="true" />
              My invoices
            </CardTitle>
          </CardHeader>
          <CardContent className="max-h-96 space-y-3 overflow-y-auto scrollbar-thin">
            {myInvoices.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No invoices on file.
              </p>
            ) : (
              myInvoices.slice(0, 6).map((inv) => (
                <div
                  key={inv.id}
                  className="flex items-center justify-between gap-3 rounded-lg border p-3"
                >
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 truncate text-sm font-medium">
                      <Copy className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden="true" />
                      {inv.invoiceNumber}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      Issued {formatDate(inv.issueDate)} · Due {formatDate(inv.dueDate)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <p className="text-sm font-semibold">{fmtMoney(inv.total)}</p>
                    <InvoiceStatusBadge status={inv.displayStatus} />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* My medical records */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <FileHeart className="h-4 w-4 text-primary" aria-hidden="true" />
              Medical records
            </CardTitle>
          </CardHeader>
          <CardContent className="max-h-96 space-y-3 overflow-y-auto scrollbar-thin">
            {myRecords.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No medical records on file.
              </p>
            ) : (
              myRecords.slice(0, 5).map((rec) => (
                <div key={rec.id} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate text-sm font-medium">{rec.diagnosis}</p>
                    <span className="shrink-0 rounded-md bg-teal-500/15 px-2 py-0.5 text-xs font-medium text-teal-700 dark:text-teal-400">
                      {rec.visitType}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    {rec.doctor?.name ?? "Doctor"} · {formatDate(rec.recordDate)}
                  </p>
                  {rec.prescription && (
                    <p className="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground">
                      <ShieldCheck className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
                      {rec.prescription}
                    </p>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
