import { ChevronLeftIcon, ChevronRightIcon, ChevronsLeftIcon, ChevronsRightIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PAGE_SIZES, type PageSize } from "@/lib/query";

interface Props {
  page: number;
  totalPages: number;
  size: PageSize;
  total: number;
  onPageChange: (page: number) => void;
  onSizeChange: (size: PageSize) => void;
}

export function Pagination({ page, totalPages, size, total, onPageChange, onSizeChange }: Props) {
  const first = total === 0 ? 0 : (page - 1) * size + 1;
  const last = Math.min(page * size, total);
  const sizeItems = PAGE_SIZES.map((s) => ({ value: String(s), label: String(s) }));

  return (
    <nav
      aria-label="Pagination"
      className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 text-sm">
      <div className="flex items-center gap-2">
        <Label htmlFor="page-size">Rows per page</Label>
        <Select items={sizeItems} value={String(size)} onValueChange={(v) => onSizeChange(Number(v) as PageSize)}>
          <SelectTrigger
            id="page-size"
            size="sm"
            className="h-11 w-20 data-[size=sm]:h-11 sm:h-7 sm:data-[size=sm]:h-7">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {sizeItems.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <p aria-live="polite" className="text-muted-foreground">
        {first}–{last} of {total}
      </p>
      <div className="flex w-full items-center justify-center gap-1 sm:w-auto">
        <Button variant="outline" size="icon-sm" className="size-11 sm:size-7" aria-label="First page" disabled={page <= 1} onClick={() => onPageChange(1)}>
          <ChevronsLeftIcon />
        </Button>
        <Button variant="outline" size="icon-sm" className="size-11 sm:size-7" aria-label="Previous page" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          <ChevronLeftIcon />
        </Button>
        <span className="px-2">
          Page {page} of {totalPages}
        </span>
        <Button variant="outline" size="icon-sm" className="size-11 sm:size-7" aria-label="Next page" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
          <ChevronRightIcon />
        </Button>
        <Button variant="outline" size="icon-sm" className="size-11 sm:size-7" aria-label="Last page" disabled={page >= totalPages} onClick={() => onPageChange(totalPages)}>
          <ChevronsRightIcon />
        </Button>
      </div>
    </nav>
  );
}
