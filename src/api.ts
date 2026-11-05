// A thin client for the helpdesk API. Extend it; don't scatter fetch calls through components.

import type { ChangesPage, HelpdeskRequest, Page, RequestEvent, Site, Staff, Status } from "./types";

const BASE = (import.meta.env.HELPDESK_URL ?? "").replace(/\/$/, "");
const TOKEN = import.meta.env.HELPDESK_TOKEN ?? "";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public retryAfterSeconds: number | null = null,
  ) {
    super(message);
  }
}

export function configured(): boolean {
  return Boolean(BASE && TOKEN);
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const MAX_ATTEMPTS = 5;

let retrying = 0;
const retryListeners = new Set<() => void>();

function adjustRetrying(delta: number) {
  retrying += delta;
  retryListeners.forEach((listener) => listener());
}

export const subscribeRetrying = (listener: () => void) => {
  retryListeners.add(listener);
  return () => {
    retryListeners.delete(listener);
  };
};

export const isRetrying = () => retrying > 0;

function backoff(attempt: number): number {
  return 500 * 2 ** (attempt - 1) + Math.random() * 250;
}

/** GET with retries: 429 waits for Retry-After, 5xx and network errors back off exponentially. Other 4xx fail fast. */
export async function get<T>(path: string, params: Record<string, string | number | undefined> = {}): Promise<T> {
  const url = new URL(BASE + path);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }
  let counted = false;
  const waitBeforeRetry = async (ms: number) => {
    if (!counted) {
      counted = true;
      adjustRetrying(1);
    }
    await sleep(ms);
  };
  try {
    for (let attempt = 1; ; attempt++) {
      let response: Response;
      try {
        response = await fetch(url, { headers: { Authorization: `Bearer ${TOKEN}` } });
      } catch {
        // fetch rejects on network failure: retry, then give up with a readable error.
        if (attempt >= MAX_ATTEMPTS) throw new ApiError(0, "Cannot reach the helpdesk");
        await waitBeforeRetry(backoff(attempt));
        continue;
      }
      if (response.ok) {
        try {
          return (await response.json()) as T;
        } catch {
          throw new ApiError(0, "The helpdesk sent a reply we could not read");
        }
      }

      const body = (await response.json().catch(() => ({}))) as { error?: string };
      const retryAfter = Number(response.headers.get("Retry-After"));
      const hasRetryAfter = response.headers.has("Retry-After") && Number.isFinite(retryAfter) && retryAfter >= 0;
      const error = new ApiError(response.status, body.error ?? response.statusText, hasRetryAfter ? retryAfter : null);
      const retryable = response.status === 429 || response.status >= 500;
      if (!retryable || attempt >= MAX_ATTEMPTS) throw error;
      await waitBeforeRetry(hasRetryAfter ? Math.min(retryAfter, 10) * 1000 : backoff(attempt));
    }
  } finally {
    if (counted) adjustRetrying(-1);
  }
}

export const listRequests = (params: { page?: number; per_page?: number; created_from?: string; created_to?: string; status?: string }) =>
  get<Page<HelpdeskRequest>>("/v1/requests", params);

/** Every page of a paged endpoint, deduplicated by id. */
export async function fetchAllPages<T extends { id: number }>(load: (page: number) => Promise<Page<T>>): Promise<T[]> {
  const byId = new Map<number, T>();
  for (let page = 1; ; page++) {
    const result = await load(page);
    for (const item of result.data) byId.set(item.id, item);
    const more = result.has_more ?? (result.total_pages !== undefined ? page < result.total_pages : result.data.length > 0);
    if (!more || result.data.length === 0) break;
  }
  return [...byId.values()];
}

export const getRequest = (id: number) => get<HelpdeskRequest>(`/v1/requests/${id}`);

export const listEvents = (id: number, page = 1) => get<Page<RequestEvent>>(`/v1/requests/${id}/events`, { page });

export const listSites = () => get<{ data: Site[] }>("/v1/sites");

export const listStaff = () => get<{ data: Staff[] }>("/v1/staff");

export const listStatuses = () => get<{ data: { value: Status; label: string }[] }>("/v1/statuses");

export const listChanges = (cursor?: string, limit = 500) => get<ChangesPage>("/v1/changes", { cursor, limit });
