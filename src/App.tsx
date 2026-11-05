import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
} from "react";
import {
  Navigate,
  Route,
  Routes,
  useLocation,
  useMatch,
  useParams,
} from "react-router-dom";
import { configured } from "./api";
import { BoardTable } from "./components/BoardTable";
import { EmptyState } from "./components/EmptyState";
import { Filters } from "./components/Filters";
import { LiveStatus } from "./components/LiveStatus";
import { Pagination } from "./components/Pagination";
import { RequestDetail } from "./components/RequestDetail";
import { Button } from "./components/ui/button";
import { useReference, useRequests } from "./hooks/useBoardData";
import { useBoardQuery } from "./hooks/useBoardQuery";
import { useChangeFeed } from "./hooks/useChangeFeed";
import { AUTO_RETRY_MS, useRetrying } from "./hooks/useRetrying";
import { keepPreview, parsePreview } from "./lib/preview";
import { defaultRange } from "./lib/range";
import {
  BOARD_PATH,
  filterRows,
  paginate,
  serializeQuery,
  sortRows,
} from "./lib/query";
import { requestPath } from "./lib/route";
import type { Change } from "./types";

function RequestRoute(props: Omit<ComponentProps<typeof RequestDetail>, "id">) {
  const { id } = useParams();
  if (!id || !/^\d+$/.test(id)) return <Navigate to={props.backHref} replace />;
  return <RequestDetail id={Number(id)} {...props} />;
}

