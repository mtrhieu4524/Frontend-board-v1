// The board's shareable state (range, filters, sort) <-> URL query string, plus the filter and sort logic.

import type { HelpdeskRequest, Status } from "@/types";

export const BOARD_PATH = "/board";

export type SortKey = "created_desc" | "created_asc" | "due_asc" | "due_desc";

export const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "created_desc", label: "Created: newest first" },
  { value: "created_asc", label: "Created: oldest first" },
  { value: "due_asc", label: "Due: soonest first" },
  { value: "due_desc", label: "Due: latest first" },
];

/** `null` for from/to means "use the default range" (last 30 days). */
export interface BoardQuery {
  from: string | null;
  to: string | null;
  site: number | null;
  status: Status | null;
  sort: SortKey;
  /** 1-based page number and rows per page. */
  page: number;
  size: PageSize;
}

export const PAGE_SIZES = [5, 10, 20, 50, 100] as const;
export type PageSize = (typeof PAGE_SIZES)[number];
export const DEFAULT_PAGE_SIZE: PageSize = 20;

export const DEFAULT_QUERY: BoardQuery = {
  from: null,
  to: null,
  site: null,
  status: null,
  sort: "created_desc",
  page: 1,
  size: DEFAULT_PAGE_SIZE,
};

// "canceled" is never shown (rule 1), so it is not a filter option.
export const FILTERABLE_STATUSES: Status[] = [
  "pending",
  "processing",
  "complete",
];

function validDate(value: string | null): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
    ? null
    : value;
}

/** Tolerant parser: anything invalid falls back to the default instead of breaking the page. */
export function parseQuery(search: string): BoardQuery {
  const params = new URLSearchParams(search);
  let from = validDate(params.get("from"));
  let to = validDate(params.get("to"));
  if (!from || !to || from > to) {
    from = null;
    to = null;
  }
  const siteParam = params.get("site");
  const site = siteParam && /^\d+$/.test(siteParam) ? Number(siteParam) : null;
  const statusParam = params.get("status") as Status | null;
  const status =
    statusParam && FILTERABLE_STATUSES.includes(statusParam)
      ? statusParam
      : null;
  const sortParam = params.get("sort") as SortKey | null;
  const sort = SORT_OPTIONS.some((o) => o.value === sortParam)
    ? (sortParam as SortKey)
    : DEFAULT_QUERY.sort;
  const pageParam = params.get("page");
  const page =
    pageParam && /^\d+$/.test(pageParam) && Number(pageParam) >= 1
      ? Number(pageParam)
      : 1;
  const sizeParam = Number(params.get("size"));
  const size = PAGE_SIZES.find((s) => s === sizeParam) ?? DEFAULT_PAGE_SIZE;
  return { from, to, site, status, sort, page, size };
}

export function serializeQuery(
  query: BoardQuery,
  range: { from: string; to: string } | null,
): string {
  const params = new URLSearchParams();
  const from = query.from ?? range?.from;
  const to = query.to ?? range?.to;
  if (from && to) {
    params.set("from", from);
    params.set("to", to);
  }
  if (query.site !== null) params.set("site", String(query.site));
  if (query.status) params.set("status", query.status);
  if (query.sort !== DEFAULT_QUERY.sort) params.set("sort", query.sort);
  if (query.size !== DEFAULT_PAGE_SIZE) params.set("size", String(query.size));
  params.set("page", String(query.page));
  const text = params.toString();
  return text ? `?${text}` : "";
}

export function paginate<T>(
  rows: T[],
  page: number,
  size: number,
): { items: T[]; page: number; totalPages: number } {
  const totalPages = Math.max(1, Math.ceil(rows.length / size));
  const current = Math.min(Math.max(1, page), totalPages);
  return {
    items: rows.slice((current - 1) * size, current * size),
    page: current,
    totalPages,
  };
}

export function filterRows(
  rows: HelpdeskRequest[],
  query: Pick<BoardQuery, "site" | "status">,
): HelpdeskRequest[] {
  return rows.filter(
    (r) =>
      (query.site === null || r.site_id === query.site) &&
      (!query.status || r.status === query.status),
  );
}

export function sortRows(
  rows: HelpdeskRequest[],
  sort: SortKey,
): HelpdeskRequest[] {
  const direction = sort.endsWith("_asc") ? 1 : -1;
  return [...rows].sort((a, b) => {
    if (sort.startsWith("due")) {
      if (a.due_on === null && b.due_on === null) return a.id - b.id;
      if (a.due_on === null) return 1;
      if (b.due_on === null) return -1;
      if (a.due_on !== b.due_on)
        return a.due_on < b.due_on ? -direction : direction;
    } else if (a.created_at !== b.created_at) {
      return (Date.parse(a.created_at) - Date.parse(b.created_at)) * direction;
    }
    return a.id - b.id;
  });
}
