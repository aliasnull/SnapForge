/** History store — same observable pattern as settings. */

import { useCallback, useSyncExternalStore } from 'react';
import {
  addHistoryEntries,
  clearHistory as clearHistoryStorage,
  createHistoryEntry,
  loadHistory,
  removeHistoryEntry as removeHistoryStorage,
} from '../lib/history';
import type { HistoryEntry } from '../lib/types';

let current: HistoryEntry[] = typeof window === 'undefined' ? [] : loadHistory();
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): HistoryEntry[] {
  return current;
}

export function getHistory(): HistoryEntry[] {
  return current;
}

export function recordHistory(
  entry: Omit<HistoryEntry, 'id' | 'timestamp'> & { timestamp?: number },
): void {
  current = addHistoryEntries(current, [createHistoryEntry(entry)]);
  emit();
}

export function recordHistoryBatch(
  entries: (Omit<HistoryEntry, 'id' | 'timestamp'> & { timestamp?: number })[],
): void {
  if (entries.length === 0) return;
  current = addHistoryEntries(current, entries.map((entry) => createHistoryEntry(entry)));
  emit();
}

export function clearHistory(): void {
  clearHistoryStorage();
  current = [];
  emit();
}

export function removeHistoryEntry(id: string): void {
  current = removeHistoryStorage(current, id);
  emit();
}

export function useHistory(): HistoryEntry[] {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function useHistoryActions(): {
  clear: () => void;
  remove: (id: string) => void;
} {
  return {
    clear: useCallback(() => clearHistory(), []),
    remove: useCallback((id: string) => removeHistoryEntry(id), []),
  };
}
