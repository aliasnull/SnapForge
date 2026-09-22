/**
 * "Choose Images" — the one control every tool starts with.
 *
 * Desktop: drag and drop, click to browse, paste from the clipboard.
 * Mobile: a single tap on a large target that opens the native picker.
 *
 * Drop and paste are progressive enhancements; the file picker is always
 * present, which is the requirement for touch devices.
 */

import { useCallback, useEffect, useRef, useState, type DragEvent } from 'react';
import { Icon } from './Icon';
import { Button } from './ui';
import { ACCEPT_ATTRIBUTE, getCapabilities } from '../lib/capabilities';
import { partitionImageFiles } from '../lib/files';
import { imageFileFromClipboard } from '../hooks/useImageSource';
import { useToast } from '../state/ToastProvider';

interface ImageDropzoneProps {
  onFiles: (files: File[]) => void;
  multiple?: boolean;
  disabled?: boolean;
  /** Copy above the drop area. */
  title?: string;
  subtitle?: string;
  compact?: boolean;
}

const BASE_FORMATS = 'JPEG · PNG · WebP · AVIF · GIF · BMP';

export function ImageDropzone({
  onFiles,
  multiple = false,
  disabled = false,
  title,
  subtitle,
  compact = false,
}: ImageDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const dragDepth = useRef(0);
  const toast = useToast();
  const caps = getCapabilities();

  const handleFiles = useCallback(
    (fileList: FileList | File[] | null) => {
      if (!fileList) return;
      const files = Array.from(fileList);
      if (files.length === 0) return;

      const { accepted, rejected } = partitionImageFiles(files);

      if (rejected.length > 0) {
        toast.toast(
          rejected.length === files.length ? 'error' : 'info',
          rejected.length === 1
            ? 'One file was skipped'
            : `${rejected.length} files were skipped`,
          rejected.slice(0, 2).join(' '),
        );
      }

      if (accepted.length > 0) {
        onFiles(multiple ? accepted : accepted.slice(0, 1));
      }
    },
    [multiple, onFiles, toast],
  );

  const onDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      dragDepth.current = 0;
      setDragOver(false);
      if (disabled) return;
      handleFiles(event.dataTransfer?.files ?? null);
    },
    [disabled, handleFiles],
  );

  const onDragEnter = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      if (disabled) return;
      dragDepth.current += 1;
      setDragOver(true);
    },
    [disabled],
  );

  const onDragLeave = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDragOver(false);
  }, []);

  // Clipboard paste, only advertised when the browser can actually do it.
  useEffect(() => {
    if (disabled || !caps.clipboardImage) return undefined;

    const onPaste = (event: ClipboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      const file = imageFileFromClipboard(event);
      if (!file) return;
      event.preventDefault();
      handleFiles([file]);
    };

    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [caps.clipboardImage, disabled, handleFiles]);

  return (
    <div
      className={[
        'dropzone',
        dragOver ? 'dropzone--over' : '',
        disabled ? 'dropzone--disabled' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      onDrop={onDrop}
      onDragOver={(event) => event.preventDefault()}
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      style={compact ? { minHeight: 170, padding: 'var(--s-6) var(--s-4)' } : undefined}
    >
      <div className="dropzone__icon">
        <Icon name={multiple ? 'images' : 'image'} size={26} />
      </div>

      <div>
        <p className="dropzone__title">{title ?? (multiple ? 'Drop images here' : 'Drop an image here')}</p>
        <p className="dropzone__sub">
          {subtitle ?? (multiple ? 'Add as many as you like — they are processed one at a time.' : 'Or choose a file from your device.')}
        </p>
      </div>

      <div className="dropzone__actions">
        <Button
          variant="primary"
          icon="upload"
          onClick={() => inputRef.current?.click()}
          disabled={disabled}
        >
          {multiple ? 'Choose Images' : 'Choose Image'}
        </Button>

        {caps.clipboardImage ? (
          <Button
            variant="secondary"
            icon="clipboard"
            onClick={() => {
              navigator.clipboard
                .read()
                .then((items) => {
                  const item = items.find((entry) =>
                    entry.types.some((type) => type.startsWith('image/')),
                  );
                  if (!item) {
                    toast.info('No image on the clipboard', 'Copy an image first, then try again.');
                    return;
                  }
                  const type = item.types.find((entry) => entry.startsWith('image/'))!;
                  return item.getType(type).then((blob) => {
                    const extension = type.split('/')[1] ?? 'png';
                    handleFiles([
                      new File([blob], `pasted-image.${extension}`, { type }),
                    ]);
                  });
                })
                .catch(() => {
                  toast.error(
                    'Clipboard unavailable',
                    'Your browser blocked clipboard access. Use “Choose Image” instead.',
                  );
                });
            }}
            disabled={disabled}
          >
            Paste Image
          </Button>
        ) : null}
      </div>

      <p className="dropzone__formats">
        {BASE_FORMATS} · Processed locally in your browser
      </p>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT_ATTRIBUTE}
        multiple={multiple}
        className="sr-only"
        tabIndex={-1}
        onChange={(event) => {
          handleFiles(event.target.files);
          // Reset so selecting the same file twice still fires a change event.
          event.target.value = '';
        }}
      />
    </div>
  );
}
