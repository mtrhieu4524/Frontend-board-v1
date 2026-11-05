export const PREVIEW_STATES = [
  "loading",
  "empty",
  "error",
  "busy",
  "down",
] as const;

export type PreviewState = (typeof PREVIEW_STATES)[number];

export function parsePreview(search: string): PreviewState | null {
  const value = new URLSearchParams(
    search.startsWith("?") ? search.slice(1) : search,
  ).get("preview");
  return PREVIEW_STATES.find((state) => state === value) ?? null;
}

export function keepPreview(currentSearch: string, nextSearch: string): string {
  const preview = new URLSearchParams(
    currentSearch.startsWith("?") ? currentSearch.slice(1) : currentSearch,
  ).get("preview");
  if (!preview) return nextSearch;
  const params = new URLSearchParams(
    nextSearch.startsWith("?") ? nextSearch.slice(1) : nextSearch,
  );
  params.set("preview", preview);
  return `?${params}`;
}
