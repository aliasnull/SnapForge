/**
 * Resize — exact dimensions, percentage scaling, or a preset.
 *
 * The aspect-ratio lock derives the partner dimension from the *source* image's
 * ratio, not from the last edited value, so the result never drifts.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ImageDropzone } from '../../components/ImageDropzone';
import { CompareViewer } from '../../components/CompareViewer';
import { ResultPanel } from '../../components/ResultPanel';
import { ImageMetaPanel } from '../../components/ImageMetaPanel';
import { FormatSelect } from '../../components/FormatSelect';
import { SourceWarning, ToolError, ToolFooter, ToolLayout } from '../../components/ToolLayout';
import { Button, Callout, NumberInput, RangeField, Segmented, Switch } from '../../components/ui';
import { useImageSource } from '../../hooks/useImageSource';
import { useToolController } from '../../hooks/useToolController';
import { useObjectUrl } from '../../hooks';
import {
  DIMENSION_PRESETS,
  fitWithin,
  partnerDimension,
  resizeImage,
} from '../../lib/image/operations';
import { formatBytes, formatDimensions } from '../../lib/format';
import { getCapabilities } from '../../lib/capabilities';
import { recordHistory } from '../../state/historyStore';
import { useSettings } from '../../state/settingsStore';
import { useToast } from '../../state/ToastProvider';
import type { OutputFormat, ResizeFit } from '../../lib/types';

type Mode = 'dimensions' | 'percentage';
type PresetKey = string;

const PERCENTAGES = [25, 50, 75, 100];

export function ResizePage() {
  const source = useImageSource();
  const tool = useToolController();
  const toast = useToast();
  const caps = getCapabilities();
  const [settings] = useSettings();

  const [mode, setMode] = useState<Mode>('dimensions');
  const [width, setWidth] = useState(1920);
  const [height, setHeight] = useState(1080);
  const [percent, setPercent] = useState(50);
  const [lockAspect, setLockAspect] = useState(settings.lockAspectByDefault);
  const [fit, setFit] = useState<ResizeFit>('stretch');
  const [format, setFormat] = useState<OutputFormat>(settings.defaultFormat);
  const [quality, setQuality] = useState(settings.defaultQuality);
  const [activePreset, setActivePreset] = useState<PresetKey | null>(null);

  const outputUrl = useObjectUrl(tool.state.blob);

  // Seed the controls from the image that was just loaded.
  useEffect(() => {
    if (!source.meta) return;
    setWidth(source.meta.width);
    setHeight(source.meta.height);
    setActivePreset(null);
  }, [source.meta]);

  useEffect(() => {
    if (format === 'image/avif' && !caps.avifEncode) setFormat('image/jpeg');
    if (format === 'image/webp' && !caps.webpEncode) setFormat('image/jpeg');
  }, [caps.avifEncode, caps.webpEncode, format]);

  const onFiles = useCallback(
    async (files: File[]) => {
      await source.select(files[0]!);
      tool.markSelected();
    },
    [source, tool],
  );

  const target = useMemo(() => {
    if (!source.meta) return { width, height };
    if (mode === 'percentage') {
      const scale = percent / 100;
      return {
        width: Math.max(1, Math.round(source.meta.width * scale)),
        height: Math.max(1, Math.round(source.meta.height * scale)),
      };
    }
    return { width, height };
  }, [mode, percent, width, height, source.meta]);

  const changeWidth = useCallback(
    (next: number) => {
      setWidth(next);
      setActivePreset(null);
      if (lockAspect && source.meta) {
        setHeight(partnerDimension(next, source.meta.width, source.meta.height, 'width'));
      }
    },
    [lockAspect, source.meta],
  );

  const changeHeight = useCallback(
    (next: number) => {
      setHeight(next);
      setActivePreset(null);
      if (lockAspect && source.meta) {
        setWidth(partnerDimension(next, source.meta.width, source.meta.height, 'height'));
      }
    },
    [lockAspect, source.meta],
  );

  const applyPreset = useCallback(
    (presetWidth: number, presetHeight: number, key: string) => {
      if (!source.meta) return;
      setMode('dimensions');
      setActivePreset(key);

      if (lockAspect) {
        // Fit the preset box inside the source ratio so nothing is distorted.
        const fitted = fitWithin(source.meta.width, source.meta.height, presetWidth, presetHeight);
        setWidth(fitted.width);
        setHeight(fitted.height);
      } else {
        setWidth(presetWidth);
        setHeight(presetHeight);
      }
    },
    [lockAspect, source.meta],
  );

  const runResize = useCallback(async () => {
    const { meta, bitmap } = source;
    if (!meta || !bitmap) return;

    const result = await tool.run(() =>
      resizeImage(
        {
          source: bitmap,
          sourceWidth: meta.width,
          sourceHeight: meta.height,
          fileName: meta.name,
          originalSize: meta.size,
        },
        {
          width: target.width,
          height: target.height,
          fit,
          background: '#ffffff',
          format,
          quality,
        },
      ),
    );

    if (result) {
      recordHistory({
        operation: 'resize',
        fileName: meta.name,
        originalSize: meta.size,
        outputSize: result.meta.size,
        outputFormat: result.meta.type,
        outputName: result.meta.name,
        width: result.meta.width,
        height: result.meta.height,
      });
      toast.success('Resized', `${result.meta.width} × ${result.meta.height} · ${formatBytes(result.meta.size)}`);
    }
  }, [source, tool, target, fit, format, quality, toast]);

  const reset = useCallback(() => {
    source.clear();
    tool.reset();
    setActivePreset(null);
  }, [source, tool]);

  if (source.status === 'empty') {
    return (
      <div className="page container">
        <ToolLayout
          icon="resize"
          title="Image Resizer"
          description="Change the pixel dimensions of an image with a locked aspect ratio, percentage scaling, or a standard preset."
        >
          <ImageDropzone onFiles={onFiles} title="Drop an image to resize" />
        </ToolLayout>
      </div>
    );
  }

  if (source.status === 'error' && source.error) {
    return (
      <div className="page container">
        <ToolLayout icon="resize" title="Image Resizer" description="Change the pixel dimensions of an image.">
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

  const meta = source.meta!;
  const busy = source.status === 'loading' || tool.state.phase === 'processing';
  const isUpscale = target.width > meta.width || target.height > meta.height;

  return (
    <div className="page container">
      <ToolLayout
        icon="resize"
        title="Image Resizer"
        description="Set exact dimensions, scale by percentage, or pick a standard size."
        actions={
          <>
            <Button variant="secondary" icon="arrow-left" onClick={reset}>
              Start over
            </Button>
            <Button
              variant="primary"
              icon="resize"
              onClick={runResize}
              loading={tool.state.phase === 'processing'}
            >
              {tool.state.phase === 'completed' ? 'Resize again' : 'Resize image'}
            </Button>
          </>
        }
      >
        <SourceWarning largeFile={source.largeFile} width={meta.width} height={meta.height} />

        <div className="workspace" style={{ marginTop: 'var(--s-5)' }}>
          <div className="workspace__controls">
            <div className="panel panel--pad control-group">
              <div className="control-group__head">
                <span className="control-group__title">Size</span>
              </div>

              <Segmented<Mode>
                ariaLabel="Resize mode"
                value={mode}
                onValueChange={setMode}
                options={[
                  { value: 'dimensions', label: 'Dimensions' },
                  { value: 'percentage', label: 'Percentage' },
                ]}
              />

              {mode === 'dimensions' ? (
                <>
                  <div className="grid-2">
                    <NumberInput
                      label="Width"
                      suffix="px"
                      value={width}
                      min={1}
                      max={20000}
                      onValueChange={changeWidth}
                    />
                    <NumberInput
                      label="Height"
                      suffix="px"
                      value={height}
                      min={1}
                      max={20000}
                      onValueChange={changeHeight}
                    />
                  </div>

                  <Switch
                    checked={lockAspect}
                    onCheckedChange={setLockAspect}
                    label="Lock aspect ratio"
                  />
                </>
              ) : (
                <>
                  <RangeField
                    label="Scale"
                    value={percent}
                    min={1}
                    max={400}
                    step={1}
                    displayValue={`${percent}%`}
                    onValueChange={(value) => {
                      setPercent(value);
                      setActivePreset(null);
                    }}
                  />
                  <div className="preset-grid">
                    {PERCENTAGES.map((value) => (
                      <button
                        key={value}
                        type="button"
                        className="preset-chip"
                        data-active={percent === value}
                        onClick={() => {
                          setPercent(value);
                          setActivePreset(null);
                        }}
                      >
                        {value}%
                      </button>
                    ))}
                  </div>
                </>
              )}

              <div className="stat-grid">
                <div className="stat">
                  <div className="stat__label">Original</div>
                  <div className="stat__value stat__value--sm">
                    {formatDimensions(meta.width, meta.height)}
                  </div>
                </div>
                <div className="stat stat--highlight">
                  <div className="stat__label">New</div>
                  <div className="stat__value stat__value-sm stat__value--sm">
                    {formatDimensions(target.width, target.height)}
                  </div>
                </div>
              </div>

              {isUpscale ? (
                <Callout tone="warning" title="This will enlarge the image">
                  Upscaling adds pixels but not detail. The result will be softer than the
                  original and may be a larger file.
                </Callout>
              ) : null}
            </div>

            <div className="panel panel--pad control-group">
              <div className="control-group__head">
                <span className="control-group__title">Presets</span>
              </div>
              <div className="preset-grid">
                {DIMENSION_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    className="preset-chip"
                    data-active={activePreset === preset.label}
                    onClick={() => applyPreset(preset.width, preset.height, preset.label)}
                    title={`${preset.width} × ${preset.height}`}
                  >
                    {preset.label}
                    <br />
                    <span className="subtle">
                      {preset.width}×{preset.height}
                    </span>
                  </button>
                ))}
              </div>
              <p className="hint">
                With the aspect lock on, a preset fits inside its box so the image is never
                stretched.
              </p>
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

              {fit !== 'stretch' ? (
                <div className="field">
                  <span className="label">Fit mode</span>
                  <Segmented<ResizeFit>
                    ariaLabel="Fit mode"
                    value={fit}
                    onValueChange={setFit}
                    options={[
                      { value: 'contain', label: 'Contain' },
                      { value: 'cover', label: 'Cover' },
                      { value: 'stretch', label: 'Stretch' },
                    ]}
                  />
                </div>
              ) : null}
            </div>

            <ImageMetaPanel meta={meta} output={tool.state.output} title="Source image" />
          </div>

          <div className="workspace__preview">
            {tool.state.phase === 'completed' && tool.state.blob && outputUrl && source.previewUrl ? (
              <>
                <CompareViewer
                  beforeUrl={source.previewUrl}
                  afterUrl={outputUrl}
                  beforeLabel="Original"
                  afterLabel="Resized"
                  beforeMeta={formatDimensions(meta.width, meta.height)}
                  afterMeta={formatDimensions(tool.state.output!.width, tool.state.output!.height)}
                />
                <ResultPanel
                  output={tool.state.output!}
                  blob={tool.state.blob}
                  originalSize={meta.size}
                  {...(tool.state.durationMs !== null ? { durationMs: tool.state.durationMs } : {})}
                />
              </>
            ) : (
              <div className="stage">
                {source.previewUrl ? (
                  <img className="stage__img" src={source.previewUrl} alt="Selected image preview" />
                ) : null}
                {busy ? (
                  <div className="stage__busy">
                    <div className="stage__busy-inner">
                      <span className="spinner spinner--lg" />
                      <span>{source.status === 'loading' ? 'Opening image…' : 'Resizing…'}</span>
                    </div>
                  </div>
                ) : null}
              </div>
            )}

            {tool.state.phase === 'selected' ? (
              <Callout tone="info" title="Preview of the target size">
                The image will be written at {formatDimensions(target.width, target.height)} in{' '}
                {format.replace('image/', '').toUpperCase()}.
              </Callout>
            ) : null}

            {tool.state.phase === 'error' && tool.state.error ? (
              <ToolError
                title={tool.state.error.title}
                message={tool.state.error.message}
                {...(tool.state.error.hint ? { hint: tool.state.error.hint } : {})}
                onRetry={() => void runResize()}
              />
            ) : null}
          </div>
        </div>

        <ToolFooter onReset={reset} />
      </ToolLayout>
    </div>
  );
}
