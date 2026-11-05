import { InboxIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  filtered: boolean;
  onClear: () => void;
}

export function EmptyState({ filtered, onClear }: Props) {
  return (
    <div
      role="status"
      className="flex flex-col items-center gap-3 rounded-lg border border-dashed px-4 py-12 text-center">
      <InboxIcon aria-hidden="true" className="size-8 text-muted-foreground" />
      <h2 className="font-medium">No requests found</h2>
      <p className="max-w-sm text-sm text-muted-foreground">
        {filtered
          ? "Nothing matches the site and status filters for these dates."
          : "No requests were created in this date range. Try widening the dates."}
      </p>
      {filtered && (
        <Button variant="outline" size="sm" onClick={onClear}>
          Clear filters
        </Button>
      )}
    </div>
  );
}
