/**
 * Compress — the flagship tool.
 *
 * The user picks a quality preset (or drags the slider), optionally caps the
 * longest side, and sees a real before/after with the actual byte savings.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ImageDropzone } from '../../components/ImageDropzone';
import { CompareViewer } from '../../components/CompareViewer';
import { ResultPanel } from '../../components/ResultPanel';
import { ImageMetaPanel } from '../../components/ImageMetaPanel';
import { FormatSelect } from '../../components/FormatSelect';
import { SourceWarning, ToolError, ToolFooter, ToolLayout } from '../../components/ToolLayout';
import { ToolLoading } from '../../components/ToolLoading';
import { Button, Callout, RangeField, Segmented } from '../../components/ui';
import { Icon } from '../../components/Icon';
import { useImageSource } from '../../hooks/useImageSource';
import { useToolController } from '../../hooks/useToolController';
import { useObjectUrl } from '../../hooks';
import { compressImage, matchQualityPreset, QUALITY_PRESETS } from '../../lib/image/operations';
import { formatBytes, formatDimensions } from '../../lib/format';
import { getCapabilities, isLossy } from '../../lib/capabilities';
import { recordHistory } from '../../state/historyStore';
import { useSettings } from '../../state/settingsStore';
import { useToast } from '../../state/ToastProvider';
import type { OutputFormat } from '../../lib/types';

type PresetId = 'max-compression' | 'balanced' | 'high' | 'custom';

const MAX_WIDTH_OPTIONS = [
  { value: 0, label: 'Original' },
  { value: 2560, label: '2560 px' },
  { value: 1920, label: '1920 px' },
  { value: 1280, label: '1280 px' },
  { value: 800, label: '800 px' },
];

export function CompressPage() {
  const source = useImageSource();
  const tool = useToolController();
  const toast = useToast();
  const caps = getCapabilities();
  const [settings] = useSettings();

  const [format, setFormat] = useState<OutputFormat>(
    isLossy(settings.defaultFormat) ? settings.defaultFormat : 'image/jpeg',
  );
  const [quality, setQuality] = useState(settings.defaultQuality);
  const [preset, setPreset] = useState<PresetId>(matchQualityPreset(settings.defaultQuality));
  const [maxWidth, setMaxWidth] = useState(0);
  const [compareKey, setCompareKey] = useState(0);

  const outputUrl = useObjectUrl(tool.state.blob);

  // Keep the format valid for this browser.
  useEffect(() => {
    if (format === 'image/avif' && !caps.avifEncode) setFormat('image/jpeg');
    if (format === 'image/webp' && !caps.webpEncode) setFormat('image/jpeg');
  }, [caps.avifEncode, caps.webpEncode, format]);

  const applyPreset = useCallback((id: PresetId) => {
    setPreset(id);
    const found = QUALITY_PRESETS.find((item) => item.id === id);
    if (found) {
      setQuality(found.quality);
      if (found.maxWidth !== undefined) setMaxWidth(found.maxWidth);
    }
  }, []);

  const onFiles = useCallback(
    async (files: File[]) => {
      await source.select(files[0]!);
      tool.markSelected();
      setCompareKey((value) => value + 1);
    },
    [source, tool],
  );

  const runCompression = useCallback(async () => {
    const { meta, bitmap } = source;
    if (!meta || !bitmap) return;

    const result = await tool.run(() =>
      compressImage(
        {
          source: bitmap,
          sourceWidth: meta.width,
          sourceHeight: meta.height,
          fileName: meta.name,
          originalSize: meta.size,
          originalType: meta.detectedType ?? meta.type,
        },
        {
          format,
          quality,
          maxWidth,
          background: '#ffffff',
        },
      ),
    );

    if (result) {
      recordHistory({
        operation: 'compress',
        fileName: meta.name,
        originalSize: meta.size,
        outputSize: result.meta.size,
        outputFormat: result.meta.type,
        outputName: result.meta.name,
        width: result.meta.width,
        height: result.meta.height,
      });
      toast.success(
        'Compressed',
        `${formatDimensions(result.meta.width, result.meta.height)} · ${formatBytes(result.meta.size)}`,
      );
    }
  }, [source, tool, format, quality, maxWidth, toast]);

  const reset = useCallback(() => {
    source.clear();
    tool.reset();
  }, [source, tool]);

  const savings = useMemo(() => {
    if (!source.meta || !tool.state.output) return null;
    return source.meta.size - tool.state.output.size;
  }, [source.meta, tool.state.output]);

  /* ---------------------------------------------------------------- empty */
  if (source.status === 'empty') {
    return (
      <div className="page container">
        <ToolLayout
          icon="compress"
          title="Image Compressor"
          description="Reduce file size while keeping the image looking right. Choose a preset, fine-tune the quality, and download the result — all without an upload."
        >
          <ImageDropzone onFiles={onFiles} title="Drop an image to compress" />
          <div className="feature-grid" style={{ marginTop: 'var(--s-6)' }}>
            <div className="feature">
              <Icon name="zap" size={20} />
              <h3>Instant</h3>
              <p>No queue, no upload progress bar. Encoding happens as you adjust the controls.</p>
            </div>
            <div className="feature">
              <Icon name="eye" size={20} />
              <h3>Honest numbers</h3>
              <p>Sizes are measured from the real files, including the times compression makes a file bigger.</p>
            </div>
            <div className="feature">
              <Icon name="lock" size={20} />
              <h3>Private by design</h3>
              <p>There is no server in this app. Nothing to upload to, nothing to leak.</p>
            </div>
          </div>
        </ToolLayout>
      </div>
    );
  }

  /* ---------------------------------------------------------------- error */
  if (source.status === 'error' && source.error) {
    return (
      <div className="page container">
        <ToolLayout icon="compress" title="Image Compressor" description="Reduce file size while keeping the image looking right.">
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

  /* -------------------------------------------------------------- loading */
  // `select()` reports 'loading' with `meta` still null while the file decodes.
  // Everything below this point reads `source.meta`, so this guard has to come
  // first — without it the meta panel dereferences null and the error boundary
  // replaces the whole tool.
  if (source.status === 'loading') {
    return (
      <ToolLoading
        icon="compress"
        title="Image Compressor"
        description="Reduce file size while keeping the image looking right."
        dropTitle="Drop an image to compress"
        onFiles={onFiles}
      />
    );
  }

  const meta = source.meta!;
  const busy = tool.state.phase === 'processing';

  return (
    <div className="page container">
      <ToolLayout
        icon="compress"
        title="Image Compressor"
        description="Adjust the settings and download. Everything stays on this device."
        actions={
          <>
            <Button variant="secondary" icon="arrow-left" onClick={reset}>
              Start over
            </Button>
            <Button
              variant="primary"
              icon="zap"
              onClick={runCompression}
              loading={tool.state.phase === 'processing'}
              disabled={source.status !== 'ready'}
            >
              {tool.state.phase === 'completed' ? 'Compress again' : 'Compress image'}
            </Button>
          </>
        }
      >
        <SourceWarning
          largeFile={source.largeFile}
          width={meta.width}
          height={meta.height}
        />

        <div className="workspace" style={{ marginTop: 'var(--s-5)' }}>
          <div className="workspace__controls">
            <div className="panel panel--pad control-group">
              <div className="control-group__head">
                <span className="control-group__title">Quality preset</span>
              </div>
              <Segmented<PresetId>
                ariaLabel="Quality preset"
                value={preset}
                onValueChange={applyPreset}
                options={[
                  { value: 'max-compression', label: 'Maximum' },
                  { value: 'balanced', label: 'Balanced' },
                  { value: 'high', label: 'High' },
                  ...(preset === 'custom' ? [{ value: 'custom' as PresetId, label: 'Custom' }] : []),
                ]}
              />

              <p className="hint">
                {preset === 'custom'
                  ? 'Custom quality set with the slider below.'
                  : (QUALITY_PRESETS.find((item) => item.id === preset)?.description ??
                    'Fine-tune with the slider below.')}
              </p>

              <RangeField
                label="Quality"
                value={Math.round(quality * 100)}
                min={10}
                max={100}
                step={1}
                displayValue={`${Math.round(quality * 100)}%`}
                onValueChange={(value) => {
                  setQuality(value / 100);
                  setPreset(matchQualityPreset(value / 100));
                }}
                disabled={format === 'image/png'}
                hint={
                  format === 'image/png'
                    ? 'PNG is lossless, so quality does not apply. Pick WebP or JPEG to tune it.'
                    : 'Lower means a smaller file. Around 70–80% is usually indistinguishable.'
                }
              />
            </div>

            <div className="panel panel--pad control-group">
              <div className="control-group__head">
                <span className="control-group__title">Output</span>
              </div>

              <FormatSelect value={format} onValueChange={setFormat} />

              <div className="field">
                <span className="label">Maximum width</span>
                <div className="preset-grid">
                  {MAX_WIDTH_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className="preset-chip"
                      data-active={maxWidth === option.value}
                      onClick={() => setMaxWidth(option.value)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                <p className="hint">
                  Never enlarges an image. Leave on “Original” to keep the current width.
                </p>
              </div>
            </div>

            <ImageMetaPanel
              meta={meta}
              output={tool.state.output}
              title="Source image"
            />
          </div>

          <div className="workspace__preview">
            {tool.state.phase === 'completed' && tool.state.blob && outputUrl && source.previewUrl ? (
              <>
                <CompareViewer
                  key={compareKey}
                  beforeUrl={source.previewUrl}
                  afterUrl={outputUrl}
                  beforeLabel="Original"
                  afterLabel="Compressed"
                  beforeMeta={formatBytes(meta.size)}
                  afterMeta={formatBytes(tool.state.output!.size)}
                />

                {savings !== null && savings <= 0 ? (
                  <Callout tone="warning" title="No saving from this setting">
                    The result is not smaller than the original. Try the Maximum preset, or lower
                    the quality slider.
                  </Callout>
                ) : null}

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
                      <span>Compressing…</span>
                    </div>
                  </div>
                ) : null}
              </div>
            )}

            {tool.state.phase === 'selected' ? (
              <Callout tone="info" title="Ready when you are">
                {formatDimensions(meta.width, meta.height)} ·{' '}
                {formatBytes(meta.size)}. Press <strong>Compress image</strong> to see the
                result.
              </Callout>
            ) : null}

            {tool.state.phase === 'error' && tool.state.error ? (
              <ToolError
                title={tool.state.error.title}
                message={tool.state.error.message}
                {...(tool.state.error.hint ? { hint: tool.state.error.hint } : {})}
                onRetry={() => {
                  void runCompression();
                }}
              />
            ) : null}
          </div>
        </div>

        <ToolFooter onReset={reset} />
      </ToolLayout>
    </div>
  );
}
