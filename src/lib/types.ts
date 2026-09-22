/** Shared domain types for SnapForge. */

/** Formats we can *write* with canvas encoders. */
export type OutputFormat = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/avif';

/** Everything we attempt to *read*. */
export type InputFormat = OutputFormat | 'image/gif' | 'image/bmp';

export interface ImageMeta {
  name: string;
  /** Declared MIME type from the File, may be empty on some Android pickers. */
  type: string;
  /** Size in bytes of the original file. */
  size: number;
  width: number;
  height: number;
  /** Decoded MIME type reported by the browser, when available. */
  detectedType?: string;
  lastModified?: number;
}

export interface OutputMeta {
  name: string;
  type: OutputFormat;
  size: number;
  width: number;
  height: number;
  /** Encoding quality used, when the format is lossy. */
  quality?: number;
}

/** A decoded source image plus its metadata. Always released via `dispose()`. */
export interface LoadedImage {
  meta: ImageMeta;
  bitmap: ImageBitmap;
  /** Full-size object URL of the original file (caller must revoke). */
  objectUrl: string;
  dispose: () => void;
}

export interface ProcessResult {
  blob: Blob;
  meta: OutputMeta;
  /** Milliseconds spent encoding — shown in the result panel. */
  durationMs: number;
}

export type ResizeFit = 'stretch' | 'contain' | 'cover';

export interface ResizeOptions {
  width: number;
  height: number;
  fit: ResizeFit;
  /** Background painted behind transparent sources when flattening to JPEG. */
  background: string;
}

export interface EncodeOptions {
  format: OutputFormat;
  /** 0..1. Ignored for PNG. */
  quality: number;
  background: string;
}

export type Rotation = 0 | 90 | 180 | 270;

export interface TransformOptions {
  rotation: Rotation;
  flipH: boolean;
  flipV: boolean;
}

export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type HistoryOperation =
  | 'compress'
  | 'resize'
  | 'convert'
  | 'crop'
  | 'rotate'
  | 'batch';

export interface HistoryEntry {
  id: string;
  operation: HistoryOperation;
  /** Original file name. Metadata only — never the image itself. */
  fileName: string;
  originalSize: number;
  outputSize: number;
  outputFormat: string;
  outputName: string;
  width: number;
  height: number;
  timestamp: number;
}

export type ThemePreference = 'system' | 'light' | 'dark';

export interface Settings {
  theme: ThemePreference;
  defaultFormat: OutputFormat;
  defaultQuality: number;
  lockAspectByDefault: boolean;
  /** Keep the original pixel dimensions unless the user asks for a resize. */
  preserveOriginalSize: boolean;
}

export interface AppCapabilities {
  webpEncode: boolean;
  avifEncode: boolean;
  offscreenCanvas: boolean;
  webWorkers: boolean;
  clipboardImage: boolean;
  share: boolean;
  maxCanvasArea: number;
  maxCanvasSide: number;
  deviceMemoryGb?: number;
}
