/**
 * Runtime capability detection.
 *
 * SnapForge never claims a format it cannot actually produce. Everything the
 * UI gates on (WebP, AVIF, OffscreenCanvas, clipboard paste, share sheet) is
 * probed once at start-up and cached here.
 */

import type { AppCapabilities, OutputFormat } from './types';

let cached: AppCapabilities | null = null;

/** Canvas area (in pixels) we refuse to allocate on low-memory devices. */
const IOS_MAX_AREA = 16_777_216; // 4096 × 4096 — iOS Safari's classic canvas ceiling.
const DEFAULT_MAX_AREA = 67_108_864; // 8192 × 8192
const HARD_MAX_AREA = 178_956_970; // ~13400²  — absolute ceiling everywhere.

function probeEncode(mime: string): boolean {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const url = canvas.toDataURL(mime);
    return typeof url === 'string' && url.startsWith(`data:${mime}`);
  } catch {
    return false;
  }
}

function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  // iPadOS 13+ reports itself as a Mac with touch points.
  return (
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

function detectDeviceMemory(): number | undefined {
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  return typeof memory === 'number' ? memory : undefined;
}

export function getCapabilities(): AppCapabilities {
  if (cached) return cached;

  const hasDocument = typeof document !== 'undefined';
  const deviceMemoryGb = detectDeviceMemory();

  // A device reporting 2 GB or less gets the conservative canvas budget.
  const constrained = isIOS() || (deviceMemoryGb !== undefined && deviceMemoryGb <= 2);
  const maxCanvasArea = constrained
    ? IOS_MAX_AREA
    : deviceMemoryGb !== undefined && deviceMemoryGb <= 4
      ? 40_000_000
      : DEFAULT_MAX_AREA;

  cached = {
    webpEncode: hasDocument && probeEncode('image/webp'),
    avifEncode: hasDocument && probeEncode('image/avif'),
    offscreenCanvas: typeof OffscreenCanvas !== 'undefined',
    webWorkers: typeof Worker !== 'undefined',
    clipboardImage:
      typeof navigator !== 'undefined' &&
      typeof navigator.clipboard?.read === 'function' &&
      (typeof window === 'undefined' || window.isSecureContext),
    share:
      typeof navigator !== 'undefined' && typeof navigator.share === 'function',
    maxCanvasArea,
    maxCanvasSide: Math.floor(Math.sqrt(HARD_MAX_AREA)),
    ...(deviceMemoryGb !== undefined ? { deviceMemoryGb } : {}),
  };

  return cached;
}

/** True when this build can actually encode the given output format. */
export function canEncode(format: OutputFormat, caps = getCapabilities()): boolean {
  switch (format) {
    case 'image/jpeg':
    case 'image/png':
      return true;
    case 'image/webp':
      return caps.webpEncode;
    case 'image/avif':
      return caps.avifEncode;
    default:
      return false;
  }
}

/** Formats offered in every format picker, in preference order. */
export function supportedOutputFormats(caps = getCapabilities()): OutputFormat[] {
  const formats: OutputFormat[] = ['image/jpeg', 'image/png', 'image/webp'];
  if (caps.avifEncode) formats.push('image/avif');
  return formats;
}

/** Lossy formats accept a quality slider; PNG is always lossless. */
export function isLossy(format: OutputFormat): boolean {
  return format !== 'image/png';
}

/** PNG cannot be quality-tuned; WebP/AVIF/JPEG can. */
export function formatSupportsQuality(format: OutputFormat): boolean {
  return isLossy(format);
}

/**
 * Formats the *file picker* should accept. GIF and BMP are listed because the
 * browser's own decoder handles them on every platform we target — they are
 * converted to a canvas-backed format on output.
 */
export const ACCEPTED_INPUT_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
  'image/gif',
  'image/bmp',
  'image/x-ms-bmp',
] as const;

export const ACCEPT_ATTRIBUTE = `${ACCEPTED_INPUT_TYPES.join(',')},.jpg,.jpeg,.png,.webp,.avif,.gif,.bmp`;

/** Extensions that map to a decodable MIME type when the picker omits one. */
export const EXTENSION_MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  jfif: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  avif: 'image/avif',
  gif: 'image/gif',
  bmp: 'image/bmp',
};

export function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot === -1 ? '' : name.slice(dot + 1).toLowerCase();
}

/** Best-effort MIME type for a File, covering pickers that report ''. */
export function resolveMimeType(file: File): string {
  if (file.type) return file.type.toLowerCase();
  return EXTENSION_MIME[extensionOf(file.name)] ?? '';
}

/** The canvas budget for a specific pixel count. */
export function canvasBudget(caps = getCapabilities()): number {
  return caps.maxCanvasArea;
}
