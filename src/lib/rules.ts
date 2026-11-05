// Rules 1, 2 and 4 from docs/rules.md. Pure functions so they can be tested without the API.

import type { HelpdeskRequest, RequestEvent } from "../types";
import { localDate, wallClockToInstant } from "./dates";

/** Rule 1: which requests count. `from` and `to` are YYYY-MM-DD, inclusive, in the site's local date. */
export function isCounted(request: HelpdeskRequest, timeZone: string, from: string, to: string): boolean {
  if (request.status === "canceled" || request.deleted_at || request.merged_into_id) return false;
  const created = localDate(new Date(request.created_at), timeZone);
  return created >= from && created <= to;
}

/** Rule 2: pending/processing and due before today in the site's timezone. null due date is never overdue. */
export function isOverdue(request: HelpdeskRequest, timeZone: string, now = new Date()): boolean {
  if (request.status !== "pending" && request.status !== "processing") return false;
  if (!request.due_on) return false;
  return request.due_on < localDate(now, timeZone);
}

/** Rule 4: an instant shown in the site's timezone, with the zone named, e.g. "06 Oct 2026, 09:15 GMT+8". */
export function formatInZone(instant: Date | string, timeZone: string): string {
  const date = typeof instant === "string" ? new Date(instant) : instant;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZoneName: "short",
  }).format(date);
}

/** A site-local calendar date (YYYY-MM-DD) for display, e.g. "07 Nov 2026". No timezone shift: it is already local. */
export function formatLocalDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", day: "2-digit", month: "short", year: "numeric" }).format(
    new Date(Date.UTC(year, month - 1, day)),
  );
}

export function zoneLabel(instant: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone, timeZoneName: "short" }).formatToParts(instant).find((p) => p.type === "timeZoneName")?.value ?? timeZone;
}

export function formatWallClock(dueAt: string, timeZone: string): string {
  const match = /^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2})$/.exec(dueAt.trim());
  if (!match) return `${dueAt} (${timeZone})`;
  const [day, month, year, hour, minute] = match.slice(1).map(Number);
  const label = zoneLabel(wallClockToInstant({ year, month, day, hour, minute }, timeZone), timeZone);
  const hhmm = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  return `${formatLocalDate(`${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`)}, ${hhmm} ${label}`;
}

export function formatEventTime(at: number, timeZone: string): string {
  return formatInZone(new Date(at * 1000), timeZone);
}

export function sortEventsOldestFirst(events: RequestEvent[]): RequestEvent[] {
  return [...events].sort((a, b) => a.at - b.at || a.id - b.id);
}

export function undoneEventIds(events: RequestEvent[]): Set<number> {
  const ids = new Set<number>();
  for (const e of events) {
    if (e.reverts_id !== null) {
      ids.add(e.id);
      ids.add(e.reverts_id);
    }
  }
  return ids;
}

export function firstResponse(events: RequestEvent[]): RequestEvent | null {
  const undone = undoneEventIds(events);
  const candidates = events.filter((e) => e.status === "processing" && e.actor_id !== null && !undone.has(e.id));
  return sortEventsOldestFirst(candidates)[0] ?? null;
}
