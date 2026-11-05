import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ComponentProps,
} from "react";
import { Navigate, Route, Routes, useMatch, useParams } from "react-router-dom";
import { configured } from "./api";
import { BoardTable } from "./components/BoardTable";
import { Filters } from "./components/Filters";
import { LiveStatus } from "./components/LiveStatus";
import { Pagination } from "./components/Pagination";
import { RequestDetail } from "./components/RequestDetail";
import { Button } from "./components/ui/button";
import { useReference, useRequests } from "./hooks/useBoardData";
import { useBoardQuery } from "./hooks/useBoardQuery";
import { useChangeFeed } from "./hooks/useChangeFeed";
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
  const busy = loading || (!reference && !referenceError);

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

  const search = serializeQuery(query, range);

  const backHref = `${BOARD_PATH}${search}`;
  const failure = referenceError ?? error;

  const board = (
    <main className="mx-auto max-w-7xl p-4">
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
          status={feed.status}
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
          className="mb-3 flex items-center justify-between gap-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <span>Could not load requests: {failure}</span>
          <Button
            size="sm"
            variant="outline"
            onClick={reference ? retryRequests : retryReference}>
            Try again
          </Button>
        </div>
      )}
      <BoardTable
        rows={paged.items}
        sites={sites}
        staff={staff}
        statusLabels={statusLabels}
        loading={busy}
        failed={Boolean(failure)}
        hrefFor={(r) => `${requestPath(r.id)}${search}`}
        highlighted={highlighted}
      />
      {!busy && !failure && rows.length > 0 && (
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
