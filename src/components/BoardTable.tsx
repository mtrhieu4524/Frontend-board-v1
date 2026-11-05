import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatInZone, formatLocalDate, isOverdue } from "@/lib/rules";
import { cn } from "@/lib/utils";
import type { HelpdeskRequest, Priority, Site, Staff, Status } from "@/types";

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

const COLUMNS = ["Site", "Ref", "Title", "Priority", "Status", "Assignee", "Created", "Due"];

interface Props {
  rows: HelpdeskRequest[];
  sites: Map<number, Site>;
  staff: Map<number, Staff>;
  statusLabels: Map<Status, string>;
  loading: boolean;
  failed?: boolean;
  now?: Date;
}

export function BoardTable({ rows, sites, staff, statusLabels, loading, failed, now = new Date() }: Props) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          {COLUMNS.map((name) => (
            <TableHead key={name}>{name}</TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {!loading && !failed && rows.length === 0 && (
          <TableRow>
            <TableCell colSpan={COLUMNS.length} className="h-24 text-center text-muted-foreground">
              No requests match these dates and filters.
            </TableCell>
          </TableRow>
        )}
        {loading
          ? Array.from({ length: 10 }, (_, i) => <SkeletonRow key={i} />)
          : rows.map((r) => {
              const site = sites.get(r.site_id);
              const zone = site?.timezone ?? "UTC";
              // Rule 3: names come from /v1/staff by id, never from the stale assignee.name.
              const assignee = r.assignee ? (staff.get(r.assignee.id)?.name ?? "Unknown staff") : null;
              const overdue = isOverdue(r, zone, now);
              return (
                <TableRow key={r.id}>
                  <TableCell>{site?.name ?? `Site ${r.site_id}`}</TableCell>
                  <TableCell className="font-mono text-xs">{r.ref}</TableCell>
                  <TableCell className="min-w-48 whitespace-normal">{r.title}</TableCell>
                  <TableCell>
                    {r.priority ? (
                      <Badge variant="outline" className={cn(PRIORITY_STYLES[r.priority])}>
                        {r.priority}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">No priority</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={cn(STATUS_STYLES[r.status])}>
                      {statusLabels.get(r.status) ?? r.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{assignee ?? <span className="text-muted-foreground">Unassigned</span>}</TableCell>
                  <TableCell className="whitespace-nowrap text-xs">{formatInZone(r.created_at, zone)}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    {r.due_on ? (
                      <span className="inline-flex items-center gap-2">
                        {formatLocalDate(r.due_on)}
                        {overdue && <Badge variant="destructive">Overdue</Badge>}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">No due date</span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
      </TableBody>
    </Table>
  );
}

function SkeletonRow() {
  return (
    <TableRow aria-hidden="true">
      {COLUMNS.map((name) => (
        <TableCell key={name}>
          <Skeleton className="h-4 w-full min-w-12" />
        </TableCell>
      ))}
    </TableRow>
  );
}
