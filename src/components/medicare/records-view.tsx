"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  Eye,
  FileHeart,
  Loader2,
  MoreHorizontal,
  Plus,
  Search,
  Trash2,
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
  formatShortDate,
  getInitials,
  getJSON,
  sendJSON,
} from "@/lib/medicare-api";
import {
  Doctor,
  MedicalRecord,
  Patient,
  VisitType,
} from "@/lib/medicare-types";

/* ------------------------------ local helpers ----------------------------- */

const VISIT_TYPES: VisitType[] = ["Consultation", "Follow-up", "Emergency", "Surgery"];

/** Sentinel for the "All patients" filter (Radix SelectItem forbids value=""). */
const PATIENT_ALL = "all";

interface RecordFormState {
  patientId: string;
  doctorId: string;
  diagnosis: string;
  visitType: VisitType;
  recordDate: string;
  prescription: string;
  treatment: string;
  notes: string;
}

interface RecordCreateBody {
  patientId: string;
  doctorId: string;
  diagnosis: string;
  visitType: VisitType;
  recordDate: string;
  prescription: string | null;
  treatment: string | null;
  notes: string | null;
}

function todayISO(): string {
  return format(new Date(), "yyyy-MM-dd");
}

function emptyRecordForm(): RecordFormState {
  return {
    patientId: "",
    doctorId: "",
    diagnosis: "",
    visitType: "Consultation",
    recordDate: todayISO(),
    prescription: "",
    treatment: "",
    notes: "",
  };
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

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
      <div className="whitespace-pre-line rounded-lg bg-muted/50 p-3 text-sm">{children}</div>
    </div>
  );
}

function VisitTypeBadge({ visitType }: { visitType: VisitType }) {
  return (
    <Badge variant="outline" className="border-muted-foreground/30 text-muted-foreground">
      {visitType}
    </Badge>
  );
}

/* ------------------------------- the view --------------------------------- */

