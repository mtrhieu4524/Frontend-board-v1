import { useSyncExternalStore } from "react";
import { isRetrying, subscribeRetrying } from "@/api";

export const AUTO_RETRY_MS = 15_000;

export function useRetrying(): boolean {
  return useSyncExternalStore(subscribeRetrying, isRetrying);
}
