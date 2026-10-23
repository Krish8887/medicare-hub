"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Briefcase,
  Building2,
  CircleDollarSign,
  Loader2,
  Mail,
  Pencil,
  Phone,
  Plus,
  Search,
  Stethoscope,
  Star,
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
import { useToast } from "@/hooks/use-toast";
import { getInitials, getJSON, sendJSON } from "@/lib/medicare-api";
import {
  Department,
  Doctor,
  DoctorAvailability,
} from "@/lib/medicare-types";
import { cn } from "@/lib/utils";

/* ------------------------------ local helpers ----------------------------- */

const AVAILABILITY_OPTIONS: DoctorAvailability[] = ["Available", "On Leave", "Off Duty"];

const AVAILABILITY_STYLES: Record<DoctorAvailability, string> = {
  Available: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  "On Leave": "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  "Off Duty": "bg-rose-500/15 text-rose-700 dark:text-rose-400",
};

function AvailabilityBadge({ availability }: { availability: DoctorAvailability }) {
  return (
    <Badge
      variant="outline"
      className={cn("border-transparent", AVAILABILITY_STYLES[availability])}
    >
      {availability}
    </Badge>
  );
}

function MetaRow({
  icon: Icon,
  iconClassName,
  children,
}: {
  icon: LucideIcon;
  iconClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2 text-sm">
      <Icon
        className={cn("h-4 w-4 shrink-0 text-muted-foreground", iconClassName)}
        aria-hidden="true"
      />
      <span className="min-w-0 truncate text-muted-foreground">{children}</span>
    </div>
  );
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

function EmptyState({ title, hint }: { title: string; hint: string }) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center gap-2 py-16 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Stethoscope className="h-6 w-6" aria-hidden="true" />
        </div>
        <p className="font-medium">{title}</p>
        <p className="text-sm text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}

function DoctorSkeletonCard() {
  return (
    <Card className="p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Skeleton className="h-12 w-12 rounded-full" />
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
        <Skeleton className="h-5 w-20 rounded-full" />
      </div>
      <div className="mt-4 space-y-2.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-4 w-full" />
        ))}
      </div>
      <Skeleton className="mt-4 h-8 w-full" />
    </Card>
  );
}

interface DoctorFormState {
  name: string;
  email: string;
  phone: string;
  specialty: string;
  department: string;
  experience: string;
  rating: string;
  consultationFee: string;
  availability: DoctorAvailability;
}

interface DoctorBody {
  name: string;
  email: string;
  phone: string;
  specialty: string;
  department: string;
  experience: number;
  rating: number;
  consultationFee: number;
  availability: DoctorAvailability;
}

const EMPTY_DOCTOR_FORM: DoctorFormState = {
  name: "",
  email: "",
  phone: "",
  specialty: "",
  department: "",
  experience: "1",
  rating: "4.5",
  consultationFee: "100",
  availability: "Available",
};

function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

/* ------------------------------- the view --------------------------------- */

