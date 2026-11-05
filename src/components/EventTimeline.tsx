import { CogIcon } from "lucide-react";
import { StatusBadge } from "@/components/badges";
import { Badge } from "@/components/ui/badge";
import { formatEventTime, formatWallClock } from "@/lib/rules";
import { cn } from "@/lib/utils";
import type { RequestEvent, Staff, Status } from "@/types";

interface Props {
  events: RequestEvent[];
  staff: Map<number, Staff>;
  timeZone: string;
  statusLabels: Map<Status, string>;
  firstResponseId: number | null;
  undoneIds: Set<number>;
}

function actorName(event: RequestEvent, staff: Map<number, Staff>): string {
  if (event.actor_id === null) return "System";
  return staff.get(event.actor_id)?.name ?? "Unknown staff";
}

function initials(name: string): string {
  const letters = name
    .split(/[\s-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]);
  return letters.join("").toUpperCase() || "?";
}

function Avatar({ name, system }: { name: string; system: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
        system ? "bg-slate-200 text-slate-600" : "bg-blue-100 text-blue-800",
      )}>
      {system ? <CogIcon className="size-4" /> : initials(name)}
    </span>
  );
}

export function EventTimeline({
  events,
  staff,
  timeZone,
  statusLabels,
  firstResponseId,
  undoneIds,
}: Props) {
  if (events.length === 0)
    return <p className="text-muted-foreground">No events yet.</p>;

  return (
    <ol className="grid gap-3">
      {events.map((event) => {
        const undone = undoneIds.has(event.id);
        const system = event.actor_id === null;
        const name = actorName(event, staff);
        return (
          <li
            key={event.id}
            className={cn(
              "flex gap-3 rounded-md border p-3 text-sm",
              undone && "border-dashed bg-muted/40 text-muted-foreground",
            )}>
            <Avatar name={name} system={system} />
            <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,20rem)] sm:gap-6">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-base font-semibold text-foreground">
                    <span className="sr-only">Done by </span>
                    {name}
                  </span>
                  <StatusBadge status={event.status} labels={statusLabels} />
                  {event.id === firstResponseId && (
                    <Badge variant="secondary">First response</Badge>
                  )}
                  {undone && (
                    <Badge variant="outline">
                      {event.reverts_id !== null ? "Undo" : "Undone"}
                    </Badge>
                  )}
                </div>
                <time
                  dateTime={new Date(event.at * 1000).toISOString()}
                  className="mt-0.5 block text-xs text-muted-foreground">
                  {formatEventTime(event.at, timeZone)}
                </time>
              </div>
              {(event.assignee_name ||
                event.due_at ||
                event.reverts_id !== null ||
                event.note) && (
                <ul className="grid content-start gap-1 sm:text-right">
                  {event.assignee_name && (
                    <li>Assigned to {event.assignee_name}</li>
                  )}
                  {event.due_at && (
                    <li>
                      Due set to {formatWallClock(event.due_at, timeZone)}
                    </li>
                  )}
                  {event.reverts_id !== null && (
                    <li>Undoes event #{event.reverts_id}</li>
                  )}
                  {event.note && <li>“{event.note}”</li>}
                </ul>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
