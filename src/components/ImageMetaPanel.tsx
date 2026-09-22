/** Read-only metadata panel. Everything shown here comes from the local file. */

import { formatBytes, formatDimensions, formatAspectRatio, formatMegapixels } from '../lib/format';
import { Icon } from './Icon';
import type { ImageMeta } from '../lib/types';

const FORMAT_LABELS: Record<string, string> = {
  'image/jpeg': 'JPEG',
  'image/png': 'PNG',
  'image/webp': 'WebP',
  'image/avif': 'AVIF',
  'image/gif': 'GIF',
  'image/bmp': 'BMP',
};

export function formatLabel(mime: string): string {
  if (!mime) return 'Unknown';
  return FORMAT_LABELS[mime] ?? mime.replace('image/', '').toUpperCase();
}

interface ImageMetaPanelProps {
  meta: ImageMeta;
  /** Optional second column describing the processed output. */
  output?: {
    name: string;
    type: string;
    size: number;
    width: number;
    height: number;
  } | null;
  title?: string;
}

export function ImageMetaPanel({ meta, output, title = 'Image details' }: ImageMetaPanelProps) {
  const rows: { label: string; value: string; title?: string }[] = [
    { label: 'Filename', value: meta.name },
    { label: 'Format', value: formatLabel(meta.detectedType || meta.type) },
    { label: 'File size', value: formatBytes(meta.size), title: `${meta.size.toLocaleString()} bytes` },
    { label: 'Dimensions', value: formatDimensions(meta.width, meta.height) },
    { label: 'Aspect ratio', value: formatAspectRatio(meta.width, meta.height) },
    { label: 'Pixels', value: formatMegapixels(meta.width, meta.height) },
  ];

  return (
    <div className="panel panel--flat panel--pad">
      <div className="row" style={{ marginBottom: 'var(--s-3)' }}>
        <Icon name="info" size={17} />
        <h2 style={{ fontSize: 'var(--fs-md)', fontWeight: 650 }}>{title}</h2>
      </div>

      <dl style={{ margin: 0 }}>
        {rows.map((row) => (
          <div className="kv" key={row.label}>
            <dt>{row.label}</dt>
            <dd className="truncate" title={row.title ?? row.value}>
              {row.value}
            </dd>
          </div>
        ))}
        {output ? (
          <>
            <div className="kv">
              <dt>Output</dt>
              <dd className="truncate" title={output.name}>
                {output.name}
              </dd>
            </div>
            <div className="kv">
              <dt>Output format</dt>
              <dd>{formatLabel(output.type)}</dd>
            </div>
            <div className="kv">
              <dt>Output size</dt>
              <dd>{formatBytes(output.size)}</dd>
            </div>
            <div className="kv">
              <dt>Output dimensions</dt>
              <dd>{formatDimensions(output.width, output.height)}</dd>
            </div>
          </>
        ) : null}
      </dl>

      <p className="note" style={{ marginTop: 'var(--s-3)' }}>
        Read from the file on your device. Nothing here is uploaded or stored.
      </p>
    </div>
  );
}
