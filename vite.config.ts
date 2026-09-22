import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Absolute-URL social card tags.
 *
 * `og:image` and `twitter:image` must be absolute — a scraper reading the page
 * has no base URL to resolve `./og-image.png` against, so a relative path
 * silently produces a preview with no image. The origin is only known once the
 * site is deployed somewhere, so it comes from `VITE_CANONICAL_ORIGIN` at build
 * time. When it is not set the tags are left relative rather than pointed at a
 * guessed domain.
 */
function absoluteSocialImage(origin: string) {
  return {
    name: 'snapforge:absolute-social-image',
    transformIndexHtml(html: string) {
      if (!origin) return html;
      const base = `${origin.replace(/\/$/, '')}/`;
      return html.replace(
        /(<meta (?:property|name)="(?:og:image|twitter:image)" content=")\.\/([^"]+)(")/g,
        (_match, prefix: string, file: string, suffix: string) => `${prefix}${base}${file}${suffix}`,
      );
    },
  };
}

/**
 * SnapForge build configuration.
 *
 * `base: './'` emits relative asset URLs. That keeps a single build artifact
 * working in every static hosting situation we care about:
 *   - GitHub Pages project sites (https://user.github.io/<repo>/)
 *   - GitHub Pages user/org sites (https://user.github.io/)
 *   - `vite preview` locally
 *   - even opening dist/index.html straight off the filesystem
 * Combined with hash-based routing there is no server-side rewrite rule to
 * configure, so a page refresh can never 404.
 */
export default defineConfig(({ mode }) => {
  // `.` rather than `process.cwd()`: this config is type-checked by the app's
  // tsconfig, which has no Node types, and Vite resolves a relative envDir
  // against the project root anyway.
  const env = loadEnv(mode, '.', 'VITE_');

  return {
    base: './',
    plugins: [react(), absoluteSocialImage((env.VITE_CANONICAL_ORIGIN ?? '').trim())],
    build: {
      target: 'es2022',
      cssTarget: 'chrome100',
      sourcemap: false,
      chunkSizeWarningLimit: 700,
    },
    worker: {
      format: 'es',
    },
    server: {
      host: true,
      port: 5173,
    },
  };
});
