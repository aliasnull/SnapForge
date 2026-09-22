/**
 * Rotate & flip.
 *
 * The preview is a CSS transform of the source image, which makes it instant
 * and free. The real pixels are only touched when the user hits Apply, so
 * rotating back and forth never degrades quality.
 */

import { useCallback, useEffect, useState } from 'react';
import { ImageDropzone } from '../../components/ImageDropzone';
import { CompareViewer } from '../../components/CompareViewer';
import { ResultPanel } from '../../components/ResultPanel';
import { ImageMetaPanel } from '../../components/ImageMetaPanel';
import { FormatSelect } from '../../components/FormatSelect';
import { SourceWarning, ToolError, ToolFooter, ToolLayout } from '../../components/ToolLayout';
import { ToolLoading } from '../../components/ToolLoading';
import { Button, Callout, RangeField } from '../../components/ui';
import { Icon } from '../../components/Icon';
import { useImageSource } from '../../hooks/useImageSource';
import { useToolController } from '../../hooks/useToolController';
import { useObjectUrl } from '../../hooks';
import { describeTransform, isIdentityTransform, transformImage } from '../../lib/image/operations';
import { formatBytes, formatDimensions } from '../../lib/format';
import { getCapabilities } from '../../lib/capabilities';
import { recordHistory } from '../../state/historyStore';
import { useSettings } from '../../state/settingsStore';
import { useToast } from '../../state/ToastProvider';
import type { OutputFormat, Rotation, TransformOptions } from '../../lib/types';

const INITIAL_TRANSFORM: TransformOptions = { rotation: 0, flipH: false, flipV: false };

