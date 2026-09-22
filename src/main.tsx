import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';

import { App } from './App';
import { RouterProvider } from './lib/router';
import { ToastProvider } from './state/ToastProvider';
import { ThemeProvider } from './state/ThemeProvider';
import { loadSettings, saveSettings } from './lib/settings';
import { useEffect, useState } from 'react';
import type { Settings } from './lib/types';

/**
 * Settings live in a module-level store (`state/settingsStore`) so the image
 * pipeline can read them outside React. The theme provider needs the same
 * object, so this wrapper keeps the two in step.
 */
function Root() {
  const [settings, setSettings] = useState<Settings>(() => loadSettings());

  const updateSettings = (patch: Partial<Settings>) => {
    setSettings((current) => {
      const next = { ...current, ...patch };
      saveSettings(next);
      return next;
    });
  };

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const resolved =
        settings.theme === 'system' ? (media.matches ? 'dark' : 'light') : settings.theme;
      document.documentElement.setAttribute('data-theme', resolved);
      document.documentElement.style.colorScheme = resolved;
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute('content', resolved === 'dark' ? '#08090c' : '#f7f8fb');
    };

    apply();
    if (settings.theme !== 'system') return undefined;
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [settings.theme]);

  return (
    <ThemeProvider settings={settings} updateSettings={updateSettings}>
      <ToastProvider>
        <RouterProvider>
          <App />
        </RouterProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}

const container = document.getElementById('root');

if (!container) {
  throw new Error('SnapForge could not find its mount point (#root).');
}

/**
 * Offline support.
 *
 * The worker caches the app shell only — never anything the user opens or
 * creates, because those never touch the network in the first place. It is
 * registered from the document's own directory so it also works when the app is
 * served from a `/repo-name/` subpath on GitHub Pages.
 *
 * Registration is skipped during development: a cached shell fighting Vite's
 * hot reload is a confusing way to spend an afternoon.
 */
function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  if (import.meta.env.DEV) return;

  window.addEventListener('load', () => {
    navigator.serviceWorker.register(new URL('sw.js', document.baseURI).href, { scope: './' }).catch(() => {
      // Offline support is a bonus, not a requirement. If the browser refuses
      // the worker (private mode, blocked storage, an insecure origin), the app
      // still works exactly as it does online.
    });
  });
}

registerServiceWorker();

createRoot(container).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
