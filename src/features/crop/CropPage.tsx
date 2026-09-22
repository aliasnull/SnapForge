/**
 * Crop — an interactive, touch-first cropper.
 *
 * Implementation notes:
 *   - The crop rectangle is stored in *source pixels*, so it survives window
 *     resizes and rotation without drifting.
 *   - Handles are 44×44 px hit areas (the visual square inside is much
 *     smaller), which is what makes this usable with a thumb on a phone.
 *   - Pointer Events are used throughout, so mouse, pen and touch all take the
 *     same code path. `touch-action: none` on the stage stops the browser from
 *     scrolling while a handle is dragged.
 */

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ImageDropzone } from '../../components/ImageDropzone';
import { ResultPanel } from '../../components/ResultPanel';
import { ImageMetaPanel } from '../../components/ImageMetaPanel';
import { FormatSelect } from '../../components/FormatSelect';
import { SourceWarning, ToolError, ToolFooter, ToolLayout } from '../../components/ToolLayout';
import { Button, Callout, RangeField } from '../../components/ui';
import { useImageSource } from '../../hooks/useImageSource';
import { useToolController } from '../../hooks/useToolController';
import { useObjectUrl } from '../../hooks';
import {
  ASPECT_PRESETS,
  applyAspectRatio,
  clampRect,
  cropImage,
} from '../../lib/image/operations';
import { formatDimensions } from '../../lib/format';
import { getCapabilities } from '../../lib/capabilities';
import { recordHistory } from '../../state/historyStore';
import { useSettings } from '../../state/settingsStore';
import { useToast } from '../../state/ToastProvider';
import type { CropRect, OutputFormat } from '../../lib/types';

type Handle = 'nw' | 'ne' | 'sw' | 'se' | 'move';
type AspectKey = string;

const HANDLES: Handle[] = ['nw', 'ne', 'sw', 'se'];
const MIN_CROP = 24;

