/**
 * Hash routing.
 *
 * Why hash instead of the History API? SnapForge is deployed as a *static*
 * site — very often to GitHub Pages, which has no rewrite rules. With path
 * routing, a refresh on `/compress` returns GitHub's 404 page. With hash
 * routing every URL resolves to `index.html`, so deep links and refreshes work
 * everywhere: GitHub Pages, `vite preview`, an S3 bucket, or a file:// URL.
 *
 * The URLs are still clean and shareable: `https://host/snapforge/#/compress`.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type AnchorHTMLAttributes,
  type ReactNode,
} from 'react';

export interface Route {
  /** Normalised path, always starting with `/` and never ending with one. */
  path: string;
  /** Query params from the hash, e.g. `#/compress?from=home`. */
  params: URLSearchParams;
  /** The full hash including any query string. */
  href: string;
}

function readHash(): string {
  if (typeof window === 'undefined') return '/';
  const raw = window.location.hash.replace(/^#/, '');
  return raw || '/';
}

function normalise(raw: string): { path: string; search: string } {
  const [pathPart = '/', searchPart = ''] = raw.split('?');
  let path = pathPart.startsWith('/') ? pathPart : `/${pathPart}`;
  if (path.length > 1) path = path.replace(/\/+$/, '');
  return { path: path || '/', search: searchPart };
}

export function parseRoute(href: string): Route {
  const { path, search } = normalise(href);
  return {
    path,
    params: new URLSearchParams(search),
    href,
  };
}

export function useRoute(): Route {
  const [href, setHref] = useState<string>(() => readHash());

  useEffect(() => {
    const onHashChange = () => setHref(readHash());
    window.addEventListener('hashchange', onHashChange);
    // Normalise an empty hash to `#/` so relative links behave predictably.
    if (!window.location.hash) window.history.replaceState(null, '', '#/');
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  return useMemo(() => parseRoute(href), [href]);
}

export function navigate(to: string, options: { replace?: boolean; keepScroll?: boolean } = {}): void {
  const target = to.startsWith('/') ? to : `/${to}`;
  const nextHash = `#${target}`;

  if (window.location.hash === nextHash) {
    if (!options.keepScroll) window.scrollTo({ top: 0, behavior: 'auto' });
    return;
  }

  if (options.replace) {
    window.history.replaceState(null, '', nextHash);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  } else {
    window.location.hash = nextHash;
  }

  if (!options.keepScroll) {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }
}

interface LinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  to: string;
  children: ReactNode;
}

/** Anchor that keeps real href semantics (middle-click, copy link) but routes client-side. */
export function Link({ to, children, onClick, ...rest }: LinkProps) {
  const target = to.startsWith('/') ? to : `/${to}`;

  return (
    <a
      href={`#${target}`}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented) return;
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
        event.preventDefault();
        navigate(target);
      }}
      {...rest}
    >
      {children}
    </a>
  );
}

/* -------------------------------------------------------------------------- */
/* Route matching                                                             */
/* -------------------------------------------------------------------------- */

interface RouterContextValue {
  route: Route;
  navigate: typeof navigate;
}

const RouterContext = createContext<RouterContextValue | null>(null);

export function RouterProvider({ children }: { children: ReactNode }) {
  const route = useRoute();
  const value = useMemo<RouterContextValue>(() => ({ route, navigate }), [route]);
  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>;
}

export function useRouter(): RouterContextValue {
  const context = useContext(RouterContext);
  if (!context) throw new Error('useRouter must be used inside <RouterProvider>');
  return context;
}

/** True when `path` matches the current route exactly or as a parent segment. */
export function useIsActive(path: string, exact = false): boolean {
  const { route } = useRouter();
  if (exact) return route.path === path;
  return route.path === path || route.path.startsWith(`${path}/`);
}

export function useNavigate(): typeof navigate {
  return useCallback(navigate, []);
}
