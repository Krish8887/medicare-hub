"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  CalendarPlus,
  CalendarX,
  CheckCircle2,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Trash2,
  XCircle,
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  formatShortDate,
  getInitials,
  getJSON,
  sendJSON,
} from "@/lib/medicare-api";
import {
  Appointment,
  AppointmentStatus,
  Doctor,
  Patient,
  TIME_SLOTS,
} from "@/lib/medicare-types";
import { StatusBadge } from "@/components/medicare/status-badge";

/* ------------------------------ local helpers ----------------------------- */

type StatusFilter = "All" | AppointmentStatus;

const STATUS_TABS: { value: StatusFilter; label: string }[] = [
  { value: "All", label: "All" },
  { value: "Pending", label: "Pending" },
  { value: "Scheduled", label: "Scheduled" },
  { value: "Completed", label: "Completed" },
  { value: "Cancelled", label: "Cancelled" },
];

const STATUS_OPTIONS: AppointmentStatus[] = ["Pending", "Scheduled", "Completed", "Cancelled"];

interface BookingFormState {
  patientId: string;
  doctorId: string;
  date: string;
  timeSlot: string;
  reason: string;
}

interface EditFormState {
  date: string;
  timeSlot: string;
  status: AppointmentStatus;
  reason: string;
  notes: string;
}

interface AppointmentCreateBody {
  patientId: string;
  doctorId: string;
  date: string;
  timeSlot: string;
  reason?: string;
}

interface RowAction {
  key: string;
  label: string;
  icon: LucideIcon;
  destructive?: boolean;
  separator?: boolean;
  onSelect: () => void;
}

function todayISO(): string {
  return format(new Date(), "yyyy-MM-dd");
}

function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

function Field({
  label,
  required,
  htmlFor,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  htmlFor?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`min-w-0 space-y-1.5 ${className ?? ""}`}>
      <Label htmlFor={htmlFor}>
        {label}
        {required && <span className="text-destructive"> *</span>}
      </Label>
      {children}
    </div>
  );
}

function EmptyState({ icon: Icon, title, hint }: { icon: LucideIcon; title: string; hint: string }) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center gap-2 py-16 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Icon className="h-6 w-6" aria-hidden="true" />
        </div>
        <p className="font-medium">{title}</p>
        <p className="text-sm text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}

