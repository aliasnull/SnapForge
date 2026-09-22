import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

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
export default defineConfig({
  base: './',
  plugins: [react()],
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
});
