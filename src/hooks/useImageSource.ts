/**
 * The single "open an image" hook used by every tool.
 *
 * It owns the whole lifecycle so no tool has to re-implement it:
 *   File -> decode -> bitmap + metadata + object URL -> (edit) -> release
 *
 * Memory rules enforced here:
 *   - exactly one decoded bitmap alive at a time
 *   - the previous bitmap is released before a new one is created
 *   - everything is released on unmount
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { decodeImageFile, type DecodedImage } from '../lib/image/decode';
import { assertFileSize, isLargeFile, partitionImageFiles } from '../lib/files';
import { AppError, toAppError } from '../lib/errors';
import { resolveMimeType } from '../lib/capabilities';
import type { ImageMeta } from '../lib/types';

export type SourceStatus = 'empty' | 'loading' | 'ready' | 'error';

export interface ImageSource {
  status: SourceStatus;
  meta: ImageMeta | null;
  /** Live bitmap for drawing. Never hand this to React state. */
  bitmap: ImageBitmap | CanvasImageSource | null;
  /** Object URL of the original file, for previews. */
  previewUrl: string | null;
  error: AppError | null;
  /** True when the file is big enough to warn about memory use. */
  largeFile: boolean;
  select: (file: File) => Promise<void>;
  clear: () => void;
}

export function useImageSource(): ImageSource {
  const [status, setStatus] = useState<SourceStatus>('empty');
  const [meta, setMeta] = useState<ImageMeta | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<AppError | null>(null);
  const [largeFile, setLargeFile] = useState(false);

  const decodedRef = useRef<DecodedImage | null>(null);
  const urlRef = useRef<string | null>(null);
  const requestId = useRef(0);

  const releaseCurrent = useCallback(() => {
    if (decodedRef.current) {
      decodedRef.current.release();
      decodedRef.current = null;
    }
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
  }, []);

  useEffect(() => releaseCurrent, [releaseCurrent]);

  const clear = useCallback(() => {
    requestId.current += 1;
    releaseCurrent();
    setStatus('empty');
    setMeta(null);
    setPreviewUrl(null);
    setError(null);
    setLargeFile(false);
  }, [releaseCurrent]);

  const select = useCallback(
    async (file: File) => {
      const ticket = ++requestId.current;

      setStatus('loading');
      setError(null);

      try {
        assertFileSize(file);
        const { accepted, rejected } = partitionImageFiles([file]);

        if (accepted.length === 0) {
          throw new AppError({
            code: 'unsupported-format',
            title: 'Unsupported file',
            message: rejected[0] ?? 'That file type cannot be opened here.',
            hint: 'Use a JPEG, PNG, WebP, AVIF, GIF or BMP image.',
          });
        }

        const decoded = await decodeImageFile(file);

        // A newer selection started while we were decoding — drop this one.
        if (ticket !== requestId.current) {
          decoded.release();
          return;
        }

        releaseCurrent();
        decodedRef.current = decoded;

        const url = URL.createObjectURL(file);
        urlRef.current = url;

        const detectedType = decoded.detectedType ?? resolveMimeType(file);
        const nextMeta: ImageMeta = {
          name: file.name || 'image',
          type: resolveMimeType(file),
          size: file.size,
          width: decoded.width,
          height: decoded.height,
          ...(detectedType ? { detectedType } : {}),
          ...(file.lastModified ? { lastModified: file.lastModified } : {}),
        };

        setMeta(nextMeta);
        setPreviewUrl(url);
        setLargeFile(isLargeFile(file));
        setStatus('ready');
      } catch (err) {
        if (ticket !== requestId.current) return;
        releaseCurrent();
        setError(toAppError(err, 'open this image'));
        setMeta(null);
        setPreviewUrl(null);
        setStatus('error');
      }
    },
    [releaseCurrent],
  );

  return {
    status,
    meta,
    bitmap: decodedRef.current?.source ?? null,
    previewUrl,
    error,
    largeFile,
    select,
    clear,
  };
}

/** Read a File out of a paste event, if it contains an image. */
export function imageFileFromClipboard(event: ClipboardEvent): File | null {
  const items = event.clipboardData?.items;
  if (!items) return null;

  for (const item of items) {
    if (item.kind === 'file' && item.type.startsWith('image/')) {
      const file = item.getAsFile();
      if (file) {
        const extension = file.type.split('/')[1] ?? 'png';
        const named =
          file.name && file.name !== 'image.png'
            ? file
            : new File([file], `pasted-image.${extension}`, { type: file.type });
        return named;
      }
    }
  }
  return null;
}
