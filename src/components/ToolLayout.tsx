/**
 * Shared chrome for every tool: the workspace grid, the reset control and the
 * consistent header/description block. Tools supply controls and a preview.
 */

import type { ReactNode } from 'react';
import { Button, Callout } from './ui';
import { Icon, type IconName } from './Icon';
import { Link } from '../lib/router';

interface ToolLayoutProps {
  icon: IconName;
  title: string;
  description: string;
  /** Shown as a small pill under the title, e.g. "Runs locally". */
  badge?: string;
  children: ReactNode;
  /** Rendered on the right of the page header — usually "Start over". */
  actions?: ReactNode;
}

export function ToolLayout({
  icon,
  title,
  description,
  badge,
  children,
  actions,
}: ToolLayoutProps) {
  return (
    <>
      <header className="page-head">
        <p className="page-head__eyebrow">
          <Icon name={icon} size={14} />
          {badge ?? 'Runs entirely in your browser'}
        </p>
        <h1>{title}</h1>
        <p>{description}</p>
        {actions ? <div className="section-actions" style={{ marginTop: 'var(--s-4)' }}>{actions}</div> : null}
      </header>
      {children}
    </>
  );
}

interface ToolEmptyStateProps {
  onReset?: () => void;
}

/** Footer shown under every tool once an image is loaded. */
export function ToolFooter({ onReset }: ToolEmptyStateProps) {
  return (
    <div className="section-actions" style={{ marginTop: 'var(--s-6)' }}>
      {onReset ? (
        <Button variant="ghost" icon="arrow-left" onClick={onReset}>
          Start over
        </Button>
      ) : null}
      <Link to="/" className="btn btn--ghost">
        <Icon name="grid" size={17} />
        All tools
      </Link>
    </div>
  );
}

interface SourceWarningProps {
  largeFile: boolean;
  width: number;
  height: number;
}

/** The "this might be heavy" notice required for very large inputs. */
export function SourceWarning({ largeFile, width, height }: SourceWarningProps) {
  if (!largeFile) return null;

  return (
    <Callout tone="warning" title="This image is very large and may require significant memory.">
      At {width} × {height} it can take a moment to process on a phone. If the tab becomes
      unresponsive, close other apps and try again — or resize it first.
    </Callout>
  );
}

/** Consistent error surface. Never shows a stack trace. */
export function ToolError({
  title,
  message,
  hint,
  onRetry,
}: {
  title: string;
  message: string;
  hint?: string;
  onRetry?: () => void;
}) {
  return (
    <Callout tone="danger" title={title}>
      <p>{message}</p>
      {hint ? <p style={{ marginTop: 6, opacity: 0.85 }}>{hint}</p> : null}
      {onRetry ? (
        <div style={{ marginTop: 'var(--s-3)' }}>
          <Button variant="secondary" size="sm" icon="arrow-left" onClick={onRetry}>
            Choose another image
          </Button>
        </div>
      ) : null}
    </Callout>
  );
}
