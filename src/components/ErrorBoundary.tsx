/** Error boundary: a crash in one screen must not blank the whole app. */

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from './ui';
import { Icon } from './Icon';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // Kept in the console for debugging; never surfaced to the user.
    console.error('SnapForge crashed:', error, info.componentStack);
  }

  override render(): ReactNode {
    const { error } = this.state;

    if (!error) return this.props.children;

    return (
      <div className="page container">
        <div className="empty" style={{ maxWidth: 560, marginInline: 'auto' }}>
          <div className="empty__icon">
            <Icon name="alert" size={24} />
          </div>
          <h2>Something went wrong</h2>
          <p>
            SnapForge hit an unexpected error in this screen. Your images were never uploaded, so
            nothing has been shared — the app just needs a moment.
          </p>
          <div className="section-actions" style={{ justifyContent: 'center' }}>
            <Button
              variant="primary"
              icon="arrow-left"
              onClick={() => {
                this.setState({ error: null });
                window.location.hash = '#/';
              }}
            >
              Back to home
            </Button>
            <Button variant="secondary" onClick={() => window.location.reload()}>
              Reload the page
            </Button>
          </div>
        </div>
      </div>
    );
  }
}
