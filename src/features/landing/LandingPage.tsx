/**
 * The landing page.
 *
 * Order matters: what it is, why it is private, then the tools. The privacy
 * flow diagram sits above the tool grid because "your images never leave your
 * device" is the product's whole reason to exist.
 */

import { Icon, type IconName } from '../../components/Icon';
import { Badge } from '../../components/ui';
import { Link } from '../../lib/router';
import { APP_TAGLINE } from '../../config';

interface Tool {
  path: string;
  icon: IconName;
  name: string;
  description: string;
}

const TOOLS: Tool[] = [
  {
    path: '/compress',
    icon: 'compress',
    name: 'Compress',
    description: 'Reduce image file size while maintaining visual quality.',
  },
  {
    path: '/resize',
    icon: 'resize',
    name: 'Resize',
    description: 'Change image dimensions while preserving aspect ratio.',
  },
  {
    path: '/convert',
    icon: 'convert',
    name: 'Convert',
    description: 'Convert between JPEG, PNG, WebP and AVIF.',
  },
  {
    path: '/crop',
    icon: 'crop',
    name: 'Crop',
    description: 'Crop an image using freeform or preset aspect ratios.',
  },
  {
    path: '/rotate',
    icon: 'rotate',
    name: 'Rotate & Flip',
    description: 'Rotate or mirror an image in a single tap.',
  },
  {
    path: '/batch',
    icon: 'batch',
    name: 'Batch',
    description: 'Process multiple images using the same operation.',
  },
];

/* -------------------------------------------------------------------------- */
/* Hero visual — a stylised, static preview of the workspace                   */
/* -------------------------------------------------------------------------- */

