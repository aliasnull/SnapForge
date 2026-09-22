/**
 * The before/after comparison viewer.
 *
 * Two modes:
 *   - `slider`: one image on top of the other with a draggable divider.
 *   - `side-by-side`: both images at once, useful on a wide screen.
 *
 * The divider is a real `<input type="range">` visually, but it is driven by
 * pointer events so it works with a mouse, a finger, and the keyboard.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Icon } from './Icon';
import { Segmented } from './ui';

type CompareMode = 'slider' | 'side-by-side';

interface CompareViewerProps {
  beforeUrl: string;
  afterUrl: string;
  beforeLabel?: string;
  afterLabel?: string;
  beforeMeta?: string;
  afterMeta?: string;
  /** Start position of the divider, 0..100. */
  initialPosition?: number;
}

export function CompareViewer({
  beforeUrl,
  afterUrl,
  beforeLabel = 'Original',
  afterLabel = 'Processed',
  beforeMeta,
  afterMeta,
  initialPosition = 50,
}: CompareViewerProps) {
  const [mode, setMode] = useState<CompareMode>('slider');
  const [position, setPosition] = useState(initialPosition);
  const viewportRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const setFromClientX = useCallback((clientX: number) => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const rect = viewport.getBoundingClientRect();
    if (rect.width <= 0) return;
    const next = ((clientX - rect.left) / rect.width) * 100;
    setPosition(Math.min(100, Math.max(0, next)));
  }, []);

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      if (!dragging.current) return;
      event.preventDefault();
      setFromClientX(event.clientX);
    };

    const stop = () => {
      dragging.current = false;
    };

    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', stop);
    window.addEventListener('pointercancel', stop);

    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', stop);
      window.removeEventListener('pointercancel', stop);
    };
  }, [setFromClientX]);

  const startDrag = (event: React.PointerEvent) => {
    dragging.current = true;
    setFromClientX(event.clientX);
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    const step = event.shiftKey ? 10 : 2;
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      setPosition((value) => Math.max(0, value - step));
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      setPosition((value) => Math.min(100, value + step));
    } else if (event.key === 'Home') {
      event.preventDefault();
      setPosition(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      setPosition(100);
    }
  };

  return (
    <div className="compare">
      <div className="compare__modes">
        <Segmented<CompareMode>
          ariaLabel="Comparison layout"
          value={mode}
          onValueChange={setMode}
          options={[
            { value: 'slider', label: 'Slider' },
            { value: 'side-by-side', label: 'Side by side' },
          ]}
        />
        <span className="spacer" />
        {mode === 'slider' ? (
          <span className="note nowrap">Drag the handle to compare</span>
        ) : null}
      </div>

      {mode === 'slider' ? (
        <div
          className="compare__viewport checkerboard"
          ref={viewportRef}
          style={{ ['--pos' as string]: `${position}%` }}
          onPointerDown={startDrag}
        >
          <img className="compare__layer" src={afterUrl} alt={`${afterLabel} preview`} draggable={false} />
          <img
            className="compare__layer compare__layer--top"
            src={beforeUrl}
            alt={`${beforeLabel} preview`}
            draggable={false}
          />

          <span className="compare__tag compare__tag--left">{beforeLabel}</span>
          <span className="compare__tag compare__tag--right">{afterLabel}</span>

          <div
            className="compare__handle"
            role="slider"
            tabIndex={0}
            aria-label="Comparison position"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(position)}
            aria-valuetext={`${Math.round(position)}% of the original shown`}
            onKeyDown={onKeyDown}
          >
            <span className="compare__grip" aria-hidden="true">
              <Icon name="sliders" size={18} />
            </span>
          </div>
        </div>
      ) : (
        <div className="compare__sbs">
          <figure className="compare__pane checkerboard">
            <figcaption>
              {beforeLabel}
              {beforeMeta ? ` · ${beforeMeta}` : ''}
            </figcaption>
            <img src={beforeUrl} alt={`${beforeLabel} preview`} />
          </figure>
          <figure className="compare__pane checkerboard">
            <figcaption>
              {afterLabel}
              {afterMeta ? ` · ${afterMeta}` : ''}
            </figcaption>
            <img src={afterUrl} alt={`${afterLabel} preview`} />
          </figure>
        </div>
      )}
    </div>
  );
}
