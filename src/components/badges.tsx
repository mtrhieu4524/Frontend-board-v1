import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Priority, Status } from "@/types";

const PRIORITY_STYLES: Record<NonNullable<Priority>, string> = {
  High: "border-red-200 bg-red-50 text-red-700",
  Medium: "border-amber-200 bg-amber-50 text-amber-700",
  Low: "border-slate-200 bg-slate-50 text-slate-600",
};

const STATUS_STYLES: Record<Status, string> = {
  pending: "border-amber-200 bg-amber-50 text-amber-800",
  processing: "border-blue-200 bg-blue-50 text-blue-800",
  complete: "border-green-200 bg-green-50 text-green-800",
  canceled: "border-slate-200 bg-slate-50 text-slate-600",
};

export function PriorityBadge({ priority }: { priority: Priority }) {
  if (!priority) return <span className="text-muted-foreground">No priority</span>;
  return (
    <Badge variant="outline" className={cn(PRIORITY_STYLES[priority])}>
      {priority}
    </Badge>
  );
}

export function StatusBadge({ status, labels }: { status: Status; labels: Map<Status, string> }) {
  return (
    <Badge variant="outline" className={cn(STATUS_STYLES[status])}>
      {labels.get(status) ?? status}
    </Badge>
  );
}