function PatientCell({ name, email }: { name?: string; email?: string }) {
  if (!name) return <span className="text-muted-foreground">Unknown</span>;
  return (
    <div className="flex items-center gap-3">
      <Avatar className="h-9 w-9">
        <AvatarFallback className="bg-primary/10 text-xs font-medium text-primary">
          {getInitials(name)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <p className="truncate font-medium">{name}</p>
        {email && <p className="truncate text-xs text-muted-foreground">{email}</p>}
      </div>
    </div>
  );
}

function DoctorCell({ name, specialty }: { name?: string; specialty?: string }) {
  if (!name) return <span className="text-muted-foreground">Unassigned</span>;
  return (
    <div className="min-w-0">
      <p className="truncate font-medium">{name}</p>
      {specialty && <p className="truncate text-xs text-muted-foreground">{specialty}</p>}
    </div>
  );
}

/* ------------------------------- the view --------------------------------- */

export default function AppointmentsView() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("All");
  const [searchInput, setSearchInput] = useState("");
  const search = useDebouncedValue(searchInput);

  const [bookingOpen, setBookingOpen] = useState(false);
  const [bookingForm, setBookingForm] = useState<BookingFormState>({
    patientId: "",
    doctorId: "",
    date: todayISO(),
    timeSlot: "",
    reason: "",
  });

  const [editing, setEditing] = useState<Appointment | null>(null);
  const [editForm, setEditForm] = useState<EditFormState>({
    date: todayISO(),
    timeSlot: "",
    status: "Scheduled",
    reason: "",
    notes: "",
  });

  const [deleting, setDeleting] = useState<Appointment | null>(null);

  /* ------------------------------ data fetching ----------------------------- */

  const appointmentsQuery = useQuery({
    queryKey: ["appointments", statusFilter, search],
    queryFn: () => {
      const params = new URLSearchParams();
      if (statusFilter !== "All") params.set("status", statusFilter);
      const trimmed = search.trim();
      if (trimmed) params.set("search", trimmed);
      const qs = params.toString();
      return getJSON<{ data: Appointment[] }>(`/api/appointments${qs ? `?${qs}` : ""}`);
    },
  });

  // Lightweight counter for the "Pending" tab badge (approval inbox).
  const pendingCountQuery = useQuery({
    queryKey: ["appointments", "pending-count"],
    queryFn: () => getJSON<{ data: Appointment[] }>("/api/appointments?status=Pending"),
    refetchInterval: 30000,
  });
  const pendingCount = pendingCountQuery.data?.data.length ?? 0;

  const patientsQuery = useQuery({
    queryKey: ["patients-list"],
    queryFn: () => getJSON<{ data: Patient[] }>("/api/patients"),
  });

  const doctorsQuery = useQuery({
    queryKey: ["doctors-list"],
    queryFn: () => getJSON<{ data: Doctor[] }>("/api/doctors"),
  });

  const appointments = appointmentsQuery.data?.data ?? [];
  const patients = patientsQuery.data?.data ?? [];
  const doctors = doctorsQuery.data?.data ?? [];
  const today = todayISO();

  /* -------------------------------- mutations ------------------------------- */

  const invalidateAfterChange = () => {
    queryClient.invalidateQueries({ queryKey: ["appointments"] });
    queryClient.invalidateQueries({ queryKey: ["stats"] });
  };

  const createMutation = useMutation({
    mutationFn: (body: AppointmentCreateBody) =>
      sendJSON<{ data: Appointment }>("/api/appointments", "POST", body),
    onSuccess: () => {
      toast({
        title: "Appointment booked",
        description: "The appointment has been added to the schedule.",
      });
      setBookingOpen(false);
      setBookingForm({ patientId: "", doctorId: "", date: todayISO(), timeSlot: "", reason: "" });
      invalidateAfterChange();
    },
    onError: (error: Error) =>
      toast({
        title: "Could not book appointment",
        description: error.message,
        variant: "destructive",
      }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      sendJSON<{ data: Appointment }>(`/api/appointments/${id}`, "PUT", data),
    onSuccess: () => {
      toast({ title: "Appointment updated", description: "Your changes have been saved." });
      setEditing(null);
      invalidateAfterChange();
    },
    onError: (error: Error) =>
      toast({
        title: "Could not update appointment",
        description: error.message,
        variant: "destructive",
      }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => sendJSON<{ success: boolean }>(`/api/appointments/${id}`, "DELETE"),
    onSuccess: () => {
      toast({ title: "Appointment deleted", description: "The appointment was removed." });
      setDeleting(null);
      invalidateAfterChange();
    },
    onError: (error: Error) =>
      toast({
        title: "Could not delete appointment",
        description: error.message,
        variant: "destructive",
      }),
  });

  /* --------------------------------- actions -------------------------------- */

  const openBooking = () => {
    setBookingForm({ patientId: "", doctorId: "", date: todayISO(), timeSlot: "", reason: "" });
    setBookingOpen(true);
  };

  const handleBook = () => {
    if (!bookingForm.patientId || !bookingForm.doctorId || !bookingForm.date || !bookingForm.timeSlot) {
      toast({
        title: "Missing information",
        description: "Please select a patient, doctor, date and time slot.",
        variant: "destructive",
      });
      return;
    }
    const body: AppointmentCreateBody = {
      patientId: bookingForm.patientId,
      doctorId: bookingForm.doctorId,
      date: bookingForm.date,
      timeSlot: bookingForm.timeSlot,
    };
    const reason = bookingForm.reason.trim();
    if (reason) body.reason = reason;
    createMutation.mutate(body);
  };

  const openEdit = (appointment: Appointment) => {
    setEditing(appointment);
    setEditForm({
      date: appointment.date,
      timeSlot: appointment.timeSlot,
      status: appointment.status,
      reason: appointment.reason ?? "",
      notes: appointment.notes ?? "",
    });
  };

  const handleSaveEdit = () => {
    if (!editing) return;
    if (!editForm.date || !editForm.timeSlot) {
      toast({
        title: "Missing information",
        description: "Please pick a date and a time slot.",
        variant: "destructive",
      });
      return;
    }
    updateMutation.mutate({
      id: editing.id,
      data: {
        date: editForm.date,
        timeSlot: editForm.timeSlot,
        status: editForm.status,
        reason: editForm.reason.trim() || null,
        notes: editForm.notes.trim() || null,
      },
    });
  };

  /* ------------------------------- row actions ------------------------------ */

  const rowActions = (appointment: Appointment): RowAction[] => [
    {
      key: "edit",
      label: "Edit",
      icon: Pencil,
      onSelect: () => openEdit(appointment),
    },
    ...(appointment.status === "Pending"
      ? [
          {
            key: "approve",
            label: "Approve",
            icon: CheckCircle2,
            onSelect: () =>
              updateMutation.mutate({ id: appointment.id, data: { status: "Scheduled" } }),
          },
          {
            key: "decline",
            label: "Decline",
            icon: XCircle,
            destructive: true,
            onSelect: () =>
              updateMutation.mutate({ id: appointment.id, data: { status: "Cancelled" } }),
          },
        ]
      : []),
    ...(appointment.status === "Scheduled"
      ? [
          {
            key: "complete",
            label: "Mark Completed",
            icon: CheckCircle2,
            onSelect: () => updateMutation.mutate({ id: appointment.id, data: { status: "Completed" } }),
          },
          {
            key: "cancel",
            label: "Cancel Appointment",
            icon: XCircle,
            destructive: true,
            onSelect: () => updateMutation.mutate({ id: appointment.id, data: { status: "Cancelled" } }),
          },
        ]
      : []),
    {
      key: "delete",
      label: "Delete",
      icon: Trash2,
      destructive: true,
      separator: true,
      onSelect: () => setDeleting(appointment),
    },
  ];

  const isLoading = appointmentsQuery.isLoading;

  /* ---------------------------------- render -------------------------------- */

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Tabs value={statusFilter} onValueChange={(value) => setStatusFilter(value as StatusFilter)}>
            <TabsList className="bg-muted">
              {STATUS_TABS.map((tab) => (
                <TabsTrigger key={tab.value} value={tab.value}>
                  {tab.label}
                  {tab.value === "Pending" && pendingCount > 0 && (
                    <span
                      className="ml-1.5 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[11px] font-semibold leading-none text-amber-700 dark:text-amber-400"
                      aria-label={`${pendingCount} pending approvals`}
                    >
                      {pendingCount}
                    </span>
                  )}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <div className="relative w-full max-w-xs">
            <Search
              className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search patient, doctor, reason…"
              aria-label="Search appointments"
              className="pl-9"
            />
          </div>
        </div>
        <Button onClick={openBooking} className="shrink-0">
          <Plus className="h-4 w-4" aria-hidden="true" />
          Book Appointment
        </Button>
      </div>

      {/* Error state */}
      {appointmentsQuery.isError && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <p className="text-sm font-medium text-destructive">Failed to load appointments</p>
            <p className="max-w-md text-sm text-muted-foreground">
              {(appointmentsQuery.error as Error).message}
            </p>
            <Button variant="outline" size="sm" onClick={() => appointmentsQuery.refetch()}>
              Try again
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Loading state */}
      {appointmentsQuery.isLoading && !appointmentsQuery.isError && (
        <>
          <Card className="hidden gap-0 overflow-hidden py-0 md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  {["Patient", "Doctor", "Date & Time", "Reason", "Status", ""].map((head, i) => (
                    <TableHead key={i}>{head}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from({ length: 6 }).map((_, rowIndex) => (
                  <TableRow key={rowIndex}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Skeleton className="h-9 w-9 rounded-full" />
                        <div className="space-y-1.5">
                          <Skeleton className="h-4 w-28" />
                          <Skeleton className="h-3 w-36" />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1.5">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-3 w-20" />
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1.5">
                        <Skeleton className="h-4 w-16" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-36" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-5 w-20 rounded-full" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-8 w-8" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
          <div className="grid gap-4 md:hidden">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="p-4">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-9 w-9 rounded-full" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <Skeleton className="h-5 w-20 rounded-full" />
                </div>
                <Skeleton className="mt-3 h-3 w-40" />
                <Skeleton className="mt-3 h-8 w-full" />
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Empty state */}
      {!isLoading &&
        !appointmentsQuery.isError &&
        appointments.length === 0 &&
        (statusFilter === "All" && !search.trim() ? (
          <EmptyState
            icon={CalendarX}
            title="No appointments found"
            hint="Book your first appointment to get started."
          />
        ) : (
          <EmptyState
            icon={CalendarX}
            title="No appointments found"
            hint="Try adjusting the status filter or search term."
          />
        ))}

      {/* Data */}
      {!isLoading && !appointmentsQuery.isError && appointments.length > 0 && (
        <>
          {/* Desktop table */}
          <Card className="hidden gap-0 overflow-hidden py-0 md:block [&>div]:max-h-[65vh] [&>div]:overflow-y-auto">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-muted/70 backdrop-blur">
                <TableRow>
                  <TableHead>Patient</TableHead>
                  <TableHead>Doctor</TableHead>
                  <TableHead>Date &amp; Time</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-12">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {appointments.map((appointment) => (
                  <TableRow key={appointment.id}>
                    <TableCell>
                      <PatientCell
                        name={appointment.patient?.name}
                        email={appointment.patient?.email}
                      />
                    </TableCell>
                    <TableCell>
                      <DoctorCell
                        name={appointment.doctor?.name}
                        specialty={appointment.doctor?.specialty}
                      />
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <p className="font-medium">{formatShortDate(appointment.date)}</p>
                      <p className="text-xs text-muted-foreground">{appointment.timeSlot}</p>
                    </TableCell>
                    <TableCell>
                      <div className="max-w-[220px] truncate text-muted-foreground">
                        {appointment.reason || "—"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={appointment.status} />
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            aria-label={`Actions for appointment on ${formatShortDate(appointment.date)}`}
                          >
                            <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          {rowActions(appointment).map((action) => (
                            <div key={action.key}>
                              {action.separator && <DropdownMenuSeparator />}
                              <DropdownMenuItem
                                variant={action.destructive ? "destructive" : "default"}
                                onClick={action.onSelect}
                              >
                                <action.icon className="h-4 w-4" aria-hidden="true" />
                                {action.label}
                              </DropdownMenuItem>
                            </div>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          {/* Mobile cards */}
          <div className="grid gap-4 md:hidden">
            {appointments.map((appointment) => (
              <Card key={appointment.id} className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-primary/10 text-sm font-medium text-primary">
                        {getInitials(appointment.patient?.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        {appointment.patient?.name ?? "Unknown patient"}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {appointment.doctor?.name ?? "Unassigned"}
                        {appointment.doctor?.specialty ? ` · ${appointment.doctor.specialty}` : ""}
                      </p>
                    </div>
                  </div>
                  <StatusBadge status={appointment.status} />
                </div>

                <div className="mt-3 space-y-1 text-sm">
                  <p className="font-medium">
                    {formatShortDate(appointment.date)}{" "}
                    <span className="font-normal text-muted-foreground">
                      · {appointment.timeSlot}
                    </span>
                  </p>
                  {appointment.reason && (
                    <p className="line-clamp-2 text-muted-foreground">{appointment.reason}</p>
                  )}
                </div>

                <div className="mt-3 flex items-center justify-end gap-1 border-t pt-3">
                  <Button variant="ghost" size="icon" className="h-9 w-9" aria-label="Edit appointment" onClick={() => openEdit(appointment)}>
                    <Pencil className="h-4 w-4" aria-hidden="true" />
                  </Button>
                  {appointment.status === "Pending" && (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 text-emerald-700 dark:text-emerald-400"
                        aria-label="Approve appointment"
                        onClick={() =>
                          updateMutation.mutate({ id: appointment.id, data: { status: "Scheduled" } })
                        }
                      >
                        <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 text-amber-700 dark:text-amber-400"
                        aria-label="Decline appointment"
                        onClick={() =>
                          updateMutation.mutate({ id: appointment.id, data: { status: "Cancelled" } })
                        }
                      >
                        <XCircle className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    </>
                  )}
                  {appointment.status === "Scheduled" && (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 text-emerald-700 dark:text-emerald-400"
                        aria-label="Mark completed"
                        onClick={() =>
                          updateMutation.mutate({ id: appointment.id, data: { status: "Completed" } })
                        }
                      >
                        <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 text-amber-700 dark:text-amber-400"
                        aria-label="Cancel appointment"
                        onClick={() =>
                          updateMutation.mutate({ id: appointment.id, data: { status: "Cancelled" } })
                        }
                      >
                        <XCircle className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    </>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 text-destructive"
                    aria-label="Delete appointment"
                    onClick={() => setDeleting(appointment)}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Booking dialog */}
      <Dialog
        open={bookingOpen}
        onOpenChange={(open) => {
          if (!open) setBookingOpen(false);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              handleBook();
            }}
            className="space-y-4"
          >
            <DialogHeader>
              <DialogTitle>Book Appointment</DialogTitle>
              <DialogDescription>
                Schedule a new visit between a patient and a doctor.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Patient" required className="sm:col-span-2">
                <Select
                  value={bookingForm.patientId}
                  onValueChange={(value) =>
                    setBookingForm((prev) => ({ ...prev, patientId: value }))
                  }
                >
                  <SelectTrigger className="w-full" aria-label="Select patient">
                    <SelectValue placeholder="Select patient" />
                  </SelectTrigger>
                  <SelectContent>
                    {patientsQuery.isLoading ? (
                      <SelectItem value="__loading" disabled>
                        Loading patients…
                      </SelectItem>
                    ) : patients.length === 0 ? (
                      <SelectItem value="__empty" disabled>
                        No patients found
                      </SelectItem>
                    ) : (
                      patients.map((patient) => (
                        <SelectItem key={patient.id} value={patient.id}>
                          {patient.name} — {patient.email}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Doctor" required className="sm:col-span-2">
                <Select
                  value={bookingForm.doctorId}
                  onValueChange={(value) =>
                    setBookingForm((prev) => ({ ...prev, doctorId: value }))
                  }
                >
                  <SelectTrigger className="w-full" aria-label="Select doctor">
                    <SelectValue placeholder="Select doctor" />
                  </SelectTrigger>
                  <SelectContent>
                    {doctorsQuery.isLoading ? (
                      <SelectItem value="__loading" disabled>
                        Loading doctors…
                      </SelectItem>
                    ) : doctors.length === 0 ? (
                      <SelectItem value="__empty" disabled>
                        No doctors found
                      </SelectItem>
                    ) : (
                      doctors.map((doctor) => (
                        <SelectItem key={doctor.id} value={doctor.id}>
                          {doctor.name} ({doctor.specialty})
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Date" required htmlFor="booking-date">
                <Input
                  id="booking-date"
                  type="date"
                  required
                  min={today}
                  value={bookingForm.date}
                  onChange={(event) =>
                    setBookingForm((prev) => ({ ...prev, date: event.target.value }))
                  }
                />
              </Field>

              <Field label="Time Slot" required>
                <Select
                  value={bookingForm.timeSlot}
                  onValueChange={(value) =>
                    setBookingForm((prev) => ({ ...prev, timeSlot: value }))
                  }
                >
                  <SelectTrigger className="w-full" aria-label="Select time slot">
                    <SelectValue placeholder="Select time slot" />
                  </SelectTrigger>
                  <SelectContent>
                    {TIME_SLOTS.map((slot) => (
                      <SelectItem key={slot} value={slot}>
                        {slot}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Reason" className="sm:col-span-2">
                <Textarea
                  rows={3}
                  placeholder="e.g. Annual check-up, chest pain follow-up…"
                  value={bookingForm.reason}
                  onChange={(event) =>
                    setBookingForm((prev) => ({ ...prev, reason: event.target.value }))
                  }
                />
              </Field>
            </div>

            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => setBookingOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending && (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                )}
                Book Appointment
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog
        open={!!editing}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              handleSaveEdit();
            }}
            className="space-y-4"
          >
            <DialogHeader>
              <DialogTitle>Edit Appointment</DialogTitle>
              <DialogDescription>
                {editing
                  ? `Visit for ${editing.patient?.name ?? "patient"} with ${
                      editing.doctor?.name ?? "doctor"
                    }.`
                  : "Update the appointment details."}
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Date" required htmlFor="edit-date">
                <Input
                  id="edit-date"
                  type="date"
                  required
                  value={editForm.date}
                  onChange={(event) =>
                    setEditForm((prev) => ({ ...prev, date: event.target.value }))
                  }
                />
              </Field>

              <Field label="Time Slot" required>
                <Select
                  value={editForm.timeSlot}
                  onValueChange={(value) =>
                    setEditForm((prev) => ({ ...prev, timeSlot: value }))
                  }
                >
                  <SelectTrigger className="w-full" aria-label="Select time slot">
                    <SelectValue placeholder="Select time slot" />
                  </SelectTrigger>
                  <SelectContent>
                    {TIME_SLOTS.map((slot) => (
                      <SelectItem key={slot} value={slot}>
                        {slot}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Status" required className="sm:col-span-2">
                <Select
                  value={editForm.status}
                  onValueChange={(value) =>
                    setEditForm((prev) => ({ ...prev, status: value as AppointmentStatus }))
                  }
                >
                  <SelectTrigger className="w-full" aria-label="Select status">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((status) => (
                      <SelectItem key={status} value={status}>
                        {status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Reason" className="sm:col-span-2">
                <Textarea
                  rows={2}
                  placeholder="Why is the patient visiting?"
                  value={editForm.reason}
                  onChange={(event) =>
                    setEditForm((prev) => ({ ...prev, reason: event.target.value }))
                  }
                />
              </Field>

              <Field label="Notes" className="sm:col-span-2">
                <Textarea
                  rows={3}
                  placeholder="Internal notes (optional)"
                  value={editForm.notes}
                  onChange={(event) =>
                    setEditForm((prev) => ({ ...prev, notes: event.target.value }))
                  }
                />
              </Field>
            </div>

            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => setEditing(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending && (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                )}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog
        open={!!deleting}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this appointment?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting
                ? `The appointment for ${deleting.patient?.name ?? "this patient"} on ${formatShortDate(
                    deleting.date
                  )} at ${deleting.timeSlot} will be permanently removed. This cannot be undone.`
                : "This appointment will be permanently removed."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={deleteMutation.isPending}
              onClick={(event) => {
                event.preventDefault();
                if (deleting) deleteMutation.mutate(deleting.id);
              }}
            >
              {deleteMutation.isPending && (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              )}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