export function CropPage() {
  const source = useImageSource();
  const tool = useToolController();
  const toast = useToast();
  const caps = getCapabilities();
  const [settings] = useSettings();

  const [crop, setCrop] = useState<CropRect>({ x: 0, y: 0, width: 0, height: 0 });
  const [aspectKey, setAspectKey] = useState<AspectKey>('Free');
  const [format, setFormat] = useState<OutputFormat>(settings.defaultFormat);
  const [quality, setQuality] = useState(settings.defaultQuality);
  const [scale, setScale] = useState(1);

  const imgRef = useRef<HTMLImageElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [displayScale, setDisplayScale] = useState(1);

  const outputUrl = useObjectUrl(tool.state.blob);
  const meta = source.meta;

  const aspectRatio = useMemo(() => {
    const preset = ASPECT_PRESETS.find((item) => item.label === aspectKey);
    return preset ? preset.ratio : null;
  }, [aspectKey]);

  useEffect(() => {
    if (format === 'image/avif' && !caps.avifEncode) setFormat('image/jpeg');
    if (format === 'image/webp' && !caps.webpEncode) setFormat('image/jpeg');
  }, [caps.avifEncode, caps.webpEncode, format]);

  // Reset the crop box whenever a new image arrives.
  useEffect(() => {
    if (!meta) return;
    setCrop({
      x: Math.round(meta.width * 0.1),
      y: Math.round(meta.height * 0.1),
      width: Math.round(meta.width * 0.8),
      height: Math.round(meta.height * 0.8),
    });
    setAspectKey('Free');
    setScale(1);
  }, [meta]);

  // Keep the crop box inside the image when the aspect preset changes.
  useEffect(() => {
    if (!meta) return;
    setCrop((current) =>
      applyAspectRatio(current, aspectRatio, meta.width, meta.height),
    );
  }, [aspectRatio, meta]);

  /* ------------------------------------------------------------ measuring */

  const measure = useCallback(() => {
    const img = imgRef.current;
    if (!img || !meta) return;
    const rect = img.getBoundingClientRect();
    if (rect.width > 0) setDisplayScale(rect.width / meta.width);
  }, [meta]);

  useLayoutEffect(() => {
    measure();
    const observer = new ResizeObserver(measure);
    if (imgRef.current) observer.observe(imgRef.current);
    window.addEventListener('orientationchange', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('orientationchange', measure);
    };
  }, [measure]);

  /* ------------------------------------------------------------- dragging */

  const dragState = useRef<{
    handle: Handle;
    startX: number;
    startY: number;
    origin: CropRect;
  } | null>(null);

  const onPointerDown = (handle: Handle) => (event: React.PointerEvent) => {
    if (!meta) return;
    event.preventDefault();
    event.stopPropagation();
    (event.target as Element).setPointerCapture?.(event.pointerId);
    dragState.current = {
      handle,
      startX: event.clientX,
      startY: event.clientY,
      origin: crop,
    };
  };

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      const drag = dragState.current;
      if (!drag || !meta) return;
      event.preventDefault();

      const dx = (event.clientX - drag.startX) / displayScale;
      const dy = (event.clientY - drag.startY) / displayScale;
      const origin = drag.origin;

      let next: CropRect;

      if (drag.handle === 'move') {
        next = { ...origin, x: origin.x + dx, y: origin.y + dy };
        next = clampRect(next, meta.width, meta.height);
      } else {
        let left = origin.x;
        let top = origin.y;
        let right = origin.x + origin.width;
        let bottom = origin.y + origin.height;

        if (drag.handle === 'nw') {
          left = Math.min(origin.x + origin.width - MIN_CROP, origin.x + dx);
          top = Math.min(origin.y + origin.height - MIN_CROP, origin.y + dy);
        } else if (drag.handle === 'ne') {
          right = Math.max(origin.x + MIN_CROP, origin.x + origin.width + dx);
          top = Math.min(origin.y + origin.height - MIN_CROP, origin.y + dy);
        } else if (drag.handle === 'sw') {
          left = Math.min(origin.x + origin.width - MIN_CROP, origin.x + dx);
          bottom = Math.max(origin.y + MIN_CROP, origin.y + origin.height + dy);
        } else if (drag.handle === 'se') {
          right = Math.max(origin.x + MIN_CROP, origin.x + origin.width + dx);
          bottom = Math.max(origin.y + MIN_CROP, origin.y + origin.height + dy);
        }

        left = Math.max(0, left);
        top = Math.max(0, top);
        right = Math.min(meta.width, right);
        bottom = Math.min(meta.height, bottom);

        let width = right - left;
        let height = bottom - top;

        if (aspectRatio) {
          // Drive the free axis from the dominant one so the drag feels direct.
          if (Math.abs(dx) > Math.abs(dy)) height = width / aspectRatio;
          else width = height * aspectRatio;

          if (drag.handle === 'nw') {
            left = right - width;
            top = bottom - height;
          } else if (drag.handle === 'ne') {
            right = left + width;
            top = bottom - height;
          } else if (drag.handle === 'sw') {
            left = right - width;
            bottom = top + height;
          } else {
            right = left + width;
            bottom = top + height;
          }

          // Clamp to the image while keeping the ratio.
          if (left < 0) {
            left = 0;
            width = right - left;
            height = width / aspectRatio;
            bottom = top + height;
          }
          if (top < 0) {
            top = 0;
            height = bottom - top;
            width = height * aspectRatio;
            right = left + width;
          }
          if (right > meta.width) {
            right = meta.width;
            width = right - left;
            height = width / aspectRatio;
            bottom = top + height;
          }
          if (bottom > meta.height) {
            bottom = meta.height;
            height = bottom - top;
            width = height * aspectRatio;
            right = left + width;
          }
        }

        next = {
          x: left,
          y: top,
          width: Math.max(MIN_CROP, right - left),
          height: Math.max(MIN_CROP, bottom - top),
        };
      }

      setCrop(next);
    };

    const stop = () => {
      dragState.current = null;
    };

    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', stop);
    window.addEventListener('pointercancel', stop);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', stop);
      window.removeEventListener('pointercancel', stop);
    };
  }, [aspectRatio, displayScale, meta]);

  /* -------------------------------------------------------------- actions */

  const onFiles = useCallback(
    async (files: File[]) => {
      await source.select(files[0]!);
      tool.markSelected();
    },
    [source, tool],
  );

  const setPreset = useCallback(
    (key: AspectKey) => {
      setAspectKey(key);
      const preset = ASPECT_PRESETS.find((item) => item.label === key);
      if (preset && meta) {
        setCrop((current) => applyAspectRatio(current, preset.ratio, meta.width, meta.height));
      }
    },
    [meta],
  );

  const runCrop = useCallback(async () => {
    if (!meta || !source.bitmap) return;

    const outWidth = Math.max(1, Math.round(crop.width * scale));
    const outHeight = Math.max(1, Math.round(crop.height * scale));

    const result = await tool.run(() =>
      cropImage(
        {
          source: source.bitmap!,
          sourceWidth: meta.width,
          sourceHeight: meta.height,
          fileName: meta.name,
          originalSize: meta.size,
        },
        crop,
        {
          format,
          quality,
          background: '#ffffff',
          outputWidth: outWidth,
          outputHeight: outHeight,
        },
      ),
    );

    if (result) {
      recordHistory({
        operation: 'crop',
        fileName: meta.name,
        originalSize: meta.size,
        outputSize: result.meta.size,
        outputFormat: result.meta.type,
        outputName: result.meta.name,
        width: result.meta.width,
        height: result.meta.height,
      });
      toast.success('Cropped', `${result.meta.width} × ${result.meta.height}`);
    }
  }, [meta, source, crop, format, quality, scale, tool, toast]);

  const reset = useCallback(() => {
    source.clear();
    tool.reset();
  }, [source, tool]);

  if (source.status === 'empty') {
    return (
      <div className="page container">
        <ToolLayout
          icon="crop"
          title="Crop Image"
          description="Drag the box to frame the shot, or lock one of the standard aspect ratios. Works with a mouse, a stylus, or a thumb."
        >
          <ImageDropzone onFiles={onFiles} title="Drop an image to crop" />
        </ToolLayout>
      </div>
    );
  }

  if (source.status === 'error' && source.error) {
    return (
      <div className="page container">
        <ToolLayout icon="crop" title="Crop Image" description="Frame and trim an image.">
          <ToolError
            title={source.error.title}
            message={source.error.message}
            {...(source.error.hint ? { hint: source.error.hint } : {})}
            onRetry={reset}
          />
        </ToolLayout>
      </div>
    );
  }

  const imageMeta = source.meta!;
  const busy = source.status === 'loading' || tool.state.phase === 'processing';
  const outputSize = {
    width: Math.round(crop.width * scale),
    height: Math.round(crop.height * scale),
  };

  return (
    <div className="page container">
      <ToolLayout
        icon="crop"
        title="Crop Image"
        description="Drag the box to frame the shot, or lock an aspect ratio."
        actions={
          <>
            <Button variant="secondary" icon="arrow-left" onClick={reset}>
              Start over
            </Button>
            <Button
              variant="primary"
              icon="crop"
              onClick={runCrop}
              loading={tool.state.phase === 'processing'}
              disabled={crop.width < MIN_CROP || crop.height < MIN_CROP}
            >
              {tool.state.phase === 'completed' ? 'Crop again' : 'Apply crop'}
            </Button>
          </>
        }
      >
        <SourceWarning
          largeFile={source.largeFile}
          width={imageMeta.width}
          height={imageMeta.height}
        />

        <div className="workspace" style={{ marginTop: 'var(--s-5)' }}>
          <div className="workspace__controls">
            <div className="panel panel--pad control-group">
              <div className="control-group__head">
                <span className="control-group__title">Aspect ratio</span>
              </div>
              <div className="preset-grid">
                {ASPECT_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    className="preset-chip"
                    data-active={aspectKey === preset.label}
                    onClick={() => setPreset(preset.label)}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              <p className="hint">
                Locked ratios keep the box constrained while you drag any corner.
              </p>
            </div>

            <div className="panel panel--pad control-group">
              <div className="control-group__head">
                <span className="control-group__title">Crop area</span>
              </div>

              <div className="stat-grid">
                <div className="stat">
                  <div className="stat__label">Selection</div>
                  <div className="stat__value stat__value--sm">
                    {formatDimensions(crop.width, crop.height)}
                  </div>
                </div>
                <div className="stat stat--highlight">
                  <div className="stat__label">Output</div>
                  <div className="stat__value stat__value--sm">
                    {formatDimensions(outputSize.width, outputSize.height)}
                  </div>
                </div>
              </div>

              <RangeField
                label="Output scale"
                value={Math.round(scale * 100)}
                min={10}
                max={100}
                displayValue={`${Math.round(scale * 100)}%`}
                onValueChange={(value) => setScale(value / 100)}
                hint="Shrink the cropped result without changing the selection."
              />
            </div>

            <div className="panel panel--pad control-group">
              <div className="control-group__head">
                <span className="control-group__title">Output</span>
              </div>
              <FormatSelect value={format} onValueChange={setFormat} />
              {format !== 'image/png' ? (
                <RangeField
                  label="Quality"
                  value={Math.round(quality * 100)}
                  min={10}
                  max={100}
                  displayValue={`${Math.round(quality * 100)}%`}
                  onValueChange={(value) => setQuality(value / 100)}
                />
              ) : null}
            </div>

            <ImageMetaPanel meta={imageMeta} output={tool.state.output} title="Source image" />
          </div>

          <div className="workspace__preview">
            <div className="cropper">
              <div className="cropper__stage" ref={stageRef}>
                <img
                  ref={imgRef}
                  className="cropper__canvas"
                  src={source.previewUrl ?? undefined}
                  alt="Image being cropped"
                  draggable={false}
                  onLoad={measure}
                />

                {displayScale > 0 && crop.width > 0 ? (
                  <div className="cropper__overlay" aria-hidden="true">
                    {/* Dim everything outside the selection. */}
                    <div
                      className="cropper__shade"
                      style={{ left: 0, top: 0, right: 0, height: crop.y * displayScale }}
                    />
                    <div
                      className="cropper__shade"
                      style={{
                        left: 0,
                        top: (crop.y + crop.height) * displayScale,
                        right: 0,
                        bottom: 0,
                      }}
                    />
                    <div
                      className="cropper__shade"
                      style={{
                        left: 0,
                        top: crop.y * displayScale,
                        width: crop.x * displayScale,
                        height: crop.height * displayScale,
                      }}
                    />
                    <div
                      className="cropper__shade"
                      style={{
                        left: (crop.x + crop.width) * displayScale,
                        top: crop.y * displayScale,
                        right: 0,
                        height: crop.height * displayScale,
                      }}
                    />

                    <div
                      className="cropper__box"
                      style={{
                        left: crop.x * displayScale,
                        top: crop.y * displayScale,
                        width: crop.width * displayScale,
                        height: crop.height * displayScale,
                      }}
                    >
                      <div className="cropper__grid" />
                    </div>
                  </div>
                ) : null}

                {/* Interactive layer — separate from the decorative overlay so
                    the handles stay hit-testable. */}
                {displayScale > 0 && crop.width > 0 ? (
                  <div
                    style={{
                      position: 'absolute',
                      left: crop.x * displayScale,
                      top: crop.y * displayScale,
                      width: crop.width * displayScale,
                      height: crop.height * displayScale,
                    }}
                  >
                    <button
                      type="button"
                      className="cropper__move"
                      aria-label="Move crop area"
                      onPointerDown={onPointerDown('move')}
                    />
                    {HANDLES.map((handle) => (
                      <button
                        key={handle}
                        type="button"
                        className="cropper__handle"
                        data-corner={handle}
                        aria-label={`Resize crop area from the ${handle} corner`}
                        onPointerDown={onPointerDown(handle)}
                      />
                    ))}
                  </div>
                ) : null}

                {busy ? (
                  <div className="stage__busy">
                    <div className="stage__busy-inner">
                      <span className="spinner spinner--lg" />
                      <span>{source.status === 'loading' ? 'Opening image…' : 'Cropping…'}</span>
                    </div>
                  </div>
                ) : null}
              </div>

              <p className="cropper__hint">
                Drag the corners to resize · drag inside the box to move it
              </p>
            </div>

            {tool.state.phase === 'completed' && tool.state.blob && outputUrl ? (
              <div className="stack">
                <div className="compare__pane checkerboard">
                  <figcaption style={{ padding: '8px 12px', fontSize: 'var(--fs-xs)', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-subtle)', borderBottom: '1px solid var(--border)' }}>
                    Cropped result
                  </figcaption>
                  <img
                    src={outputUrl}
                    alt="Cropped result"
                    style={{ width: '100%', maxHeight: '46vh', objectFit: 'contain', margin: '0 auto' }}
                  />
                </div>
                <ResultPanel
                  output={tool.state.output!}
                  blob={tool.state.blob}
                  originalSize={imageMeta.size}
                  {...(tool.state.durationMs !== null ? { durationMs: tool.state.durationMs } : {})}
                >
                  <Button
                    variant="ghost"
                    icon="crop"
                    onClick={() => {
                      setCrop({
                        x: 0,
                        y: 0,
                        width: imageMeta.width,
                        height: imageMeta.height,
                      });
                      setAspectKey('Free');
                      tool.invalidate();
                    }}
                  >
                    Adjust the crop and try again
                  </Button>
                </ResultPanel>
              </div>
            ) : null}

            {tool.state.phase === 'selected' ? (
              <Callout tone="info" title="Selection ready">
                {formatDimensions(crop.width, crop.height)} at position{' '}
                {Math.round(crop.x)}, {Math.round(crop.y)}. Press <strong>Apply crop</strong>.
              </Callout>
            ) : null}

            {tool.state.phase === 'error' && tool.state.error ? (
              <ToolError
                title={tool.state.error.title}
                message={tool.state.error.message}
                {...(tool.state.error.hint ? { hint: tool.state.error.hint } : {})}
                onRetry={() => void runCrop()}
              />
            ) : null}
          </div>
        </div>

        <ToolFooter onReset={reset} />
      </ToolLayout>
    </div>
  );
}
