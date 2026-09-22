/**
 * Batch processing.
 *
 * Up to 40 images through one operation. Memory is the constraint on a phone,
 * so files are decoded, processed and released **one at a time** — peak usage
 * is a single image, not the whole queue.
 *
 * Progress is reported per item, failures are isolated (one bad file does not
 * abort the run), and the results are packaged into a ZIP built in the browser.
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import { ImageDropzone } from '../../components/ImageDropzone';
import { ResultPanel } from '../../components/ResultPanel';
import { FormatSelect } from '../../components/FormatSelect';
import { ToolError, ToolFooter, ToolLayout } from '../../components/ToolLayout';
import { Button, Callout, IconButton, NumberInput, ProgressBar, RangeField, Segmented, Switch } from '../../components/ui';
import { Icon } from '../../components/Icon';
import { EmptyState } from '../../components/ui';
import { useObjectUrl } from '../../hooks';
import { decodeImageFile } from '../../lib/image/decode';
import { renderTransform, type Surface } from '../../lib/image/canvas';
import {
  compressImage,
  convertImage,
  QUALITY_PRESETS,
  resizeImage,
} from '../../lib/image/operations';
import { buildOutputName, isLargeFile, partitionImageFiles } from '../../lib/files';
import { formatBytes, formatDimensions } from '../../lib/format';
import { toAppError } from '../../lib/errors';
import { buildZipName, createZip } from '../../lib/zip';
import { downloadBlob } from '../../lib/download';
import { recordHistoryBatch } from '../../state/historyStore';
import { useSettings } from '../../state/settingsStore';
import { useToast } from '../../state/ToastProvider';
import type { HistoryEntry, OutputFormat, ProcessResult } from '../../lib/types';

type Operation = 'compress' | 'resize' | 'convert';
type ItemStatus = 'queued' | 'working' | 'done' | 'failed';

interface BatchItem {
  id: string;
  file: File;
  status: ItemStatus;
  outputName?: string;
  outputSize?: number;
  outputWidth?: number;
  outputHeight?: number;
  error?: string;
  blob?: Blob;
}

const MAX_ITEMS = 40;

const OPERATION_LABEL: Record<Operation, string> = {
  compress: 'Compress',
  resize: 'Resize',
  convert: 'Convert',
};

function uid(): string {
  return `b_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function BatchPage() {
  const toast = useToast();
  const [settings] = useSettings();

  const [items, setItems] = useState<BatchItem[]>([]);
  const [operation, setOperation] = useState<Operation>('compress');
  const [format, setFormat] = useState<OutputFormat>(settings.defaultFormat);
  const [quality, setQuality] = useState(settings.defaultQuality);
  const [maxWidth, setMaxWidth] = useState(1920);
  const [percent, setPercent] = useState(50);
  const [resizeMode, setResizeMode] = useState<'longest' | 'percentage'>('longest');
  const [rotate90, setRotate90] = useState(false);

  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [zipBlob, setZipBlob] = useState<Blob | null>(null);
  const [zipName, setZipName] = useState('snapforge-batch.zip');
  const [zipBusy, setZipBusy] = useState(false);
  const [fatalError, setFatalError] = useState<{ title: string; message: string; hint?: string } | null>(null);

  const cancelRef = useRef(false);
  const zipUrl = useObjectUrl(zipBlob);

  const addFiles = useCallback(
    (files: File[]) => {
      const { accepted, rejected } = partitionImageFiles(files);

      if (rejected.length > 0) {
        toast.info(
          `${rejected.length} file${rejected.length === 1 ? '' : 's'} skipped`,
          rejected[0],
        );
      }

      setItems((current) => {
        const room = MAX_ITEMS - current.length;
        if (room <= 0) {
          toast.error(
            'Batch is full',
            `SnapForge processes up to ${MAX_ITEMS} images at a time to protect your device's memory.`,
          );
          return current;
        }
        const next = accepted.slice(0, room).map<BatchItem>((file) => ({
          id: uid(),
          file,
          status: 'queued',
        }));
        if (accepted.length > room) {
          toast.info(
            'Some files were not added',
            `The batch is limited to ${MAX_ITEMS} images per run.`,
          );
        }
        return [...current, ...next];
      });

      setZipBlob(null);
    },
    [toast],
  );

  const removeItem = useCallback((id: string) => {
    setItems((current) => current.filter((item) => item.id !== id));
    setZipBlob(null);
  }, []);

  const clearAll = useCallback(() => {
    setItems([]);
    setZipBlob(null);
    setProgress({ done: 0, total: 0 });
    setFatalError(null);
  }, []);

  const pending = useMemo(() => items.filter((item) => item.status === 'queued').length, [items]);
  const completed = useMemo(() => items.filter((item) => item.status === 'done').length, [items]);
  const failed = useMemo(() => items.filter((item) => item.status === 'failed').length, [items]);
  const largeCount = useMemo(() => items.filter((item) => isLargeFile(item.file)).length, [items]);

  const updateItem = useCallback((id: string, patch: Partial<BatchItem>) => {
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  }, []);

  /* -------------------------------------------------------------- running */

  const processOne = useCallback(
    async (item: BatchItem, index: number, total: number): Promise<ProcessResult> => {
      const decoded = await decodeImageFile(item.file);
      let rotated: Surface | null = null;
      try {
        // An optional 90° rotation is applied *first*, so every later stage
        // (resize caps, quality, encoding) sees the final orientation and the
        // "longest side" limit means what the user expects.
        let source: CanvasImageSource = decoded.source;
        let sourceWidth = decoded.width;
        let sourceHeight = decoded.height;

        if (rotate90) {
          rotated = renderTransform(
            decoded.source,
            decoded.width,
            decoded.height,
            90,
            false,
            false,
            { flatten: format === 'image/jpeg', background: '#ffffff' },
          );
          source = rotated.canvas;
          sourceWidth = rotated.width;
          sourceHeight = rotated.height;
        }

        const input = {
          source,
          sourceWidth,
          sourceHeight,
          fileName: item.file.name,
          originalSize: item.file.size,
        };

        let result: ProcessResult;

        if (operation === 'convert') {
          result = await convertImage(input, { format, quality, background: '#ffffff' });
        } else if (operation === 'compress') {
          result = await compressImage(input, {
            format,
            quality,
            maxWidth: maxWidth > 0 ? maxWidth : 0,
            background: '#ffffff',
          });
        } else {
          const longest = Math.max(sourceWidth, sourceHeight);
          const scale = resizeMode === 'percentage' ? percent / 100 : Math.min(1, maxWidth / longest);
          const width = Math.max(1, Math.round(sourceWidth * scale));
          const height = Math.max(1, Math.round(sourceHeight * scale));
          result = await resizeImage(input, {
            width,
            height,
            fit: 'stretch',
            background: '#ffffff',
            format,
            quality,
          });
        }

        // Batch naming: photo-01.webp, photo-02.webp …
        const finalName = buildOutputName(item.file.name, {
          format,
          index,
          total,
        });

        return {
          ...result,
          meta: { ...result.meta, name: finalName },
        };
      } finally {
        decoded.release();
      }
    },
    [operation, format, quality, maxWidth, percent, resizeMode, rotate90],
  );

  const runBatch = useCallback(async () => {
    const queue = items.filter((item) => item.status === 'queued' || item.status === 'failed');
    if (queue.length === 0) return;

    cancelRef.current = false;
    setRunning(true);
    setZipBlob(null);
    setFatalError(null);
    setProgress({ done: 0, total: queue.length });

    const historyEntries: (Omit<HistoryEntry, 'id' | 'timestamp'>)[] = [];
    let done = 0;

    for (let index = 0; index < queue.length; index += 1) {
      if (cancelRef.current) break;

      const item = queue[index]!;
      updateItem(item.id, { status: 'working', error: undefined });

      try {
        const result = await processOne(item, index, queue.length);
        updateItem(item.id, {
          status: 'done',
          outputName: result.meta.name,
          outputSize: result.meta.size,
          outputWidth: result.meta.width,
          outputHeight: result.meta.height,
          blob: result.blob,
        });

        historyEntries.push({
          operation: 'batch',
          fileName: item.file.name,
          originalSize: item.file.size,
          outputSize: result.meta.size,
          outputFormat: result.meta.type,
          outputName: result.meta.name,
          width: result.meta.width,
          height: result.meta.height,
        });
      } catch (error) {
        const appError = toAppError(error, 'process this file');
        updateItem(item.id, { status: 'failed', error: `${appError.title}: ${appError.message}` });
      }

      done += 1;
      setProgress({ done, total: queue.length });

      // Yield to the browser so the progress bar actually paints on mobile.
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    setRunning(false);

    if (historyEntries.length > 0) recordHistoryBatch(historyEntries);

    setItems((current) => {
      const succeeded = current.filter((item) => item.status === 'done');
      if (succeeded.length === 0) {
        setFatalError({
          title: 'Nothing was processed',
          message: 'Every file in this batch failed. Check the messages below.',
          hint: 'Try a different output format, or process the images one at a time.',
        });
      }
      return current;
    });
  }, [items, processOne, updateItem]);

  const downloadZip = useCallback(async () => {
    const ready = items.filter((item) => item.status === 'done' && item.blob);
    if (ready.length === 0) return;

    setZipBusy(true);
    try {
      const name = buildZipName('snapforge', ready.length);
      const blob = await createZip(
        ready.map((item) => ({
          name: item.outputName ?? item.file.name,
          blob: item.blob!,
        })),
      );
      setZipBlob(blob);
      setZipName(name);

      const result = downloadBlob(blob, name);
      if (result.ok) {
        toast.success('ZIP created', `${ready.length} images · ${formatBytes(blob.size)}`);
      } else if (result.error) {
        toast.error(result.error);
      }
    } catch (error) {
      const appError = toAppError(error, 'build the ZIP file');
      toast.error(appError);
    } finally {
      setZipBusy(false);
    }
  }, [items, toast]);

  /* ----------------------------------------------------------------- views */

  if (items.length === 0) {
    return (
      <div className="page container">
        <ToolLayout
          icon="batch"
          title="Batch Processing"
          description={`Apply one operation to many images at once. Up to ${MAX_ITEMS} files per run, processed one at a time so your device's memory stays comfortable.`}
        >
          <ImageDropzone
            onFiles={addFiles}
            multiple
            title="Drop images here"
            subtitle="Select as many as you need — they queue up and run one after another."
          />

          <div className="feature-grid" style={{ marginTop: 'var(--s-6)' }}>
            <div className="feature">
              <Icon name="cpu" size={20} />
              <h3>One at a time</h3>
              <p>Each image is decoded, processed and freed before the next one starts.</p>
            </div>
            <div className="feature">
              <Icon name="alert-circle" size={20} />
              <h3>Failures stay isolated</h3>
              <p>A corrupt file is reported and skipped; the rest of the batch keeps going.</p>
            </div>
            <div className="feature">
              <Icon name="download" size={20} />
              <h3>ZIP in the browser</h3>
              <p>The archive is assembled locally and downloaded directly. No server involved.</p>
            </div>
          </div>
        </ToolLayout>
      </div>
    );
  }

  const busy = running || zipBusy;

  return (
    <div className="page container">
      <ToolLayout
        icon="batch"
        title="Batch Processing"
        description="One operation, many images, all local."
        actions={
          <>
            <Button variant="secondary" icon="plus" onClick={clearAll} disabled={busy}>
              Clear list
            </Button>
            <Button
              variant="primary"
              icon="zap"
              onClick={runBatch}
              loading={running}
              disabled={pending === 0 && failed === 0}
            >
              {completed > 0 ? `Process ${pending + failed} remaining` : `Process ${items.length} images`}
            </Button>
          </>
        }
      >
        {largeCount > 0 ? (
          <Callout tone="warning" title={`${largeCount} large image${largeCount === 1 ? '' : 's'} in this batch`}>
            Files over 25 MB take noticeably longer on a phone. If the tab becomes sluggish,
            process them in smaller groups.
          </Callout>
        ) : null}

        <div className="workspace" style={{ marginTop: 'var(--s-5)' }}>
          <div className="workspace__controls">
            <div className="panel panel--pad control-group">
              <div className="control-group__head">
                <span className="control-group__title">Operation</span>
              </div>
              <Segmented<Operation>
                ariaLabel="Batch operation"
                value={operation}
                onValueChange={(value) => {
                  setOperation(value);
                  setZipBlob(null);
                }}
                options={[
                  { value: 'compress', label: 'Compress' },
                  { value: 'resize', label: 'Resize' },
                  { value: 'convert', label: 'Convert' },
                ]}
              />

              <FormatSelect
                label="Output format"
                value={format}
                onValueChange={setFormat}
                hint={OPERATION_LABEL[operation] + ' → ' + format.replace('image/', '').toUpperCase()}
              />

              {format !== 'image/png' ? (
                <RangeField
                  label="Quality"
                  value={Math.round(quality * 100)}
                  min={10}
                  max={100}
                  displayValue={`${Math.round(quality * 100)}%`}
                  onValueChange={(value) => {
                    setQuality(value / 100);
                    setZipBlob(null);
                  }}
                />
              ) : null}

              {operation === 'compress' ? (
                <>
                  <div className="preset-grid">
                    {QUALITY_PRESETS.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        className="preset-chip"
                        data-active={Math.abs(quality - preset.quality) < 0.001}
                        onClick={() => {
                          setQuality(preset.quality);
                          if (preset.maxWidth) setMaxWidth(preset.maxWidth);
                          setZipBlob(null);
                        }}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                  <NumberInput
                    label="Maximum width"
                    suffix="px"
                    value={maxWidth}
                    min={0}
                    max={20000}
                    onValueChange={(value) => {
                      setMaxWidth(value);
                      setZipBlob(null);
                    }}
                  />
                  <p className="hint">Set to 0 to keep each image at its original width.</p>
                </>
              ) : null}

              {operation === 'resize' ? (
                <>
                  <Segmented<'longest' | 'percentage'>
                    ariaLabel="Resize mode"
                    value={resizeMode}
                    onValueChange={setResizeMode}
                    options={[
                      { value: 'longest', label: 'Longest side' },
                      { value: 'percentage', label: 'Percentage' },
                    ]}
                  />
                  {resizeMode === 'longest' ? (
                    <NumberInput
                      label="Longest side"
                      suffix="px"
                      value={maxWidth}
                      min={16}
                      max={20000}
                      onValueChange={setMaxWidth}
                    />
                  ) : (
                    <RangeField
                      label="Scale"
                      value={percent}
                      min={5}
                      max={200}
                      displayValue={`${percent}%`}
                      onValueChange={setPercent}
                    />
                  )}
                </>
              ) : null}

              <Switch
                checked={rotate90}
                onCheckedChange={(value) => {
                  setRotate90(value);
                  setZipBlob(null);
                }}
                label="Also rotate 90° clockwise"
              />
            </div>

            {running || progress.total > 0 ? (
              <div className="panel panel--pad control-group">
                <div className="progress-head">
                  <span className="muted">
                    {running ? 'Processing' : 'Finished'}
                  </span>
                  <b>
                    {progress.done} / {progress.total}
                  </b>
                </div>
                <ProgressBar
                  value={progress.done}
                  max={progress.total}
                  done={!running && progress.done === progress.total}
                  label="Batch progress"
                />
                <div className="pill-row" style={{ marginTop: 'var(--s-3)' }}>
                  <span className="badge badge--success">
                    <Icon name="check" size={13} />
                    {completed} completed
                  </span>
                  {failed > 0 ? (
                    <span className="badge badge--danger">
                      <Icon name="close" size={13} />
                      {failed} failed
                    </span>
                  ) : (
                    <span className="badge">0 failed</span>
                  )}
                </div>

                {running ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      cancelRef.current = true;
                    }}
                  >
                    Stop after this image
                  </Button>
                ) : null}
              </div>
            ) : null}

            {completed > 0 ? (
              <div className="panel panel--pad control-group">
                <div className="control-group__head">
                  <span className="control-group__title">Download</span>
                </div>
                <p className="hint">
                  {completed} image{completed === 1 ? '' : 's'} ready. They are packaged into a
                  single ZIP, built in your browser.
                </p>
                <Button
                  variant="primary"
                  icon="download"
                  onClick={downloadZip}
                  loading={zipBusy}
                  block
                >
                  Download all ({completed})
                </Button>
              </div>
            ) : null}

            {zipBlob && zipUrl ? (
              <ResultPanel
                output={{
                  name: zipName,
                  type: 'image/png',
                  size: zipBlob.size,
                  width: 0,
                  height: 0,
                }}
                blob={zipBlob}
              />
            ) : null}
          </div>

          <div className="workspace__preview">
            {fatalError ? (
              <ToolError
                title={fatalError.title}
                message={fatalError.message}
                {...(fatalError.hint ? { hint: fatalError.hint } : {})}
                onRetry={clearAll}
              />
            ) : null}

            <div className="panel panel--pad">
              <div className="row" style={{ marginBottom: 'var(--s-4)' }}>
                <h2 style={{ fontSize: 'var(--fs-md)', fontWeight: 650 }}>
                  Queue ({items.length})
                </h2>
                <span className="spacer" />
                <IconButton
                  icon="plus"
                  label="Add more images"
                  onClick={() => {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = 'image/*';
                    input.multiple = true;
                    input.onchange = () => {
                      if (input.files) addFiles(Array.from(input.files));
                    };
                    input.click();
                  }}
                  disabled={busy}
                />
              </div>

              {items.length === 0 ? (
                <EmptyState
                  icon="images"
                  title="No images queued"
                  description="Add images to get started."
                />
              ) : (
                <div className="batch-list">
                  {items.map((item, index) => (
                    <div className="batch-row" key={item.id}>
                      <span className="batch-row__index">{index + 1}</span>
                      <div className="batch-row__body">
                        <div className="batch-row__name" title={item.file.name}>
                          {item.file.name}
                        </div>
                        <div className="batch-row__meta">
                          <span>{formatBytes(item.file.size)}</span>
                          {item.outputSize !== undefined ? (
                            <span>→ {formatBytes(item.outputSize)}</span>
                          ) : null}
                          {item.outputWidth ? (
                            <span>{formatDimensions(item.outputWidth, item.outputHeight ?? 0)}</span>
                          ) : null}
                          {item.error ? <span title={item.error}>{item.error}</span> : null}
                        </div>
                      </div>
                      <div
                        className={`batch-row__status batch-row__status--${item.status}`}
                        aria-label={`Status: ${item.status}`}
                      >
                        {item.status === 'queued' ? <Icon name="history" size={15} /> : null}
                        {item.status === 'working' ? <span className="spinner" /> : null}
                        {item.status === 'done' ? <Icon name="check" size={15} /> : null}
                        {item.status === 'failed' ? <Icon name="close" size={15} /> : null}
                        <span className="sr-only">{item.status}</span>
                      </div>
                      <IconButton
                        icon="trash"
                        label={`Remove ${item.file.name}`}
                        size="sm"
                        onClick={() => removeItem(item.id)}
                        disabled={busy}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            <p className="note icon-text">
              <Icon name="lock" size={13} />
              Files stay in memory for this tab only. Nothing is uploaded, and nothing is written
              to disk except the ZIP you download.
            </p>
          </div>
        </div>

        <ToolFooter onReset={clearAll} />
      </ToolLayout>
    </div>
  );
}
