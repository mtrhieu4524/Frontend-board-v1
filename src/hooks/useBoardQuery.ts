import { useCallback, useEffect, useState } from "react";
import {
  BOARD_PATH,
  parseQuery,
  serializeQuery,
  type BoardQuery,
} from "@/lib/query";

type Range = { from: string; to: string };

/**
 * Board state that lives in the URL, so a link carries range, filters and sort.
 * `fallbackRange` is the default range, used until the user picks one. The effective range
 * is written to the URL as soon as it is known.
 */
export function useBoardQuery(fallbackRange: Range | null) {
  const [query, setQuery] = useState<BoardQuery>(() =>
    parseQuery(window.location.search),
  );

  // Any change goes back to page 1, unless the patch itself sets the page.
  const update = useCallback(
    (patch: Partial<BoardQuery>) =>
      setQuery((q) => ({ ...q, page: 1, ...patch })),
    [],
  );

  const range: Range | null =
    query.from && query.to ? { from: query.from, to: query.to } : fallbackRange;
  const from = range?.from;
  const to = range?.to;

  useEffect(() => {
    const next = serializeQuery(query, from && to ? { from, to } : null);
    if (
      window.location.pathname !== BOARD_PATH ||
      next !== window.location.search
    ) {
      window.history.replaceState(null, "", `${BOARD_PATH}${next}`);
    }
  }, [query, from, to]);

  // Back/forward or a manually edited URL re-reads the state.
  useEffect(() => {
    const onPop = () => setQuery(parseQuery(window.location.search));
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  return { query, update, range };
}
