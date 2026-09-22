/**
 * Format picking, shared by every tool that writes a file.
 *
 * The options are derived from what this browser can *actually* encode, and
 * unavailable formats are shown disabled with the reason — never silently
 * substituted.
 */

import { useMemo } from 'react';
import { SelectField } from './ui';
import { getCapabilities, isLossy } from '../lib/capabilities';
import type { OutputFormat } from '../lib/types';

export const FORMAT_LABEL: Record<OutputFormat, string> = {
  'image/jpeg': 'JPEG (.jpg)',
  'image/png': 'PNG (.png)',
  'image/webp': 'WebP (.webp)',
  'image/avif': 'AVIF (.avif)',
};

export const FORMAT_NOTE: Record<OutputFormat, string> = {
  'image/jpeg': 'Universal support. No transparency. Best for photos.',
  'image/png': 'Lossless and supports transparency. Usually the largest file.',
  'image/webp': 'Smaller than JPEG at the same quality. Supports transparency.',
  'image/avif': 'Best compression available in a browser, but slower to encode.',
};

interface FormatSelectProps {
  label?: string;
  value: OutputFormat;
  onValueChange: (format: OutputFormat) => void;
  /** Restrict the list further, e.g. when the source has transparency. */
  allow?: OutputFormat[];
  hint?: string;
}

export function FormatSelect({
  label = 'Output format',
  value,
  onValueChange,
  allow,
  hint,
}: FormatSelectProps) {
  const caps = getCapabilities();

  const options = useMemo(() => {
    const all: OutputFormat[] = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];

    return all.map((format) => {
      const permitted = !allow || allow.includes(format);
      const encodable =
        format === 'image/jpeg' || format === 'image/png'
          ? true
          : format === 'image/webp'
            ? caps.webpEncode
            : caps.avifEncode;

      return {
        value: format,
        label: FORMAT_LABEL[format],
        disabled: !permitted || !encodable,
      };
    });
  }, [allow, caps.avifEncode, caps.webpEncode]);

  const unsupported = options.filter((option) => option.disabled && !allow?.includes(option.value));

  return (
    <SelectField<OutputFormat>
      label={label}
      value={value}
      options={options}
      onValueChange={onValueChange}
      hint={
        hint ??
        (unsupported.length > 0
          ? `${unsupported.map((option) => FORMAT_LABEL[option.value].split(' ')[0]).join(', ')} not available in this browser.`
          : FORMAT_NOTE[value])
      }
    />
  );
}

export { isLossy };
