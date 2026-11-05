import { Link, useNavigate } from "react-router-dom";
import { PriorityBadge, StatusBadge } from "@/components/badges";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatInZone, formatLocalDate, isOverdue } from "@/lib/rules";
import { cn } from "@/lib/utils";
import type { HelpdeskRequest, Site, Staff, Status } from "@/types";

const COLUMNS = ["Site", "Ref", "Title", "Priority", "Status", "Assignee", "Created", "Due"];
const FOCUS_RING = "rounded-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/60";

interface Props {
  rows: HelpdeskRequest[];
  sites: Map<number, Site>;
  staff: Map<number, Staff>;
  statusLabels: Map<Status, string>;
  loading: boolean;
  hrefFor: (request: HelpdeskRequest) => string;
  highlighted?: ReadonlySet<number>;
  now?: Date;
}

interface RowView {
  request: HelpdeskRequest;
  href: string;
  siteName: string;
  zone: string;
  assignee: string | null;
  overdue: boolean;
}

export function BoardTable({ rows, sites, staff, statusLabels, loading, hrefFor, highlighted, now = new Date() }: Props) {
  const navigate = useNavigate();
  const views: RowView[] = rows.map((r) => {
    const site = sites.get(r.site_id);
    const zone = site?.timezone ?? "UTC";
    // Rule 3: names come from /v1/staff by id, never from the stale assignee.name.
    const assignee = r.assignee ? (staff.get(r.assignee.id)?.name ?? "Unknown staff") : null;
    return { request: r, href: hrefFor(r), siteName: site?.name ?? `Site ${r.site_id}`, zone, assignee, overdue: isOverdue(r, zone, now) };
  });

  return (
    <>
      <ul className="grid gap-3 md:hidden" aria-label="Requests" aria-busy={loading}>
        {loading
          ? Array.from({ length: 5 }, (_, i) => <SkeletonCard key={i} />)
          : views.map((v) => (
              <RequestCard key={v.request.id} view={v} statusLabels={statusLabels} highlighted={highlighted?.has(v.request.id) ?? false} />
            ))}
      </ul>

      <div className="hidden overflow-x-auto md:block">
        <Table aria-busy={loading}>
          <caption className="sr-only">Requests</caption>
          <TableHeader>
            <TableRow>
              {COLUMNS.map((name) => (
                <TableHead key={name} scope="col">
                  {name}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading
              ? Array.from({ length: 10 }, (_, i) => <SkeletonRow key={i} />)
              : views.map(({ request: r, href, siteName, zone, assignee, overdue }) => (
                  <TableRow
                    key={r.id}
                    className={cn("cursor-pointer", highlighted?.has(r.id) && "bg-amber-50")}
                    onClick={(e) => {
                      if (!(e.target as HTMLElement).closest("a")) navigate(href);
                    }}>
                    <TableCell>{siteName}</TableCell>
                    <TableCell className="font-mono text-xs">
                      <Link to={href} className={cn("underline-offset-2 hover:underline focus-visible:underline", FOCUS_RING)} aria-label={`Open ${r.ref}: ${r.title}`}>
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
                      <DueValue request={r} overdue={overdue} />
                    </TableCell>
                  </TableRow>
                ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}

function DueValue({ request, overdue }: { request: HelpdeskRequest; overdue: boolean }) {
  if (!request.due_on) return <span className="text-muted-foreground">No due date</span>;
  return (
    <span className="inline-flex items-center gap-2">
      {formatLocalDate(request.due_on)}
      {overdue && <Badge variant="destructive">Overdue</Badge>}
    </span>
  );
}

function RequestCard({ view, statusLabels, highlighted }: { view: RowView; statusLabels: Map<Status, string>; highlighted: boolean }) {
  const { request: r, href, siteName, zone, assignee, overdue } = view;
  return (
    <li className={cn("relative rounded-lg border p-3 text-sm focus-within:ring-3 focus-within:ring-ring/60", highlighted && "bg-amber-50")}>
      <div className="flex items-start justify-between gap-3">
        <span className="font-mono text-xs text-muted-foreground">{r.ref}</span>
        <PriorityBadge priority={r.priority} />
      </div>
      <Link to={href} aria-label={`Open ${r.ref}: ${r.title}`} className="mt-1 block font-medium outline-none after:absolute after:inset-0 after:content-['']">
        {r.title}
      </Link>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <StatusBadge status={r.status} labels={statusLabels} />
        {overdue && <Badge variant="destructive">Overdue</Badge>}
      </div>
      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-muted-foreground">
        <dt>Site</dt>
        <dd className="text-foreground">{siteName}</dd>
        <dt>Assignee</dt>
        <dd className="text-foreground">{assignee ?? <span className="text-muted-foreground">Unassigned</span>}</dd>
        <dt>Created</dt>
        <dd className="text-foreground">{formatInZone(r.created_at, zone)}</dd>
        <dt>Due</dt>
        <dd className="text-foreground">
          <DueValue request={r} overdue={false} />
        </dd>
      </dl>
    </li>
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

function SkeletonCard() {
  return (
    <li aria-hidden="true" className="grid gap-2 rounded-lg border p-3">
      <Skeleton className="h-3 w-20" />
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
    </li>
  );
}
