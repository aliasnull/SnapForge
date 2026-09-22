/** Route table + document metadata. */

import { useEffect } from 'react';
import { AppShell } from './components/AppShell';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Button } from './components/ui';
import { Icon } from './components/Icon';
import { Link, useRouter } from './lib/router';
import { APP_NAME, CANONICAL_ORIGIN } from './config';

import { LandingPage } from './features/landing/LandingPage';
import { ToolsPage } from './features/tools/ToolsPage';
import { CompressPage } from './features/compress/CompressPage';
import { ResizePage } from './features/resize/ResizePage';
import { ConvertPage } from './features/convert/ConvertPage';
import { CropPage } from './features/crop/CropPage';
import { RotatePage } from './features/rotate/RotatePage';
import { BatchPage } from './features/batch/BatchPage';
import { HistoryPage } from './features/history/HistoryPage';
import { SettingsPage } from './features/settings/SettingsPage';
import { PrivacyPage } from './features/privacy/PrivacyPage';
import { AboutPage } from './features/about/AboutPage';

interface RouteDefinition {
  path: string;
  title: string;
  description: string;
  element: React.ReactNode;
}

const ROUTES: RouteDefinition[] = [
  {
    path: '/',
    title: `${APP_NAME} - Private Browser Image Tools`,
    description:
      'Resize, compress, convert, crop and rotate images directly in your browser. No uploads, no accounts, no waiting.',
    element: <LandingPage />,
  },
  {
    path: '/tools',
    title: `Tools · ${APP_NAME}`,
    description: 'Six focused image tools that run entirely on your device.',
    element: <ToolsPage />,
  },
  {
    path: '/compress',
    title: `Compress Images · ${APP_NAME}`,
    description:
      'Reduce image file size while maintaining visual quality. Processed locally in your browser.',
    element: <CompressPage />,
  },
  {
    path: '/resize',
    title: `Resize Images · ${APP_NAME}`,
    description:
      'Change image dimensions by exact size, percentage, or preset, with aspect-ratio locking.',
    element: <ResizePage />,
  },
  {
    path: '/convert',
    title: `Convert Images · ${APP_NAME}`,
    description: 'Convert between JPEG, PNG, WebP and AVIF entirely in your browser.',
    element: <ConvertPage />,
  },
  {
    path: '/crop',
    title: `Crop Images · ${APP_NAME}`,
    description: 'Crop images with freeform selection or locked aspect ratios, with touch controls.',
    element: <CropPage />,
  },
  {
    path: '/rotate',
    title: `Rotate & Flip Images · ${APP_NAME}`,
    description: 'Rotate an image 90°, 180°, or flip it horizontally and vertically.',
    element: <RotatePage />,
  },
  {
    path: '/batch',
    title: `Batch Processing · ${APP_NAME}`,
    description:
      'Apply one operation to many images at once, then download them together as a ZIP.',
    element: <BatchPage />,
  },
  {
    path: '/history',
    title: `History · ${APP_NAME}`,
    description: 'A local, metadata-only record of what you processed. Stored on your device.',
    element: <HistoryPage />,
  },
  {
    path: '/settings',
    title: `Settings · ${APP_NAME}`,
    description: 'Theme, processing defaults and local data controls.',
    element: <SettingsPage />,
  },
  {
    path: '/privacy',
    title: `Privacy · ${APP_NAME}`,
    description: 'How SnapForge keeps your images on your device. No uploads, no storage, no accounts.',
    element: <PrivacyPage />,
  },
  {
    path: '/about',
    title: `About · ${APP_NAME}`,
    description: 'What SnapForge is, how it is built, and what it deliberately is not.',
    element: <AboutPage />,
  },
];

const NOT_FOUND: RouteDefinition = {
  path: '/404',
  title: `Not found · ${APP_NAME}`,
  description: 'That page does not exist.',
  element: <NotFound />,
};

function NotFound() {
  return (
    <div className="page container">
      <div className="empty" style={{ maxWidth: 520, marginInline: 'auto' }}>
        <div className="empty__icon">
          <Icon name="alert-circle" size={24} />
        </div>
        <h1 style={{ fontSize: 'var(--fs-2xl)' }}>Page not found</h1>
        <p>The link you followed does not point at anything in SnapForge.</p>
        <div className="section-actions" style={{ justifyContent: 'center' }}>
          <Link to="/" className="btn btn--primary">
            Back to home
          </Link>
          <Link to="/tools" className="btn btn--secondary">
            Browse tools
          </Link>
        </div>
      </div>
    </div>
  );
}

/**
 * The canonical URL is only meaningful once the site is deployed somewhere
 * known, so it is injected here — from `VITE_CANONICAL_ORIGIN` at build time —
 * rather than hard-coded in `index.html` where it would have to be a guess.
 *
 * The configured value is expected to be the full deployed URL, path included
 * (`https://user.github.io/repo/`). It is *not* combined with
 * `import.meta.env.BASE_URL`: that is `'./'`, which is right for asset
 * resolution but would turn a valid origin into `https://user.github.io/repo./`
 * — a path that does not exist.
 *
 * Hash routes all resolve to the same document, so the fragment is dropped and
 * every route shares one canonical URL.
 */
function useCanonicalLink() {
  useEffect(() => {
    if (!CANONICAL_ORIGIN) return;

    let href: string;
    try {
      const url = new URL(CANONICAL_ORIGIN);
      url.hash = '';
      href = url.href;
    } catch {
      // A misconfigured variable must not take the app down. Skip the tag
      // rather than emit a canonical pointing somewhere wrong.
      return;
    }

    let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'canonical';
      document.head.appendChild(link);
    }
    link.href = href;
  }, []);
}

function useDocumentMeta(route: RouteDefinition) {
  useEffect(() => {
    document.title = route.title;

    const setMeta = (selector: string, attribute: string, value: string) => {
      const element = document.head.querySelector(selector);
      if (element) element.setAttribute(attribute, value);
    };

    setMeta('meta[name="description"]', 'content', route.description);
    setMeta('meta[property="og:title"]', 'content', route.title);
    setMeta('meta[property="og:description"]', 'content', route.description);
    setMeta('meta[name="twitter:title"]', 'content', route.title);
    setMeta('meta[name="twitter:description"]', 'content', route.description);
  }, [route]);
}

export function App() {
  const { route } = useRouter();
  const match =
    ROUTES.find((item) => item.path === route.path) ?? (route.path === '/' ? ROUTES[0]! : NOT_FOUND);

  useDocumentMeta(match);
  useCanonicalLink();

  return (
    <ErrorBoundary>
      <AppShell>
        <ErrorBoundary key={match.path}>{match.element}</ErrorBoundary>
      </AppShell>
    </ErrorBoundary>
  );
}

export { Button };
