/**
 * The image operations themselves.
 *
 * Each function takes a decoded source and returns a `ProcessResult` (blob +
 * metadata + timing). Nothing here touches React, the DOM shell, or storage —
 * which is what makes them reusable from the worker as well as the main thread.
 */

import { canvasBudget } from '../capabilities';
import { AppError, toAppError } from '../errors';
import { buildOutputName, canAllocateCanvas } from '../files';
import type {
  CropRect,
  EncodeOptions,
  OutputFormat,
  ProcessResult,
  ResizeOptions,
  Rotation,
  TransformOptions,
} from '../types';
import { renderCrop, renderToSurface, renderTransform, type Surface } from './canvas';
import { encodeSmallest, encodeSurface } from './encode';

export interface OperationInput {
  source: CanvasImageSource;
  sourceWidth: number;
  sourceHeight: number;
  /** Original file name, used to derive the output name. */
  fileName: string;
  /** Original byte size, used to report savings honestly. */
  originalSize?: number;
  originalType?: string;
}

function finalize(
  surface: Surface,
  encoded: { blob: Blob; type: string; substituted: boolean },
  startedAt: number,
  options: { name: string; format: OutputFormat; quality?: number; warn?: string },
): ProcessResult {
  const meta = {
    name: options.name,
    type: options.format,
    size: encoded.blob.size,
    width: surface.width,
    height: surface.height,
    ...(options.quality !== undefined ? { quality: options.quality } : {}),
  };

  const result: ProcessResult = {
    blob: encoded.blob,
    meta,
    durationMs: Math.round(performance.now() - startedAt),
  };

  if (encoded.substituted || options.warn) {
    result.meta.name = options.name;
  }

  return result;
}

/* -------------------------------------------------------------------------- */
/* Resize                                                                     */
/* -------------------------------------------------------------------------- */

export async function resizeImage(
  input: OperationInput,
  options: ResizeOptions & EncodeOptions,
): Promise<ProcessResult> {
  const startedAt = performance.now();

  const width = Math.max(1, Math.round(options.width));
  const height = Math.max(1, Math.round(options.height));

  const check = canAllocateCanvas(width, height, canvasBudget());
  if (!check.ok) {
    throw new AppError({
      code: 'too-large',
      title: 'Output is too large',
      message: check.message,
      hint: check.hint,
    });
  }

  try {
    const surface = renderToSurface(input.source, {
      width,
      height,
      fit: options.fit,
      background: options.background,
      flatten: options.format === 'image/jpeg',
      sourceWidth: input.sourceWidth,
      sourceHeight: input.sourceHeight,
    });

    const encoded = await encodeSurface(surface, {
      format: options.format,
      quality: options.quality,
    });

    return finalize(surface, encoded, startedAt, {
      name: buildOutputName(input.fileName, {
        suffix: `${width}x${height}`,
        format: options.format,
      }),
      format: options.format,
      quality: options.format === 'image/png' ? undefined : options.quality,
    });
  } catch (error) {
    throw toAppError(error, 'resize this image');
  }
}

/* -------------------------------------------------------------------------- */
/* Compress                                                                   */
/* -------------------------------------------------------------------------- */

export interface CompressOptions extends EncodeOptions {
  /** Optional cap on the longest side; `0` keeps the original dimensions. */
  maxWidth?: number;
  maxHeight?: number;
}

/**
 * Compression = optional downscale + lossy re-encode. When the source is
 * already smaller than the requested cap we never upscale — that would inflate
 * the file for no visual gain.
 */
export async function compressImage(
  input: OperationInput,
  options: CompressOptions,
): Promise<ProcessResult> {
  const startedAt = performance.now();

  try {
    let targetWidth = input.sourceWidth;
    let targetHeight = input.sourceHeight;

    const cap = options.maxWidth && options.maxWidth > 0 ? options.maxWidth : 0;
    if (cap && targetWidth > cap) {
      const scale = cap / targetWidth;
      targetWidth = Math.round(targetWidth * scale);
      targetHeight = Math.round(targetHeight * scale);
    }

    const hardCap = options.maxHeight && options.maxHeight > 0 ? options.maxHeight : 0;
    if (hardCap && targetHeight > hardCap) {
      const scale = hardCap / targetHeight;
      targetWidth = Math.round(targetWidth * scale);
      targetHeight = Math.round(targetHeight * scale);
    }

    targetWidth = Math.max(1, targetWidth);
    targetHeight = Math.max(1, targetHeight);

    const check = canAllocateCanvas(targetWidth, targetHeight, canvasBudget());
    if (!check.ok) {
      throw new AppError({
        code: 'too-large',
        title: 'Output is too large',
        message: check.message,
        hint: check.hint,
      });
    }

    const surface = renderToSurface(input.source, {
      width: targetWidth,
      height: targetHeight,
      fit: 'stretch',
      background: options.background,
      flatten: options.format === 'image/jpeg',
      sourceWidth: input.sourceWidth,
      sourceHeight: input.sourceHeight,
    });

    const encoded = await encodeSmallest(surface, {
      format: options.format,
      quality: options.quality,
      ...(input.originalSize !== undefined ? { originalSize: input.originalSize } : {}),
    });

    return finalize(surface, encoded, startedAt, {
      name: buildOutputName(input.fileName, {
        suffix: 'compressed',
        format: options.format,
      }),
      format: options.format,
      quality: options.format === 'image/png' ? undefined : options.quality,
    });
  } catch (error) {
    throw toAppError(error, 'compress this image');
  }
}

