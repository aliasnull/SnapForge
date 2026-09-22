/**
 * Theme resolution.
 *
 * Three states: `system`, `light`, `dark`. The resolved value is written to
 * `documentElement[data-theme]`, which every colour token keys off, plus a
 * `color-scheme` hint so native form controls and the Android status bar match.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { loadSettings, saveSettings } from '../lib/settings';
import type { Settings, ThemePreference } from '../lib/types';

export type ResolvedTheme = 'light' | 'dark';

interface ThemeContextValue {
  preference: ThemePreference;
  resolved: ResolvedTheme;
  setPreference: (preference: ThemePreference) => void;
  /** Cycles system -> dark -> light -> system, for the header toggle. */
  cycle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function systemPrefersDark(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return true;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function resolve(preference: ThemePreference): ResolvedTheme {
  if (preference === 'system') return systemPrefersDark() ? 'dark' : 'light';
  return preference;
}

export function applyTheme(resolved: ResolvedTheme, preference: ThemePreference): void {
  const root = document.documentElement;
  root.setAttribute('data-theme', resolved);
  root.setAttribute('data-theme-preference', preference);
  root.style.colorScheme = resolved;

  const meta = document.querySelector('meta[name="theme-color"]');
  const color = resolved === 'dark' ? '#08090c' : '#f7f8fb';
  if (meta) meta.setAttribute('content', color);
}

interface ThemeProviderProps {
  children: ReactNode;
  /** Existing settings + setter so theme and settings share one source. */
  settings: Settings;
  updateSettings: (patch: Partial<Settings>) => void;
}

export function ThemeProvider({ children, settings, updateSettings }: ThemeProviderProps) {
  const [resolved, setResolved] = useState<ResolvedTheme>(() => resolve(settings.theme));

  useEffect(() => {
    const next = resolve(settings.theme);
    setResolved(next);
    applyTheme(next, settings.theme);
  }, [settings.theme]);

  // Follow the OS while the preference is `system`.
  useEffect(() => {
    if (settings.theme !== 'system' || !window.matchMedia) return undefined;

    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      const next: ResolvedTheme = query.matches ? 'dark' : 'light';
      setResolved(next);
      applyTheme(next, 'system');
    };

    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, [settings.theme]);

  const setPreference = useCallback(
    (preference: ThemePreference) => {
      updateSettings({ theme: preference });
    },
    [updateSettings],
  );

  const cycle = useCallback(() => {
    const order: ThemePreference[] = ['system', 'dark', 'light'];
    const index = order.indexOf(settings.theme);
    setPreference(order[(index + 1) % order.length]!);
  }, [settings.theme, setPreference]);

  const value = useMemo<ThemeContextValue>(
    () => ({ preference: settings.theme, resolved, setPreference, cycle }),
    [settings.theme, resolved, setPreference, cycle],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used inside <ThemeProvider>');
  return context;
}

/** Settings-backed theme, persisted through the same store as everything else. */
export function useStoredTheme(): {
  preference: ThemePreference;
  resolved: ResolvedTheme;
  cycle: () => void;
} {
  const [settings, setSettings] = useState<Settings>(() => loadSettings());

  const cycle = useCallback(() => {
    setSettings((current) => {
      const order: ThemePreference[] = ['system', 'dark', 'light'];
      const index = order.indexOf(current.theme);
      const next: Settings = { ...current, theme: order[(index + 1) % order.length]! };
      saveSettings(next);
      return next;
    });
  }, []);

  const resolved = resolve(settings.theme);

  useEffect(() => {
    applyTheme(resolved, settings.theme);
  }, [resolved, settings.theme]);

  return { preference: settings.theme, resolved, cycle };
}
