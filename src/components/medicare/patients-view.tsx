"use client";

import { useEffect, useState } from "react";
import { differenceInYears } from "date-fns";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Eye,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Trash2,
  Users,
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
import { Badge } from "@/components/ui/badge";
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
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  formatDate,
  getInitials,
  getJSON,
  sendJSON,
  toDate,
} from "@/lib/medicare-api";
import { Appointment, BLOOD_GROUPS, MedicalRecord, Patient } from "@/lib/medicare-types";
import { StatusBadge } from "@/components/medicare/status-badge";
import { cn } from "@/lib/utils";

/* ------------------------------ local helpers ----------------------------- */

interface PatientDetail extends Patient {
  appointments: Appointment[];
  records: MedicalRecord[];
}

type Gender = "Male" | "Female" | "Other";

const GENDER_OPTIONS: Gender[] = ["Male", "Female", "Other"];

interface PatientFormState {
  name: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  gender: Gender;
  bloodGroup: string; // "" means Unknown
  address: string;
  allergies: string;
}

interface PatientBody {
  name: string;
  email: string;
  phone: string;
  gender: Gender;
  bloodGroup: string | null;
  address: string | null;
  allergies: string | null;
  dateOfBirth?: string | null;
}

const EMPTY_PATIENT_FORM: PatientFormState = {
  name: "",
  email: "",
  phone: "",
  dateOfBirth: "",
  gender: "Male",
  bloodGroup: "",
  address: "",
  allergies: "",
};

function getAge(dob: string | null | undefined): number | null {
  if (!dob) return null;
  try {
    return differenceInYears(new Date(), toDate(dob));
  } catch {
    return null;
  }
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
    <div className={cn("min-w-0 space-y-1.5", className)}>
      <Label htmlFor={htmlFor}>
        {label}
        {required && <span className="text-destructive"> *</span>}
      </Label>
      {children}
    </div>
  );
}

function DetailField({
  label,
  value,
  className,
}: {
  label: string;
  value: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="mt-0.5 min-w-0 text-sm font-medium">{value}</div>
    </div>
  );
}

function BloodGroupBadge({ bloodGroup }: { bloodGroup: string | null }) {
  if (!bloodGroup) return <span className="text-muted-foreground">—</span>;
  return (
    <Badge
      variant="outline"
      className="border-transparent bg-rose-500/10 text-rose-700 dark:text-rose-400"
    >
      {bloodGroup}
    </Badge>
  );
}

function EmptyState({ title, hint }: { title: string; hint: string }) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center gap-2 py-16 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Users className="h-6 w-6" aria-hidden="true" />
        </div>
        <p className="font-medium">{title}</p>
        <p className="text-sm text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}

