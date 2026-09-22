/**
 * Encoding a surface to a Blob.
 *
 * Canvas encoders silently ignore formats they do not support and fall back to
 * PNG. We detect that by comparing the produced blob's type against the one we
 * asked for, so the UI can tell the user the truth instead of handing them a
 * PNG labelled `.webp`.
 */

import { canEncode, getCapabilities } from '../capabilities';
import { AppError, toAppError } from '../errors';
import type { OutputFormat } from '../types';
import type { Surface } from './canvas';

export interface EncodeRequest {
  format: OutputFormat;
  /** 0..1 — ignored by PNG. */
  quality?: number;
}

export interface EncodedBlob {
  blob: Blob;
  /** The format actually produced (may differ if the browser refused). */
  type: string;
  /** True when the browser silently substituted a different encoder. */
  substituted: boolean;
}

export async function encodeSurface(
  surface: Surface,
  request: EncodeRequest,
): Promise<EncodedBlob> {
  const caps = getCapabilities();

  if (!canEncode(request.format, caps)) {
    throw new AppError({
      code: 'encode-unsupported',
      title: 'Format not available in this browser',
      message: `This browser cannot write ${request.format.replace('image/', '').toUpperCase()} files.`,
      hint: 'Choose JPEG, PNG or WebP instead.',
    });
  }

  const quality =
    request.format === 'image/png'
      ? undefined
      : Math.min(1, Math.max(0.01, request.quality ?? 0.82));

  let blob: Blob | null = null;
  try {
    blob = await surface.toBlob(request.format, quality);
  } catch (error) {
    throw toAppError(error, 'encode this image');
  }

  if (!blob || blob.size === 0) {
    throw new AppError({
      code: 'encode-failed',
      title: 'Encoding failed',
      message: 'The browser produced an empty file for this image.',
      hint: 'Try a different output format, or reduce the output size.',
    });
  }

  const substituted = blob.type !== request.format;

  return {
    blob,
    type: blob.type || request.format,
    substituted,
  };
}

/**
 * Pick the smallest encoding for a "compress" run.
 * We encode at the requested quality and, when the result is *larger* than the
 * original (common when re-encoding an already-optimised JPEG), retry once at a
 * lower quality so the user always gets a real saving or an honest answer.
 */
export async function encodeSmallest(
  surface: Surface,
  request: EncodeRequest & { originalSize?: number },
): Promise<EncodedBlob> {
  const first = await encodeSurface(surface, request);

  const originalSize = request.originalSize ?? 0;
  const isLossyFormat = request.format !== 'image/png';

  if (!isLossyFormat || originalSize <= 0 || first.blob.size < originalSize) {
    return first;
  }

  const retryQuality = Math.max(0.4, (request.quality ?? 0.82) - 0.15);
  try {
    const second = await encodeSurface(surface, { ...request, quality: retryQuality });
    return second.blob.size < first.blob.size ? second : first;
  } catch {
    return first;
  }
}

/** Quick estimate of what a canvas at this size will cost in RAM. */
export function estimateSurfaceBytes(width: number, height: number): number {
  return width * height * 4;
}
