import { useCallback, useEffect, useState } from "react";
import { ApiError, configured, fetchAllPages, listRequests, listSites, listStaff, listStatuses } from "@/api";
import { addDays, toApiDate } from "@/lib/dates";
import { isCounted } from "@/lib/rules";
import type { HelpdeskRequest, Site, Staff, Status } from "@/types";

export function describeError(e: unknown): string {
  if (e instanceof ApiError) return e.status ? `${e.status}: ${e.message}` : e.message;
  return String(e);
}

export interface Reference {
  sites: Site[];
  staff: Staff[];
  statuses: { value: Status; label: string }[];
}

/** Sites, staff and status labels. Loaded once; they change rarely. */
export function useReference() {
  const [reference, setReference] = useState<Reference | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!configured()) return;
    let cancelled = false;
    setError(null);
    Promise.all([listSites(), listStaff(), listStatuses()])
      .then(([sites, staff, statuses]) => {
        if (!cancelled) setReference({ sites: sites.data, staff: staff.data, statuses: statuses.data });
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(describeError(e));
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  return { reference, error, retry: () => setAttempt((n) => n + 1) };
}

/**
 * All requests created in [from, to] (site-local dates, rule 1).
 * The API filters on UTC dates, so we ask for one extra day on each side and filter locally per site.
 */
export function useRequests(from: string | null, to: string | null, sites: Site[] | undefined, enabled = true) {
  const [requests, setRequests] = useState<HelpdeskRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!enabled || !configured() || !from || !to || !sites) return;
    let cancelled = false;
    const zones = new Map(sites.map((s) => [s.id, s.timezone]));
    setLoading(true);
    setError(null);
    fetchAllPages((page) =>
      listRequests({
        page,
        per_page: 100,
        created_from: toApiDate(addDays(from, -1)),
        created_to: toApiDate(addDays(to, 1)),
      }),
    )
      .then((all) => {
        if (cancelled) return;
        // A request whose site is unknown cannot be placed in a local date; drop it rather than guess.
        setRequests(all.filter((r) => zones.has(r.site_id) && isCounted(r, zones.get(r.site_id)!, from, to)));
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(describeError(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [from, to, sites, attempt, enabled]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { requests, loading, error, retry };
}