/* -------------------------------------------------------------------------- */
/* Convert                                                                    */
/* -------------------------------------------------------------------------- */

export async function convertImage(
  input: OperationInput,
  options: EncodeOptions,
): Promise<ProcessResult> {
  const startedAt = performance.now();

  try {
    const surface = renderToSurface(input.source, {
      width: input.sourceWidth,
      height: input.sourceHeight,
      fit: 'stretch',
      background: options.background,
      flatten: options.format === 'image/jpeg',
      sourceWidth: input.sourceWidth,
      sourceHeight: input.sourceHeight,
    });

    const encoded = await encodeSurface(surface, {
      format: options.format,
      quality: options.quality,
    });

    return finalize(surface, encoded, startedAt, {
      name: buildOutputName(input.fileName, {
        suffix: 'converted',
        format: options.format,
      }),
      format: options.format,
      quality: options.format === 'image/png' ? undefined : options.quality,
    });
  } catch (error) {
    throw toAppError(error, 'convert this image');
  }
}

/* -------------------------------------------------------------------------- */
/* Crop                                                                       */
/* -------------------------------------------------------------------------- */

export interface CropOptions extends EncodeOptions {
  /** Optional output size; defaults to the crop rect's own size. */
  outputWidth?: number;
  outputHeight?: number;
}

export async function cropImage(
  input: OperationInput,
  rect: CropRect,
  options: CropOptions,
): Promise<ProcessResult> {
  const startedAt = performance.now();

  const sx = Math.max(0, Math.round(rect.x));
  const sy = Math.max(0, Math.round(rect.y));
  const sw = Math.max(1, Math.min(Math.round(rect.width), input.sourceWidth - sx));
  const sh = Math.max(1, Math.min(Math.round(rect.height), input.sourceHeight - sy));

  const outWidth = Math.max(1, Math.round(options.outputWidth ?? sw));
  const outHeight = Math.max(1, Math.round(options.outputHeight ?? sh));

  const check = canAllocateCanvas(outWidth, outHeight, canvasBudget());
  if (!check.ok) {
    throw new AppError({
      code: 'too-large',
      title: 'Crop is too large',
      message: check.message,
      hint: check.hint,
    });
  }

  try {
    const surface = renderCrop(input.source, sx, sy, sw, sh, outWidth, outHeight, {
      flatten: options.format === 'image/jpeg',
      background: options.background,
    });

    const encoded = await encodeSurface(surface, {
      format: options.format,
      quality: options.quality,
    });

    return finalize(surface, encoded, startedAt, {
      name: buildOutputName(input.fileName, {
        suffix: `${outWidth}x${outHeight}`,
        format: options.format,
      }),
      format: options.format,
      quality: options.format === 'image/png' ? undefined : options.quality,
    });
  } catch (error) {
    throw toAppError(error, 'crop this image');
  }
}

/* -------------------------------------------------------------------------- */
/* Rotate / flip                                                              */
/* -------------------------------------------------------------------------- */

export function isIdentityTransform(options: TransformOptions): boolean {
  return options.rotation === 0 && !options.flipH && !options.flipV;
}

export function describeTransform(options: TransformOptions): string {
  const parts: string[] = [];
  if (options.rotation === 90) parts.push('rotated-90');
  else if (options.rotation === 180) parts.push('rotated-180');
  else if (options.rotation === 270) parts.push('rotated-270');
  if (options.flipH) parts.push('flipped-h');
  if (options.flipV) parts.push('flipped-v');
  return parts.join('-') || 'unchanged';
}

export async function transformImage(
  input: OperationInput,
  transform: TransformOptions,
  options: EncodeOptions,
): Promise<ProcessResult> {
  const startedAt = performance.now();

  const swapped = transform.rotation === 90 || transform.rotation === 270;
  const outWidth = swapped ? input.sourceHeight : input.sourceWidth;
  const outHeight = swapped ? input.sourceWidth : input.sourceHeight;

  const check = canAllocateCanvas(outWidth, outHeight, canvasBudget());
  if (!check.ok) {
    throw new AppError({
      code: 'too-large',
      title: 'Output is too large',
      message: check.message,
      hint: check.hint,
    });
  }

  try {
    const surface = renderTransform(
      input.source,
      input.sourceWidth,
      input.sourceHeight,
      transform.rotation,
      transform.flipH,
      transform.flipV,
      { flatten: options.format === 'image/jpeg', background: options.background },
    );

    const encoded = await encodeSurface(surface, {
      format: options.format,
      quality: options.quality,
    });

    return finalize(surface, encoded, startedAt, {
      name: buildOutputName(input.fileName, {
        suffix: describeTransform(transform),
        format: options.format,
      }),
      format: options.format,
      quality: options.format === 'image/png' ? undefined : options.quality,
    });
  } catch (error) {
    throw toAppError(error, 'rotate this image');
  }
}

