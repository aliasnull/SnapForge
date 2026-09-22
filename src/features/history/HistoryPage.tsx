/** History — metadata only, stored locally, clearable in one tap. */

import { useMemo, useState } from 'react';
import { Icon } from '../../components/Icon';
import { Button, Callout, EmptyState, Modal } from '../../components/ui';
import { Link } from '../../lib/router';
import { formatBytes, formatRelativeTime, percentChange, formatPercentMagnitude } from '../../lib/format';
import { historyFootprint, OPERATION_LABELS } from '../../lib/history';
import { formatLabel } from '../../components/ImageMetaPanel';
import { useHistory, useHistoryActions } from '../../state/historyStore';
import { useToast } from '../../state/ToastProvider';

export function HistoryPage() {
  const history = useHistory();
  const { clear, remove } = useHistoryActions();
  const toast = useToast();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const footprint = useMemo(() => historyFootprint(history), [history]);

  if (history.length === 0) {
    return (
      <div className="page container">
        <header className="page-head">
          <p className="page-head__eyebrow">
            <Icon name="history" size={14} />
            Stored on this device only
          </p>
          <h1>History</h1>
          <p>A local record of what you processed. Image data is never included.</p>
        </header>

        <EmptyState
          icon="history"
          title="Nothing here yet"
          description="Once you compress, resize or convert an image, a small text-only record appears here so you can see what changed."
          action={
            <Link to="/tools" className="btn btn--primary">
              Open a tool
            </Link>
          }
        />

        <div className="panel panel--pad" style={{ marginTop: 'var(--s-6)' }}>
          <div className="row" style={{ marginBottom: 'var(--s-3)' }}>
            <Icon name="shield" size={18} />
            <h2 style={{ fontSize: 'var(--fs-md)', fontWeight: 650 }}>What history stores</h2>
          </div>
          <ul className="prose" style={{ paddingLeft: '1.1rem', marginBottom: 0 }}>
            <li>File name, operation, timestamp</li>
            <li>Original and output file sizes, plus the output format</li>
            <li>Output pixel dimensions</li>
          </ul>
          <p className="note" style={{ marginTop: 'var(--s-3)' }}>
            No image data. No thumbnails. No copies of your files. It lives in this browser's local
            storage and disappears when you clear it.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="page container">
      <header className="page-head">
        <p className="page-head__eyebrow">
          <Icon name="history" size={14} />
          {history.length} record{history.length === 1 ? '' : 's'} · {formatBytes(footprint)}
        </p>
        <h1>History</h1>
        <p>
          Text-only records kept in this browser. Your images were never stored — only the numbers
          about them.
        </p>
      </header>

      <div className="section-actions" style={{ marginBottom: 'var(--s-5)' }}>
        <Button variant="danger" icon="trash" onClick={() => setConfirmOpen(true)}>
          Clear history
        </Button>
        <span className="note">Uses {formatBytes(footprint)} of local storage.</span>
      </div>

      <div className="history-list">
        {history.map((entry) => {
          const change = percentChange(entry.originalSize, entry.outputSize);
          const grew = change !== null && change > 0;

          return (
            <div className="history-row" key={entry.id}>
              <span className="history-row__op">{OPERATION_LABELS[entry.operation]}</span>

              <div className="history-row__body">
                <div className="history-row__name" title={entry.fileName}>
                  {entry.fileName}
                </div>
                <div className="history-row__meta">
                  {formatRelativeTime(entry.timestamp)} · {formatBytes(entry.originalSize)} →{' '}
                  {formatBytes(entry.outputSize)} · {formatLabel(entry.outputFormat)}
                  {entry.width > 0 ? ` · ${entry.width}×${entry.height}` : ''}
                </div>
              </div>

              {change !== null ? (
                <span className={`history-row__delta ${grew ? 'is-negative' : ''}`}>
                  {grew ? '+' : '−'}
                  {formatPercentMagnitude(entry.originalSize, entry.outputSize)}
                </span>
              ) : null}

              <button
                type="button"
                className="btn btn--ghost btn--icon btn--sm"
                aria-label={`Remove record for ${entry.fileName}`}
                onClick={() => remove(entry.id)}
              >
                <Icon name="close" size={15} />
              </button>
            </div>
          );
        })}
      </div>

      <Callout tone="info" title="This list is local" >
        It is stored with <code>localStorage</code> on this device. Clearing your browser data, or
        the button above, removes it permanently.
      </Callout>

      <Modal
        open={confirmOpen}
        title="Clear all history?"
        onClose={() => setConfirmOpen(false)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              icon="trash"
              onClick={() => {
                clear();
                setConfirmOpen(false);
                toast.success('History cleared');
              }}
            >
              Clear {history.length} record{history.length === 1 ? '' : 's'}
            </Button>
          </>
        }
      >
        This removes every record from this browser. It cannot be undone — but nothing important is
        lost, because your images were never stored here in the first place.
      </Modal>
    </div>
  );
}
