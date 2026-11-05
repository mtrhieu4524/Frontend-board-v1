import { useCallback, useEffect, useRef, useState } from "react";
import {
  ApiError,
  configured,
  fetchAllPages,
  listRequests,
  listSites,
  listStaff,
  listStatuses,
} from "@/api";
import { mergeRequestChanges, mergeStaffChanges } from "@/lib/changes";
import { addDays, toApiDate } from "@/lib/dates";
import { isCounted } from "@/lib/rules";
import type { Change, HelpdeskRequest, Site, Staff, Status } from "@/types";

const HIGHLIGHT_MS = 8_000;

export function describeError(e: unknown): string {
  if (e instanceof ApiError)
    return e.status ? `${e.status}: ${e.message}` : e.message;
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
        if (!cancelled)
          setReference({
            sites: sites.data,
            staff: staff.data,
            statuses: statuses.data,
          });
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(describeError(e));
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const applyChanges = useCallback((changes: Change[]) => {
    setReference((current) => {
      if (!current) return current;
      const staff = mergeStaffChanges(current.staff, changes);
      return staff === current.staff ? current : { ...current, staff };
    });
  }, []);

  return {
    reference,
    error,
    retry: () => setAttempt((n) => n + 1),
    applyChanges,
  };
}

/**
 * All requests created in [from, to] (site-local dates, rule 1).
 * The API filters on UTC dates, so we ask for one extra day on each side and filter locally per site.
 */
export function useRequests(
  from: string | null,
  to: string | null,
  sites: Site[] | undefined,
  enabled = true,
) {
  const [requests, setRequests] = useState<HelpdeskRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [loadedAt, setLoadedAt] = useState<Date | null>(null);
  const [highlighted, setHighlighted] = useState<ReadonlySet<number>>(
    new Set(),
  );
  const [lastChange, setLastChange] = useState<{
    count: number;
    at: number;
  } | null>(null);

  const current = useRef<HelpdeskRequest[]>([]);
  const scope = useRef<{
    from: string;
    to: string;
    zones: Map<number, string>;
  } | null>(null);
  const loadingRef = useRef(false);
  const buffered = useRef<Change[]>([]);
  const clearTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  const commit = useCallback((next: HelpdeskRequest[]) => {
    current.current = next;
    setRequests(next);
  }, []);

  const merge = useCallback((base: HelpdeskRequest[], changes: Change[]) => {
    const active = scope.current;
    if (!active) return { requests: base, changedIds: [] as number[] };
    return mergeRequestChanges(base, changes, (r) => {
      const zone = active.zones.get(r.site_id);
      return zone !== undefined && isCounted(r, zone, active.from, active.to);
    });
  }, []);

  const flash = useCallback((ids: number[]) => {
    setHighlighted(new Set(ids));
    setLastChange({ count: ids.length, at: Date.now() });
    clearTimeout(clearTimer.current);
    clearTimer.current = setTimeout(
      () => setHighlighted(new Set()),
      HIGHLIGHT_MS,
    );
  }, []);

  useEffect(() => () => clearTimeout(clearTimer.current), []);

  const applyChanges = useCallback(
    (changes: Change[]) => {
      if (loadingRef.current) buffered.current.push(...changes);
      const result = merge(current.current, changes);
      if (result.requests === current.current) return;
      commit(result.requests);
      flash(result.changedIds);
    },
    [merge, commit, flash],
  );

  useEffect(() => {
    if (!enabled || !configured() || !from || !to || !sites) return;
    let cancelled = false;
    const zones = new Map(sites.map((s) => [s.id, s.timezone]));
    scope.current = { from, to, zones };
    buffered.current = [];
    loadingRef.current = true;
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
        const snapshot = all.filter(
          (r) =>
            zones.has(r.site_id) &&
            isCounted(r, zones.get(r.site_id)!, from, to),
        );
        commit(merge(snapshot, buffered.current).requests);
        buffered.current = [];
        setLoadedAt(new Date());
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(describeError(e));
      })
      .finally(() => {
        if (!cancelled) {
          loadingRef.current = false;
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [from, to, sites, attempt, enabled, commit, merge]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return {
    requests,
    loading,
    error,
    retry,
    loadedAt,
    applyChanges,
    highlighted,
    lastChange,
  };
}
