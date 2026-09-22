/**
 * Canvas surfaces and drawing.
 *
 * Two things matter on a phone here:
 *   1. Never allocate a canvas larger than the device can afford.
 *   2. Never let a single `drawImage` do a 10x downscale — Chrome's box filter
 *      aliases badly below ~0.5x, so we halve repeatedly first.
 */

import { canvasBudget, getCapabilities } from '../capabilities';
import { AppError } from '../errors';
import type { ResizeFit } from '../types';
import { canAllocateCanvas } from '../files';

export interface Surface {
  canvas: HTMLCanvasElement | OffscreenCanvas;
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
  width: number;
  height: number;
  /** Encode to a Blob, normalised across HTMLCanvasElement and OffscreenCanvas. */
  toBlob: (type: string, quality?: number) => Promise<Blob | null>;
}

export function createSurface(width: number, height: number): Surface {
  const w = Math.max(1, Math.round(width));
  const h = Math.max(1, Math.round(height));

  const check = canAllocateCanvas(w, h, canvasBudget());
  if (!check.ok) {
    throw new AppError({
      code: 'too-large',
      title: 'Output is too large',
      message: check.message,
      hint: check.hint,
    });
  }

  const caps = getCapabilities();

  if (caps.offscreenCanvas && typeof OffscreenCanvas !== 'undefined') {
    try {
      const canvas = new OffscreenCanvas(w, h);
      const ctx = canvas.getContext('2d', { alpha: true });
      if (ctx) {
        return {
          canvas,
          ctx: ctx as OffscreenCanvasRenderingContext2D,
          width: w,
          height: h,
          toBlob: (type, quality) => canvas.convertToBlob({ type, quality }),
        };
      }
    } catch {
      // Fall through to a DOM canvas.
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { alpha: true });

  if (!ctx) {
    throw new AppError({
      code: 'canvas-unavailable',
      title: 'Canvas unavailable',
      message: 'This browser would not provide a 2D canvas context.',
      hint: 'Reload the page. If it persists, try a different browser.',
    });
  }

  return {
    canvas,
    ctx,
    width: w,
    height: h,
    toBlob: (type, quality) =>
      new Promise<Blob | null>((resolve) => {
        canvas.toBlob((blob) => resolve(blob), type, quality);
      }),
  };
}

/**
 * Draw `source` into `ctx` at the given rect using progressive halving.
 * `dw`/`dh` are the destination size in device pixels.
 */
export function drawScaled(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
): void {
  const targetW = Math.max(1, Math.round(dw));
  const targetH = Math.max(1, Math.round(dh));

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  let currentSource: CanvasImageSource = source;
  let currentW = sourceWidth;
  let currentH = sourceHeight;

  // Halve until we are within 2x of the target, then do the final draw.
  while (currentW / 2 >= targetW && currentH / 2 >= targetH && currentW > 2 && currentH > 2) {
    const halfW = Math.max(1, Math.floor(currentW / 2));
    const halfH = Math.max(1, Math.floor(currentH / 2));
    const step = createSurface(halfW, halfH);
    step.ctx.imageSmoothingEnabled = true;
    step.ctx.imageSmoothingQuality = 'high';
    step.ctx.drawImage(currentSource, 0, 0, currentW, currentH, 0, 0, halfW, halfH);
    currentSource = step.canvas;
    currentW = halfW;
    currentH = halfH;
  }

  ctx.drawImage(currentSource, 0, 0, currentW, currentH, dx, dy, targetW, targetH);
}

/** Fill the whole surface with a solid colour (used to flatten alpha). */
export function fillBackground(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  color: string,
  width: number,
  height: number,
): void {
  ctx.save();
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}

export interface DrawToSurfaceOptions {
  fit: ResizeFit;
  background: string;
  /** Paint an opaque background first — required for JPEG output. */
  flatten?: boolean;
  sourceWidth: number;
  sourceHeight: number;
}

/** Compute the destination rect for a given fit mode. */
export function computeFitRect(
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number,
  fit: ResizeFit,
): { dx: number; dy: number; dw: number; dh: number } {
  if (fit === 'stretch' || sourceWidth <= 0 || sourceHeight <= 0) {
    return { dx: 0, dy: 0, dw: targetWidth, dh: targetHeight };
  }

  const scale =
    fit === 'contain'
      ? Math.min(targetWidth / sourceWidth, targetHeight / sourceHeight)
      : Math.max(targetWidth / sourceWidth, targetHeight / sourceHeight);

  const dw = sourceWidth * scale;
  const dh = sourceHeight * scale;

  return {
    dx: (targetWidth - dw) / 2,
    dy: (targetHeight - dh) / 2,
    dw,
    dh,
  };
}

/** Draw a decoded source onto a fresh surface of the requested size. */
export function renderToSurface(
  source: CanvasImageSource,
  options: DrawToSurfaceOptions & { width: number; height: number },
): Surface {
  const surface = createSurface(options.width, options.height);

  if (options.flatten) {
    fillBackground(surface.ctx, options.background, surface.width, surface.height);
  } else {
    surface.ctx.clearRect(0, 0, surface.width, surface.height);
  }

  const rect = computeFitRect(
    options.sourceWidth,
    options.sourceHeight,
    surface.width,
    surface.height,
    options.fit,
  );

  drawScaled(
    surface.ctx,
    source,
    options.sourceWidth,
    options.sourceHeight,
    rect.dx,
    rect.dy,
    rect.dw,
    rect.dh,
  );

  return surface;
}

/**
 * Render an arbitrary sub-rectangle of the source (used by crop) at 1:1 or
 * scaled, with optional rotation/flip already baked into the source.
 */
export function renderCrop(
  source: CanvasImageSource,
  sx: number,
  sy: number,
  sw: number,
  sh: number,
  outWidth: number,
  outHeight: number,
  options: { flatten?: boolean; background?: string } = {},
): Surface {
  const surface = createSurface(outWidth, outHeight);

  if (options.flatten) {
    fillBackground(surface.ctx, options.background ?? '#ffffff', surface.width, surface.height);
  }

  surface.ctx.imageSmoothingEnabled = true;
  surface.ctx.imageSmoothingQuality = 'high';
  surface.ctx.drawImage(source, sx, sy, sw, sh, 0, 0, surface.width, surface.height);

  return surface;
}

/** A canvas large enough for the rotated bounding box, with the transform applied. */
export function renderTransform(
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  rotation: 0 | 90 | 180 | 270,
  flipH: boolean,
  flipV: boolean,
  options: { flatten?: boolean; background?: string } = {},
): Surface {
  const swapped = rotation === 90 || rotation === 270;
  const outWidth = swapped ? sourceHeight : sourceWidth;
  const outHeight = swapped ? sourceWidth : sourceHeight;

  const surface = createSurface(outWidth, outHeight);

  if (options.flatten) {
    fillBackground(surface.ctx, options.background ?? '#ffffff', surface.width, surface.height);
  }

  const { ctx } = surface;
  ctx.save();
  ctx.translate(surface.width / 2, surface.height / 2);
  ctx.rotate((rotation * Math.PI) / 180);
  ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(
    source,
    -sourceWidth / 2,
    -sourceHeight / 2,
    sourceWidth,
    sourceHeight,
  );
  ctx.restore();

  return surface;
}

/** Average colour of an image, used as the JPEG flatten background default. */
export function sampleAverageColor(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  width: number,
  height: number,
): string {
  try {
    const sampleW = Math.max(1, Math.min(16, width));
    const sampleH = Math.max(1, Math.min(16, height));
    const data = ctx.getImageData(0, 0, sampleW, sampleH).data;
    let r = 0;
    let g = 0;
    let b = 0;
    const pixels = data.length / 4;
    for (let i = 0; i < data.length; i += 4) {
      r += data[i] ?? 0;
      g += data[i + 1] ?? 0;
      b += data[i + 2] ?? 0;
    }
    r = Math.round(r / pixels);
    g = Math.round(g / pixels);
    b = Math.round(b / pixels);
    return `rgb(${r}, ${g}, ${b})`;
  } catch {
    return '#ffffff';
  }
}
