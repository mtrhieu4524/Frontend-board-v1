import { Link, useNavigate } from "react-router-dom";
import { PriorityBadge, StatusBadge } from "@/components/badges";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatInZone, formatLocalDate, isOverdue } from "@/lib/rules";
import type { HelpdeskRequest, Site, Staff, Status } from "@/types";

const COLUMNS = ["Site", "Ref", "Title", "Priority", "Status", "Assignee", "Created", "Due"];

interface Props {
  rows: HelpdeskRequest[];
  sites: Map<number, Site>;
  staff: Map<number, Staff>;
  statusLabels: Map<Status, string>;
  loading: boolean;
  failed?: boolean;
  hrefFor: (request: HelpdeskRequest) => string;
  now?: Date;
}

export function BoardTable({ rows, sites, staff, statusLabels, loading, failed, hrefFor, now = new Date() }: Props) {
  const navigate = useNavigate();
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
              const href = hrefFor(r);
              return (
                <TableRow
                  key={r.id}
                  className="cursor-pointer"
                  onClick={(e) => {
                    if (!(e.target as HTMLElement).closest("a")) navigate(href);
                  }}>
                  <TableCell>{site?.name ?? `Site ${r.site_id}`}</TableCell>
                  <TableCell className="font-mono text-xs">
                    <Link to={href} className="underline-offset-2 hover:underline focus-visible:underline" aria-label={`Open ${r.ref}: ${r.title}`}>
                      {r.ref}
                    </Link>
                  </TableCell>
                  <TableCell className="min-w-48 whitespace-normal">{r.title}</TableCell>
                  <TableCell>
                    <PriorityBadge priority={r.priority} />
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={r.status} labels={statusLabels} />
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