export default function RecordsView() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [searchInput, setSearchInput] = useState("");
  const search = useDebouncedValue(searchInput);
  const [patientFilter, setPatientFilter] = useState<string>(PATIENT_ALL);

  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<RecordFormState>(emptyRecordForm);

  const [viewing, setViewing] = useState<MedicalRecord | null>(null);
  const [deleting, setDeleting] = useState<MedicalRecord | null>(null);

  /* ------------------------------ data fetching ----------------------------- */

  const recordsQuery = useQuery({
    queryKey: ["records", search, patientFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      const trimmed = search.trim();
      if (trimmed) params.set("search", trimmed);
      if (patientFilter !== PATIENT_ALL) params.set("patientId", patientFilter);
      const qs = params.toString();
      return getJSON<{ data: MedicalRecord[] }>(`/api/records${qs ? `?${qs}` : ""}`);
    },
  });

  const patientsQuery = useQuery({
    queryKey: ["patients-list"],
    queryFn: () => getJSON<{ data: Patient[] }>("/api/patients"),
  });

  const doctorsQuery = useQuery({
    queryKey: ["doctors-list"],
    queryFn: () => getJSON<{ data: Doctor[] }>("/api/doctors"),
  });

  const records = recordsQuery.data?.data ?? [];
  const patients = patientsQuery.data?.data ?? [];
  const doctors = doctorsQuery.data?.data ?? [];
  const today = todayISO();

  /* -------------------------------- mutations ------------------------------- */

  const invalidateAfterChange = () => {
    queryClient.invalidateQueries({ queryKey: ["records"] });
    queryClient.invalidateQueries({ queryKey: ["stats"] });
  };

  const createMutation = useMutation({
    mutationFn: (body: RecordCreateBody) =>
      sendJSON<{ data: MedicalRecord }>("/api/records", "POST", body),
    onSuccess: () => {
      toast({
        title: "Medical record created",
        description: "The record has been added to the patient's history.",
      });
      setFormOpen(false);
      setForm(emptyRecordForm());
      invalidateAfterChange();
    },
    onError: (error: Error) =>
      toast({
        title: "Could not create record",
        description: error.message,
        variant: "destructive",
      }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => sendJSON<{ success: boolean }>(`/api/records/${id}`, "DELETE"),
    onSuccess: () => {
      toast({ title: "Medical record deleted", description: "The record was removed." });
      setDeleting(null);
      invalidateAfterChange();
    },
    onError: (error: Error) =>
      toast({
        title: "Could not delete record",
        description: error.message,
        variant: "destructive",
      }),
  });

  /* --------------------------------- actions -------------------------------- */

  const openCreate = () => {
    setForm(emptyRecordForm());
    setFormOpen(true);
  };

  const handleCreate = () => {
    if (!form.patientId || !form.doctorId || !form.diagnosis.trim() || !form.recordDate) {
      toast({
        title: "Missing information",
        description: "Please select a patient and doctor, and enter a diagnosis.",
        variant: "destructive",
      });
      return;
    }
    createMutation.mutate({
      patientId: form.patientId,
      doctorId: form.doctorId,
      diagnosis: form.diagnosis.trim(),
      visitType: form.visitType,
      recordDate: new Date(form.recordDate).toISOString(),
      prescription: form.prescription.trim() || null,
      treatment: form.treatment.trim() || null,
      notes: form.notes.trim() || null,
    });
  };

  const isLoading = recordsQuery.isLoading;
  const hasFilters = patientFilter !== PATIENT_ALL || search.trim().length > 0;

  /* ---------------------------------- render -------------------------------- */

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-full max-w-xs">
            <Search
              className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search diagnosis…"
              aria-label="Search medical records by diagnosis"
              className="pl-9"
            />
          </div>
          <Select value={patientFilter} onValueChange={setPatientFilter}>
            <SelectTrigger className="w-full sm:w-48" aria-label="Filter by patient">
              <SelectValue placeholder="All patients" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={PATIENT_ALL}>All patients</SelectItem>
              {patients.map((patient) => (
                <SelectItem key={patient.id} value={patient.id}>
                  {patient.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={openCreate} className="shrink-0">
          <Plus className="h-4 w-4" aria-hidden="true" />
          New Record
        </Button>
      </div>

      {/* Error state */}
      {recordsQuery.isError && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <p className="text-sm font-medium text-destructive">Failed to load medical records</p>
            <p className="max-w-md text-sm text-muted-foreground">
              {(recordsQuery.error as Error).message}
            </p>
            <Button variant="outline" size="sm" onClick={() => recordsQuery.refetch()}>
              Try again
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Loading state */}
      {isLoading && !recordsQuery.isError && (
        <>
          <Card className="hidden gap-0 overflow-hidden py-0 md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  {["Patient", "Diagnosis", "Doctor", "Visit Type", "Date", "Prescription", ""].map(
                    (head, i) => (
                      <TableHead key={i}>{head}</TableHead>
                    )
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from({ length: 6 }).map((_, rowIndex) => (
                  <TableRow key={rowIndex}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Skeleton className="h-9 w-9 rounded-full" />
                        <Skeleton className="h-4 w-24" />
                      </div>
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-36" />
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1.5">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-3 w-20" />
                      </div>
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-5 w-20 rounded-full" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-16" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-28" />
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
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-28" />
                  </div>
                  <Skeleton className="h-5 w-20 rounded-full" />
                </div>
                <Skeleton className="mt-3 h-3 w-32" />
                <Skeleton className="mt-3 h-8 w-full" />
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Empty state */}
      {!isLoading && !recordsQuery.isError && records.length === 0 && (
        <EmptyState
          icon={FileHeart}
          title="No medical records found"
          hint={
            hasFilters
              ? "Try adjusting the patient filter or search term."
              : "Create the first medical record to get started."
          }
        />
      )}

      {/* Data */}
      {!isLoading && !recordsQuery.isError && records.length > 0 && (
        <>
          {/* Desktop table */}
          <Card className="hidden gap-0 overflow-hidden py-0 md:block [&>div]:max-h-[65vh] [&>div]:overflow-y-auto">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-muted/70 backdrop-blur">
                <TableRow>
                  <TableHead>Patient</TableHead>
                  <TableHead>Diagnosis</TableHead>
                  <TableHead>Doctor</TableHead>
                  <TableHead>Visit Type</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Prescription</TableHead>
                  <TableHead className="w-12">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                          <AvatarFallback className="bg-primary/10 text-xs font-medium text-primary">
                            {getInitials(record.patient?.name)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="max-w-[140px] truncate font-medium">
                          {record.patient?.name ?? "Unknown"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="max-w-[220px] truncate font-medium">{record.diagnosis}</div>
                    </TableCell>
                    <TableCell>
                      <div className="min-w-0">
                        <p className="truncate font-medium">{record.doctor?.name ?? "—"}</p>
                        {record.doctor?.specialty && (
                          <p className="truncate text-xs text-muted-foreground">
                            {record.doctor.specialty}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <VisitTypeBadge visitType={record.visitType} />
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {formatShortDate(record.recordDate)}
                    </TableCell>
                    <TableCell>
                      <div className="max-w-[180px] truncate text-muted-foreground">
                        {record.prescription || "—"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            aria-label={`Actions for record: ${record.diagnosis}`}
                          >
                            <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem onClick={() => setViewing(record)}>
                            <Eye className="h-4 w-4" aria-hidden="true" />
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem variant="destructive" onClick={() => setDeleting(record)}>
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                            Delete
                          </DropdownMenuItem>
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
            {records.map((record) => (
              <Card key={record.id} className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-primary/10 text-sm font-medium text-primary">
                        {getInitials(record.patient?.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="truncate font-medium">{record.diagnosis}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {record.patient?.name ?? "Unknown"} · {record.doctor?.name ?? "—"}
                      </p>
                    </div>
                  </div>
                  <VisitTypeBadge visitType={record.visitType} />
                </div>

                <div className="mt-3 space-y-1 text-sm">
                  <p className="text-muted-foreground">{formatShortDate(record.recordDate)}</p>
                  {record.prescription && (
                    <p className="line-clamp-2 text-muted-foreground">
                      <span className="font-medium text-foreground">Rx:</span> {record.prescription}
                    </p>
                  )}
                </div>

                <div className="mt-3 flex items-center justify-end gap-1 border-t pt-3">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9"
                    aria-label="View record details"
                    onClick={() => setViewing(record)}
                  >
                    <Eye className="h-4 w-4" aria-hidden="true" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 text-destructive"
                    aria-label="Delete record"
                    onClick={() => setDeleting(record)}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </div>
              </Card>
            ))}
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
        <DialogContent className="sm:max-w-xl">
          <div className="max-h-[70vh] overflow-y-auto scrollbar-thin pr-1">
            {viewing && (
              <>
                <DialogHeader>
                  <div className="flex flex-wrap items-center gap-2 pr-6">
                    <DialogTitle className="text-left leading-snug">{viewing.diagnosis}</DialogTitle>
                    <VisitTypeBadge visitType={viewing.visitType} />
                  </div>
                  <DialogDescription className="text-left">
                    Recorded on {formatDate(viewing.recordDate)}
                  </DialogDescription>
                </DialogHeader>

                <div className="mt-4 space-y-4">
                  <div className="grid gap-3 rounded-lg border p-3 text-sm sm:grid-cols-2">
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">Patient</p>
                      <div className="mt-1 flex items-center gap-2">
                        <Avatar className="h-6 w-6">
                          <AvatarFallback className="bg-primary/10 text-[10px] font-medium text-primary">
                            {getInitials(viewing.patient?.name)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="truncate font-medium">
                          {viewing.patient?.name ?? "Unknown"}
                        </span>
                      </div>
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">Doctor</p>
                      <div className="mt-1 truncate font-medium">
                        {viewing.doctor?.name ?? "Unknown"}
                        {viewing.doctor?.specialty && (
                          <span className="font-normal text-muted-foreground">
                            {" "}
                            · {viewing.doctor.specialty}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <DetailSection title="Prescription">
                    {viewing.prescription || "No prescription recorded"}
                  </DetailSection>
                  <DetailSection title="Treatment Plan">
                    {viewing.treatment || "Not specified"}
                  </DetailSection>
                  <DetailSection title="Notes">{viewing.notes || "—"}</DetailSection>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* New record dialog */}
      <Dialog
        open={formOpen}
        onOpenChange={(open) => {
          if (!open) setFormOpen(false);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              handleCreate();
            }}
            className="space-y-4"
          >
            <DialogHeader>
              <DialogTitle>New Medical Record</DialogTitle>
              <DialogDescription>
                Document a patient visit, its diagnosis and the prescribed treatment.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Patient" required className="sm:col-span-2">
                <Select
                  value={form.patientId}
                  onValueChange={(value) => setForm((prev) => ({ ...prev, patientId: value }))}
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
                  value={form.doctorId}
                  onValueChange={(value) => setForm((prev) => ({ ...prev, doctorId: value }))}
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

              <Field label="Diagnosis" required htmlFor="record-diagnosis" className="sm:col-span-2">
                <Input
                  id="record-diagnosis"
                  required
                  placeholder="e.g. Type 2 diabetes mellitus"
                  value={form.diagnosis}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, diagnosis: event.target.value }))
                  }
                />
              </Field>

              <Field label="Visit Type" required>
                <Select
                  value={form.visitType}
                  onValueChange={(value) =>
                    setForm((prev) => ({ ...prev, visitType: value as VisitType }))
                  }
                >
                  <SelectTrigger className="w-full" aria-label="Select visit type">
                    <SelectValue placeholder="Select visit type" />
                  </SelectTrigger>
                  <SelectContent>
                    {VISIT_TYPES.map((visitType) => (
                      <SelectItem key={visitType} value={visitType}>
                        {visitType}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Record Date" required htmlFor="record-date">
                <Input
                  id="record-date"
                  type="date"
                  required
                  max={today}
                  value={form.recordDate}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, recordDate: event.target.value }))
                  }
                />
              </Field>

              <Field label="Prescription" className="sm:col-span-2">
                <Textarea
                  rows={2}
                  placeholder="Medications and dosage…"
                  value={form.prescription}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, prescription: event.target.value }))
                  }
                />
              </Field>

              <Field label="Treatment Plan" className="sm:col-span-2">
                <Textarea
                  rows={2}
                  placeholder="Recommended treatment and follow-up…"
                  value={form.treatment}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, treatment: event.target.value }))
                  }
                />
              </Field>

              <Field label="Notes" className="sm:col-span-2">
                <Textarea
                  rows={2}
                  placeholder="Additional notes (optional)"
                  value={form.notes}
                  onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
                />
              </Field>
            </div>

            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending && (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                )}
                Create Record
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
            <AlertDialogTitle>Delete this medical record?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting
                ? `The record "${deleting.diagnosis}" for ${
                    deleting.patient?.name ?? "this patient"
                  } will be permanently removed. This cannot be undone.`
                : "This medical record will be permanently removed."}
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