function HeroVisual() {
  return (
    <div className="hero-visual" aria-hidden="true">
      <div className="hero-visual__inner">
        <div className="hero-visual__bar">
          <span className="hero-visual__dots">
            <i />
            <i />
            <i />
          </span>
          <span className="hero-visual__title">SnapForge · Compress</span>
        </div>

        <div className="hero-visual__body">
          <div className="hero-visual__canvas checkerboard">
            <svg viewBox="0 0 200 150" width="100%" height="100%" role="presentation">
              <defs>
                <linearGradient id="hv-sky" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.55" />
                  <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.35" />
                </linearGradient>
              </defs>
              <rect width="200" height="150" fill="url(#hv-sky)" />
              <circle cx="150" cy="38" r="16" fill="#fff" opacity="0.75" />
              <path d="M0 108 L44 74 L78 100 L112 62 L152 96 L200 68 L200 150 L0 150 Z" fill="#0d0f14" opacity="0.55" />
              <path d="M0 126 L52 100 L96 122 L140 96 L200 124 L200 150 L0 150 Z" fill="#0d0f14" opacity="0.8" />
            </svg>
          </div>

          <div className="hero-visual__controls">
            <div>
              <div className="hv-row">
                <span>Quality</span>
                <span className="mono">72%</span>
              </div>
              <div className="hv-track" style={{ marginTop: 8 }}>
                <i style={{ width: '72%' }} />
              </div>
            </div>

            <div className="hv-row">
              <span>Format</span>
              <span className="badge">WebP</span>
            </div>

            <div className="hv-row">
              <span>Original</span>
              <span className="mono">4.8 MB</span>
            </div>

            <div className="hv-row">
              <span>Result</span>
              <span className="mono">820 KB</span>
            </div>

            <div className="hv-stat">
              <span className="hv-chip">
                <Icon name="check" size={12} />
                82.9% smaller
              </span>
            </div>

            <div className="hv-row" style={{ paddingTop: 4 }}>
              <span className="hv-chip" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
                <Icon name="lock" size={12} />
                Processed locally
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Privacy flow                                                               */
/* -------------------------------------------------------------------------- */

function FlowNode({
  icon,
  title,
  sub,
  tone = 'default',
}: {
  icon: IconName;
  title: string;
  sub: string;
  tone?: 'default' | 'active' | 'danger';
}) {
  return (
    <div className={`flow__node ${tone !== 'default' ? `flow__node--${tone}` : ''}`}>
      <Icon name={icon} size={24} />
      <strong>{title}</strong>
      <span>{sub}</span>
    </div>
  );
}

function FlowArrow() {
  return (
    <div className="flow__arrow" aria-hidden="true">
      <Icon name="arrow-right" size={18} />
    </div>
  );
}

function PrivacyFlow() {
  return (
    <div className="flow-compare">
      <div className="flow-compare__col flow-compare__col--good">
        <p className="flow-compare__label flow-compare__label--good">
          <Icon name="check-circle" size={15} />
          How SnapForge works
        </p>
        <div className="flow">
          <FlowNode icon="monitor" title="Your device" sub="The file you picked" />
          <FlowArrow />
          <FlowNode icon="cpu" title="SnapForge" sub="Runs in this tab" tone="active" />
          <FlowArrow />
          <FlowNode icon="lock" title="Processed locally" sub="In browser memory" tone="active" />
          <FlowArrow />
          <FlowNode icon="download" title="Download" sub="Saved by you" />
        </div>
      </div>

      <div className="flow-compare__col">
        <p className="flow-compare__label flow-compare__label--bad">
          <Icon name="close" size={15} />
          What SnapForge does not do
        </p>
        <div className="flow-steps">
          <div className="flow-step flow-step--muted">
            <Icon name="upload" size={16} />
            <span>Upload your file to a server</span>
          </div>
          <div className="flow-step flow-step--muted">
            <Icon name="file" size={16} />
            <span>Store a copy in an image database</span>
          </div>
          <div className="flow-step flow-step--muted">
            <Icon name="cpu" size={16} />
            <span>Process it on someone else's machine</span>
          </div>
          <div className="flow-step flow-step--muted">
            <Icon name="history" size={16} />
            <span>Keep a log of what you opened</span>
          </div>
          <div className="flow-step flow-step--muted">
            <Icon name="settings" size={16} />
            <span>Ask you to create an account</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Page                                                                       */
/* -------------------------------------------------------------------------- */

export function LandingPage() {
  return (
    <>
      <section className="hero">
        <div className="container hero__grid">
          <div>
            <div className="hero__badge">
              <Badge tone="brand" icon="lock">
                100% Browser Processing
              </Badge>
            </div>

            <h1>
              Transform Images.
              <br />
              <span className="gradient-text">Keep Them Private.</span>
            </h1>

            <p className="hero__lede">
              Resize, compress, convert and edit images directly in your browser. No uploads. No
              accounts. No waiting.
            </p>

            <div className="hero__actions">
              <Link to="/compress" className="btn btn--primary btn--lg">
                Start Editing
                <Icon name="arrow-right" size={18} />
              </Link>
              <Link to="/tools" className="btn btn--secondary btn--lg">
                Explore Tools
              </Link>
            </div>

            <div className="hero__trust">
              <span>
                <Icon name="lock" size={15} />
                Your images never leave your device
              </span>
              <span>
                <Icon name="zap" size={15} />
                No upload, no queue
              </span>
              <span>
                <Icon name="shield" size={15} />
                Works offline once loaded
              </span>
            </div>
          </div>

          <HeroVisual />
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="section__head">
            <p className="eyebrow">Privacy by architecture</p>
            <h2>There is no server to send your images to</h2>
            <p>
              SnapForge is a static web app. It has no backend, no database and no upload endpoint.
              Every pixel is decoded, edited and encoded inside this browser tab.
            </p>
          </div>
          <PrivacyFlow />
        </div>
      </section>

      <section className="section" id="tools">
        <div className="container">
          <div className="section__head">
            <p className="eyebrow">Tools</p>
            <h2>Everything you need, nothing you don't</h2>
            <p>
              Six focused tools. Each one opens instantly, works offline, and hands you a file
              without ever leaving the page.
            </p>
          </div>

          <div className="tool-grid">
            {TOOLS.map((tool) => (
              <Link key={tool.path} to={tool.path} className="tool-card">
                <span className="tool-card__icon">
                  <Icon name={tool.icon} size={22} />
                </span>
                <span className="tool-card__title">{tool.name}</span>
                <span className="tool-card__desc">{tool.description}</span>
                <span className="tool-card__action">
                  Open Tool
                  <Icon name="arrow-right" size={15} />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="section__head">
            <p className="eyebrow">Why it is fast</p>
            <h2>Built on the browser's own image engine</h2>
            <p>
              SnapForge uses the Canvas and File APIs your device already has. Nothing is
              downloaded, re-uploaded or re-encoded by a remote service.
            </p>
          </div>

          <div className="feature-grid">
            <div className="feature">
              <Icon name="zap" size={22} />
              <h3>No round trip</h3>
              <p>Processing starts the moment you pick a file — there is no upload to wait for.</p>
            </div>
            <div className="feature">
              <Icon name="cpu" size={22} />
              <h3>Native decoders</h3>
              <p>Canvas and ImageBitmap decode JPEG, PNG, WebP and AVIF at hardware speed.</p>
            </div>
            <div className="feature">
              <Icon name="eye" size={22} />
              <h3>Honest output</h3>
              <p>Sizes come from the actual encoded blob. If a file gets bigger, SnapForge says so.</p>
            </div>
            <div className="feature">
              <Icon name="shield" size={22} />
              <h3>Offline ready</h3>
              <p>Once the page has loaded it keeps working with no connection at all.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div
            className="panel panel--pad"
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--s-5)',
              alignItems: 'center',
              textAlign: 'center',
              background: 'linear-gradient(160deg, var(--accent-soft), transparent 70%)',
              borderColor: 'var(--border-brand)',
            }}
          >
            <Badge tone="brand" icon="sparkle">
              {APP_TAGLINE}
            </Badge>
            <h2 style={{ maxWidth: '24ch' }}>Pick an image and see for yourself</h2>
            <p className="muted" style={{ maxWidth: '52ch' }}>
              Drop a photo in, watch it shrink, download it. If you are not convinced, open your
              browser's network tab — you will see no requests carrying your image.
            </p>
            <div className="section-actions" style={{ justifyContent: 'center' }}>
              <Link to="/compress" className="btn btn--primary btn--lg">
                Start Editing
                <Icon name="arrow-right" size={18} />
              </Link>
              <Link to="/privacy" className="btn btn--secondary btn--lg">
                Read the privacy notes
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
