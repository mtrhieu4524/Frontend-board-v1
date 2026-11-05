import { useCallback, useEffect, useMemo } from "react";
import { useLocation, useMatch, useNavigate } from "react-router-dom";
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
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  const query = useMemo(() => parseQuery(search), [search]);
  const onBoard = useMatch(BOARD_PATH) !== null;
  const onRequest = useMatch("/requests/:id") !== null;
  const active = onBoard || onRequest;

  const range: Range | null =
    query.from && query.to ? { from: query.from, to: query.to } : fallbackRange;
  const from = range?.from;
  const to = range?.to;

  useEffect(() => {
    if (!active) return;
    const next = serializeQuery(query, from && to ? { from, to } : null);
    if (next !== search) navigate({ pathname, search: next }, { replace: true });
  }, [active, query, pathname, search, from, to, navigate]);

  // Any change goes back to page 1, unless the patch itself sets the page.
  const update = useCallback(
    (patch: Partial<BoardQuery>) => {
      const next = { ...query, page: 1, ...patch };
      navigate(
        {
          pathname,
          search: serializeQuery(next, from && to ? { from, to } : null),
        },
        { replace: true },
      );
    },
    [query, pathname, from, to, navigate],
  );

  return { query, update, range };
}
