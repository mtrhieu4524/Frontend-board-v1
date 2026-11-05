import { useCallback, useEffect, useState } from "react";
import { ApiError, configured, fetchAllPages, getRequest, listEvents } from "@/api";
import { describeError } from "@/hooks/useBoardData";
import type { HelpdeskRequest, RequestEvent } from "@/types";

export interface RequestDetailState {
  request: HelpdeskRequest | null;
  events: RequestEvent[];
  loading: boolean;
  notFound: boolean;
  error: string | null;
  retry: () => void;
}

export function useRequestDetail(id: number): RequestDetailState {
  const [request, setRequest] = useState<HelpdeskRequest | null>(null);
  const [events, setEvents] = useState<RequestEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    setRequest(null);
    setEvents([]);
    setNotFound(false);
    setError(null);
  }, [id]);

  useEffect(() => {
    if (!configured()) return;
    let cancelled = false;
    setLoading(true);
    setNotFound(false);
    setError(null);
    Promise.all([getRequest(id), fetchAllPages((page) => listEvents(id, page))])
      .then(([loadedRequest, loadedEvents]) => {
        if (cancelled) return;
        setRequest(loadedRequest);
        setEvents(loadedEvents);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        if (e instanceof ApiError && e.status === 404) setNotFound(true);
        else setError(describeError(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { request, events, loading, notFound, error, retry };
}
