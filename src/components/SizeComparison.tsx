/**
 * File size comparison block.
 *
 * Every number is computed from the actual blobs — no estimates, no invented
 * statistics. When the "compressed" file is bigger than the original (which
 * genuinely happens with already-optimised JPEGs) it says so instead of
 * pretending otherwise.
 */

import { formatBytes, formatExactBytes, formatPercentMagnitude, percentChange } from '../lib/format';

interface SizeComparisonProps {
  originalSize: number;
  processedSize: number;
  originalLabel?: string;
  processedLabel?: string;
}

export function SizeComparison({
  originalSize,
  processedSize,
  originalLabel = 'Original',
  processedLabel = 'Result',
}: SizeComparisonProps) {
  const change = percentChange(originalSize, processedSize);
  const saved = originalSize - processedSize;
  const max = Math.max(originalSize, processedSize, 1);
  const beforeWidth = (originalSize / max) * 100;
  const afterWidth = (processedSize / max) * 100;
  const grew = change !== null && change > 0;

  return (
    <div className="sizebar">
      <div className="sizebar__row">
        <span className="sizebar__label">{originalLabel}</span>
        <span className="sizebar__track">
          <span
            className="sizebar__fill sizebar__fill--before"
            style={{ width: `${beforeWidth}%` }}
          />
        </span>
        <span className="sizebar__value" title={formatExactBytes(originalSize)}>
          {formatBytes(originalSize)}
        </span>
      </div>

      <div className="sizebar__row">
        <span className="sizebar__label">{processedLabel}</span>
        <span className="sizebar__track">
          <span
            className="sizebar__fill sizebar__fill--after"
            style={{ width: `${afterWidth}%` }}
          />
        </span>
        <span className="sizebar__value" title={formatExactBytes(processedSize)}>
          {formatBytes(processedSize)}
        </span>
      </div>

      <div className="sizebar__saved">
        <span className="muted">
          {grew ? 'Increased by' : 'Saved'}
          {change !== null ? ` · ${formatPercentMagnitude(originalSize, processedSize)}` : ''}
        </span>
        <b className={grew ? 'is-negative' : undefined}>
          {grew ? '+' : '−'}
          {formatBytes(Math.abs(saved))}
        </b>
      </div>

      {grew ? (
        <p className="note">
          This image was already optimised, so re-encoding it added data. Lower the quality
          slider or resize to get a smaller file.
        </p>
      ) : null}
    </div>
  );
}
