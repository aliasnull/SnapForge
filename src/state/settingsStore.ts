/**
 * Settings store — a tiny observable singleton.
 *
 * Both React components and plain modules (the image pipeline) need to read the
 * current defaults, so the state lives outside React and is subscribed to via
 * `useSyncExternalStore`. That keeps a single source of truth with no provider
 * gymnastics and no stale closures in async code.
 */

import { useCallback, useSyncExternalStore } from 'react';
import {
  DEFAULT_SETTINGS,
  clearSettings,
  loadSettings,
  saveSettings,
} from '../lib/settings';
import type { Settings } from '../lib/types';

let current: Settings = typeof window === 'undefined' ? { ...DEFAULT_SETTINGS } : loadSettings();
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): Settings {
  return current;
}

export function getSettings(): Settings {
  return current;
}

export function updateSettings(patch: Partial<Settings>): void {
  current = { ...current, ...patch };
  saveSettings(current);
  emit();
}

export function resetSettings(): void {
  current = { ...DEFAULT_SETTINGS };
  clearSettings();
  emit();
}

export function useSettings(): [Settings, (patch: Partial<Settings>) => void] {
  const settings = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return [settings, updateSettings];
}

export function useSetting<K extends keyof Settings>(key: K): Settings[K] {
  const settings = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return settings[key];
}

/** Convenience hook returning a stable setter for one key. */
export function useSettingSetter<K extends keyof Settings>(
  key: K,
): (value: Settings[K]) => void {
  return useCallback(
    (value: Settings[K]) => {
      updateSettings({ [key]: value } as Partial<Settings>);
    },
    [key],
  );
}
