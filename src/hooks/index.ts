/** Small shared hooks. */

import { useCallback, useEffect, useRef, useState } from 'react';
import { getCapabilities } from '../lib/capabilities';

/**
 * Create an object URL for a blob and revoke it automatically when the blob
 * changes or the component unmounts. This is the *only* sanctioned way to make
 * a preview URL — it is what keeps a phone from running out of memory after a
 * dozen edits.
 */
export function useObjectUrl(blob: Blob | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!blob) {
      setUrl(null);
      return undefined;
    }

    const next = URL.createObjectURL(blob);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [blob]);

  return url;
}

/** Debounce a rapidly changing value (slider drags, resize inputs). */
export function useDebounced<T>(value: T, delay = 180): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

/** `true` once the component has mounted on the client. */
export function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}

/**
 * Track the browser's visual viewport height so full-height layouts do not
 * jump when the Android URL bar hides and shows.
 */
export function useViewportHeight(): number {
  const [height, setHeight] = useState(() =>
    typeof window === 'undefined' ? 800 : window.innerHeight,
  );

  useEffect(() => {
    const update = () => setHeight(window.innerHeight);
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, []);

  return height;
}

/** Cached capability probe, safe to call during render. */
export function useCapabilities() {
  return getCapabilities();
}

/**
 * Persisted boolean toggle (used for "remember my choice" style options).
 * Degrades to plain state when storage is unavailable.
 */
export function usePersistentFlag(key: string, initial = false): [boolean, (value: boolean) => void] {
  const [value, setValue] = useState<boolean>(() => {
    try {
      const raw = window.localStorage.getItem(key);
      return raw === null ? initial : raw === 'true';
    } catch {
      return initial;
    }
  });

  const set = useCallback(
    (next: boolean) => {
      setValue(next);
      try {
        window.localStorage.setItem(key, String(next));
      } catch {
        /* ignore */
      }
    },
    [key],
  );

  return [value, set];
}

/** Run a callback once, guarding against React 18/19 double-invoked effects. */
export function useOnce(callback: () => void): void {
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    callback();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

/**
 * Subscribe to a media query. Used for "is this a touch device" decisions
 * without re-rendering on every resize.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window === 'undefined' ? false : window.matchMedia(query).matches,
  );

  useEffect(() => {
    const list = window.matchMedia(query);
    const onChange = () => setMatches(list.matches);
    onChange();
    list.addEventListener('change', onChange);
    return () => list.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}