export default function DoctorsView() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [searchInput, setSearchInput] = useState("");
  const search = useDebouncedValue(searchInput);
  const [departmentFilter, setDepartmentFilter] = useState("all");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Doctor | null>(null);
  const [form, setForm] = useState<DoctorFormState>(EMPTY_DOCTOR_FORM);
  const [deleting, setDeleting] = useState<Doctor | null>(null);

  /* ------------------------------ data fetching ----------------------------- */

  const doctorsQuery = useQuery({
    queryKey: ["doctors", search, departmentFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      const trimmed = search.trim();
      if (trimmed) params.set("search", trimmed);
      if (departmentFilter !== "all") params.set("department", departmentFilter);
      const qs = params.toString();
      return getJSON<{ data: Doctor[] }>(`/api/doctors${qs ? `?${qs}` : ""}`);
    },
  });

  const departmentsQuery = useQuery({
    queryKey: ["departments"],
    queryFn: () => getJSON<{ data: Department[] }>("/api/departments"),
  });

  const doctors = doctorsQuery.data?.data ?? [];
  const departments = departmentsQuery.data?.data ?? [];

  /* -------------------------------- mutations ------------------------------- */

  const invalidateAfterChange = () => {
    queryClient.invalidateQueries({ queryKey: ["doctors"] });
    queryClient.invalidateQueries({ queryKey: ["doctors-list"] });
    queryClient.invalidateQueries({ queryKey: ["departments"] });
    queryClient.invalidateQueries({ queryKey: ["stats"] });
  };

  const createMutation = useMutation({
    mutationFn: (body: DoctorBody) => sendJSON<{ data: Doctor }>("/api/doctors", "POST", body),
    onSuccess: () => {
      toast({ title: "Doctor added", description: "The new doctor is now in the directory." });
      closeDialog();
      invalidateAfterChange();
    },
    onError: (error: Error) =>
      toast({ title: "Could not add doctor", description: error.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: DoctorBody }) =>
      sendJSON<{ data: Doctor }>(`/api/doctors/${id}`, "PUT", data),
    onSuccess: () => {
      toast({ title: "Doctor updated", description: "Your changes have been saved." });
      closeDialog();
      invalidateAfterChange();
    },
    onError: (error: Error) =>
      toast({ title: "Could not update doctor", description: error.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => sendJSON<{ success: boolean }>(`/api/doctors/${id}`, "DELETE"),
    onSuccess: () => {
      toast({ title: "Doctor deleted", description: "The doctor was removed from the directory." });
      setDeleting(null);
      invalidateAfterChange();
    },
    onError: (error: Error) =>
      toast({
        title: "Could not delete doctor",
        description: error.message.includes("existing appointments")
          ? `${error.message} — cancel those appointments first, then try again.`
          : error.message,
        variant: "destructive",
      }),
  });

  /* --------------------------------- actions -------------------------------- */

  const closeDialog = () => {
    setDialogOpen(false);
    setEditing(null);
  };

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_DOCTOR_FORM);
    setDialogOpen(true);
  };

  const openEdit = (doctor: Doctor) => {
    setEditing(doctor);
    setForm({
      name: doctor.name,
      email: doctor.email,
      phone: doctor.phone,
      specialty: doctor.specialty,
      department: doctor.department,
      experience: String(doctor.experience),
      rating: String(doctor.rating),
      consultationFee: String(doctor.consultationFee),
      availability: doctor.availability,
    });
    setDialogOpen(true);
  };

  const handleSave = () => {
    const missing = [form.name, form.email, form.phone, form.specialty].some((v) => !v.trim());
    if (missing || !form.department) {
      toast({
        title: "Missing information",
        description: "Please fill in name, email, phone, specialty and department.",
        variant: "destructive",
      });
      return;
    }
    const body: DoctorBody = {
      name: form.name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      specialty: form.specialty.trim(),
      department: form.department,
      experience: Math.max(1, Math.floor(Number(form.experience) || 1)),
      rating: Math.min(5, Math.max(0, Number(form.rating) || 0)),
      consultationFee: Math.max(0, Number(form.consultationFee) || 0),
      availability: form.availability,
    };
    if (editing) updateMutation.mutate({ id: editing.id, data: body });
    else createMutation.mutate(body);
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

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
              placeholder="Search name or specialty…"
              aria-label="Search doctors"
              className="pl-9"
            />
          </div>
          <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
            <SelectTrigger className="w-full sm:w-48" aria-label="Filter by department">
              <SelectValue placeholder="All departments" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All departments</SelectItem>
              {departments.map((department) => (
                <SelectItem key={department.id} value={department.name}>
                  {department.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={openCreate} className="shrink-0">
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add Doctor
        </Button>
      </div>

      {/* Error state */}
      {doctorsQuery.isError && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <p className="text-sm font-medium text-destructive">Failed to load doctors</p>
            <p className="max-w-md text-sm text-muted-foreground">
              {(doctorsQuery.error as Error).message}
            </p>
            <Button variant="outline" size="sm" onClick={() => doctorsQuery.refetch()}>
              Try again
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Loading state */}
      {doctorsQuery.isLoading && !doctorsQuery.isError && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <DoctorSkeletonCard key={i} />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!doctorsQuery.isLoading &&
        !doctorsQuery.isError &&
        doctors.length === 0 && (
          <EmptyState
            title="No doctors found"
            hint={
              search.trim() || departmentFilter !== "all"
                ? "Try adjusting the search or department filter."
                : "Add your first doctor to build the directory."
            }
          />
        )}

      {/* Data */}
      {!doctorsQuery.isLoading && !doctorsQuery.isError && doctors.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {doctors.map((doctor) => (
            <Card key={doctor.id} className="p-6">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar className="h-12 w-12">
                    <AvatarFallback className="bg-primary/10 text-sm font-semibold text-primary">
                      {getInitials(doctor.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{doctor.name}</p>
                    <p className="truncate text-sm text-muted-foreground">{doctor.specialty}</p>
                  </div>
                </div>
                <AvailabilityBadge availability={doctor.availability} />
              </div>

              <div className="mt-4 space-y-2.5">
                <MetaRow icon={Building2}>{doctor.department}</MetaRow>
                <MetaRow icon={Briefcase}>{doctor.experience} yrs experience</MetaRow>
                <MetaRow icon={Star} iconClassName="fill-amber-500 text-amber-500">
                  {doctor.rating.toFixed(1)} rating
                </MetaRow>
                <MetaRow icon={CircleDollarSign}>${doctor.consultationFee} consultation</MetaRow>
                <MetaRow icon={Mail}>{doctor.email}</MetaRow>
                <MetaRow icon={Phone}>{doctor.phone}</MetaRow>
              </div>

              <div className="mt-4 flex items-center justify-end gap-2 border-t pt-4">
                <Button variant="outline" size="sm" onClick={() => openEdit(doctor)}>
                  <Pencil className="h-4 w-4" aria-hidden="true" />
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => setDeleting(doctor)}
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                  Delete
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

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
              <DialogTitle>{editing ? "Edit Doctor" : "Add Doctor"}</DialogTitle>
              <DialogDescription>
                {editing
                  ? `Update ${editing.name}'s profile details.`
                  : "Add a new doctor to the directory."}
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Name" required htmlFor="doctor-name">
                <Input
                  id="doctor-name"
                  value={form.name}
                  onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                  placeholder="Dr. Jane Doe"
                  required
                />
              </Field>

              <Field label="Email" required htmlFor="doctor-email">
                <Input
                  id="doctor-email"
                  type="email"
                  value={form.email}
                  onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
                  placeholder="jane.doe@medicarehub.com"
                  required
                />
              </Field>

              <Field label="Phone" required htmlFor="doctor-phone">
                <Input
                  id="doctor-phone"
                  value={form.phone}
                  onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
                  placeholder="+1 (555) 000-0000"
                  required
                />
              </Field>

              <Field label="Specialty" required htmlFor="doctor-specialty">
                <Input
                  id="doctor-specialty"
                  value={form.specialty}
                  onChange={(event) => setForm((prev) => ({ ...prev, specialty: event.target.value }))}
                  placeholder="Cardiologist"
                  required
                />
              </Field>

              <Field label="Department" required>
                <Select
                  value={form.department}
                  onValueChange={(value) => setForm((prev) => ({ ...prev, department: value }))}
                >
                  <SelectTrigger className="w-full" aria-label="Select department">
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    {departmentsQuery.isLoading ? (
                      <SelectItem value="__loading" disabled>
                        Loading departments…
                      </SelectItem>
                    ) : departments.length === 0 ? (
                      <SelectItem value="__empty" disabled>
                        No departments available
                      </SelectItem>
                    ) : (
                      departments.map((department) => (
                        <SelectItem key={department.id} value={department.name}>
                          {department.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Experience (years)" required htmlFor="doctor-experience">
                <Input
                  id="doctor-experience"
                  type="number"
                  min={1}
                  value={form.experience}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, experience: event.target.value }))
                  }
                  required
                />
              </Field>

              <Field label="Rating (0–5)" htmlFor="doctor-rating">
                <Input
                  id="doctor-rating"
                  type="number"
                  min={0}
                  max={5}
                  step={0.1}
                  value={form.rating}
                  onChange={(event) => setForm((prev) => ({ ...prev, rating: event.target.value }))}
                />
              </Field>

              <Field label="Consultation Fee ($)" htmlFor="doctor-fee">
                <Input
                  id="doctor-fee"
                  type="number"
                  min={0}
                  value={form.consultationFee}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, consultationFee: event.target.value }))
                  }
                />
              </Field>

              <Field label="Availability">
                <Select
                  value={form.availability}
                  onValueChange={(value) =>
                    setForm((prev) => ({ ...prev, availability: value as DoctorAvailability }))
                  }
                >
                  <SelectTrigger className="w-full" aria-label="Select availability">
                    <SelectValue placeholder="Select availability" />
                  </SelectTrigger>
                  <SelectContent>
                    {AVAILABILITY_OPTIONS.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={closeDialog}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                {editing ? "Save Changes" : "Add Doctor"}
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
            <AlertDialogTitle>Delete this doctor?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove{" "}
              <span className="font-medium text-foreground">{deleting?.name}</span> from the
              directory. Doctors with existing appointments or medical records cannot be deleted.
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