/* -------------------------------------------------------------------------- */
/* Presets                                                                    */
/* -------------------------------------------------------------------------- */

export interface DimensionPreset {
  label: string;
  width: number;
  height: number;
  group: 'video' | 'social' | 'classic';
}

export const DIMENSION_PRESETS: DimensionPreset[] = [
  { label: '4K UHD', width: 3840, height: 2160, group: 'video' },
  { label: 'Full HD', width: 1920, height: 1080, group: 'video' },
  { label: 'HD 720p', width: 1280, height: 720, group: 'video' },
  { label: 'Square', width: 1080, height: 1080, group: 'social' },
  { label: 'Story 9:16', width: 1080, height: 1920, group: 'social' },
  { label: 'Open Graph', width: 1200, height: 630, group: 'social' },
];

export interface AspectPreset {
  label: string;
  /** null = freeform. */
  ratio: number | null;
}

export const ASPECT_PRESETS: AspectPreset[] = [
  { label: 'Free', ratio: null },
  { label: '1:1', ratio: 1 },
  { label: '4:3', ratio: 4 / 3 },
  { label: '3:2', ratio: 3 / 2 },
  { label: '16:9', ratio: 16 / 9 },
  { label: '9:16', ratio: 9 / 16 },
];

export interface QualityPreset {
  id: 'max-compression' | 'balanced' | 'high' | 'custom';
  label: string;
  description: string;
  quality: number;
  /** Optional longest-side cap applied by "maximum compression". */
  maxWidth?: number;
}

export const QUALITY_PRESETS: QualityPreset[] = [
  {
    id: 'max-compression',
    label: 'Maximum',
    description: 'Smallest file. Good for quick sharing and thumbnails.',
    quality: 0.5,
    maxWidth: 1600,
  },
  {
    id: 'balanced',
    label: 'Balanced',
    description: 'Best trade-off for photos and screenshots.',
    quality: 0.75,
  },
  {
    id: 'high',
    label: 'High quality',
    description: 'Near-original detail, still much smaller than PNG.',
    quality: 0.9,
  },
];

export function matchQualityPreset(quality: number): QualityPreset['id'] {
  const found = QUALITY_PRESETS.find((preset) => Math.abs(preset.quality - quality) < 0.001);
  return found ? found.id : 'custom';
}

/* -------------------------------------------------------------------------- */
/* Geometry helpers                                                           */
/* -------------------------------------------------------------------------- */

/** Fit `width` × `height` inside a box while preserving aspect ratio. */
export function fitWithin(
  sourceWidth: number,
  sourceHeight: number,
  maxWidth: number,
  maxHeight: number,
): { width: number; height: number } {
  if (sourceWidth <= 0 || sourceHeight <= 0) {
    return { width: maxWidth, height: maxHeight };
  }
  const scale = Math.min(maxWidth / sourceWidth, maxHeight / sourceHeight, 1);
  return {
    width: Math.max(1, Math.round(sourceWidth * scale)),
    height: Math.max(1, Math.round(sourceHeight * scale)),
  };
}

/** Derive the partner dimension for an aspect-locked resize. */
export function partnerDimension(
  known: number,
  sourceWidth: number,
  sourceHeight: number,
  axis: 'width' | 'height',
): number {
  if (axis === 'width') {
    if (sourceWidth <= 0) return known;
    return Math.max(1, Math.round((known * sourceHeight) / sourceWidth));
  }
  if (sourceHeight <= 0) return known;
  return Math.max(1, Math.round((known * sourceWidth) / sourceHeight));
}

/** Snap a crop rect to a target aspect ratio, keeping it inside the bounds. */
export function applyAspectRatio(
  rect: CropRect,
  ratio: number | null,
  boundsWidth: number,
  boundsHeight: number,
): CropRect {
  if (!ratio) return clampRect(rect, boundsWidth, boundsHeight);

  const centerX = rect.x + rect.width / 2;
  const centerY = rect.y + rect.height / 2;

  let width = rect.width;
  let height = width / ratio;

  if (height > boundsHeight) {
    height = boundsHeight;
    width = height * ratio;
  }
  if (width > boundsWidth) {
    width = boundsWidth;
    height = width / ratio;
  }

  return clampRect(
    { x: centerX - width / 2, y: centerY - height / 2, width, height },
    boundsWidth,
    boundsHeight,
  );
}

/** Keep a rect fully inside `0..bounds`, preserving its size where possible. */
export function clampRect(rect: CropRect, boundsWidth: number, boundsHeight: number): CropRect {
  const width = Math.min(rect.width, boundsWidth);
  const height = Math.min(rect.height, boundsHeight);
  return {
    x: Math.min(Math.max(0, rect.x), boundsWidth - width),
    y: Math.min(Math.max(0, rect.y), boundsHeight - height),
    width,
    height,
  };
}

export const ROTATION_STEPS: Rotation[] = [0, 90, 180, 270];
