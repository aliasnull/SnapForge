/**
 * Convert — change the container format without touching the pixels.
 *
 * The transparency warning is the important part: JPEG has no alpha channel, so
 * converting a transparent PNG to JPEG silently turns those pixels black in
 * most implementations. We flatten onto white (or a sampled average) and say so.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ImageDropzone } from '../../components/ImageDropzone';
import { CompareViewer } from '../../components/CompareViewer';
import { ResultPanel } from '../../components/ResultPanel';
import { ImageMetaPanel, formatLabel } from '../../components/ImageMetaPanel';
import { FormatSelect, FORMAT_NOTE } from '../../components/FormatSelect';
import { SourceWarning, ToolError, ToolFooter, ToolLayout } from '../../components/ToolLayout';
import { ToolLoading } from '../../components/ToolLoading';
import { Button, Callout, RangeField } from '../../components/ui';
import { Icon } from '../../components/Icon';
import { useImageSource } from '../../hooks/useImageSource';
import { useToolController } from '../../hooks/useToolController';
import { useObjectUrl } from '../../hooks';
import { convertImage } from '../../lib/image/operations';
import { formatBytes, formatDimensions } from '../../lib/format';
import { getCapabilities, supportedOutputFormats } from '../../lib/capabilities';
import { recordHistory } from '../../state/historyStore';
import { useSettings } from '../../state/settingsStore';
import { useToast } from '../../state/ToastProvider';
import type { OutputFormat } from '../../lib/types';

export function ConvertPage() {
  const source = useImageSource();
  const tool = useToolController();
  const toast = useToast();
  const caps = getCapabilities();
  const [settings] = useSettings();

  const [format, setFormat] = useState<OutputFormat>(settings.defaultFormat);
  const [quality, setQuality] = useState(settings.defaultQuality);
  const [background, setBackground] = useState('#ffffff');

  const outputUrl = useObjectUrl(tool.state.blob);
  const available = useMemo(() => supportedOutputFormats(caps), [caps]);

  useEffect(() => {
    if (!available.includes(format)) setFormat(available[0] ?? 'image/png');
  }, [available, format]);

  const onFiles = useCallback(
    async (files: File[]) => {
      await source.select(files[0]!);
      tool.markSelected();
    },
    [source, tool],
  );

  const sourceFormat = source.meta ? formatLabel(source.meta.detectedType || source.meta.type) : '';
  const targetLabel = formatLabel(format);
  const isSameFormat =
    source.meta !== null &&
    (source.meta.detectedType || source.meta.type) === format;

  const runConvert = useCallback(async () => {
    const { meta, bitmap } = source;
    if (!meta || !bitmap) return;

    const result = await tool.run(() =>
      convertImage(
        {
          source: bitmap,
          sourceWidth: meta.width,
          sourceHeight: meta.height,
          fileName: meta.name,
          originalSize: meta.size,
        },
        { format, quality, background },
      ),
    );

    if (result) {
      recordHistory({
        operation: 'convert',
        fileName: meta.name,
        originalSize: meta.size,
        outputSize: result.meta.size,
        outputFormat: result.meta.type,
        outputName: result.meta.name,
        width: result.meta.width,
        height: result.meta.height,
      });
      toast.success('Converted', `${sourceFormat} → ${formatLabel(result.meta.type)}`);
    }
  }, [source, tool, format, quality, background, sourceFormat, toast]);

  const reset = useCallback(() => {
    source.clear();
    tool.reset();
  }, [source, tool]);

  if (source.status === 'empty') {
    return (
      <div className="page container">
        <ToolLayout
          icon="convert"
          title="Image Converter"
          description="Move between JPEG, PNG, WebP and AVIF. The list only shows formats this browser can genuinely write."
        >
          <ImageDropzone onFiles={onFiles} title="Drop an image to convert" />

          <div className="panel panel--pad" style={{ marginTop: 'var(--s-6)' }}>
            <div className="row" style={{ marginBottom: 'var(--s-4)' }}>
              <Icon name="cpu" size={18} />
              <h2 style={{ fontSize: 'var(--fs-md)', fontWeight: 650 }}>
                Formats available on this device
              </h2>
            </div>
            <div className="pill-row">
              {(['image/jpeg', 'image/png', 'image/webp', 'image/avif'] as OutputFormat[]).map(
                (item) => {
                  const supported = available.includes(item);
                  return (
                    <span
                      key={item}
                      className={`badge ${supported ? 'badge--success' : ''}`}
                      title={supported ? FORMAT_NOTE[item] : 'Not supported by this browser'}
                    >
                      <Icon name={supported ? 'check' : 'close'} size={13} />
                      {formatLabel(item)}
                    </span>
                  );
                },
              )}
            </div>
            <p className="note" style={{ marginTop: 'var(--s-4)' }}>
              Read support also covers GIF and BMP — those are decoded and written out as one of
              the formats above.
            </p>
          </div>
        </ToolLayout>
      </div>
    );
  }

  if (source.status === 'error' && source.error) {
    return (
      <div className="page container">
        <ToolLayout icon="convert" title="Image Converter" description="Move between image formats.">
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

  // See the note in CompressPage: `meta` is null until the decode resolves, and
  // the lines below this guard read it.
  if (source.status === 'loading') {
    return (
      <ToolLoading
        icon="convert"
        title="Image Converter"
        description="Move between image formats."
        dropTitle="Drop an image to convert"
        onFiles={onFiles}
      />
    );
  }

  const meta = source.meta!;
  const busy = tool.state.phase === 'processing';

  return (
    <div className="page container">
      <ToolLayout
        icon="convert"
        title="Image Converter"
        description="Pick a target format and convert. Pixel dimensions are never changed."
        actions={
          <>
            <Button variant="secondary" icon="arrow-left" onClick={reset}>
              Start over
            </Button>
            <Button
              variant="primary"
              icon="convert"
              onClick={runConvert}
              loading={tool.state.phase === 'processing'}
            >
              {tool.state.phase === 'completed' ? 'Convert again' : 'Convert image'}
            </Button>
          </>
        }
      >
        <SourceWarning largeFile={source.largeFile} width={meta.width} height={meta.height} />

        <div className="workspace" style={{ marginTop: 'var(--s-5)' }}>
          <div className="workspace__controls">
            <div className="panel panel--pad control-group">
              <div className="control-group__head">
                <span className="control-group__title">Conversion</span>
              </div>

              <div className="stat-grid">
                <div className="stat">
                  <div className="stat__label">From</div>
                  <div className="stat__value stat__value--sm">{sourceFormat}</div>
                </div>
                <div className="stat stat--highlight">
                  <div className="stat__label">To</div>
                  <div className="stat__value stat__value--sm">{targetLabel}</div>
                </div>
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
                  hint={
                    format === 'image/avif'
                      ? 'AVIF encodes slowly on mobile — expect a short pause.'
                      : undefined
                  }
                />
              ) : (
                <Callout tone="info" title="Lossless output">
                  PNG keeps every pixel exactly as it is. That also means the file will usually be
                  larger than a WebP or JPEG of the same image.
                </Callout>
              )}

              {format === 'image/jpeg' ? (
                <div className="field">
                  <span className="label">Background for transparency</span>
                  <div className="row">
                    <input
                      type="color"
                      value={background}
                      onChange={(event) => setBackground(event.target.value)}
                      aria-label="Background colour"
                      style={{
                        width: 56,
                        height: 44,
                        borderRadius: 'var(--r-sm)',
                        border: '1px solid var(--border)',
                        background: 'var(--surface-2)',
                        padding: 4,
                      }}
                    />
                    <span className="hint">
                      JPEG has no transparency. Any transparent pixels become this colour.
                    </span>
                  </div>
                </div>
              ) : null}

              {isSameFormat ? (
                <Callout tone="info" title="Same format selected">
                  Re-encoding to the same format usually makes the file bigger. Pick a different
                  target, or use the Compressor if you want a smaller file.
                </Callout>
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
                  beforeLabel={sourceFormat}
                  afterLabel={formatLabel(tool.state.output!.type)}
                  beforeMeta={formatBytes(meta.size)}
                  afterMeta={formatBytes(tool.state.output!.size)}
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
                      <span>Converting…</span>
                    </div>
                  </div>
                ) : null}
              </div>
            )}

            {tool.state.phase === 'selected' ? (
              <Callout tone="info" title="Ready to convert">
                {formatDimensions(meta.width, meta.height)} will be written as {targetLabel}.
              </Callout>
            ) : null}

            {tool.state.phase === 'error' && tool.state.error ? (
              <ToolError
                title={tool.state.error.title}
                message={tool.state.error.message}
                {...(tool.state.error.hint ? { hint: tool.state.error.hint } : {})}
                onRetry={() => void runConvert()}
              />
            ) : null}
          </div>
        </div>

        <ToolFooter onReset={reset} />
      </ToolLayout>
    </div>
  );
}
