import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { AppointmentStatus, InvoiceDisplayStatus } from "@/lib/medicare-types";

const STATUS_STYLES: Record<AppointmentStatus, string> = {
  Pending: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  Scheduled: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  Completed: "bg-teal-500/15 text-teal-700 dark:text-teal-400",
  Cancelled: "bg-rose-500/15 text-rose-700 dark:text-rose-400",
};

const INVOICE_STATUS_STYLES: Record<InvoiceDisplayStatus, string> = {
  Draft: "bg-slate-500/10 text-slate-600 dark:text-slate-400",
  Pending: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  Overdue: "bg-rose-500/15 text-rose-700 dark:text-rose-400",
  Paid: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  Cancelled: "bg-muted text-muted-foreground",
};

export function StatusBadge({
  status,
  className,
}: {
  status: AppointmentStatus;
  className?: string;
}) {
  const style = STATUS_STYLES[status];
  return (
    <Badge
      variant="outline"
      className={cn(
        "border-transparent",
        style,
        !style && "bg-muted text-muted-foreground",
        className
      )}
    >
      {status}
    </Badge>
  );
}

export function InvoiceStatusBadge({
  status,
  className,
}: {
  status: InvoiceDisplayStatus;
  className?: string;
}) {
  const style = INVOICE_STATUS_STYLES[status];
  return (
    <Badge
      variant="outline"
      className={cn(
        "border-transparent",
        style,
        !style && "bg-muted text-muted-foreground",
        className
      )}
    >
      {status}
    </Badge>
  );
}
