"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  Baby,
  Bone,
  Brain,
  Building2,
  HeartPulse,
  Loader2,
  MapPin,
  Phone,
  Plus,
  Sparkles,
  Stethoscope,
  Syringe,
  Trash2,
  UserCheck,
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
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { getJSON, sendJSON } from "@/lib/medicare-api";
import { Department } from "@/lib/medicare-types";

/* ------------------------------ local helpers ----------------------------- */

/** Icons cycled per card index (order roughly follows a hospital floor). */
const DEPARTMENT_ICONS: LucideIcon[] = [
  HeartPulse,
  Brain,
  Bone,
  Baby,
  Sparkles,
  Stethoscope,
  Activity,
  Syringe,
];

interface DepartmentFormState {
  name: string;
  description: string;
  headDoctor: string;
  location: string;
  phone: string;
}

interface DepartmentCreateBody {
  name: string;
  description: string | null;
  headDoctor: string | null;
  location: string | null;
  phone: string | null;
}

function emptyDepartmentForm(): DepartmentFormState {
  return { name: "", description: "", headDoctor: "", location: "", phone: "" };
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

function MetaRow({ icon: Icon, value }: { icon: LucideIcon; value: string }) {
  return (
    <div className="flex items-center gap-2 text-muted-foreground">
      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="min-w-0 truncate">{value}</span>
    </div>
  );
}

/* ------------------------------- the view --------------------------------- */

export default function DepartmentsView() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<DepartmentFormState>(emptyDepartmentForm);
  const [deleting, setDeleting] = useState<Department | null>(null);

  /* ------------------------------ data fetching ----------------------------- */

  const departmentsQuery = useQuery({
    queryKey: ["departments"],
    queryFn: () => getJSON<{ data: Department[] }>("/api/departments"),
  });

  const departments = departmentsQuery.data?.data ?? [];

  /* -------------------------------- mutations ------------------------------- */

  const invalidateAfterChange = () => {
    queryClient.invalidateQueries({ queryKey: ["departments"] });
    queryClient.invalidateQueries({ queryKey: ["stats"] });
  };

  const createMutation = useMutation({
    mutationFn: (body: DepartmentCreateBody) =>
      sendJSON<{ data: Department }>("/api/departments", "POST", body),
    onSuccess: () => {
      toast({
        title: "Department added",
        description: "The new department is now part of the hospital directory.",
      });
      setFormOpen(false);
      setForm(emptyDepartmentForm());
      invalidateAfterChange();
    },
    onError: (error: Error) =>
      toast({
        title: "Could not add department",
        description: error.message,
        variant: "destructive",
      }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => sendJSON<{ success: boolean }>(`/api/departments/${id}`, "DELETE"),
    onSuccess: () => {
      toast({ title: "Department deleted", description: "The department was removed." });
      setDeleting(null);
      invalidateAfterChange();
    },
    onError: (error: Error) =>
      toast({
        title: "Could not delete department",
        description: error.message,
        variant: "destructive",
      }),
  });

  /* --------------------------------- actions -------------------------------- */

  const openCreate = () => {
    setForm(emptyDepartmentForm());
    setFormOpen(true);
  };

  const handleCreate = () => {
    if (!form.name.trim()) {
      toast({
        title: "Missing information",
        description: "Please enter a department name.",
        variant: "destructive",
      });
      return;
    }
    createMutation.mutate({
      name: form.name.trim(),
      description: form.description.trim() || null,
      headDoctor: form.headDoctor.trim() || null,
      location: form.location.trim() || null,
      phone: form.phone.trim() || null,
    });
  };

  const isLoading = departmentsQuery.isLoading;

  /* ---------------------------------- render -------------------------------- */

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {isLoading
            ? "Loading departments…"
            : `${departments.length} ${departments.length === 1 ? "department" : "departments"} across the hospital`}
        </p>
        <Button onClick={openCreate} className="shrink-0">
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add Department
        </Button>
      </div>

      {/* Error state */}
      {departmentsQuery.isError && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <p className="text-sm font-medium text-destructive">Failed to load departments</p>
            <p className="max-w-md text-sm text-muted-foreground">
              {(departmentsQuery.error as Error).message}
            </p>
            <Button variant="outline" size="sm" onClick={() => departmentsQuery.refetch()}>
              Try again
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Loading state */}
      {isLoading && !departmentsQuery.isError && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="p-6">
              <div className="flex items-start justify-between gap-3">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <Skeleton className="h-5 w-24 rounded-full" />
              </div>
              <Skeleton className="mt-3 h-5 w-32" />
              <Skeleton className="mt-2 h-3 w-full" />
              <Skeleton className="mt-1.5 h-3 w-4/5" />
              <div className="mt-4 space-y-2.5">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-4 w-1/2" />
              </div>
              <Skeleton className="mt-6 h-8 w-20 self-end" />
            </Card>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !departmentsQuery.isError && departments.length === 0 && (
        <EmptyState
          icon={Building2}
          title="No departments"
          hint="Add your first department to organize doctors and services."
        />
      )}

      {/* Data */}
      {!isLoading && !departmentsQuery.isError && departments.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {departments.map((department, index) => {
            const Icon = DEPARTMENT_ICONS[index % DEPARTMENT_ICONS.length]!;
            const doctorCount = department.doctorCount ?? 0;
            return (
              <Card key={department.id} className="flex flex-col p-6">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <Badge variant="secondary">
                    {doctorCount} {doctorCount === 1 ? "doctor" : "doctors"}
                  </Badge>
                </div>

                <h3 className="mt-3 font-semibold leading-snug">{department.name}</h3>
                <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">
                  {department.description || "No description provided."}
                </p>

                <div className="mt-4 flex-1 space-y-2.5 text-sm">
                  <MetaRow icon={MapPin} value={department.location || "—"} />
                  <MetaRow icon={UserCheck} value={department.headDoctor || "Unassigned"} />
                  <MetaRow icon={Phone} value={department.phone || "—"} />
                </div>

                <div className="mt-4 flex justify-end border-t pt-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    aria-label={`Delete ${department.name}`}
                    onClick={() => setDeleting(department)}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                    Delete
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add department dialog */}
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
              <DialogTitle>Add Department</DialogTitle>
              <DialogDescription>
                Create a new hospital department to group doctors and services.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Name" required htmlFor="department-name" className="sm:col-span-2">
                <Input
                  id="department-name"
                  required
                  placeholder="e.g. Cardiology"
                  value={form.name}
                  onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                />
              </Field>

              <Field label="Description" className="sm:col-span-2">
                <Textarea
                  rows={3}
                  placeholder="What this department treats and provides…"
                  value={form.description}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, description: event.target.value }))
                  }
                />
              </Field>

              <Field label="Head Doctor" htmlFor="department-head">
                <Input
                  id="department-head"
                  placeholder="e.g. Dr. Sarah Mitchell"
                  value={form.headDoctor}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, headDoctor: event.target.value }))
                  }
                />
              </Field>

              <Field label="Location" htmlFor="department-location">
                <Input
                  id="department-location"
                  placeholder="Block A, Floor 1"
                  value={form.location}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, location: event.target.value }))
                  }
                />
              </Field>

              <Field label="Phone" htmlFor="department-phone" className="sm:col-span-2">
                <Input
                  id="department-phone"
                  type="tel"
                  placeholder="+1 (555) 000-0000"
                  value={form.phone}
                  onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
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
                Add Department
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
            <AlertDialogTitle>Delete this department?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting
                ? `"${deleting.name}" will be permanently removed from the directory. This cannot be undone.`
                : "This department will be permanently removed."}
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
