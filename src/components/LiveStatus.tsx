import { useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { FeedStatus } from "@/hooks/useChangeFeed";
import { formatAgo, formatClock } from "@/lib/time";
import { cn } from "@/lib/utils";

interface Props {
  status: FeedStatus;
  lastUpdated: Date | null;
  error: string | null;
  lastChange: { count: number; at: number } | null;
  canRefresh: boolean;
  syncing: boolean;
  onRefresh: () => void;
}

const MIN_SPIN_MS = 700;

const LABELS: Record<FeedStatus, string> = {
  starting: "Connecting…",
  live: "Live",
  retrying: "Reconnecting…",
};

function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}

export function LiveStatus({
  status,
  lastUpdated,
  error,
  lastChange,
  canRefresh,
  syncing,
  onRefresh,
}: Props) {
  const now = useNow(5_000);
  const [refreshing, setRefreshing] = useState(false);
  const clickedAt = useRef(0);

  useEffect(() => {
    if (!refreshing || syncing) return;
    const wait = Math.max(0, MIN_SPIN_MS - (Date.now() - clickedAt.current));
    const timer = setTimeout(() => setRefreshing(false), wait);
    return () => clearTimeout(timer);
  }, [refreshing, syncing]);

  const handleRefresh = () => {
    clickedAt.current = Date.now();
    setRefreshing(true);
    onRefresh();
  };
  const plural = lastChange && lastChange.count !== 1 ? "requests" : "request";
  const live = status === "live";

  return (
    <div className="space-y-2 text-sm text-muted-foreground">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
              live
                ? "border-green-200 bg-green-50 text-green-700"
                : "border-amber-200 bg-amber-50 text-amber-700",
            )}>
            <span
              aria-hidden="true"
              className={cn(
                "size-1.5 rounded-full",
                live ? "bg-green-500" : "animate-pulse bg-amber-500",
              )}
            />
            {LABELS[status]}
          </span>
          {lastUpdated && (
            <span>
              Updated{" "}
              <time
                dateTime={lastUpdated.toISOString()}
                className="font-medium text-foreground">
                {formatClock(lastUpdated)}
              </time>{" "}
              <span className="text-xs">
                ({formatAgo(now - lastUpdated.getTime())})
              </span>
            </span>
          )}
          {lastChange && (
            <span className="hidden items-center gap-3 sm:inline-flex">
              <span aria-hidden="true" className="text-border">
                |
              </span>
              <span>
                <span className="font-medium text-foreground">
                  {lastChange.count} {plural}
                </span>{" "}
                changed {formatAgo(now - lastChange.at)}
              </span>
            </span>
          )}
        </div>
        <Button
          size="sm"
          variant="outline"
          disabled={!canRefresh || refreshing}
          aria-busy={refreshing}
          onClick={handleRefresh}>
          <RefreshCw
            aria-hidden="true"
            className={cn("size-3.5", refreshing && "animate-spin")}
          />
          {refreshing ? "Refreshing…" : "Refresh now"}
        </Button>
      </div>
      {error && (
        <p
          role="alert"
          className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800">
          Could not reach the helpdesk ({error}). Showing the last data
          received; retrying automatically.
        </p>
      )}
      <span role="status" className="sr-only">
        {lastChange
          ? `Board updated: ${lastChange.count} ${plural} changed.`
          : ""}
      </span>
    </div>
  );
}
