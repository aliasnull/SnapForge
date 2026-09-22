/** Privacy page — a plain description of what the app does and does not do. */

import { Icon } from '../../components/Icon';
import { Badge } from '../../components/ui';
import { Link } from '../../lib/router';
import { HAS_GITHUB_URL, GITHUB_URL } from '../../config';

export function PrivacyPage() {
  return (
    <div className="page container">
      <header className="page-head">
        <p className="page-head__eyebrow">
          <Icon name="shield" size={14} />
          Privacy
        </p>
        <h1>Your files stay on your device</h1>
        <p>
          This page describes exactly what SnapForge does with your images, in plain language. No
          legal padding, no claims the code does not back up.
        </p>
      </header>

      <div className="container container--narrow" style={{ paddingInline: 0 }}>
        <div className="panel panel--pad" style={{ marginBottom: 'var(--s-6)' }}>
          <div className="row" style={{ marginBottom: 'var(--s-4)' }}>
            <Badge tone="success" icon="lock">
              Verified by architecture
            </Badge>
            <Badge tone="brand" icon="cpu">
              No backend
            </Badge>
          </div>
          <p style={{ marginBottom: 0 }}>
            SnapForge is a static website. It is a set of HTML, CSS and JavaScript files served
            from a web host. There is no application server behind it, no database, and no upload
            endpoint — because none of those things exist in the project, there is nowhere for your
            images to go.
          </p>
        </div>

        <div className="prose">
          <h2>What happens when you pick an image</h2>
          <ol>
            <li>
              The browser's <strong>File API</strong> hands the file to the page as a JavaScript{' '}
              <code>File</code> object. The file is read from your device's storage into the tab's
              memory.
            </li>
            <li>
              The image is decoded with <code>createImageBitmap()</code> or an{' '}
              <code>&lt;img&gt;</code> element, and drawn onto a <code>&lt;canvas&gt;</code>.
            </li>
            <li>
              Your chosen operation — compress, resize, convert, crop, rotate — is applied to those
              canvas pixels.
            </li>
            <li>
              The canvas is encoded back into a <code>Blob</code>, and you download it. The browser
              writes the file wherever you tell it to.
            </li>
          </ol>

          <p>
            Every one of those steps happens inside the page. Nothing is sent over the network.
            You can confirm this yourself: open your browser's developer tools, switch to the
            Network tab, and process an image. You will see no request carrying your file.
          </p>

          <h2>No image uploads</h2>
          <p>
            There is no upload code in SnapForge. No <code>fetch()</code>, no{' '}
            <code>XMLHttpRequest</code>, and no form submission is used for image data. The only
            network request the app ever makes is the initial download of its own static assets —
            the same HTML, CSS and JavaScript files every visitor receives.
          </p>

          <h2>No image storage</h2>
          <p>
            Your images are never written to disk by SnapForge. They live in the tab's memory for
            as long as the page is open, and they are released as soon as you clear the image or
            close the tab. There is no cache, no temporary file, and no "recent files" feature.
          </p>

          <h2>No account required</h2>
          <p>
            There is no sign-up, no login, no email collection, and no user identifier of any kind.
            SnapForge has no way to know who you are, and no way to link two visits together.
          </p>

          <h2>Processing occurs in browser memory</h2>
          <p>
            Decoding, editing and encoding all happen on the device you are holding. On a phone
            this means the work is done by your phone's CPU and GPU, which is also why very large
            images can be slow — SnapForge refuses images that would exceed a safe memory budget
            rather than risk crashing your browser.
          </p>

          <h2>Downloaded files are controlled by you</h2>
          <p>
            When you press Download, the browser saves the file to your device's Downloads folder
            (or wherever you choose, depending on your browser settings). From that point the file
            is yours to manage — SnapForge has no further involvement and no way to track what
            happens to it.
          </p>

          <h2>What is stored on your device</h2>
          <p>
            Two small pieces of data are kept in this browser's <code>localStorage</code>, and
            nothing else:
          </p>
          <ul>
            <li>
              <strong>Your preferences</strong> — theme, default format, default quality, and the
              two resize toggles. A few hundred bytes of text.
            </li>
            <li>
              <strong>History records</strong> — file name, operation, timestamp, input and output
              sizes, output format and output dimensions. This is <em>metadata about</em> your
              files, never the files themselves. There are no thumbnails and no image data in it.
            </li>
            <li>
              <strong>The app's own offline copy</strong> — SnapForge's HTML, CSS, JavaScript and
              icons, kept in the browser's Cache Storage so the app opens without a connection.
              This is the same public code every visitor downloads, and it contains nothing about
              you or your images. It is the only cache SnapForge creates; processed images are
              never written to it.
            </li>
          </ul>
          <p>
            All three are cleared from <Link to="/settings">Settings</Link> — "Clear local history"
            for the records, "Clear offline cache" for the app shell — or by clearing your
            browser's site data. None of it is ever transmitted anywhere.
          </p>

          <h2>Third-party code</h2>
          <p>
            SnapForge bundles only two runtime libraries:
          </p>
          <ul>
            <li>
              <strong>React</strong> and <strong>React DOM</strong> (MIT) — for the user interface.
            </li>
            <li>
              Everything else — the image pipeline, the ZIP writer, the router, the history store —
              is implemented in this project's own source. There is no third-party image processing
              library, no analytics SDK, no advertising code, and no fonts fetched from a CDN.
            </li>
          </ul>
          <p>
            The application does not load any remote scripts at runtime. Once the page has loaded,
            it works with no network connection at all.
          </p>

          <h2>What SnapForge does not claim</h2>
          <p>
            This is not a security product and it does not make your device more secure. It does
            not encrypt anything, and it does not protect you from malware, a compromised browser,
            or a browser extension with permission to read your pages. What it does guarantee is
            narrower and more useful: <strong>SnapForge itself never sends your images
            anywhere.</strong>
          </p>

          <h2>Questions or corrections</h2>
          <p>
            The full source is available, so every claim on this page can be checked against the
            code.
            {HAS_GITHUB_URL ? (
              <>
                {' '}
                Start with{' '}
                <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
                  the repository
                </a>
                .
              </>
            ) : (
              ' The repository URL is not configured in this build; see the project README for the source location.'
            )}
          </p>
        </div>

        <div className="panel panel--pad" style={{ marginTop: 'var(--s-7)' }}>
          <div className="row" style={{ marginBottom: 'var(--s-3)' }}>
            <Icon name="lock" size={18} />
            <h2 style={{ fontSize: 'var(--fs-md)', fontWeight: 650 }}>The short version</h2>
          </div>
          <p className="muted" style={{ marginBottom: 0 }}>
            Your images never leave your device. There is no server to leave them to.
          </p>
        </div>
      </div>
    </div>
  );
}
