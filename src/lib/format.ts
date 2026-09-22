/**
 * Formatting helpers shared by every screen.
 * All of them are pure and safe to call during render.
 */

const KB = 1024;
const UNITS = ['B', 'KB', 'MB', 'GB'] as const;

/** Human readable file size, e.g. `4.8 MB`, `820 KB`, `912 B`. */
export function formatBytes(bytes: number, digits?: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—';
  if (bytes < KB) return `${Math.round(bytes)} B`;

  let value = bytes;
  let unit = 0;
  while (value >= KB && unit < UNITS.length - 1) {
    value /= KB;
    unit += 1;
  }
  const decimals = digits ?? (value >= 100 ? 0 : value >= 10 ? 1 : 2);
  return `${value.toFixed(decimals)} ${UNITS[unit]}`;
}

/** Exact byte count with thousands separators, for tooltips / detail rows. */
export function formatExactBytes(bytes: number): string {
  if (!Number.isFinite(bytes)) return '—';
  return `${bytes.toLocaleString()} bytes`;
}

/** `1920 × 1080` — uses the multiplication sign, not the letter x. */
export function formatDimensions(width: number, height: number): string {
  return `${Math.round(width)} × ${Math.round(height)}`;
}

export function formatMegapixels(width: number, height: number): string {
  const mp = (width * height) / 1_000_000;
  if (mp >= 10) return `${mp.toFixed(1)} MP`;
  return `${mp.toFixed(2)} MP`;
}

/** Greatest common divisor, used for a tidy aspect ratio label. */
function gcd(a: number, b: number): number {
  a = Math.abs(Math.round(a));
  b = Math.abs(Math.round(b));
  while (b) {
    const t = b;
    b = a % b;
    a = t;
  }
  return a || 1;
}

/**
 * Aspect ratio as a reduced ratio when the numbers stay readable
 * (`16:9`), otherwise as a decimal (`1.85:1`).
 */
export function formatAspectRatio(width: number, height: number): string {
  if (!width || !height) return '—';
  const divisor = gcd(width, height);
  const w = Math.round(width / divisor);
  const h = Math.round(height / divisor);
  if (w <= 40 && h <= 40) return `${w}:${h}`;
  return `${(width / height).toFixed(2)}:1`;
}

/**
 * Signed percentage change between two sizes.
 * Negative means the output is smaller (good). Returns `null` when the
 * baseline is unusable so callers can render a dash instead of `NaN%`.
 */
export function percentChange(before: number, after: number): number | null {
  if (!before || before <= 0) return null;
  return ((after - before) / before) * 100;
}

/** `82.9% smaller` / `12.0% larger` / `Same size`. */
export function formatSizeDelta(before: number, after: number): string {
  const change = percentChange(before, after);
  if (change === null) return '—';
  if (Math.abs(change) < 0.05) return 'Same size';
  const magnitude = Math.abs(change).toFixed(1);
  return change < 0 ? `${magnitude}% smaller` : `${magnitude}% larger`;
}

/** `82.9%` — always the absolute magnitude, for stat tiles. */
export function formatPercentMagnitude(before: number, after: number): string {
  const change = percentChange(before, after);
  if (change === null) return '—';
  return `${Math.abs(change).toFixed(1)}%`;
}

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

export function formatTimestamp(epochMs: number): string {
  try {
    return dateFormatter.format(new Date(epochMs));
  } catch {
    return '—';
  }
}

/** `just now`, `4 min ago`, `3 days ago`. */
export function formatRelativeTime(epochMs: number, now = Date.now()): string {
  const seconds = Math.max(0, Math.round((now - epochMs) / 1000));
  if (seconds < 45) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} ${days === 1 ? 'day' : 'days'} ago`;
  return formatTimestamp(epochMs);
}

/** Clamp helper used by every numeric control in the app. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Parse a user-typed number, falling back when the field is empty/NaN. */
export function toInt(value: string, fallback: number): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}
