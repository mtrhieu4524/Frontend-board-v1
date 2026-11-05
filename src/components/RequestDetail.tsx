import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { EventTimeline } from "@/components/EventTimeline";
import { PriorityBadge, StatusBadge } from "@/components/badges";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useRequestDetail } from "@/hooks/useRequestDetail";
import { AUTO_RETRY_MS, useRetrying } from "@/hooks/useRetrying";
import { parsePreview } from "@/lib/preview";
import { firstResponse, formatEventTime, formatInZone, formatLocalDate, isOverdue, sortEventsOldestFirst, undoneEventIds } from "@/lib/rules";
import type { HelpdeskRequest, Site, Staff, Status } from "@/types";

interface Props {
  id: number;
  sites: Map<number, Site>;
  staff: Map<number, Staff>;
  statusLabels: Map<Status, string>;
  referenceReady: boolean;
  referenceError: string | null;
  onRetryReference: () => void;
  backHref: string;
  now?: Date;
}

export function RequestDetail({ id, sites, staff, statusLabels, referenceReady, referenceError, onRetryReference, backHref, now = new Date() }: Props) {
  const preview = parsePreview(useLocation().search);
  const detail = useRequestDetail(id);
  const [showUndone, setShowUndone] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const waiting = useRetrying();
  const request = preview === "empty" ? null : detail.request;
  const events = detail.events;
  const notFound = preview === "empty" || detail.notFound;
  const error =
    preview === "error"
      ? "The helpdesk refused the access token"
      : preview === "down"
        ? "The helpdesk is temporarily unavailable"
        : preview
          ? null
          : detail.error;
  const loading =
    preview === "loading" || preview === "busy" || (!preview && detail.loading);
  const retry = detail.retry;
  const retrying = preview === "busy" || waiting;

  useEffect(() => {
    heading.current?.focus();
  }, [id]);
  useEffect(() => setShowUndone(false), [id]);
  useEffect(() => {
    document.title = request ? `${request.ref}: ${request.title}` : `Request #${id}`;
    return () => {
      document.title = "Requests board";
    };
  }, [id, request]);

  const site = request ? sites.get(request.site_id) : undefined;
  const zone = site?.timezone ?? "UTC";

  const ordered = useMemo(() => sortEventsOldestFirst(events), [events]);
  const undoneIds = useMemo(() => undoneEventIds(events), [events]);
  const first = useMemo(() => firstResponse(events), [events]);
  const shown = showUndone ? ordered : ordered.filter((e) => !undoneIds.has(e.id));
  const failure = error ?? (preview ? null : referenceError);
  const showSkeleton =
    (preview === "loading" || preview === "busy" || !request) &&
    !failure &&
    !notFound &&
    (loading || !referenceReady);
  const showBody =
    Boolean(request) &&
    referenceReady &&
    (preview === null || preview === "down");

  useEffect(() => {
    if (!failure || preview) return;
    const timer = setTimeout(() => {
      if (error) retry();
      else onRetryReference();
    }, AUTO_RETRY_MS);
    return () => clearTimeout(timer);
  }, [failure, preview, error, retry, onRetryReference]);

  return (
    <main className="mx-auto max-w-4xl p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <Link
        to={backHref}
        className="inline-flex rounded-sm text-sm underline-offset-2 outline-none hover:underline focus-visible:underline focus-visible:ring-3 focus-visible:ring-ring/60">
        ← Back to the board
      </Link>
      <h1 ref={heading} tabIndex={-1} className="mt-3 text-2xl font-semibold outline-none">
        {request ? `${request.ref}: ${request.title}` : `Request #${id}`}
      </h1>

      {showSkeleton && <DetailSkeleton slow={retrying} />}
      {request && !showSkeleton && retrying && (
        <p
          role="status"
          className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          The helpdesk is slow to answer. Retrying automatically…
        </p>
      )}

      {notFound && (
        <div role="alert" className="mt-4 rounded-md border p-3">
          <p>There is no request #{id}. It may have been removed, or the link is wrong.</p>
          <Link
            to={backHref}
            className="mt-3 inline-flex min-h-11 items-center rounded-sm text-sm underline-offset-2 outline-none hover:underline focus-visible:underline focus-visible:ring-3 focus-visible:ring-ring/60 sm:min-h-0">
            Back to the board
          </Link>
        </div>
      )}

      {failure && (
        <div role="alert" className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <span>
            Could not load this request. {failure}.
            {request ? " Showing the last data received." : null} We will try
            again in a few seconds.
          </span>
          <Button
            size="sm"
            variant="outline"
            className="min-h-11 sm:min-h-7"
            onClick={error ? retry : onRetryReference}>
            Try again
          </Button>
        </div>
      )}

      {showBody && request && (
        <>
          <Notices request={request} knownSite={Boolean(site)} />
          <p className="mt-2 text-sm text-muted-foreground">
            All times are in {site ? `${site.name} local time` : "UTC"} ({zone}).
          </p>

          <dl className="mt-4 grid gap-x-8 gap-y-3 sm:grid-cols-2">
            <Field label="Site">{site?.name ?? `Site ${request.site_id}`}</Field>
            <Field label="Location">{request.location}</Field>
            <Field label="Status">
              <StatusBadge status={request.status} labels={statusLabels} />
            </Field>
            <Field label="Priority">
              <PriorityBadge priority={request.priority} />
            </Field>
            <Field label="Assignee">
              {request.assignee ? (staff.get(request.assignee.id)?.name ?? "Unknown staff") : <span className="text-muted-foreground">Unassigned</span>}
            </Field>
            <Field label="Due">
              {request.due_on ? (
                <span className="inline-flex items-center gap-2">
                  {formatLocalDate(request.due_on)}
                  {isOverdue(request, zone, now) && <Badge variant="destructive">Overdue</Badge>}
                </span>
              ) : (
                <span className="text-muted-foreground">No due date</span>
              )}
            </Field>
            <Field label="Created">{formatInZone(request.created_at, zone)}</Field>
            <Field label="Last updated">{formatInZone(request.updated_at, zone)}</Field>
            <Field label="First response">
              {first ? (
                <span>
                  {first.actor_id !== null ? (staff.get(first.actor_id)?.name ?? "Unknown staff") : "System"}, {formatEventTime(first.at, zone)}
                </span>
              ) : (
                <span className="text-muted-foreground">No first response yet</span>
              )}
            </Field>
          </dl>

          <section aria-labelledby="history-heading" className="mt-8">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h2 id="history-heading" className="text-lg font-semibold">
                History ({shown.length} {shown.length === 1 ? "event" : "events"})
              </h2>
              {undoneIds.size > 0 && (
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={showUndone} onChange={(e) => setShowUndone(e.target.checked)} className="size-5 sm:size-4" />
                  Show undone events ({undoneIds.size})
                </label>
              )}
            </div>
            <EventTimeline
              events={shown}
              staff={staff}
              timeZone={zone}
              statusLabels={statusLabels}
              firstResponseId={first?.id ?? null}
              undoneIds={undoneIds}
            />
          </section>
        </>
      )}
    </main>
  );
}

function Notices({ request, knownSite }: { request: HelpdeskRequest; knownSite: boolean }) {
  const notes: string[] = [];
  if (request.deleted_at) notes.push("This request was deleted.");
  if (request.merged_into_id) notes.push(`This request was merged into #${request.merged_into_id} as a duplicate.`);
  if (request.status === "canceled") notes.push("This request was canceled.");
  if (!knownSite) notes.push("This request belongs to a site the helpdesk does not list, so its times are shown in UTC.");
  if (notes.length === 0) return null;
  return (
    <div role="status" className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
      {notes.map((n) => (
        <p key={n}>{n}</p>
      ))}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="mt-0.5">{children}</dd>
    </div>
  );
}

function DetailSkeleton({ slow }: { slow: boolean }) {
  return (
    <div role="status" aria-label="Loading request" className="mt-4 grid gap-3">
      {slow && <p className="text-sm text-amber-800">The helpdesk is slow to answer. Retrying automatically…</p>}
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="h-24 w-full" />
    </div>
  );
}
