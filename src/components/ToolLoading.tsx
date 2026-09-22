/**
 * The one "an image is being opened" surface, shared by every tool.
 *
 * `useImageSource` reports `status: 'loading'` with `meta: null` for the whole
 * time a file is being decoded, and decoding a large photo off a phone's camera
 * roll is not instant. Every tool therefore has to handle that state *before*
 * it reaches for `source.meta` — this component is what they render instead, so
 * the guard cannot drift between the five of them.
 *
 * It deliberately keeps the drop target on screen rather than replacing it: a
 * slow decode should still let someone drop a different file, and `select()`
 * already cancels the in-flight decode when a newer one starts.
 */

import { ImageDropzone } from './ImageDropzone';
import { ToolLayout } from './ToolLayout';
import { Icon, type IconName } from './Icon';

interface ToolLoadingProps {
  icon: IconName;
  title: string;
  description: string;
  /** Copy inside the drop target, e.g. "Drop an image to compress". */
  dropTitle: string;
  onFiles: (files: File[]) => void;
}

export function ToolLoading({
  icon,
  title,
  description,
  dropTitle,
  onFiles,
}: ToolLoadingProps) {
  return (
    <div className="page container">
      <ToolLayout icon={icon} title={title} description={description}>
        <ImageDropzone onFiles={onFiles} title={dropTitle} />
        <div className="stage stage--empty" style={{ marginTop: 'var(--s-5)' }} role="status">
          <div className="stage__busy-inner">
            <span className="spinner spinner--lg" />
            <span>Opening image…</span>
          </div>
        </div>
        <p className="note" style={{ marginTop: 'var(--s-4)', textAlign: 'center' }}>
          <Icon name="lock" size={13} /> Decoding happens on this device. Nothing is uploaded.
        </p>
      </ToolLayout>
    </div>
  );
}
