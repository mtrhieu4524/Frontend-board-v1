import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FILTERABLE_STATUSES, SORT_OPTIONS, type BoardQuery, type SortKey } from "@/lib/query";
import type { Site, Status } from "@/types";

const ALL = "all";

interface Props {
  query: BoardQuery;
  range: { from: string; to: string } | null;
  sites: Site[];
  statusLabels: Map<Status, string>;
  onChange: (patch: Partial<BoardQuery>) => void;
}

export function Filters({ query, range, sites, statusLabels, onChange }: Props) {
  const from = query.from ?? range?.from ?? "";
  const to = query.to ?? range?.to ?? "";
  const siteItems = [{ value: ALL, label: "All sites" }, ...sites.map((s) => ({ value: String(s.id), label: s.name }))];
  const statusItems = [{ value: ALL, label: "All statuses" }, ...FILTERABLE_STATUSES.map((s) => ({ value: s, label: statusLabels.get(s) ?? s }))];

  // Only commit a range when both ends are valid and ordered; otherwise keep what is on screen.
  const changeRange = (nextFrom: string, nextTo: string) => {
    if (nextFrom && nextTo && nextFrom <= nextTo) onChange({ from: nextFrom, to: nextTo });
  };

  return (
    <div className="my-4 flex flex-wrap items-end gap-4">
      <div className="grid gap-1.5">
        <Label htmlFor="range-from">From</Label>
        <Input id="range-from" type="date" value={from} max={to || undefined} onChange={(e) => changeRange(e.target.value, to)} className="w-40" />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="range-to">To</Label>
        <Input id="range-to" type="date" value={to} min={from || undefined} onChange={(e) => changeRange(from, e.target.value)} className="w-40" />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="filter-site">Site</Label>
        <Select items={siteItems} value={query.site === null ? ALL : String(query.site)} onValueChange={(v) => onChange({ site: v === ALL ? null : Number(v) })}>
          <SelectTrigger id="filter-site" className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All sites</SelectItem>
            {sites.map((s) => (
              <SelectItem key={s.id} value={String(s.id)}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="filter-status">Status</Label>
        <Select items={statusItems} value={query.status ?? ALL} onValueChange={(v) => onChange({ status: v === ALL ? null : (v as Status) })}>
          <SelectTrigger id="filter-status" className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All statuses</SelectItem>
            {FILTERABLE_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {statusLabels.get(s) ?? s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="sort">Sort</Label>
        <Select items={SORT_OPTIONS} value={query.sort} onValueChange={(v) => onChange({ sort: v as SortKey })}>
          <SelectTrigger id="sort" className="w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
