"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { motion } from "framer-motion";
import {
  CalendarClock,
  CalendarPlus,
  CalendarX2,
  Clock,
  Hourglass,
  Info,
  Loader2,
  MessageSquareText,
  Stethoscope,
  type LucideIcon,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuthStore } from "@/lib/auth-store";
import { useMedicareStore } from "@/lib/medicare-store";
import { formatDate, formatShortDate, getInitials, getJSON, sendJSON } from "@/lib/medicare-api";
import type { Appointment, AppointmentSlot, Doctor } from "@/lib/medicare-types";
import { cn } from "@/lib/utils";
import { StatusBadge } from "./status-badge";

/**
 * Client-side appointment option for MEMBER accounts:
 * browse doctors, pick an open slot published by the admin, and request a
 * booking. New requests start as "Pending" until an administrator approves
 * them; members may cancel anything that is still Pending or Scheduled.
 */

function todayISO(): string {
  return format(new Date(), "yyyy-MM-dd");
}

interface BookingForm {
  doctorId: string;
  date: string;
  timeSlot: string;
  reason: string;
}

const EMPTY_BOOKING: BookingForm = { doctorId: "", date: "", timeSlot: "", reason: "" };

function SectionCard({
  title,
  icon: Icon,
  count,
  action,
  children,
}: {
  title: string;
  icon: LucideIcon;
  count?: number;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
          {title}
          {typeof count === "number" && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
              {count}
            </span>
          )}
        </CardTitle>
        {action}
      </CardHeader>
      <CardContent className="space-y-3">{children}</CardContent>
    </Card>
  );
}

function BookingDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<BookingForm>(EMPTY_BOOKING);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const doctorsQ = useQuery({
    queryKey: ["doctors-list"],
    queryFn: () => getJSON<{ data: Doctor[] }>("/api/doctors"),
    enabled: open,
  });
  const bookableDoctors = useMemo(
    () => (doctorsQ.data?.data ?? []).filter((d) => d.availability === "Available"),
    [doctorsQ.data]
  );

  const slotsQ = useQuery({
    queryKey: ["my-slots", form.doctorId, form.date],
    queryFn: () =>
      getJSON<{ data: AppointmentSlot[] }>(
        `/api/slots?doctorId=${encodeURIComponent(form.doctorId)}&date=${encodeURIComponent(
          form.date
        )}&available=true`
      ),
    enabled: open && Boolean(form.doctorId && form.date),
  });
  const openSlots = slotsQ.data?.data ?? [];

  /** Update doctor/date and drop any selected slot that no longer matches. */
  const updateSelection = (patch: Partial<Pick<BookingForm, "doctorId" | "date">>) => {
    setForm((prev) => ({ ...prev, ...patch, timeSlot: "" }));
    setSubmitError(null);
  };

  const resetAndClose = () => {
    setForm(EMPTY_BOOKING);
    setSubmitError(null);
    onOpenChange(false);
  };

  const bookMutation = useMutation({
    mutationFn: (body: { doctorId: string; date: string; timeSlot: string; reason?: string }) =>
      sendJSON<{ data: Appointment }>("/api/appointments", "POST", body),
    onSuccess: () => {
      toast({
        title: "Appointment requested",
        description: "Your request is pending approval — you'll see the status update here.",
      });
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      queryClient.invalidateQueries({ queryKey: ["my-slots"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      resetAndClose();
    },
    onError: (error: Error) => setSubmitError(error.message),
  });

  const handleSubmit = () => {
    setSubmitError(null);
    if (!form.doctorId || !form.date || !form.timeSlot) {
      setSubmitError("Please choose a doctor, a date and one of the open time slots.");
      return;
    }
    const reason = form.reason.trim();
    bookMutation.mutate({
      doctorId: form.doctorId,
      date: form.date,
      timeSlot: form.timeSlot,
      ...(reason ? { reason } : {}),
    });
  };

  const today = todayISO();

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) resetAndClose();
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg scrollbar-thin">
        <div className="space-y-4">
          <DialogHeader>
            <DialogTitle>Book an appointment</DialogTitle>
            <DialogDescription>
              Pick a doctor and one of their open slots. The front desk reviews
              every request before it is confirmed.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="member-doctor">
                Doctor<span className="text-destructive"> *</span>
              </Label>
              <Select
                value={form.doctorId}
                onValueChange={(value) => updateSelection({ doctorId: value })}
              >
                <SelectTrigger id="member-doctor" className="w-full" aria-label="Select doctor">
                  <SelectValue placeholder="Select a doctor" />
                </SelectTrigger>
                <SelectContent>
                  {doctorsQ.isLoading ? (
                    <SelectItem value="__loading" disabled>
                      Loading doctors…
                    </SelectItem>
                  ) : bookableDoctors.length === 0 ? (
                    <SelectItem value="__empty" disabled>
                      No doctors are accepting bookings right now
                    </SelectItem>
                  ) : (
                    bookableDoctors.map((doctor) => (
                      <SelectItem key={doctor.id} value={doctor.id}>
                        {doctor.name} — {doctor.specialty}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="member-date">
                Date<span className="text-destructive"> *</span>
              </Label>
              <Input
                id="member-date"
                type="date"
                min={today}
                value={form.date}
                onChange={(event) => updateSelection({ date: event.target.value })}
              />
            </div>

            {form.doctorId && form.date && (
              <div className="space-y-2">
                <Label>
                  Open time slots<span className="text-destructive"> *</span>
                </Label>
                {slotsQ.isLoading ? (
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <Skeleton key={i} className="h-9 rounded-lg" />
                    ))}
                  </div>
                ) : openSlots.length === 0 ? (
                  <Alert className="border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
                    <Info className="h-4 w-4" aria-hidden="true" />
                    <AlertDescription>
                      No open slots for this doctor on {formatDate(form.date)}. Try
                      another date.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <div
                    role="radiogroup"
                    aria-label="Available time slots"
                    className="grid grid-cols-2 gap-2 sm:grid-cols-3"
                  >
                    {openSlots.map((slot) => (
                      <button
                        key={slot.id}
                        type="button"
                        role="radio"
                        aria-checked={form.timeSlot === slot.timeSlot}
                        onClick={() =>
                          setForm((prev) => ({ ...prev, timeSlot: slot.timeSlot }))
                        }
                        className={cn(
                          "flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-xs font-medium transition-colors",
                          form.timeSlot === slot.timeSlot
                            ? "border-primary bg-primary/10 text-primary"
                            : "text-muted-foreground hover:border-primary/40 hover:bg-muted"
                        )}
                      >
                        <Clock className="h-3 w-3 shrink-0" aria-hidden="true" />
                        {slot.timeSlot}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="member-reason">Reason for visit</Label>
              <Textarea
                id="member-reason"
                rows={3}
                placeholder="e.g. Annual check-up, follow-up on test results…"
                value={form.reason}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, reason: event.target.value }))
                }
              />
            </div>

            {submitError && (
              <Alert variant="destructive">
                <AlertDescription>{submitError}</AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={resetAndClose}>
              Cancel
            </Button>
            <Button type="submit" onClick={handleSubmit} disabled={bookMutation.isPending}>
              {bookMutation.isPending && (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              )}
              Request Appointment
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function MyAppointmentsView() {
  const user = useAuthStore((s) => s.user);
  const setActiveView = useMedicareStore((s) => s.setActiveView);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [bookingOpen, setBookingOpen] = useState(false);
  const [cancelling, setCancelling] = useState<Appointment | null>(null);

  const appointmentsQ = useQuery({
    queryKey: ["appointments", "mine"],
    queryFn: () => getJSON<{ data: Appointment[] }>("/api/appointments"),
  });

  const appointments = useMemo(
    () =>
      (appointmentsQ.data?.data ?? [])
        .slice()
        .sort((a, b) => (a.date === b.date ? a.timeSlot.localeCompare(b.timeSlot) : b.date.localeCompare(a.date))),
    [appointmentsQ.data]
  );

  const pending = appointments.filter((a) => a.status === "Pending");
  const upcoming = appointments.filter(
    (a) => (a.status === "Pending" || a.status === "Scheduled") && a.date >= todayISO()
  );
  const past = appointments.filter(
    (a) => !upcoming.includes(a) && !pending.includes(a)
  );

  const cancelMutation = useMutation({
    mutationFn: (id: string) =>
      sendJSON<{ data: Appointment }>(`/api/appointments/${id}`, "PUT", {
        status: "Cancelled",
      }),
    onSuccess: () => {
      toast({
        title: "Appointment cancelled",
        description: "The time slot has been released back to the schedule.",
      });
      setCancelling(null);
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      queryClient.invalidateQueries({ queryKey: ["my-slots"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
    },
    onError: (error: Error) =>
      toast({
        title: "Could not cancel appointment",
        description: error.message,
        variant: "destructive",
      }),
  });

  const renderAppointment = (appointment: Appointment, cancellable: boolean) => (
    <div key={appointment.id} className="rounded-lg border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-sm font-bold text-primary">
            {getInitials(appointment.doctor?.name)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">
              {appointment.doctor?.name ?? "Doctor"}
            </p>
            <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
              <Stethoscope className="h-3 w-3 shrink-0" aria-hidden="true" />
              {appointment.doctor?.specialty ?? "Specialist"} ·{" "}
              {appointment.doctor?.department ?? ""}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <StatusBadge status={appointment.status} />
          {cancellable && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 gap-1 border-destructive/30 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => setCancelling(appointment)}
            >
              <CalendarX2 className="h-3 w-3" aria-hidden="true" />
              Cancel
            </Button>
          )}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <CalendarClock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {formatDate(appointment.date)} · {appointment.timeSlot}
        </span>
        {appointment.reason && (
          <span className="flex min-w-0 items-center gap-1.5">
            <MessageSquareText className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">{appointment.reason}</span>
          </span>
        )}
      </div>
    </div>
  );

  if (appointmentsQ.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (appointmentsQ.isError) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <p className="text-sm font-medium text-destructive">Failed to load appointments</p>
          <p className="text-sm text-muted-foreground">
            {(appointmentsQ.error as Error).message}
          </p>
          <Button variant="outline" size="sm" onClick={() => appointmentsQ.refetch()}>
            Try again
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header / CTA */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex flex-wrap items-center justify-between gap-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 p-6 text-white shadow-sm"
      >
        <div className="min-w-0">
          <h2 className="text-xl font-bold md:text-2xl">Book &amp; manage appointments</h2>
          <p className="mt-1 max-w-xl text-sm text-emerald-50/90">
            Requests start as <span className="font-semibold">Pending</span> until
            staff confirm them. You can cancel any visit that has not been completed.
          </p>
        </div>
        <Button
          size="lg"
          className="shrink-0 bg-white text-emerald-700 hover:bg-emerald-50"
          onClick={() => setBookingOpen(true)}
        >
          <CalendarPlus className="h-4 w-4" aria-hidden="true" />
          Book Appointment
        </Button>
      </motion.div>

      {/* Status summary */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/15 text-amber-700 dark:text-amber-400">
              <Hourglass className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-2xl font-bold leading-none">{pending.length}</p>
              <p className="mt-1 text-xs text-muted-foreground">Pending approval</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
              <CalendarClock className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-2xl font-bold leading-none">{upcoming.length}</p>
              <p className="mt-1 text-xs text-muted-foreground">Upcoming visits</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-500/15 text-teal-700 dark:text-teal-400">
              <CalendarX2 className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-2xl font-bold leading-none">
                {appointments.filter((a) => a.status === "Cancelled").length}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">Cancelled</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Upcoming / pending */}
      <SectionCard
        title="Upcoming & pending"
        icon={CalendarClock}
        count={upcoming.length}
        action={
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setBookingOpen(true)}>
            <CalendarPlus className="h-3 w-3" aria-hidden="true" />
            New request
          </Button>
        }
      >
        {upcoming.length === 0 && pending.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-sm text-muted-foreground">
              You have no upcoming appointments.
            </p>
            <Button className="mt-4" onClick={() => setBookingOpen(true)}>
              <CalendarPlus className="h-4 w-4" aria-hidden="true" />
              Book your first appointment
            </Button>
          </div>
        ) : (
          upcoming.map((appointment) =>
            renderAppointment(appointment, true)
          )
        )}
        {upcoming.length === 0 && pending.length > 0 && (
          <p className="py-2 text-center text-sm text-muted-foreground">
            All your requests are pending staff approval.
          </p>
        )}
      </SectionCard>

      {/* History */}
      <SectionCard title="Past & cancelled" icon={CalendarX2} count={past.length}>
        {past.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Nothing here yet — your visit history will appear after appointments are completed.
          </p>
        ) : (
          past.map((appointment) =>
            renderAppointment(
              appointment,
              appointment.status === "Scheduled" || appointment.status === "Pending"
            )
          )
        )}
      </SectionCard>

      <BookingDialog open={bookingOpen} onOpenChange={setBookingOpen} />

      {/* Cancel confirmation */}
      <AlertDialog
        open={!!cancelling}
        onOpenChange={(open) => {
          if (!open) setCancelling(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this appointment?</AlertDialogTitle>
            <AlertDialogDescription>
              {cancelling
                ? `Your visit with ${cancelling.doctor?.name ?? "the doctor"} on ${formatShortDate(
                    cancelling.date
                  )} at ${cancelling.timeSlot} will be cancelled and the slot released.`
                : "The appointment will be cancelled."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelMutation.isPending}>
              Keep appointment
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={cancelMutation.isPending}
              onClick={(event) => {
                event.preventDefault();
                if (cancelling) cancelMutation.mutate(cancelling.id);
              }}
            >
              {cancelMutation.isPending && (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              )}
              Yes, cancel it
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Hint for members without a linked profile */}
      {appointments.length === 0 && (
        <p className="text-center text-xs text-muted-foreground">
          Trouble booking?{" "}
          <button
            type="button"
            className="font-medium text-primary underline underline-offset-2"
            onClick={() => setActiveView("profile")}
          >
            Check your profile
          </button>{" "}
          — your account email must be linked to a patient record by the front desk.
        </p>
      )}
    </div>
  );
}
