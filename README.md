# SnapForge

**Fast. Private. In Your Browser.**

SnapForge is a browser-based image toolkit. Resize, compress, convert, crop and
rotate images without uploading anything anywhere. There is no backend, no
account, no API key and no analytics — the entire image pipeline runs in your
browser tab, on your device.

> **Your images never leave your device.**

---

## Why it exists

Almost every "free online image converter" works the same way: you pick a file,
it is uploaded to someone's server, processed there, and downloaded back. That
means your photo — a passport scan, a client's product shot, an unreleased
design — sits on a machine you do not control, for a length of time you are not
told.

SnapForge does the processing where the image already is: in the browser. The
network is used for exactly one thing, loading the app itself.

## Features

| Tool | What it does |
| --- | --- |
| **Compress** | Reduce file size with a quality slider and optional max-width cap. |
| **Resize** | Exact pixels, percentage, or presets, with aspect-ratio locking. |
| **Convert** | JPEG, PNG, WebP and AVIF — formats your browser cannot encode are disabled, not faked. |
| **Crop** | Freeform or locked aspect ratios, with pointer and touch handles. |
| **Rotate & Flip** | 90° / 180° / 270° rotation and horizontal or vertical mirroring. |
| **Batch** | One operation across many files, downloaded together as a ZIP. |

Plus: drag-and-drop and clipboard paste, a mobile file picker, before/after
comparison, a plain-language size comparison, dark and light themes, a
metadata-only local history, and a responsive layout that works on a 360px
phone.

## Privacy, concretely

- **No upload.** There is no endpoint to upload to. The app is a folder of
  static files.
- **No storage of your images.** Originals are read into memory, processed, and
  released. Nothing is written to disk, IndexedDB or a cache.
- **No accounts, no keys.** Nothing to sign into and no secret in the bundle.
- **No third-party runtime code.** The only runtime dependencies are React and
  React DOM. The ZIP writer, PNG encoder and every image operation live in this
  repository.
- **Offline cache is app-shell only.** The service worker caches the app's own
  HTML/JS/CSS/icons so it opens without a connection. It never sees an image,
  because images are never fetched over the network. You can drop that cache
  from **Settings → Clear offline cache**.

Full details are on the in-app Privacy page.

## Technology

- **React 19** + **TypeScript 5.9** (strict, `verbatimModuleSyntax`)
- **Vite 8** (rolldown) — static output, no server runtime
- **Canvas 2D / `ImageBitmap` / `OffscreenCanvas` / `Blob`** for the pipeline
- Hand-written **CSS** with design tokens — no UI framework
- **Hash routing** (`#/compress`) so a refresh can never 404 on static hosting

No image-processing library is bundled. Decoding goes through the browser's own
decoders; encoding goes through `canvas.toBlob()`.

## Getting started

```bash
npm install
npm run dev        # http://localhost:5173
```

Other scripts:

```bash
npm run typecheck  # tsc --noEmit
npm run build      # typecheck + production build into dist/
npm run preview    # serve the built dist/ locally
npm run audit      # verify the built bundle still keeps the privacy promise
npm run icons      # regenerate the PWA icons and social card
```

### Building on Android (Termux)

`scripts/android-build.sh` exists for one specific problem: on Android the
shared storage mount (`/storage/emulated/0`) is a FUSE filesystem that does not
support symlinks, which breaks both `node_modules/.bin` and any native addon
that has to be `dlopen`'d. The script mirrors the project into a real ext4
directory under `$HOME`, builds there, and copies `dist/` back:

```bash
npm install --no-bin-links
npm run android:build          # or: bash scripts/android-build.sh build
bash scripts/android-build.sh typecheck
```

## Deployment

The build is fully static, so any static host works. GitHub Pages is set up out
of the box:

1. Push the repository to GitHub with `main` as the default branch.
2. In **Settings → Pages**, set **Source** to **GitHub Actions**.
3. Push to `main`. `.github/workflows/deploy.yml` type-checks, builds and
   publishes `dist/`.

Because `base` is `'./'` and routing is hash-based, the same artifact works at a
domain root, at `https://user.github.io/repo/`, and from the local filesystem.

**Optional:** to emit a canonical URL, set a repository *variable* named
`CANONICAL_ORIGIN` (Settings → Secrets and variables → Actions → Variables) to
your deployed origin. If it is unset, the app omits the canonical link rather
than inventing a URL.

**Optional:** the footer's GitHub link only renders when `VITE_GITHUB_URL` is
set. The deploy workflow sets it automatically from the repository it is running
in.

## Testing

The app is designed to be checked at these widths, and the layout is verified at
each: **360, 390, 412, 768, 1024, 1440px**. Interaction checks on Android
Chrome: file picker (single and multi-select), camera-roll images, processing,
download, touch drag on the crop handles, slider drag, and no accidental
page-zoom while using the tools.

The privacy promise is also checkable mechanically. `npm run audit` reads the
built `dist/` and fails the build if it finds an upload primitive constructed in
application code, a credential, an unexpected external host, a missing asset, or
placeholder text — so a change that quietly breaks the promise is caught before
it ships.

```bash
npm run build && npm run audit
```

### Browser checks

Three checks drive the real app in a real Chromium over the DevTools Protocol,
because a route that renders is not the same as a tool that works. They need a
Chromium on `PATH` (override with `CHROME_BIN`) and a running server — the dev
server or a deployed URL.

```bash
npm run test:image                                    # writes a 12 MP test-image.png
npm run test:routes  -- http://localhost:5173         # every route renders without throwing
npm run test:e2e     -- http://localhost:5173 test-image.png   # an image through each tool, end to end
npm run test:loading -- http://localhost:5173 test-image.png   # the decode state is safe and temporary
```

`test:loading` exists because of a bug that shipped: choosing a file briefly
leaves the source with `status: 'loading'` and `meta: null`, and the tools fell
through to `source.meta!` and crashed the screen. `test:e2e` could not catch it —
it waits for the decode to settle, so it passed either way. The loading check
samples the DOM from inside the page while the decode is in flight, under CPU
throttling so the window is wide enough to observe, and asserts that the state
was reached, that nothing crashed, and that the tool came back out of it.

## Known limitations

- **Format support follows the browser.** WebP and AVIF encoding depend on
  `canvas.toBlob()` support. The app probes for it and disables what is missing
  rather than producing a file with the wrong extension.
- **AVIF encoding is rare.** Most browsers can *decode* AVIF but not encode it.
- **Very large images are memory-bound.** A 100-megapixel source is limited by
  the device, not the code.
- **Metadata is not preserved.** EXIF (including orientation) is dropped, since
  re-encoding through a canvas does not carry it. Orientation is applied to the
  pixels via `ImageBitmap` options where the browser supports it.
- **ZIP output is stored, not deflated.** Images are already compressed, so
  deflate would cost time for almost no size gain.
- **The history list is metadata only.** File names, sizes, dimensions and
  timestamps — never the image data.

## License

MIT.
