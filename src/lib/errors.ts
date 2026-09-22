/**
 * Friendly, typed errors.
 *
 * Rule: a user never sees a stack trace. Every failure that can reach the UI
 * is normalised into an `AppError` carrying a short human title, a sentence of
 * explanation and an optional recovery hint.
 */

export type AppErrorCode =
  | 'unsupported-format'
  | 'corrupt-file'
  | 'too-large'
  | 'decode-failed'
  | 'encode-unsupported'
  | 'encode-failed'
  | 'canvas-unavailable'
  | 'memory'
  | 'download-failed'
  | 'clipboard-empty'
  | 'clipboard-denied'
  | 'zip-failed'
  | 'no-files'
  | 'unknown';

export interface AppErrorShape {
  code: AppErrorCode;
  title: string;
  message: string;
  hint?: string;
}

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly title: string;
  readonly hint?: string;

  constructor(shape: AppErrorShape, cause?: unknown) {
    super(shape.message);
    this.name = 'AppError';
    this.code = shape.code;
    this.title = shape.title;
    this.hint = shape.hint;
    if (cause !== undefined) this.cause = cause;
  }

  toShape(): AppErrorShape {
    return {
      code: this.code,
      title: this.title,
      message: this.message,
      ...(this.hint ? { hint: this.hint } : {}),
    };
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

const MEMORY_PATTERN = /out of memory|allocation failed|array buffer allocation|invalid array length/i;

/**
 * Normalise anything thrown during processing into an `AppError`.
 * `context` names the operation so the fallback message is still useful.
 */
export function toAppError(error: unknown, context = 'process this image'): AppError {
  if (isAppError(error)) return error;

  const raw = error instanceof Error ? error.message : String(error ?? '');

  if (MEMORY_PATTERN.test(raw)) {
    return new AppError({
      code: 'memory',
      title: 'Not enough memory',
      message: 'The browser ran out of memory while working on this image.',
      hint: 'Try a smaller image, or close other tabs and try again.',
    });
  }

  if (/unsupported|not supported|cannot decode/i.test(raw)) {
    return new AppError({
      code: 'unsupported-format',
      title: 'Format not supported here',
      message: 'This browser could not decode that image file.',
      hint: 'Try a JPEG, PNG or WebP version of the image.',
    });
  }

  if (/network|failed to fetch/i.test(raw)) {
    return new AppError({
      code: 'decode-failed',
      title: 'Could not read the file',
      message: 'The file could not be read from your device.',
      hint: 'Re-select the file and try again.',
    });
  }

  return new AppError(
    {
      code: 'unknown',
      title: 'Something went wrong',
      message: `SnapForge could not ${context}.`,
      hint: 'Try again. If it keeps failing, reload the page.',
    },
    error,
  );
}
