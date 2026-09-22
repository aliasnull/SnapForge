/**
 * Decoding: File -> drawable source + metadata.
 *
 * We try the fastest, most correct path first and degrade gracefully:
 *   1. createImageBitmap with EXIF orientation applied (Chrome/Edge/Firefox)
 *   2. createImageBitmap without options (older Safari)
 *   3. <img> + object URL (last resort; also the only path for some iOS builds)
 *
 * Whichever path wins, the caller gets a uniform `DecodedImage` whose
 * `release()` frees the underlying bitmap and object URL.
 */

import { canvasBudget, getCapabilities, resolveMimeType } from '../capabilities';
import { AppError, toAppError } from '../errors';

export interface DecodedImage {
  /** Anything `ctx.drawImage` accepts. */
  source: CanvasImageSource;
  width: number;
  height: number;
  /** MIME type the browser actually decoded, when it reports one. */
  detectedType?: string;
  /** Frees bitmap memory and revokes the object URL, if any. */
  release: () => void;
}

interface CreateImageBitmapOptionsWithOrientation extends ImageBitmapOptions {
  imageOrientation?: 'from-image' | 'flipY' | 'none';
}

async function decodeWithImageBitmap(file: File): Promise<DecodedImage | null> {
  if (typeof createImageBitmap !== 'function') return null;

  const attempts: (ImageBitmapOptions | undefined)[] = [
    { imageOrientation: 'from-image' } as CreateImageBitmapOptionsWithOrientation,
    undefined,
  ];

  for (const options of attempts) {
    try {
      const bitmap = options
        ? await createImageBitmap(file, options)
        : await createImageBitmap(file);
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        release: () => bitmap.close(),
      };
    } catch {
      // Try the next strategy.
    }
  }

  return null;
}

async function decodeWithImageElement(file: File): Promise<DecodedImage | null> {
  if (typeof document === 'undefined') return null;

  const url = URL.createObjectURL(file);
  const img = new Image();
  img.decoding = 'async';

  try {
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () =>
        reject(
          new AppError({
            code: 'decode-failed',
            title: 'Could not read this image',
            message: 'The file appears to be damaged or is not a readable image.',
            hint: 'Try re-saving or re-exporting the image, then select it again.',
          }),
        );
      img.src = url;
    });
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }

  const width = img.naturalWidth || img.width;
  const height = img.naturalHeight || img.height;

  if (!width || !height) {
    URL.revokeObjectURL(url);
    throw new AppError({
      code: 'corrupt-file',
      title: 'Empty image',
      message: 'This file decoded to a zero-sized image.',
      hint: 'The file may be truncated or only partially downloaded.',
    });
  }

  return {
    source: img,
    width,
    height,
    release: () => {
      img.src = '';
      URL.revokeObjectURL(url);
    },
  };
}

export interface DecodeOptions {
  /** Skip the memory guard for operations that do not allocate a full canvas. */
  skipSizeCheck?: boolean;
}

/**
 * Decode a user-selected file into something we can draw.
 * Throws `AppError` with a friendly message on every failure path.
 */
export async function decodeImageFile(
  file: File,
  options: DecodeOptions = {},
): Promise<DecodedImage> {
  if (!file || file.size === 0) {
    throw new AppError({
      code: 'corrupt-file',
      title: 'Empty file',
      message: 'That file has no data in it.',
      hint: 'Pick a different image.',
    });
  }

  let decoded: DecodedImage | null = null;
  let lastError: unknown = null;

  try {
    decoded = await decodeWithImageBitmap(file);
  } catch (error) {
    lastError = error;
  }

  if (!decoded) {
    try {
      decoded = await decodeWithImageElement(file);
    } catch (error) {
      lastError = error;
    }
  }

  if (!decoded) {
    throw toAppError(lastError, 'open this image');
  }

  if (!options.skipSizeCheck) {
    const budget = canvasBudget();
    const area = decoded.width * decoded.height;
    if (area > budget) {
      const maxSide = Math.floor(Math.sqrt(budget));
      decoded.release();
      throw new AppError({
        code: 'too-large',
        title: 'Image is too large to process safely',
        message: `This image is ${decoded.width} × ${decoded.height}. Opening it at full size could exhaust this device's memory.`,
        hint: `Resize it to about ${maxSide} px on the longest side first, or open it on a device with more memory.`,
      });
    }
  }

  const mime = resolveMimeType(file);
  return mime ? { ...decoded, detectedType: mime } : decoded;
}

/**
 * Cheap metadata read used by the file list. Decodes the header only where the
 * browser allows it, and falls back to a full decode otherwise.
 */
export async function readImageDimensions(
  file: File,
): Promise<{ width: number; height: number } | null> {
  const caps = getCapabilities();
  if (caps.offscreenCanvas && typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file);
      const size = { width: bitmap.width, height: bitmap.height };
      bitmap.close();
      return size;
    } catch {
      // fall through
    }
  }
  return null;
}
