"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addDays, format } from "date-fns";
import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  HandCoins,
  Hourglass,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  Printer,
  ReceiptText,
  Search,
  Send,
  Trash2,
  Wallet,
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
import { Separator } from "@/components/ui/separator";
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
import { InvoiceStatusBadge } from "@/components/medicare/status-badge";
import { useToast } from "@/hooks/use-toast";
import {
  formatCurrency,
  formatDate,
  formatShortDate,
  getInitials,
  getJSON,
  sendJSON,
} from "@/lib/medicare-api";
import {
  type Invoice,
  type InvoiceDisplayStatus,
  type InvoiceStatus,
  type Patient,
  PAYMENT_METHODS,
  type PaymentMethod,
} from "@/lib/medicare-types";
import { cn } from "@/lib/utils";

/* ------------------------------ local helpers ----------------------------- */

type StatusFilter = "All" | InvoiceDisplayStatus;

const STATUS_TABS: { value: StatusFilter; label: string }[] = [
  { value: "All", label: "All" },
  { value: "Draft", label: "Draft" },
  { value: "Pending", label: "Pending" },
  { value: "Overdue", label: "Overdue" },
  { value: "Paid", label: "Paid" },
  { value: "Cancelled", label: "Cancelled" },
];

function todayISO(): string {
  return format(new Date(), "yyyy-MM-dd");
}

