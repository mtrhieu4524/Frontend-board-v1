import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, configured, listChanges } from "@/api";
import { describeError } from "@/hooks/useBoardData";
import type { Change } from "@/types";

const STORAGE_KEY = "helpdesk.changes.cursor";
const MAX_SAVED_CURSOR_AGE_MS = 10 * 60 * 1000;
const RETRY_BASE_MS = 5_000;
const RETRY_MAX_MS = 60_000;

export type FeedStatus = "starting" | "live" | "retrying";

interface Options {
  enabled: boolean;
  onChanges: (changes: Change[]) => void;
  intervalMs?: number;
}

function loadCursor(): string | undefined {
  try {
    const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? "null") as {
      cursor: string;
      savedAt: number;
    } | null;
    return saved && Date.now() - saved.savedAt < MAX_SAVED_CURSOR_AGE_MS
      ? saved.cursor
      : undefined;
  } catch {
    return undefined;
  }
}

function saveCursor(cursor: string | undefined) {
  try {
    if (cursor)
      sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ cursor, savedAt: Date.now() }),
      );
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    return;
  }
}

export function useChangeFeed({
  enabled,
  onChanges,
  intervalMs = 30_000,
}: Options) {
  const [status, setStatus] = useState<FeedStatus>("starting");
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const cursor = useRef<string | undefined>(undefined);
  const cursorLoaded = useRef(false);
  const handler = useRef(onChanges);
  const pollNow = useRef<() => void>(() => undefined);

  useEffect(() => {
    handler.current = onChanges;
  }, [onChanges]);

  useEffect(() => {
    if (!enabled || !configured()) return;
    if (!cursorLoaded.current) {
      cursor.current = loadCursor();
      cursorLoaded.current = true;
    }

    let cancelled = false;
    let running = false;
    let failures = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const schedule = (ms: number) => {
      clearTimeout(timer);
      timer = setTimeout(tick, ms);
    };

    async function catchUp(): Promise<boolean> {
      for (;;) {
        let page;
        try {
          page = await listChanges(cursor.current);
        } catch (e) {
          if (e instanceof ApiError && e.status === 410 && cursor.current) {
            cursor.current = undefined;
            saveCursor(undefined);
            setStatus("starting");
            continue;
          }
          throw e;
        }
        if (cancelled) return false;
        handler.current(page.data);
        cursor.current = page.next_cursor;
        saveCursor(page.next_cursor);
        if (!page.has_more) return true;
      }
    }

    async function tick() {
      if (running || cancelled) return;
      if (document.hidden) {
        schedule(intervalMs);
        return;
      }
      running = true;
      setSyncing(true);
      try {
        if (await catchUp()) {
          failures = 0;
          setError(null);
          setStatus("live");
          setLastSyncedAt(new Date());
          schedule(intervalMs);
        }
      } catch (e) {
        if (cancelled) return;
        failures += 1;
        setError(describeError(e));
        setStatus("retrying");
        schedule(Math.min(RETRY_MAX_MS, RETRY_BASE_MS * 2 ** (failures - 1)));
      } finally {
        running = false;
        if (!cancelled) setSyncing(false);
      }
    }

    const onVisible = () => {
      if (!document.hidden) void tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    pollNow.current = () => {
      clearTimeout(timer);
      void tick();
    };
    void tick();

    return () => {
      cancelled = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
      pollNow.current = () => undefined;
    };
  }, [enabled, intervalMs]);

  const refresh = useCallback(() => pollNow.current(), []);
  return { status, lastSyncedAt, error, syncing, refresh };
}
