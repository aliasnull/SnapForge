/**
 * Download + share helpers.
 *
 * Everything happens through an object URL and a synthetic anchor click — there
 * is no upload, no fetch, and no server in this path.
 */

import { AppError } from './errors';

export interface DownloadResult {
  ok: boolean;
  error?: AppError;
}

/** Trigger a browser download for a blob. */
export function downloadBlob(blob: Blob, fileName: string): DownloadResult {
  let url: string | null = null;
  try {
    url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    anchor.rel = 'noopener';
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: new AppError(
        {
          code: 'download-failed',
          title: 'Download failed',
          message: 'The browser blocked the download.',
          hint: 'Long-press the preview image and choose “Save image” instead.',
        },
        error,
      ),
    };
  } finally {
    // Revoke on the next tick — revoking synchronously can cancel the download
    // in some Android WebView builds.
    if (url) {
      const revokeUrl = url;
      setTimeout(() => URL.revokeObjectURL(revokeUrl), 20_000);
    }
  }
}

export interface ShareResult {
  shared: boolean;
  error?: AppError;
}

/**
 * Try the native share sheet (useful on Android/iOS for "save to Photos").
 * Falls back to a plain download when sharing is unavailable or cancelled.
 */
export async function shareOrDownload(
  blob: Blob,
  fileName: string,
  title = 'SnapForge image',
): Promise<ShareResult> {
  const file = new File([blob], fileName, { type: blob.type || 'image/png' });

  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    const canShareFiles =
      typeof navigator.canShare === 'function' ? navigator.canShare({ files: [file] }) : false;

    if (canShareFiles) {
      try {
        await navigator.share({ files: [file], title });
        return { shared: true };
      } catch (error) {
        // User dismissed the sheet — fall through to a download.
        if (error instanceof Error && error.name === 'AbortError') {
          return { shared: false };
        }
      }
    }
  }

  const result = downloadBlob(blob, fileName);
  return { shared: false, ...(result.error ? { error: result.error } : {}) };
}

/** Open a blob in a new tab (used by "Open full size"). */
export function openBlobInNewTab(blob: Blob): boolean {
  try {
    const url = URL.createObjectURL(blob);
    const opened = window.open(url, '_blank', 'noopener,noreferrer');
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return Boolean(opened);
  } catch {
    return false;
  }
}

/**
 * Copy an image blob to the clipboard. Requires a secure context and a user
 * gesture; both are checked by the caller before offering the button.
 */
export async function copyImageToClipboard(blob: Blob): Promise<DownloadResult> {
  try {
    const ClipboardItemCtor = (
      window as Window & { ClipboardItem?: typeof ClipboardItem }
    ).ClipboardItem;

    if (!ClipboardItemCtor || !navigator.clipboard?.write) {
      throw new Error('Clipboard image write is not supported in this browser.');
    }

    await navigator.clipboard.write([new ClipboardItemCtor({ [blob.type]: blob })]);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: new AppError(
        {
          code: 'clipboard-denied',
          title: 'Could not copy',
          message: 'The browser would not let SnapForge write to the clipboard.',
          hint: 'Use Download instead — it always works.',
        },
        error,
      ),
    };
  }
}
