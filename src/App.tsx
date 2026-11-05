import { useEffect, useMemo } from "react";
import { configured } from "./api";
import { BoardTable } from "./components/BoardTable";
import { Filters } from "./components/Filters";
import { Pagination } from "./components/Pagination";
import { Button } from "./components/ui/button";
import { useReference, useRequests } from "./hooks/useBoardData";
import { useBoardQuery } from "./hooks/useBoardQuery";
import { defaultRange } from "./lib/range";
import { filterRows, paginate, sortRows } from "./lib/query";

export default function App() {
  const {
    reference,
    error: referenceError,
    retry: retryReference,
  } = useReference();

  const fallbackRange = useMemo(
    () => (reference ? defaultRange(reference.sites) : null),
    [reference],
  );
  const { query, update, range } = useBoardQuery(fallbackRange);
  const {
    requests,
    loading,
    error,
    retry: retryRequests,
  } = useRequests(range?.from ?? null, range?.to ?? null, reference?.sites);

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

  const failure = referenceError ?? error;

  return (
    <main className="mx-auto max-w-7xl p-4">
      <h1 className="text-2xl font-semibold">Requests board</h1>
      <Filters
        query={query}
        range={range}
        sites={reference?.sites ?? []}
        statusLabels={statusLabels}
        onChange={update}
      />
      <p className="mb-2 text-sm text-muted-foreground">
        {busy ? "" : `Showing ${rows.length} of ${requests.length} requests.`}
      </p>
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
}
