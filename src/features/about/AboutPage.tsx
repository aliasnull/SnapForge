/** About — what SnapForge is, how it is built, and what it deliberately is not. */

import { Icon } from '../../components/Icon';
import { Badge } from '../../components/ui';
import { Link } from '../../lib/router';
import { APP_TAGLINE, APP_VERSION, GITHUB_URL, HAS_GITHUB_URL } from '../../config';

const STACK = [
  ['TypeScript', 'Typed across the whole codebase, including the image pipeline.'],
  ['React', 'The UI layer only — no state library, no component framework.'],
  ['Vite', 'Build tooling and the static output for GitHub Pages.'],
  ['Canvas API', 'Every pixel operation: scale, crop, rotate, flatten, encode.'],
  ['ImageBitmap', 'Fast, off-main-thread-friendly decoding where supported.'],
  ['Blob + File API', 'Reading your files in, handing results back out.'],
  ['Web Crypto-free ZIP', 'A small store-method ZIP writer, written for this project.'],
];

export function AboutPage() {
  return (
    <div className="page container">
      <header className="page-head">
        <p className="page-head__eyebrow">
          <Icon name="sparkle" size={14} />
          {APP_TAGLINE}
        </p>
        <h1>About SnapForge</h1>
        <p>
          A small, focused image toolkit that does its work in your browser and nowhere else.
        </p>
      </header>

      <div className="container container--narrow" style={{ paddingInline: 0 }}>
        <div className="prose">
          <h2>What it is</h2>
          <p>
            SnapForge is a static web application for the everyday image jobs: making a photo
            smaller, resizing it for a specific place, changing its format, cropping it, straightening
            it, or doing any of those things to a whole folder of files at once.
          </p>
          <p>
            It exists because most tools that do this require you to hand your files to someone
            else's computer. That is a strange trade for a task your own device is perfectly capable
            of performing.
          </p>

          <h2>What it deliberately is not</h2>
          <ul>
            <li>
              <strong>Not a service.</strong> There is no account, no subscription, no quota, and
              nothing to sign up for.
            </li>
            <li>
              <strong>Not AI-powered.</strong> No generation, no enhancement, no background removal,
              no chat assistant. The interesting engineering here is making the boring, reliable
              operations work well.
            </li>
            <li>
              <strong>Not a photo editor.</strong> No layers, no filters, no curves. Six tools that
              each do one thing properly.
            </li>
            <li>
              <strong>Not tracking you.</strong> No analytics, no telemetry, no cookies beyond the
              local storage described on the privacy page.
            </li>
          </ul>

          <h2>How it is built</h2>
        </div>

        <div className="panel panel--pad" style={{ marginBlock: 'var(--s-5)' }}>
          <dl style={{ margin: 0 }}>
            {STACK.map(([name, description]) => (
              <div className="kv" key={name}>
                <dt style={{ minWidth: 130 }}>{name}</dt>
                <dd style={{ fontWeight: 400, textAlign: 'left', color: 'var(--text-muted)' }}>
                  {description}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="prose">
          <h2>Where the processing happens</h2>
          <p>
            Entirely in your browser tab. A file you select is read with the File API, decoded by
            the browser's own image decoder, drawn onto a canvas, edited there, and encoded back
            into a downloadable blob. SnapForge has no backend, so there is no other place for it
            to happen.
          </p>

          <h2>Known limitations</h2>
          <ul>
            <li>
              Output formats depend on the browser. AVIF encoding, in particular, is not available
              everywhere — the app disables it rather than failing.
            </li>
            <li>
              Very large images are refused above a device-dependent memory budget. This is a
              deliberate safeguard, not an oversight.
            </li>
            <li>
              Animated GIFs are decoded at their first frame. SnapForge does not write animated
              output.
            </li>
            <li>
              EXIF metadata is not preserved through a re-encode; canvas output carries only the
              pixels.
            </li>
            <li>
              There is no undo history beyond the Start over button in each tool.
            </li>
          </ul>

          <h2>Version</h2>
          <p>
            SnapForge v{APP_VERSION} · MIT licensed.
            {HAS_GITHUB_URL ? (
              <>
                {' '}
                Source:{' '}
                <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
                  {GITHUB_URL.replace(/^https?:\/\//, '')}
                </a>
                .
              </>
            ) : null}
          </p>
        </div>

        <div className="panel panel--pad" style={{ marginTop: 'var(--s-6)' }}>
          <div className="row" style={{ marginBottom: 'var(--s-3)' }}>
            <Icon name="lock" size={18} />
            <h2 style={{ fontSize: 'var(--fs-md)', fontWeight: 650 }}>The one promise</h2>
          </div>
          <p className="muted" style={{ marginBottom: 'var(--s-4)' }}>
            Your images never leave your device.
          </p>
          <div className="section-actions">
            <Badge tone="brand" icon="sparkle">
              {APP_TAGLINE}
            </Badge>
            <Link to="/privacy" className="btn btn--secondary btn--sm">
              Privacy details
            </Link>
            <Link to="/tools" className="btn btn--primary btn--sm">
              Open a tool
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