export default function App() {
  const { search: locationSearch } = useLocation();
  const preview = parsePreview(locationSearch);
  const onRequestPage = useMatch("/requests/:id") !== null;
  const {
    reference,
    error: referenceError,
    retry: retryReference,
    applyChanges: applyStaffChanges,
  } = useReference();

  const fallbackRange = useMemo(
    () => (reference ? defaultRange(reference.sites) : null),
    [reference],
  );
  const { query, update, range } = useBoardQuery(fallbackRange);

  const [boardOpened, setBoardOpened] = useState(!onRequestPage);
  if (!onRequestPage && !boardOpened) setBoardOpened(true);
  const {
    requests,
    loading,
    error,
    retry: retryRequests,
    loadedAt,
    applyChanges: applyRequestChanges,
    highlighted,
    lastChange,
  } = useRequests(
    range?.from ?? null,
    range?.to ?? null,
    reference?.sites,
    boardOpened,
  );

  const onChanges = useCallback(
    (changes: Change[]) => {
      applyRequestChanges(changes);
      applyStaffChanges(changes);
    },
    [applyRequestChanges, applyStaffChanges],
  );
  const feed = useChangeFeed({
    enabled: boardOpened && Boolean(reference) && loadedAt !== null,
    onChanges,
  });
  const lastUpdated =
    loadedAt && feed.lastSyncedAt && feed.lastSyncedAt > loadedAt
      ? feed.lastSyncedAt
      : loadedAt;

  const sites = useMemo(
    () => new Map((reference?.sites ?? []).map((s) => [s.id, s])),
    [reference],
  );
  const staff = useMemo(
    () => new Map((reference?.staff ?? []).map((s) => [s.id, s])),
    [reference],
  );
  const statusLabels = useMemo(
    () => new Map((reference?.statuses ?? []).map((s) => [s.value, s.label])),
    [reference],
  );
  const rows = useMemo(
    () => sortRows(filterRows(requests, query), query.sort),
    [requests, query],
  );
  const paged = useMemo(
    () => paginate(rows, query.page, query.size),
    [rows, query.page, query.size],
  );
  const previewLoading = preview === "loading" || preview === "busy";
  const busy =
    previewLoading ||
    (!preview && (loading || (!reference && !referenceError)));
  const failure =
    preview === "error"
      ? "The helpdesk refused the access token"
      : preview === "down"
        ? "The helpdesk is temporarily unavailable"
        : preview
          ? null
          : (referenceError ?? error);
  const waiting = useRetrying();
  const retrying = preview === "busy" || waiting;
  const resultsRef = useRef<HTMLDivElement>(null);

  const retryFailed = reference ? retryRequests : retryReference;
  const retryFailedRef = useRef(retryFailed);
  useEffect(() => {
    retryFailedRef.current = retryFailed;
  });
  useEffect(() => {
    if (!failure || preview) return;
    const timer = setTimeout(() => retryFailedRef.current(), AUTO_RETRY_MS);
    return () => clearTimeout(timer);
  }, [failure, preview]);

  // A link or a shrinking result set can point past the last page: move the URL to the page shown.
  // Wait until requests have arrived: before that the list is empty and every page would clamp to 1.
  const hasData = requests.length > 0;
  useEffect(() => {
    if (!busy && hasData && paged.page !== query.page)
      update({ page: paged.page });
  }, [busy, hasData, paged.page, query.page, update]);

  if (!configured()) {
    return (
      <p className="p-4">
        Save <code>HELPDESK_URL</code> and <code>HELPDESK_TOKEN</code> in{" "}
        <code>.env</code>, then restart <code>npm run dev</code>.
      </p>
    );
  }

  const search = keepPreview(
    locationSearch,
    serializeQuery(query, range),
  );

  const backHref = `${BOARD_PATH}${search}`;
  const filtered = query.site !== null || query.status !== null;
  const hasRows = rows.length > 0;
  const showEmpty =
    preview === "empty" || (!preview && !busy && !failure && !hasRows);
  const hideTable = preview === "empty" || preview === "error";
  const showTable =
    !hideTable && (previewLoading || preview === "down" || hasRows || busy);
  const tableLoading = previewLoading || (busy && !hasRows);

  const board = (
    <main className="relative mx-auto max-w-7xl p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <a
        href="#requests"
        onClick={(e) => {
          e.preventDefault();
          resultsRef.current?.focus();
        }}
        className="absolute left-3 top-3 z-50 -translate-y-[200%] rounded-md bg-background px-3 py-2 text-sm font-medium shadow-md outline-none focus-visible:translate-y-0 focus-visible:ring-3 focus-visible:ring-ring/60">
        Skip to requests
      </a>
      <h1 className="text-2xl font-semibold">Requests board</h1>
      <Filters
        query={query}
        range={range}
        sites={reference?.sites ?? []}
        statusLabels={statusLabels}
        onChange={update}
      />
      <div className="mb-3">
        <LiveStatus
          status={failure ? "retrying" : feed.status}
          lastUpdated={lastUpdated}
          error={feed.error}
          lastChange={lastChange}
          canRefresh={loadedAt !== null}
          syncing={feed.syncing}
          onRefresh={feed.refresh}
        />
      </div>
      {failure && (
        <div
          role="alert"
          className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <span>
            Could not load requests. {failure}.{" "}
            {hasRows && !hideTable
              ? "Showing the last data received."
              : null}{" "}
            We will try again in a few seconds.
          </span>
          <Button
            size="sm"
            variant="outline"
            className="min-h-11 sm:min-h-7"
            onClick={retryFailed}>
            Try again
          </Button>
        </div>
      )}
      {busy && retrying && !failure && (
        <p
          role="status"
          className="mb-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          The helpdesk is slow to answer. Retrying automatically…
        </p>
      )}
      <p role="status" className="sr-only">
        {busy
          ? "Loading requests…"
          : failure
            ? ""
            : showEmpty
              ? "No requests found."
              : `${rows.length} ${rows.length === 1 ? "request" : "requests"} found.`}
      </p>
      <div
        id="requests"
        ref={resultsRef}
        tabIndex={-1}
        className="outline-none">
        {showEmpty ? (
          <EmptyState
            filtered={filtered}
            onClear={() => update({ site: null, status: null })}
          />
        ) : (
          showTable && (
            <BoardTable
              rows={paged.items}
              sites={sites}
              staff={staff}
              statusLabels={statusLabels}
              loading={tableLoading}
              hrefFor={(r) => `${requestPath(r.id)}${search}`}
              highlighted={highlighted}
            />
          )
        )}
      </div>
      {!tableLoading && !showEmpty && !hideTable && rows.length > 0 && (
        <Pagination
          page={paged.page}
          totalPages={paged.totalPages}
          size={query.size}
          total={rows.length}
          onPageChange={(page) => update({ page })}
          onSizeChange={(size) => update({ size })}
        />
      )}
    </main>
  );

  return (
    <Routes>
      <Route path={BOARD_PATH} element={board} />
      <Route
        path="/requests/:id"
        element={
          <RequestRoute
            sites={sites}
            staff={staff}
            statusLabels={statusLabels}
            referenceReady={Boolean(reference)}
            referenceError={referenceError}
            onRetryReference={retryReference}
            backHref={backHref}
          />
        }
      />
      <Route path="*" element={<Navigate to={backHref} replace />} />
    </Routes>
  );
}
