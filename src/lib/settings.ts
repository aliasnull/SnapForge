/**
 * Persisted user preferences (theme, default format/quality, resize behaviour).
 * Same defensive storage access as the history module — a browser with storage
 * disabled still gets a fully working app, just without remembered settings.
 */

import type { OutputFormat, Settings, ThemePreference } from './types';

const STORAGE_KEY = 'snapforge.settings.v1';

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  defaultFormat: 'image/webp',
  defaultQuality: 0.75,
  lockAspectByDefault: true,
  preserveOriginalSize: true,
};

const VALID_FORMATS: OutputFormat[] = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
const VALID_THEMES: ThemePreference[] = ['system', 'light', 'dark'];

function safeStorage(): Storage | null {
  try {
    const probe = '__snapforge_settings_probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    return null;
  }
}

export function loadSettings(): Settings {
  const storage = safeStorage();
  if (!storage) return { ...DEFAULT_SETTINGS };

  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<Settings>;

    return {
      theme: VALID_THEMES.includes(parsed.theme as ThemePreference)
        ? (parsed.theme as ThemePreference)
        : DEFAULT_SETTINGS.theme,
      defaultFormat: VALID_FORMATS.includes(parsed.defaultFormat as OutputFormat)
        ? (parsed.defaultFormat as OutputFormat)
        : DEFAULT_SETTINGS.defaultFormat,
      defaultQuality:
        typeof parsed.defaultQuality === 'number' &&
        parsed.defaultQuality >= 0.1 &&
        parsed.defaultQuality <= 1
          ? parsed.defaultQuality
          : DEFAULT_SETTINGS.defaultQuality,
      lockAspectByDefault:
        typeof parsed.lockAspectByDefault === 'boolean'
          ? parsed.lockAspectByDefault
          : DEFAULT_SETTINGS.lockAspectByDefault,
      preserveOriginalSize:
        typeof parsed.preserveOriginalSize === 'boolean'
          ? parsed.preserveOriginalSize
          : DEFAULT_SETTINGS.preserveOriginalSize,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: Settings): void {
  const storage = safeStorage();
  if (!storage) return;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    /* ignore */
  }
}

export function clearSettings(): void {
  const storage = safeStorage();
  if (!storage) return;
  try {
    storage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
