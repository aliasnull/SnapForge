/**
 * Build-time configuration.
 *
 * `GITHUB_URL` is intentionally empty by default: the footer only shows a
 * repository link when one is actually configured, so the app never invents a
 * URL that goes nowhere. Set it here (or via `VITE_GITHUB_URL` at build time)
 * once the repository exists.
 */

export const APP_NAME = 'SnapForge';
export const APP_TAGLINE = 'Fast. Private. In Your Browser.';
export const APP_VERSION = '1.0.0';

const envUrl =
  typeof import.meta !== 'undefined' && import.meta.env
    ? (import.meta.env.VITE_GITHUB_URL as string | undefined)
    : undefined;

export const GITHUB_URL = (envUrl ?? '').trim();
export const HAS_GITHUB_URL = GITHUB_URL.length > 0;

/** Canonical origin used for the Open Graph tags; empty means "use current URL". */
export const CANONICAL_ORIGIN = (
  (typeof import.meta !== 'undefined' && import.meta.env
    ? (import.meta.env.VITE_CANONICAL_ORIGIN as string | undefined)
    : undefined) ?? ''
).trim();

export const TOOL_ROUTES = {
  compress: '/compress',
  resize: '/resize',
  convert: '/convert',
  crop: '/crop',
  rotate: '/rotate',
  batch: '/batch',
} as const;
