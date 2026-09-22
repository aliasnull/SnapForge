/**
 * Local history.
 *
 * Stores *metadata only*: file name, operation, sizes, timestamp. The image
 * bytes are never written to storage — they live in memory for as long as the
 * tab is open and disappear when it closes.
 *
 * localStorage is used rather than IndexedDB because the payload is tiny
 * (capped at 100 entries ≈ 20 KB) and synchronous access keeps the UI simple.
 */

import type { HistoryEntry, HistoryOperation } from './types';

const STORAGE_KEY = 'snapforge.history.v1';
const MAX_ENTRIES = 100;

function safeStorage(): Storage | null {
  try {
    const probe = '__snapforge_probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    // Private mode / storage disabled — history silently becomes a no-op.
    return null;
  }
}

function isHistoryEntry(value: unknown): value is HistoryEntry {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Partial<HistoryEntry>;
  return (
    typeof entry.id === 'string' &&
    typeof entry.operation === 'string' &&
    typeof entry.fileName === 'string' &&
    typeof entry.originalSize === 'number' &&
    typeof entry.outputSize === 'number' &&
    typeof entry.timestamp === 'number'
  );
}

export function loadHistory(): HistoryEntry[] {
  const storage = safeStorage();
  if (!storage) return [];

  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isHistoryEntry).sort((a, b) => b.timestamp - a.timestamp);
  } catch {
    return [];
  }
}

function persist(entries: HistoryEntry[]): void {
  const storage = safeStorage();
  if (!storage) return;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)));
  } catch {
    // Quota exceeded — drop the oldest half and try once more.
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, Math.floor(MAX_ENTRIES / 2))));
    } catch {
      /* give up quietly */
    }
  }
}

export function createHistoryEntry(
  input: Omit<HistoryEntry, 'id' | 'timestamp'> & { timestamp?: number },
): HistoryEntry {
  const id =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `h_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

  return {
    ...input,
    id,
    timestamp: input.timestamp ?? Date.now(),
  };
}

export function addHistoryEntries(
  existing: HistoryEntry[],
  additions: HistoryEntry[],
): HistoryEntry[] {
  if (additions.length === 0) return existing;
  const next = [...additions, ...existing].slice(0, MAX_ENTRIES);
  persist(next);
  return next;
}

export function clearHistory(): void {
  const storage = safeStorage();
  if (!storage) return;
  try {
    storage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function removeHistoryEntry(entries: HistoryEntry[], id: string): HistoryEntry[] {
  const next = entries.filter((entry) => entry.id !== id);
  persist(next);
  return next;
}

export const OPERATION_LABELS: Record<HistoryOperation, string> = {
  compress: 'Compress',
  resize: 'Resize',
  convert: 'Convert',
  crop: 'Crop',
  rotate: 'Rotate',
  batch: 'Batch',
};

/** Approximate storage footprint of the history list, for the settings page. */
export function historyFootprint(entries: HistoryEntry[]): number {
  try {
    return new Blob([JSON.stringify(entries)]).size;
  } catch {
    return 0;
  }
}