function PatientCell({ patient }: { patient: Patient }) {
  return (
    <div className="flex items-center gap-3">
      <Avatar className="h-9 w-9">
        <AvatarFallback className="bg-primary/10 text-xs font-medium text-primary">
          {getInitials(patient.name)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <p className="truncate font-medium">{patient.name}</p>
        <p className="truncate text-xs text-muted-foreground">{patient.email}</p>
      </div>
    </div>
  );
}

/* ------------------------------- the view --------------------------------- */

export default function PatientsView() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [searchInput, setSearchInput] = useState("");
  const search = useDebouncedValue(searchInput);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Patient | null>(null);
  const [form, setForm] = useState<PatientFormState>(EMPTY_PATIENT_FORM);
  const [deleting, setDeleting] = useState<Patient | null>(null);
  const [viewing, setViewing] = useState<Patient | null>(null);

  /* ------------------------------ data fetching ----------------------------- */

  const patientsQuery = useQuery({
    queryKey: ["patients", search],
    queryFn: () => {
      const params = new URLSearchParams();
      const trimmed = search.trim();
      if (trimmed) params.set("search", trimmed);
      const qs = params.toString();
      return getJSON<{ data: Patient[] }>(`/api/patients${qs ? `?${qs}` : ""}`);
    },
  });

  const detailQuery = useQuery({
    queryKey: ["patient", viewing?.id],
    queryFn: () => getJSON<{ data: PatientDetail }>(`/api/patients/${viewing?.id ?? ""}`),
    enabled: !!viewing,
  });

  const patients = patientsQuery.data?.data ?? [];
  const detail = detailQuery.data?.data;

  /* -------------------------------- mutations ------------------------------- */

  const invalidateAfterChange = () => {
    queryClient.invalidateQueries({ queryKey: ["patients"] });
    queryClient.invalidateQueries({ queryKey: ["patients-list"] });
    queryClient.invalidateQueries({ queryKey: ["stats"] });
  };

  const createMutation = useMutation({
    mutationFn: (body: PatientBody) => sendJSON<{ data: Patient }>("/api/patients", "POST", body),
    onSuccess: () => {
      toast({ title: "Patient added", description: "The new patient is now in the directory." });
      closeDialog();
      invalidateAfterChange();
    },
    onError: (error: Error) =>
      toast({ title: "Could not add patient", description: error.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: PatientBody }) =>
      sendJSON<{ data: Patient }>(`/api/patients/${id}`, "PUT", data),
    onSuccess: () => {
      toast({ title: "Patient updated", description: "Your changes have been saved." });
      closeDialog();
      queryClient.invalidateQueries({ queryKey: ["patient"] });
      invalidateAfterChange();
    },
    onError: (error: Error) =>
      toast({ title: "Could not update patient", description: error.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => sendJSON<{ success: boolean }>(`/api/patients/${id}`, "DELETE"),
    onSuccess: () => {
      toast({
        title: "Patient deleted",
        description: "The patient and their related records were removed.",
      });
      setDeleting(null);
      invalidateAfterChange();
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      queryClient.invalidateQueries({ queryKey: ["records"] });
    },
    onError: (error: Error) =>
      toast({ title: "Could not delete patient", description: error.message, variant: "destructive" }),
  });

  /* --------------------------------- actions -------------------------------- */

  const closeDialog = () => {
    setDialogOpen(false);
    setEditing(null);
  };

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_PATIENT_FORM);
    setDialogOpen(true);
  };

  const openEdit = (patient: Patient) => {
    setEditing(patient);
    setForm({
      name: patient.name,
      email: patient.email,
      phone: patient.phone,
      dateOfBirth: patient.dateOfBirth ? patient.dateOfBirth.slice(0, 10) : "",
      gender: patient.gender,
      bloodGroup: patient.bloodGroup ?? "",
      address: patient.address ?? "",
      allergies: patient.allergies ?? "",
    });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!form.name.trim() || !form.email.trim() || !form.phone.trim()) {
      toast({
        title: "Missing information",
        description: "Please fill in name, email and phone.",
        variant: "destructive",
      });
      return;
    }
    const body: PatientBody = {
      name: form.name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      gender: form.gender,
      bloodGroup: form.bloodGroup || null,
      address: form.address.trim() || null,
      allergies: form.allergies.trim() || null,
    };
    if (form.dateOfBirth) {
      body.dateOfBirth = new Date(form.dateOfBirth).toISOString();
    } else if (editing) {
      body.dateOfBirth = null; // explicit clear on edit
    }
    if (editing) updateMutation.mutate({ id: editing.id, data: body });
    else createMutation.mutate(body);
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;
  const isLoading = patientsQuery.isLoading;

  /* ---------------------------------- render -------------------------------- */

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full max-w-xs">
          <Search
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search name, email or phone…"
            aria-label="Search patients"
            className="pl-9"
          />
        </div>
        <Button onClick={openCreate} className="shrink-0">
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add Patient
        </Button>
      </div>

      {/* Error state */}
      {patientsQuery.isError && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <p className="text-sm font-medium text-destructive">Failed to load patients</p>
            <p className="max-w-md text-sm text-muted-foreground">
              {(patientsQuery.error as Error).message}
            </p>
            <Button variant="outline" size="sm" onClick={() => patientsQuery.refetch()}>
              Try again
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Loading state */}
      {isLoading && !patientsQuery.isError && (
        <>
          <Card className="hidden gap-0 overflow-hidden py-0 md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  {["Patient", "Phone", "Gender", "Blood Group", "Age", ""].map((head, i) => (
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
                      <Skeleton className="h-4 w-32" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-14" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-5 w-10 rounded-full" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-10" />
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
        !patientsQuery.isError &&
        patients.length === 0 && (
          <EmptyState
            title="No patients found"
            hint={
              search.trim()
                ? "Try adjusting the search term."
                : "Add your first patient to build the directory."
            }
          />
        )}

      {/* Data */}
      {!isLoading && !patientsQuery.isError && patients.length > 0 && (
        <>
          {/* Desktop table */}
          <Card className="hidden gap-0 overflow-hidden py-0 md:block [&>div]:max-h-[65vh] [&>div]:overflow-y-auto">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-muted/70 backdrop-blur">
                <TableRow>
                  <TableHead>Patient</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Gender</TableHead>
                  <TableHead>Blood Group</TableHead>
                  <TableHead>Age</TableHead>
                  <TableHead className="w-12">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {patients.map((patient) => {
                  const age = getAge(patient.dateOfBirth);
                  return (
                    <TableRow key={patient.id}>
                      <TableCell>
                        <PatientCell patient={patient} />
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {patient.phone}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{patient.gender}</TableCell>
                      <TableCell>
                        <BloodGroupBadge bloodGroup={patient.bloodGroup} />
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {age !== null ? age : "—"}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              aria-label={`Actions for ${patient.name}`}
                            >
                              <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44">
                            <DropdownMenuItem onClick={() => setViewing(patient)}>
                              <Eye className="h-4 w-4" aria-hidden="true" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openEdit(patient)}>
                              <Pencil className="h-4 w-4" aria-hidden="true" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={() => setDeleting(patient)}
                            >
                              <Trash2 className="h-4 w-4" aria-hidden="true" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>

          {/* Mobile cards */}
          <div className="grid gap-4 md:hidden">
            {patients.map((patient) => {
              const age = getAge(patient.dateOfBirth);
              return (
                <Card key={patient.id} className="p-4">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-primary/10 text-sm font-medium text-primary">
                        {getInitials(patient.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{patient.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{patient.email}</p>
                    </div>
                    <BloodGroupBadge bloodGroup={patient.bloodGroup} />
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                    <p className="truncate text-muted-foreground">{patient.phone}</p>
                    <p className="text-muted-foreground">
                      {patient.gender}
                      {age !== null ? ` · ${age} yrs` : ""}
                    </p>
                  </div>

                  <div className="mt-3 flex items-center justify-end gap-1 border-t pt-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setViewing(patient)}
                    >
                      <Eye className="h-4 w-4" aria-hidden="true" />
                      View
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => openEdit(patient)}>
                      <Pencil className="h-4 w-4" aria-hidden="true" />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => setDeleting(patient)}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                      Delete
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        </>
      )}

      {/* View details dialog */}
      <Dialog
        open={!!viewing}
        onOpenChange={(open) => {
          if (!open) setViewing(null);
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <Avatar className="h-9 w-9">
                <AvatarFallback className="bg-primary/10 text-xs font-medium text-primary">
                  {getInitials(viewing?.name)}
                </AvatarFallback>
              </Avatar>
              <span className="min-w-0 truncate">{viewing?.name}</span>
            </DialogTitle>
            <DialogDescription>Patient profile, appointments and medical history.</DialogDescription>
          </DialogHeader>

          <div className="max-h-[70vh] space-y-6 overflow-y-auto pr-1 scrollbar-thin">
            {detailQuery.isLoading && (
              <div className="space-y-4">
                <Skeleton className="h-4 w-40" />
                <div className="grid gap-3 sm:grid-cols-2">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-20 w-full" />
              </div>
            )}

            {detailQuery.isError && (
              <div className="flex flex-col items-center gap-3 py-8 text-center">
                <p className="text-sm font-medium text-destructive">Failed to load details</p>
                <p className="max-w-sm text-sm text-muted-foreground">
                  {(detailQuery.error as Error).message}
                </p>
                <Button variant="outline" size="sm" onClick={() => detailQuery.refetch()}>
                  Try again
                </Button>
              </div>
            )}

            {detail && (
              <>
                {/* Personal information */}
                <section aria-label="Personal information">
                  <h3 className="mb-3 text-sm font-semibold">Personal Information</h3>
                  <div className="grid gap-x-6 gap-y-4 rounded-lg border p-4 sm:grid-cols-2">
                    <DetailField label="Email" value={detail.email} />
                    <DetailField label="Phone" value={detail.phone} />
                    <DetailField label="Gender" value={detail.gender} />
                    <DetailField
                      label="Blood Group"
                      value={<BloodGroupBadge bloodGroup={detail.bloodGroup} />}
                    />
                    <DetailField
                      label="Date of Birth"
                      value={detail.dateOfBirth ? formatDate(detail.dateOfBirth) : "—"}
                    />
                    <DetailField
                      label="Age"
                      value={getAge(detail.dateOfBirth)?.toString() ?? "—"}
                    />
                    <DetailField
                      label="Address"
                      value={detail.address?.trim() || "—"}
                      className="sm:col-span-2"
                    />
                    <DetailField
                      label="Allergies"
                      value={detail.allergies?.trim() || "None recorded"}
                      className="sm:col-span-2"
                    />
                  </div>
                </section>

                {/* Appointments */}
                <section aria-label="Appointments">
                  <h3 className="mb-3 text-sm font-semibold">
                    Appointments ({detail.appointments.length})
                  </h3>
                  {detail.appointments.length === 0 ? (
                    <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                      No appointments yet
                    </p>
                  ) : (
                    <div className="max-h-60 space-y-2 overflow-y-auto pr-1 scrollbar-thin">
                      {detail.appointments.map((appointment) => (
                        <div
                          key={appointment.id}
                          className="rounded-lg border p-3"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-sm font-medium">
                              {formatDate(appointment.date)}{" "}
                              <span className="font-normal text-muted-foreground">
                                · {appointment.timeSlot}
                              </span>
                            </p>
                            <StatusBadge status={appointment.status} />
                          </div>
                          <p className="mt-1 truncate text-xs text-muted-foreground">
                            {appointment.doctor?.name ?? "Unassigned"}
                            {appointment.reason ? ` — ${appointment.reason}` : ""}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                {/* Medical records */}
                <section aria-label="Medical records">
                  <h3 className="mb-3 text-sm font-semibold">
                    Medical Records ({detail.records.length})
                  </h3>
                  {detail.records.length === 0 ? (
                    <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                      No medical records
                    </p>
                  ) : (
                    <div className="max-h-60 space-y-2 overflow-y-auto pr-1 scrollbar-thin">
                      {detail.records.map((record) => (
                        <div
                          key={record.id}
                          className="rounded-lg border p-3"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-sm font-medium">{record.diagnosis}</p>
                            <Badge
                              variant="outline"
                              className="border-transparent bg-muted text-muted-foreground"
                            >
                              {record.visitType}
                            </Badge>
                          </div>
                          <p className="mt-1 truncate text-xs text-muted-foreground">
                            {formatDate(record.recordDate)} · {record.doctor?.name ?? "Unassigned"}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Add / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => (open ? setDialogOpen(true) : closeDialog())}>
        <DialogContent className="sm:max-w-xl">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              handleSave();
            }}
            className="space-y-4"
          >
            <DialogHeader>
              <DialogTitle>{editing ? "Edit Patient" : "Add Patient"}</DialogTitle>
              <DialogDescription>
                {editing ? `Update ${editing.name}'s profile details.` : "Register a new patient."}
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Name" required htmlFor="patient-name">
                <Input
                  id="patient-name"
                  value={form.name}
                  onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                  placeholder="Jane Doe"
                  required
                />
              </Field>

              <Field label="Email" required htmlFor="patient-email">
                <Input
                  id="patient-email"
                  type="email"
                  value={form.email}
                  onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
                  placeholder="jane.doe@email.com"
                  required
                />
              </Field>

              <Field label="Phone" required htmlFor="patient-phone">
                <Input
                  id="patient-phone"
                  value={form.phone}
                  onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
                  placeholder="+1 (555) 000-0000"
                  required
                />
              </Field>

              <Field label="Date of Birth" htmlFor="patient-dob">
                <Input
                  id="patient-dob"
                  type="date"
                  value={form.dateOfBirth}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, dateOfBirth: event.target.value }))
                  }
                />
              </Field>

              <Field label="Gender">
                <Select
                  value={form.gender}
                  onValueChange={(value) =>
                    setForm((prev) => ({ ...prev, gender: value as Gender }))
                  }
                >
                  <SelectTrigger className="w-full" aria-label="Select gender">
                    <SelectValue placeholder="Select gender" />
                  </SelectTrigger>
                  <SelectContent>
                    {GENDER_OPTIONS.map((gender) => (
                      <SelectItem key={gender} value={gender}>
                        {gender}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Blood Group">
                <Select
                  value={form.bloodGroup || "unknown"}
                  onValueChange={(value) =>
                    setForm((prev) => ({ ...prev, bloodGroup: value === "unknown" ? "" : value }))
                  }
                >
                  <SelectTrigger className="w-full" aria-label="Select blood group">
                    <SelectValue placeholder="Select blood group" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unknown">Unknown</SelectItem>
                    {BLOOD_GROUPS.map((group) => (
                      <SelectItem key={group} value={group}>
                        {group}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Address" className="sm:col-span-2">
                <Textarea
                  rows={2}
                  value={form.address}
                  onChange={(event) => setForm((prev) => ({ ...prev, address: event.target.value }))}
                  placeholder="Street, city, state…"
                />
              </Field>

              <Field label="Allergies" className="sm:col-span-2" htmlFor="patient-allergies">
                <Input
                  id="patient-allergies"
                  value={form.allergies}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, allergies: event.target.value }))
                  }
                  placeholder="e.g. Penicillin, or leave empty"
                />
              </Field>
            </div>

            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={closeDialog}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                {editing ? "Save Changes" : "Add Patient"}
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
            <AlertDialogTitle>Delete this patient?</AlertDialogTitle>
            <AlertDialogDescription>
              Deleting <span className="font-medium text-foreground">{deleting?.name}</span> also
              removes their appointments and medical records. This action cannot be undone.
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