export function RotatePage() {
  const source = useImageSource();
  const tool = useToolController();
  const toast = useToast();
  const caps = getCapabilities();
  const [settings] = useSettings();

  const [transform, setTransform] = useState<TransformOptions>(INITIAL_TRANSFORM);
  const [format, setFormat] = useState<OutputFormat>(settings.defaultFormat);
  const [quality, setQuality] = useState(settings.defaultQuality);

  const outputUrl = useObjectUrl(tool.state.blob);
  const meta = source.meta;

  useEffect(() => {
    if (format === 'image/avif' && !caps.avifEncode) setFormat('image/jpeg');
    if (format === 'image/webp' && !caps.webpEncode) setFormat('image/jpeg');
  }, [caps.avifEncode, caps.webpEncode, format]);

  useEffect(() => {
    setTransform(INITIAL_TRANSFORM);
  }, [meta]);

  const onFiles = useCallback(
    async (files: File[]) => {
      await source.select(files[0]!);
      tool.markSelected();
    },
    [source, tool],
  );

  const rotate = useCallback((delta: 90 | -90 | 180) => {
    setTransform((current) => {
      const next = (((current.rotation + delta) % 360) + 360) % 360;
      return { ...current, rotation: next as Rotation };
    });
    tool.invalidate();
  }, [tool]);

  const toggleFlip = useCallback(
    (axis: 'h' | 'v') => {
      setTransform((current) => ({
        ...current,
        flipH: axis === 'h' ? !current.flipH : current.flipH,
        flipV: axis === 'v' ? !current.flipV : current.flipV,
      }));
      tool.invalidate();
    },
    [tool],
  );

  const runTransform = useCallback(async () => {
    if (!meta || !source.bitmap) return;

    const result = await tool.run(() =>
      transformImage(
        {
          source: source.bitmap!,
          sourceWidth: meta.width,
          sourceHeight: meta.height,
          fileName: meta.name,
          originalSize: meta.size,
        },
        transform,
        { format, quality, background: '#ffffff' },
      ),
    );

    if (result) {
      recordHistory({
        operation: 'rotate',
        fileName: meta.name,
        originalSize: meta.size,
        outputSize: result.meta.size,
        outputFormat: result.meta.type,
        outputName: result.meta.name,
        width: result.meta.width,
        height: result.meta.height,
      });
      toast.success('Applied', `${result.meta.width} × ${result.meta.height}`);
    }
  }, [meta, source, transform, format, quality, tool, toast]);

  const reset = useCallback(() => {
    source.clear();
    tool.reset();
    setTransform(INITIAL_TRANSFORM);
  }, [source, tool]);

  if (source.status === 'empty') {
    return (
      <div className="page container">
        <ToolLayout
          icon="rotate"
          title="Rotate & Flip"
          description="Straighten a sideways photo or mirror an image. The preview updates instantly — the pixels are only rewritten when you apply."
        >
          <ImageDropzone onFiles={onFiles} title="Drop an image to rotate" />
        </ToolLayout>
      </div>
    );
  }

  if (source.status === 'error' && source.error) {
    return (
      <div className="page container">
        <ToolLayout icon="rotate" title="Rotate & Flip" description="Rotate or mirror an image.">
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

  // See the note in CompressPage: `imageMeta` is null until the decode
  // resolves, and the lines below this guard read it.
  if (source.status === 'loading') {
    return (
      <ToolLoading
        icon="rotate"
        title="Rotate & Flip"
        description="Rotate or mirror an image."
        dropTitle="Drop an image to rotate"
        onFiles={onFiles}
      />
    );
  }

  const imageMeta = source.meta!;
  const busy = tool.state.phase === 'processing';
  const swapped = transform.rotation === 90 || transform.rotation === 270;
  const previewWidth = swapped ? imageMeta.height : imageMeta.width;
  const previewHeight = swapped ? imageMeta.width : imageMeta.height;
  const identity = isIdentityTransform(transform);

  const previewStyle: React.CSSProperties = {
    transform: `rotate(${transform.rotation}deg) scaleX(${transform.flipH ? -1 : 1}) scaleY(${transform.flipV ? -1 : 1})`,
    transition: 'transform var(--t-base) var(--ease)',
    maxHeight: 'min(52vh, 560px)',
    maxWidth: '100%',
    objectFit: 'contain',
  };

  return (
    <div className="page container">
      <ToolLayout
        icon="rotate"
        title="Rotate & Flip"
        description="The preview is live. Apply when it looks right."
        actions={
          <>
            <Button variant="secondary" icon="arrow-left" onClick={reset}>
              Start over
            </Button>
            <Button
              variant="primary"
              icon="rotate"
              onClick={runTransform}
              loading={tool.state.phase === 'processing'}
              disabled={identity}
            >
              {tool.state.phase === 'completed' ? 'Apply again' : 'Apply changes'}
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
                <span className="control-group__title">Rotate</span>
              </div>
              <div className="preset-grid">
                <button
                  type="button"
                  className="preset-chip"
                  onClick={() => rotate(-90)}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                >
                  <Icon name="rotate-ccw" size={16} />
                  90° left
                </button>
                <button
                  type="button"
                  className="preset-chip"
                  onClick={() => rotate(90)}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                >
                  <Icon name="rotate-cw" size={16} />
                  90° right
                </button>
                <button
                  type="button"
                  className="preset-chip"
                  onClick={() => rotate(180)}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, gridColumn: 'span 2' }}
                >
                  <Icon name="rotate" size={16} />
                  Rotate 180°
                </button>
              </div>
            </div>

            <div className="panel panel--pad control-group">
              <div className="control-group__head">
                <span className="control-group__title">Flip</span>
              </div>
              <div className="preset-grid">
                <button
                  type="button"
                  className="preset-chip"
                  data-active={transform.flipH}
                  aria-pressed={transform.flipH}
                  onClick={() => toggleFlip('h')}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                >
                  <Icon name="flip-h" size={16} />
                  Horizontal
                </button>
                <button
                  type="button"
                  className="preset-chip"
                  data-active={transform.flipV}
                  aria-pressed={transform.flipV}
                  onClick={() => toggleFlip('v')}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                >
                  <Icon name="flip-v" size={16} />
                  Vertical
                </button>
              </div>

              <Button
                variant="ghost"
                size="sm"
                icon="close"
                onClick={() => {
                  setTransform(INITIAL_TRANSFORM);
                  tool.invalidate();
                }}
                disabled={identity}
              >
                Clear transform
              </Button>
            </div>

            <div className="panel panel--pad control-group">
              <div className="control-group__head">
                <span className="control-group__title">Result</span>
              </div>
              <div className="stat-grid">
                <div className="stat">
                  <div className="stat__label">Original</div>
                  <div className="stat__value stat__value--sm">
                    {formatDimensions(imageMeta.width, imageMeta.height)}
                  </div>
                </div>
                <div className="stat stat--highlight">
                  <div className="stat__label">After</div>
                  <div className="stat__value stat__value--sm">
                    {formatDimensions(previewWidth, previewHeight)}
                  </div>
                </div>
              </div>
              <p className="hint">
                Applied: <strong>{describeTransform(transform).replace(/-/g, ' ')}</strong>
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
            </div>

            <ImageMetaPanel meta={imageMeta} output={tool.state.output} title="Source image" />
          </div>

          <div className="workspace__preview">
            <div className="stage">
              {source.previewUrl ? (
                <img
                  src={source.previewUrl}
                  alt="Rotated preview"
                  style={previewStyle}
                  draggable={false}
                />
              ) : null}
              {busy ? (
                <div className="stage__busy">
                  <div className="stage__busy-inner">
                    <span className="spinner spinner--lg" />
                    <span>Applying…</span>
                  </div>
                </div>
              ) : null}
            </div>

            {tool.state.phase === 'completed' && tool.state.blob && outputUrl && source.previewUrl ? (
              <>
                <CompareViewer
                  beforeUrl={source.previewUrl}
                  afterUrl={outputUrl}
                  beforeLabel="Original"
                  afterLabel="Transformed"
                  beforeMeta={formatBytes(imageMeta.size)}
                  afterMeta={formatBytes(tool.state.output!.size)}
                />
                <ResultPanel
                  output={tool.state.output!}
                  blob={tool.state.blob}
                  originalSize={imageMeta.size}
                  {...(tool.state.durationMs !== null ? { durationMs: tool.state.durationMs } : {})}
                />
              </>
            ) : null}

            {identity && tool.state.phase !== 'completed' ? (
              <Callout tone="info" title="Nothing to apply yet">
                Rotate or flip the image, then press <strong>Apply changes</strong>.
              </Callout>
            ) : null}

            {tool.state.phase === 'error' && tool.state.error ? (
              <ToolError
                title={tool.state.error.title}
                message={tool.state.error.message}
                {...(tool.state.error.hint ? { hint: tool.state.error.hint } : {})}
                onRetry={() => void runTransform()}
              />
            ) : null}
          </div>
        </div>

        <ToolFooter onReset={reset} />
      </ToolLayout>
    </div>
  );
}
