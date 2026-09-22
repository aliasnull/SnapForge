/**
 * The result panel: size comparison, output metadata, and the actions the user
 * actually came for (download, share, copy, open).
 *
 * Rendered only in the COMPLETED state — the download button never exists
 * before there is something to download.
 */

import { useState } from 'react';
import { Button, IconButton } from './ui';
import { Icon } from './Icon';
import { SizeComparison } from './SizeComparison';
import { formatBytes, formatDimensions } from '../lib/format';
import { formatLabel } from './ImageMetaPanel';
import { copyImageToClipboard, downloadBlob, openBlobInNewTab, shareOrDownload } from '../lib/download';
import { getCapabilities } from '../lib/capabilities';
import { useToast } from '../state/ToastProvider';
import type { OutputMeta } from '../lib/types';

interface ResultPanelProps {
  output: OutputMeta;
  blob: Blob;
  originalSize?: number;
  /** Shown as a small caption, e.g. "Encoded in 240 ms". */
  durationMs?: number;
  /** Extra controls, e.g. "Adjust and re-run". */
  children?: React.ReactNode;
}

export function ResultPanel({
  output,
  blob,
  originalSize,
  durationMs,
  children,
}: ResultPanelProps) {
  const toast = useToast();
  const caps = getCapabilities();
  const [busy, setBusy] = useState(false);

  const handleDownload = () => {
    const result = downloadBlob(blob, output.name);
    if (result.ok) {
      toast.success('Download started', `${output.name} · ${formatBytes(output.size)}`);
    } else if (result.error) {
      toast.error(result.error);
    }
  };

  const handleShare = async () => {
    setBusy(true);
    try {
      const result = await shareOrDownload(blob, output.name, 'SnapForge image');
      if (result.error) toast.error(result.error);
      else if (!result.shared) toast.success('Saved', `${output.name} · ${formatBytes(output.size)}`);
    } finally {
      setBusy(false);
    }
  };

  const handleCopy = async () => {
    setBusy(true);
    try {
      const result = await copyImageToClipboard(blob);
      if (result.ok) toast.success('Copied to clipboard');
      else if (result.error) toast.error(result.error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack" style={{ gap: 'var(--s-4)' }}>
      {originalSize !== undefined && originalSize > 0 ? (
        <SizeComparison originalSize={originalSize} processedSize={output.size} />
      ) : (
        <div className="stat-grid">
          <div className="stat stat--highlight">
            <div className="stat__label">Output size</div>
            <div className="stat__value">{formatBytes(output.size)}</div>
          </div>
          <div className="stat">
            <div className="stat__label">Dimensions</div>
            <div className="stat__value stat__value--sm">
              {formatDimensions(output.width, output.height)}
            </div>
          </div>
        </div>
      )}

      <div className="stat-grid stat-grid--3">
        <div className="stat">
          <div className="stat__label">Format</div>
          <div className="stat__value stat__value--sm">{formatLabel(output.type)}</div>
          {output.quality !== undefined ? (
            <div className="stat__sub">Quality {Math.round(output.quality * 100)}%</div>
          ) : (
            <div className="stat__sub">Lossless</div>
          )}
        </div>
        <div className="stat">
          <div className="stat__label">Size</div>
          <div className="stat__value stat__value--sm">{formatBytes(output.size)}</div>
          <div className="stat__sub">Exact: {output.size.toLocaleString()} B</div>
        </div>
        <div className="stat">
          <div className="stat__label">Output name</div>
          <div className="stat__value stat__value--sm truncate" title={output.name}>
            {output.name}
          </div>
          {durationMs !== undefined ? (
            <div className="stat__sub">Encoded in {durationMs} ms</div>
          ) : null}
        </div>
      </div>

      <div className="actions-row">
        <Button variant="primary" icon="download" onClick={handleDownload}>
          Download
        </Button>

        {caps.share ? (
          <Button variant="secondary" icon="share" onClick={handleShare} loading={busy}>
            Save / Share
          </Button>
        ) : null}

        {caps.clipboardImage ? (
          <IconButton icon="copy" label="Copy image to clipboard" onClick={handleCopy} />
        ) : null}

        <IconButton
          icon="external"
          label="Open result in a new tab"
          onClick={() => {
            if (!openBlobInNewTab(blob)) toast.error('Could not open a new tab');
          }}
        />
      </div>

      {children}

      <p className="note icon-text">
        <Icon name="lock" size={13} />
        This file was created in your browser. It was never uploaded anywhere.
      </p>
    </div>
  );
}