function balanceDue(invoice: Pick<Invoice, "total" | "amountPaid">): number {
  return Math.round(Math.max(invoice.total - invoice.amountPaid, 0) * 100) / 100;
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

function StatCard({
  label,
  value,
  caption,
  icon: Icon,
  tint,
}: {
  label: string;
  value: string;
  caption: string;
  icon: LucideIcon;
  tint: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-1 truncate text-2xl font-bold tracking-tight">{value}</p>
          <p className="mt-2 truncate text-xs text-muted-foreground">{caption}</p>
        </div>
        <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", tint)}>
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
      </CardContent>
    </Card>
  );
}

interface RowAction {
  key: string;
  label: string;
  icon: LucideIcon;
  destructive?: boolean;
  separator?: boolean;
  onSelect: () => void;
}

/* --------------------------- invoice form dialog -------------------------- */

interface LineItemRow {
  description: string;
  quantity: string;
  unitPrice: string;
}

interface InvoiceFormValues {
  patientId: string;
  items: LineItemRow[];
  taxRate: string;
  discount: string;
  status: Extract<InvoiceStatus, "Draft" | "Pending">;
  issueDate: string;
  dueDate: string;
  notes: string;
}

export interface InvoiceSubmitBody {
  patientId: string;
  items: { description: string; quantity: number; unitPrice: number }[];
  taxRate: number;
  discount: number;
  status: "Draft" | "Pending";
  issueDate: string;
  dueDate: string;
  notes: string | null;
}

const emptyRow: LineItemRow = { description: "", quantity: "1", unitPrice: "" };

function emptyForm(today: string): InvoiceFormValues {
  return {
    patientId: "",
    items: [{ ...emptyRow }],
    taxRate: "0",
    discount: "0",
    status: "Pending",
    issueDate: today,
    dueDate: format(addDays(new Date(), 14), "yyyy-MM-dd"),
    notes: "",
  };
}

function formFromInvoice(invoice: Invoice): InvoiceFormValues {
  return {
    patientId: invoice.patientId,
    items:
      invoice.items.length > 0
        ? invoice.items.map((it) => ({
            description: it.description,
            quantity: String(it.quantity),
            unitPrice: String(it.unitPrice),
          }))
        : [{ ...emptyRow }],
    taxRate: String(invoice.taxRate),
    discount: String(invoice.discount),
    status: invoice.status === "Draft" ? "Draft" : "Pending",
    issueDate: invoice.issueDate,
    dueDate: invoice.dueDate,
    notes: invoice.notes ?? "",
  };
}

function parseMoney(value: string): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function InvoiceFormDialog({
  open,
  onOpenChange,
  patients,
  patientsLoading,
  initial,
  pending,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patients: Patient[];
  patientsLoading: boolean;
  initial: Invoice | null;
  pending: boolean;
  onSubmit: (body: InvoiceSubmitBody) => void;
}) {
  const { toast } = useToast();
  const [form, setForm] = useState<InvoiceFormValues>(() =>
    initial ? formFromInvoice(initial) : emptyForm(todayISO())
  );

  const parsedItems = form.items
    .map((row) => ({
      description: row.description.trim(),
      quantity: Math.floor(Number(row.quantity)),
      unitPrice: Number(row.unitPrice),
    }))
    .filter((item) => item.description.length > 0);

  const subtotal = parsedItems.reduce((sum, it) => sum + it.quantity * it.unitPrice, 0);
  const taxAmount = (subtotal * parseMoney(form.taxRate)) / 100;
  const discount = parseMoney(form.discount);
  const total = subtotal + taxAmount - discount;

  const updateItem = (idx: number, patch: Partial<LineItemRow>) =>
    setForm((prev) => ({
      ...prev,
      items: prev.items.map((it, i) => (i === idx ? { ...it, ...patch } : it)),
    }));

  const handleSubmit = () => {
    if (!form.patientId) {
      toast({ title: "Missing information", description: "Please select a patient.", variant: "destructive" });
      return;
    }
    if (parsedItems.length === 0) {
      toast({
        title: "Missing information",
        description: "Add at least one line item with a description.",
        variant: "destructive",
      });
      return;
    }
    const invalidItem = parsedItems.find((it) => it.quantity < 1 || it.unitPrice < 0 || !Number.isFinite(it.unitPrice));
    if (invalidItem) {
      toast({
        title: "Invalid line item",
        description: "Quantities must be at least 1 and unit prices cannot be negative.",
        variant: "destructive",
      });
      return;
    }
    if (!form.issueDate || !form.dueDate) {
      toast({ title: "Missing information", description: "Please pick an issue date and a due date.", variant: "destructive" });
      return;
    }
    onSubmit({
      patientId: form.patientId,
      items: parsedItems,
      taxRate: parseMoney(form.taxRate),
      discount: parseMoney(form.discount),
      status: form.status,
      issueDate: form.issueDate,
      dueDate: form.dueDate,
      notes: form.notes.trim() || null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            handleSubmit();
          }}
          className="space-y-4"
        >
          <DialogHeader>
            <DialogTitle>{initial ? `Edit ${initial.invoiceNumber}` : "New Invoice"}</DialogTitle>
            <DialogDescription>
              {initial
                ? "Update the draft or pending invoice details."
                : "Bill a patient for services — totals are calculated automatically."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Patient" required className="sm:col-span-3">
              <Select
                value={form.patientId}
                onValueChange={(value) => setForm((prev) => ({ ...prev, patientId: value }))}
              >
                <SelectTrigger className="w-full" aria-label="Select patient">
                  <SelectValue placeholder="Select patient" />
                </SelectTrigger>
                <SelectContent>
                  {patientsLoading ? (
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

            <Field label="Issue Date" required htmlFor="invoice-issue-date">
              <Input
                id="invoice-issue-date"
                type="date"
                required
                value={form.issueDate}
                onChange={(event) => setForm((prev) => ({ ...prev, issueDate: event.target.value }))}
              />
            </Field>

            <Field label="Due Date" required htmlFor="invoice-due-date">
              <Input
                id="invoice-due-date"
                type="date"
                required
                value={form.dueDate}
                onChange={(event) => setForm((prev) => ({ ...prev, dueDate: event.target.value }))}
              />
            </Field>

            <Field label="Save as">
              <Select
                value={form.status}
                onValueChange={(value) =>
                  setForm((prev) => ({ ...prev, status: value as InvoiceFormValues["status"] }))
                }
              >
                <SelectTrigger className="w-full" aria-label="Select invoice status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Pending">Pending — send to patient</SelectItem>
                  <SelectItem value="Draft">Draft — keep unsent</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>

          {/* Line items */}
          <div className="space-y-2">
            <div className="hidden items-center gap-2 px-0.5 text-xs font-medium text-muted-foreground sm:grid sm:grid-cols-[minmax(0,1fr)_5rem_7rem_6.5rem_2.5rem]">
              <span>Description</span>
              <span className="text-right">Qty</span>
              <span className="text-right">Unit Price</span>
              <span className="text-right">Amount</span>
              <span />
            </div>
            {form.items.map((row, idx) => {
              const amount = (Number(row.quantity) || 0) * (Number(row.unitPrice) || 0);
              return (
                <div
                  key={idx}
                  className="grid grid-cols-2 items-center gap-2 rounded-lg border p-2 sm:grid-cols-[minmax(0,1fr)_5rem_7rem_6.5rem_2.5rem] sm:border-0 sm:p-0"
                >
                  <Input
                    value={row.description}
                    onChange={(event) => updateItem(idx, { description: event.target.value })}
                    placeholder="e.g. Consultation, lab test…"
                    aria-label={`Item ${idx + 1} description`}
                    className="col-span-2 sm:col-span-1"
                  />
                  <Input
                    type="number"
                    min={1}
                    step={1}
                    value={row.quantity}
                    onChange={(event) => updateItem(idx, { quantity: event.target.value })}
                    placeholder="Qty"
                    aria-label={`Item ${idx + 1} quantity`}
                    className="text-right"
                  />
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={row.unitPrice}
                    onChange={(event) => updateItem(idx, { unitPrice: event.target.value })}
                    placeholder="0.00"
                    aria-label={`Item ${idx + 1} unit price`}
                    className="text-right"
                  />
                  <span className="text-right text-sm font-medium tabular-nums" aria-label={`Item ${idx + 1} amount`}>
                    {formatCurrency(amount)}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 justify-self-end text-muted-foreground hover:text-destructive"
                    aria-label={`Remove item ${idx + 1}`}
                    disabled={form.items.length === 1}
                    onClick={() => setForm((prev) => ({ ...prev, items: prev.items.filter((_, i) => i !== idx) }))}
                  >
                    <XCircle className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </div>
              );
            })}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setForm((prev) => ({ ...prev, items: [...prev.items, { ...emptyRow }] }))}
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Add Line Item
            </Button>
          </div>

          {/* Adjustments + totals */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Tax Rate %" htmlFor="invoice-tax">
                <Input
                  id="invoice-tax"
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  value={form.taxRate}
                  onChange={(event) => setForm((prev) => ({ ...prev, taxRate: event.target.value }))}
                />
              </Field>
              <Field label="Discount $" htmlFor="invoice-discount">
                <Input
                  id="invoice-discount"
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.discount}
                  onChange={(event) => setForm((prev) => ({ ...prev, discount: event.target.value }))}
                />
              </Field>
            </div>
            <div className="space-y-1.5 self-end rounded-lg border bg-muted/40 p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="tabular-nums">{formatCurrency(subtotal)}</span>
              </div>
              {parseMoney(form.taxRate) > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tax ({form.taxRate}%)</span>
                  <span className="tabular-nums">{formatCurrency(taxAmount)}</span>
                </div>
              )}
              {discount > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Discount</span>
                  <span className="tabular-nums">-{formatCurrency(discount)}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between font-semibold">
                <span>Total</span>
                <span className={cn("tabular-nums", total < 0 && "text-destructive")}>
                  {formatCurrency(Math.max(total, 0))}
                </span>
              </div>
            </div>
          </div>

          <Field label="Notes">
            <Textarea
              rows={2}
              placeholder="Payment terms, reminders or other notes (optional)"
              value={form.notes}
              onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
            />
          </Field>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {initial ? "Save Changes" : form.status === "Draft" ? "Save Draft" : "Create Invoice"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------- the view --------------------------------- */

export default function BillingView() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("All");
  const [searchInput, setSearchInput] = useState("");
  const [debouncedTimer, setDebouncedTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [search, setSearch] = useState("");
  const handleSearchChange = (value: string) => {
    setSearchInput(value);
    if (debouncedTimer) clearTimeout(debouncedTimer);
    setDebouncedTimer(setTimeout(() => setSearch(value), 300));
  };

  const [formOpen, setFormOpen] = useState(false);
  const [formInvoice, setFormInvoice] = useState<Invoice | null>(null);

  const [detailId, setDetailId] = useState<string | null>(null);
  const [payOpen, setPayOpen] = useState(false);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState<PaymentMethod>("Card");
  const [payNote, setPayNote] = useState("");

  const [deleting, setDeleting] = useState<Invoice | null>(null);

  /* ------------------------------ data fetching ----------------------------- */

  const invoicesQuery = useQuery({
    queryKey: ["invoices"],
    queryFn: () => getJSON<{ data: Invoice[] }>("/api/billing"),
  });

  const patientsQuery = useQuery({
    queryKey: ["patients-list"],
    queryFn: () => getJSON<{ data: Patient[] }>("/api/patients"),
  });

  const invoices = invoicesQuery.data?.data ?? [];
  const patients = patientsQuery.data?.data ?? [];
  const today = todayISO();

  const detailInvoice = detailId ? invoices.find((inv) => inv.id === detailId) ?? null : null;

  const filtered = invoices.filter((inv) => {
    if (statusFilter !== "All" && inv.displayStatus !== statusFilter) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      inv.invoiceNumber.toLowerCase().includes(q) ||
      (inv.patient?.name ?? "").toLowerCase().includes(q)
    );
  });

  /* --------------------------------- stats ---------------------------------- */

  const activeInvoices = invoices.filter((inv) => inv.status !== "Cancelled");
  const totalBilled = activeInvoices.reduce((sum, inv) => sum + inv.total, 0);
  const collected = activeInvoices.reduce((sum, inv) => sum + Math.min(inv.amountPaid, inv.total), 0);
  const unpaidInvoices = invoices.filter(
    (inv) => inv.displayStatus === "Pending" || inv.displayStatus === "Overdue"
  );
  const outstanding = unpaidInvoices.reduce((sum, inv) => sum + balanceDue(inv), 0);
  const overdueInvoices = invoices.filter((inv) => inv.displayStatus === "Overdue");
  const overdueAmount = overdueInvoices.reduce((sum, inv) => sum + balanceDue(inv), 0);
  const collectionRate = totalBilled > 0 ? Math.round((collected / totalBilled) * 100) : 0;

  /* -------------------------------- mutations ------------------------------- */

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["invoices"] });
  };

  const createMutation = useMutation({
    mutationFn: (body: InvoiceSubmitBody) =>
      sendJSON<{ data: Invoice }>("/api/billing", "POST", body),
    onSuccess: () => {
      toast({ title: "Invoice created", description: "The invoice has been added to billing." });
      setFormOpen(false);
      setFormInvoice(null);
      invalidate();
    },
    onError: (error: Error) =>
      toast({ title: "Could not create invoice", description: error.message, variant: "destructive" }),
  });

  interface UpdateVars {
    id: string;
    data: unknown;
    toastTitle?: string;
    toastDescription?: string;
    closeForm?: boolean;
  }

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: UpdateVars) =>
      sendJSON<{ data: Invoice }>(`/api/billing/${id}`, "PUT", data),
    onSuccess: (_result, variables) => {
      toast({
        title: variables.toastTitle ?? "Invoice updated",
        description: variables.toastDescription ?? "Your changes have been saved.",
      });
      if (variables.closeForm) {
        setFormOpen(false);
        setFormInvoice(null);
      }
      invalidate();
    },
    onError: (error: Error) =>
      toast({ title: "Could not update invoice", description: error.message, variant: "destructive" }),
  });

  const payMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: unknown }) =>
      sendJSON<{ data: Invoice }>(`/api/billing/${id}`, "PUT", data),
    onSuccess: (result) => {
      const paid = result.data.status === "Paid";
      toast({
        title: paid ? "Invoice paid in full" : "Payment recorded",
        description: paid
          ? "The balance has been settled and the invoice is marked as paid."
          : "The payment has been added to the invoice.",
      });
      setPayOpen(false);
      setPayAmount("");
      setPayNote("");
      invalidate();
    },
    onError: (error: Error) =>
      toast({ title: "Could not record payment", description: error.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => sendJSON<{ success: boolean }>(`/api/billing/${id}`, "DELETE"),
    onSuccess: () => {
      toast({ title: "Invoice deleted", description: "The invoice was removed." });
      setDeleting(null);
      invalidate();
    },
    onError: (error: Error) =>
      toast({ title: "Could not delete invoice", description: error.message, variant: "destructive" }),
  });

  /* --------------------------------- actions -------------------------------- */

  const openCreate = () => {
    setFormInvoice(null);
    setFormOpen(true);
  };

  const openEdit = (invoice: Invoice) => {
    setFormInvoice(invoice);
    setFormOpen(true);
  };

  const openDetail = (invoice: Invoice, withPayment = false) => {
    setDetailId(invoice.id);
    if (withPayment) {
      setPayAmount(String(balanceDue(invoice)));
      setPayOpen(true);
    } else {
      setPayOpen(false);
    }
  };

  const handlePay = () => {
    if (!detailInvoice) return;
    const amount = Number(payAmount);
    const balance = balanceDue(detailInvoice);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast({ title: "Invalid amount", description: "Enter a payment amount greater than zero.", variant: "destructive" });
      return;
    }
    if (amount > balance + 0.005) {
      toast({
        title: "Amount exceeds balance",
        description: `The outstanding balance is ${formatCurrency(balance)}.`,
        variant: "destructive",
      });
      return;
    }
    payMutation.mutate({
      id: detailInvoice.id,
      data: { payment: { amount, method: payMethod, note: payNote.trim() || undefined } },
    });
  };

  /* ------------------------------- row actions ------------------------------ */

  const isEditable = (invoice: Invoice) => invoice.status === "Draft" || invoice.status === "Pending";
  const isPayable = (invoice: Invoice) =>
    (invoice.displayStatus === "Pending" || invoice.displayStatus === "Overdue") && balanceDue(invoice) > 0.005;

  const rowActions = (invoice: Invoice): RowAction[] => [
    { key: "view", label: "View Invoice", icon: Eye, onSelect: () => openDetail(invoice) },
    ...(isEditable(invoice)
      ? [{ key: "edit", label: "Edit", icon: Pencil, onSelect: () => openEdit(invoice) }]
      : []),
    ...(invoice.status === "Draft"
      ? [
          {
            key: "send",
            label: "Send Invoice",
            icon: Send,
            onSelect: () =>
              updateMutation.mutate({
                id: invoice.id,
                data: { status: "Pending" },
                toastTitle: "Invoice sent",
                toastDescription: `${invoice.invoiceNumber} is now pending payment.`,
              }),
          },
        ]
      : []),
    ...(isPayable(invoice)
      ? [
          {
            key: "pay",
            label: "Record Payment",
            icon: Wallet,
            onSelect: () => openDetail(invoice, true),
          },
          {
            key: "paid",
            label: "Mark Paid",
            icon: CheckCircle2,
            onSelect: () =>
              updateMutation.mutate({
                id: invoice.id,
                data: { status: "Paid" },
                toastTitle: "Invoice paid",
                toastDescription: `${invoice.invoiceNumber} has been settled.`,
              }),
          },
        ]
      : []),
    ...((invoice.status === "Draft" || invoice.displayStatus === "Pending" || invoice.displayStatus === "Overdue")
      ? [
          {
            key: "cancel",
            label: "Cancel Invoice",
            icon: XCircle,
            destructive: true,
            onSelect: () =>
              updateMutation.mutate({
                id: invoice.id,
                data: { status: "Cancelled" },
                toastTitle: "Invoice cancelled",
                toastDescription: `${invoice.invoiceNumber} was cancelled.`,
              }),
          },
        ]
      : []),
    {
      key: "delete",
      label: "Delete",
      icon: Trash2,
      destructive: true,
      separator: true,
      onSelect: () => setDeleting(invoice),
    },
  ];

  const isLoading = invoicesQuery.isLoading;

  /* ---------------------------------- render -------------------------------- */

  return (
    <div className="space-y-4">
      {/* Stats */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[124px] rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Total Billed"
            value={formatCurrency(totalBilled)}
            caption={`${activeInvoices.length} active invoice${activeInvoices.length === 1 ? "" : "s"}`}
            icon={ReceiptText}
            tint="bg-primary/10 text-primary"
          />
          <StatCard
            label="Collected"
            value={formatCurrency(collected)}
            caption={`${collectionRate}% of billed amount`}
            icon={HandCoins}
            tint="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
          />
          <StatCard
            label="Outstanding"
            value={formatCurrency(outstanding)}
            caption={`${unpaidInvoices.length} awaiting payment`}
            icon={Hourglass}
            tint="bg-amber-500/15 text-amber-700 dark:text-amber-400"
          />
          <StatCard
            label="Overdue"
            value={formatCurrency(overdueAmount)}
            caption={`${overdueInvoices.length} past due date`}
            icon={AlertTriangle}
            tint="bg-rose-500/15 text-rose-700 dark:text-rose-400"
          />
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Tabs value={statusFilter} onValueChange={(value) => setStatusFilter(value as StatusFilter)}>
            <TabsList className="flex-wrap bg-muted">
              {STATUS_TABS.map((tab) => (
                <TabsTrigger key={tab.value} value={tab.value}>
                  {tab.label}
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
              onChange={(event) => handleSearchChange(event.target.value)}
              placeholder="Search invoice # or patient…"
              aria-label="Search invoices"
              className="pl-9"
            />
          </div>
        </div>
        <Button onClick={openCreate} className="shrink-0">
          <Plus className="h-4 w-4" aria-hidden="true" />
          New Invoice
        </Button>
      </div>

      {/* Error state */}
      {invoicesQuery.isError && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <p className="text-sm font-medium text-destructive">Failed to load invoices</p>
            <p className="max-w-md text-sm text-muted-foreground">
              {(invoicesQuery.error as Error).message}
            </p>
            <Button variant="outline" size="sm" onClick={() => invoicesQuery.refetch()}>
              Try again
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Loading state */}
      {isLoading && !invoicesQuery.isError && (
        <>
          <Card className="hidden gap-0 overflow-hidden py-0 md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  {["Invoice", "Patient", "Issued", "Due", "Total", "Status", ""].map((head, i) => (
                    <TableHead key={i}>{head}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from({ length: 6 }).map((_, rowIndex) => (
                  <TableRow key={rowIndex}>
                    <TableCell>
                      <div className="space-y-1.5">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-3 w-16" />
                      </div>
                    </TableCell>
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
                      <Skeleton className="h-4 w-16" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-16" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-20" />
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
                <div className="flex items-center justify-between gap-2">
                  <div className="space-y-1.5">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                  <Skeleton className="h-5 w-20 rounded-full" />
                </div>
                <Skeleton className="mt-3 h-4 w-24" />
                <Skeleton className="mt-3 h-9 w-full" />
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Empty state */}
      {!isLoading && !invoicesQuery.isError && filtered.length === 0 &&
        (invoices.length === 0 ? (
          <EmptyState
            icon={ReceiptText}
            title="No invoices yet"
            hint="Create your first invoice to start billing for services."
          />
        ) : (
          <EmptyState
            icon={ReceiptText}
            title="No invoices found"
            hint="Try adjusting the status filter or search term."
          />
        ))}

      {/* Data */}
      {!isLoading && !invoicesQuery.isError && filtered.length > 0 && (
        <>
          {/* Desktop table */}
          <Card className="hidden gap-0 overflow-hidden py-0 md:block [&>div]:max-h-[62vh] [&>div]:overflow-y-auto">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-muted/70 backdrop-blur">
                <TableRow>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Patient</TableHead>
                  <TableHead>Issued</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-12">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell>
                      <button
                        type="button"
                        onClick={() => openDetail(invoice)}
                        className="text-left font-medium text-primary underline-offset-4 hover:underline"
                        aria-label={`View invoice ${invoice.invoiceNumber}`}
                      >
                        {invoice.invoiceNumber}
                      </button>
                      <p className="text-xs text-muted-foreground">
                        {invoice.items.length} item{invoice.items.length === 1 ? "" : "s"}
                      </p>
                    </TableCell>
                    <TableCell>
                      <PatientCell name={invoice.patient?.name} email={invoice.patient?.email} />
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {formatShortDate(invoice.issueDate)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {formatShortDate(invoice.dueDate)}
                    </TableCell>
                    <TableCell className="text-right">
                      <p className="font-semibold tabular-nums">{formatCurrency(invoice.total)}</p>
                      {invoice.amountPaid > 0 && invoice.status !== "Cancelled" && (
                        <p className="text-xs tabular-nums text-muted-foreground">
                          Paid {formatCurrency(invoice.amountPaid)}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      <InvoiceStatusBadge status={invoice.displayStatus} />
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            aria-label={`Actions for invoice ${invoice.invoiceNumber}`}
                          >
                            <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-52">
                          {rowActions(invoice).map((action) => (
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
            {filtered.map((invoice) => (
              <Card key={invoice.id} className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{invoice.invoiceNumber}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {invoice.patient?.name ?? "Unknown patient"}
                    </p>
                  </div>
                  <InvoiceStatusBadge status={invoice.displayStatus} />
                </div>

                <div className="mt-3 flex items-end justify-between gap-2">
                  <div>
                    <p className="font-semibold tabular-nums">{formatCurrency(invoice.total)}</p>
                    {invoice.amountPaid > 0 && invoice.status !== "Cancelled" && (
                      <p className="text-xs tabular-nums text-muted-foreground">
                        Paid {formatCurrency(invoice.amountPaid)}
                      </p>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">Due {formatShortDate(invoice.dueDate)}</p>
                </div>

                <div className="mt-3 flex items-center justify-end gap-1 border-t pt-3">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9"
                    aria-label={`View invoice ${invoice.invoiceNumber}`}
                    onClick={() => openDetail(invoice)}
                  >
                    <Eye className="h-4 w-4" aria-hidden="true" />
                  </Button>
                  {isPayable(invoice) && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 text-emerald-700 dark:text-emerald-400"
                      aria-label={`Record payment for ${invoice.invoiceNumber}`}
                      onClick={() => openDetail(invoice, true)}
                    >
                      <Wallet className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  )}
                  {isEditable(invoice) && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9"
                      aria-label={`Edit invoice ${invoice.invoiceNumber}`}
                      onClick={() => openEdit(invoice)}
                    >
                      <Pencil className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 text-destructive"
                    aria-label={`Delete invoice ${invoice.invoiceNumber}`}
                    onClick={() => setDeleting(invoice)}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Create / edit form dialog */}
      {formOpen && (
        <InvoiceFormDialog
          key={formInvoice?.id ?? "new"}
          open={formOpen}
          onOpenChange={(open) => {
            if (!open) {
              setFormOpen(false);
              setFormInvoice(null);
            }
          }}
          patients={patients}
          patientsLoading={patientsQuery.isLoading}
          initial={formInvoice}
          pending={createMutation.isPending || updateMutation.isPending}
          onSubmit={(body) => {
            if (formInvoice) {
              updateMutation.mutate({
                id: formInvoice.id,
                data: body,
                closeForm: true,
                toastTitle: "Invoice updated",
                toastDescription: `${formInvoice.invoiceNumber} has been updated.`,
              });
            } else {
              createMutation.mutate(body);
            }
          }}
        />
      )}

      {/* Detail dialog */}
      <Dialog
        open={!!detailInvoice}
        onOpenChange={(open) => {
          if (!open) {
            setDetailId(null);
            setPayOpen(false);
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          {detailInvoice && (
            <>
              <div className="print-area space-y-5">
                {/* Invoice header */}
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Invoice</p>
                    <DialogTitle className="text-xl font-bold">{detailInvoice.invoiceNumber}</DialogTitle>
                    <DialogDescription className="text-xs text-muted-foreground">
                      Issued {formatDate(detailInvoice.issueDate)} · Due {formatDate(detailInvoice.dueDate)}
                    </DialogDescription>
                  </div>
                  <InvoiceStatusBadge status={detailInvoice.displayStatus} className="text-sm" />
                </div>

                {/* Parties */}
                <div className="grid gap-4 rounded-lg border p-4 sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-medium uppercase text-muted-foreground">From</p>
                    <p className="mt-1 font-medium">Medicare Hub</p>
                    <p className="text-sm text-muted-foreground">1 Health Way, Springfield</p>
                    <p className="text-sm text-muted-foreground">+1 (555) 100-3000</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase text-muted-foreground">Bill To</p>
                    <p className="mt-1 font-medium">{detailInvoice.patient?.name ?? "Unknown patient"}</p>
                    <p className="text-sm text-muted-foreground">{detailInvoice.patient?.email}</p>
                    <p className="text-sm text-muted-foreground">{detailInvoice.patient?.phone}</p>
                  </div>
                </div>

                {/* Items */}
                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Description</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                        <TableHead className="text-right">Unit Price</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detailInvoice.items.map((item, idx) => (
                        <TableRow key={idx}>
                          <TableCell>{item.description}</TableCell>
                          <TableCell className="text-right tabular-nums">{item.quantity}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatCurrency(item.unitPrice)}
                          </TableCell>
                          <TableCell className="text-right font-medium tabular-nums">
                            {formatCurrency(item.quantity * item.unitPrice)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Totals */}
                <div className="ml-auto w-full max-w-xs space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="tabular-nums">{formatCurrency(detailInvoice.subtotal)}</span>
                  </div>
                  {detailInvoice.taxRate > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Tax ({detailInvoice.taxRate}%)</span>
                      <span className="tabular-nums">{formatCurrency(detailInvoice.taxAmount)}</span>
                    </div>
                  )}
                  {detailInvoice.discount > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Discount</span>
                      <span className="tabular-nums">-{formatCurrency(detailInvoice.discount)}</span>
                    </div>
                  )}
                  <Separator />
                  <div className="flex justify-between font-semibold">
                    <span>Total</span>
                    <span className="tabular-nums">{formatCurrency(detailInvoice.total)}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Paid</span>
                    <span className="tabular-nums">-{formatCurrency(detailInvoice.amountPaid)}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between text-base font-bold">
                    <span>Balance Due</span>
                    <span className="tabular-nums">{formatCurrency(balanceDue(detailInvoice))}</span>
                  </div>
                </div>

                {/* Payment history */}
                {detailInvoice.payments.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-medium uppercase text-muted-foreground">Payment history</p>
                    <ul className="space-y-1.5">
                      {detailInvoice.payments.map((payment, idx) => (
                        <li
                          key={idx}
                          className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 rounded-md bg-muted/50 px-3 py-1.5 text-sm"
                        >
                          <span className="flex flex-wrap items-center gap-x-2">
                            <span className="font-medium tabular-nums">{formatCurrency(payment.amount)}</span>
                            <span className="text-muted-foreground">· {payment.method}</span>
                            <span className="text-xs text-muted-foreground">{formatDate(payment.date)}</span>
                          </span>
                          {payment.note && (
                            <span className="text-xs text-muted-foreground">{payment.note}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {detailInvoice.notes && (
                  <p className="rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">
                    {detailInvoice.notes}
                  </p>
                )}
              </div>

              {/* Record payment panel */}
              {payOpen &&
                detailInvoice.status !== "Draft" &&
                detailInvoice.status !== "Cancelled" &&
                balanceDue(detailInvoice) > 0.005 && (
                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      handlePay();
                    }}
                    className="space-y-3 rounded-lg border border-primary/30 bg-primary/5 p-4"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold">Record payment</p>
                      <p className="text-xs text-muted-foreground">
                        Balance due:{" "}
                        <span className="font-medium text-foreground">
                          {formatCurrency(balanceDue(detailInvoice))}
                        </span>
                      </p>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="Amount" required htmlFor="pay-amount">
                        <div className="flex gap-2">
                          <Input
                            id="pay-amount"
                            type="number"
                            min="0.01"
                            max={balanceDue(detailInvoice)}
                            step="0.01"
                            required
                            value={payAmount}
                            onChange={(event) => setPayAmount(event.target.value)}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="shrink-0"
                            onClick={() => setPayAmount(String(balanceDue(detailInvoice)))}
                          >
                            Full
                          </Button>
                        </div>
                      </Field>
                      <Field label="Method">
                        <Select
                          value={payMethod}
                          onValueChange={(value) => setPayMethod(value as PaymentMethod)}
                        >
                          <SelectTrigger className="w-full" aria-label="Payment method">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {PAYMENT_METHODS.map((method) => (
                              <SelectItem key={method} value={method}>
                                {method}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Field>
                    </div>
                    <Field label="Note">
                      <Input
                        value={payNote}
                        onChange={(event) => setPayNote(event.target.value)}
                        placeholder="e.g. Paid at the front desk"
                      />
                    </Field>
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setPayOpen(false)}
                      >
                        Cancel
                      </Button>
                      <Button type="submit" size="sm" disabled={payMutation.isPending}>
                        {payMutation.isPending && (
                          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                        )}
                        Add Payment
                      </Button>
                    </div>
                  </form>
                )}

              {/* Actions */}
              <DialogFooter className="flex-row flex-wrap items-center gap-2 border-t pt-4">
                <Button variant="outline" onClick={() => window.print()}>
                  <Printer className="h-4 w-4" aria-hidden="true" />
                  Print
                </Button>
                <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
                  {isEditable(detailInvoice) && (
                    <Button variant="outline" onClick={() => openEdit(detailInvoice)}>
                      <Pencil className="h-4 w-4" aria-hidden="true" />
                      Edit
                    </Button>
                  )}
                  {detailInvoice.status === "Draft" && (
                    <Button
                      variant="outline"
                      onClick={() =>
                        updateMutation.mutate({
                          id: detailInvoice.id,
                          data: { status: "Pending" },
                          toastTitle: "Invoice sent",
                          toastDescription: `${detailInvoice.invoiceNumber} is now pending payment.`,
                        })
                      }
                    >
                      <Send className="h-4 w-4" aria-hidden="true" />
                      Send
                    </Button>
                  )}
                  {isPayable(detailInvoice) && (
                    <>
                      <Button
                        variant="outline"
                        className="text-emerald-700 hover:bg-emerald-500/10 hover:text-emerald-700 dark:text-emerald-400"
                        onClick={() =>
                          updateMutation.mutate({
                            id: detailInvoice.id,
                            data: { status: "Paid" },
                            toastTitle: "Invoice paid",
                            toastDescription: `${detailInvoice.invoiceNumber} has been settled.`,
                          })
                        }
                      >
                        <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                        Mark Paid
                      </Button>
                      {!payOpen && (
                        <Button
                          onClick={() => {
                            setPayAmount(String(balanceDue(detailInvoice)));
                            setPayOpen(true);
                          }}
                        >
                          <Wallet className="h-4 w-4" aria-hidden="true" />
                          Record Payment
                        </Button>
                      )}
                    </>
                  )}
                  {(detailInvoice.status === "Draft" ||
                    detailInvoice.displayStatus === "Pending" ||
                    detailInvoice.displayStatus === "Overdue") && (
                    <Button
                      variant="outline"
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={() =>
                        updateMutation.mutate({
                          id: detailInvoice.id,
                          data: { status: "Cancelled" },
                          toastTitle: "Invoice cancelled",
                          toastDescription: `${detailInvoice.invoiceNumber} was cancelled.`,
                        })
                      }
                    >
                      <XCircle className="h-4 w-4" aria-hidden="true" />
                      Cancel Invoice
                    </Button>
                  )}
                </div>
              </DialogFooter>
            </>
          )}
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
            <AlertDialogTitle>Delete this invoice?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting
                ? `Invoice ${deleting.invoiceNumber} for ${
                    deleting.patient?.name ?? "this patient"
                  } (${formatCurrency(deleting.total)}) will be permanently removed. This cannot be undone.`
                : "This invoice will be permanently removed."}
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
