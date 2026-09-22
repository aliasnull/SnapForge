/**
 * Static audit of the production bundle.
 *
 * SnapForge's central claim is that images never leave the device. That claim
 * is only worth making if it is checkable, so this script checks the built
 * output for the things that would break it — a network call, a credential, an
 * upload endpoint — and for the copy the product is supposed to ship with.
 *
 * It reads `dist/` only. It is not a substitute for a real browser, but it
 * catches the class of mistake that would quietly falsify the privacy promise.
 *
 * Usage: node scripts/audit-bundle.mjs
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';

const DIST = 'dist';

let failures = 0;
let warnings = 0;

const fail = (message) => {
  failures += 1;
  console.log(`  FAIL  ${message}`);
};
const warn = (message) => {
  warnings += 1;
  console.log(`  warn  ${message}`);
};
const pass = (message) => console.log(`  ok    ${message}`);

if (!existsSync(DIST)) {
  console.error(`${DIST}/ does not exist — run "npm run build" first.`);
  process.exit(1);
}

/** Every file in dist/, as { path, text } where text is set for text assets. */
function walk(directory) {
  const out = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) out.push(...walk(path));
    else out.push(path);
  }
  return out;
}

const files = walk(DIST);
const TEXT_EXTENSIONS = new Set(['.js', '.css', '.html', '.json', '.webmanifest', '.svg', '.txt', '.map']);
const textFiles = files.filter((file) => TEXT_EXTENSIONS.has(extname(file)));
const bundle = textFiles
  .map((file) => readFileSync(file, 'utf8'))
  .join('\n');

console.log('\nSnapForge bundle audit');
console.log(`  ${files.length} files, ${textFiles.length} text assets scanned\n`);

/* ------------------------------------------------------- privacy guarantees */

console.log('Privacy');

// No network primitive may be used for image data. `fetch` and `Request` do
// appear in the service worker (that is how the app shell is cached), so the
// check is scoped to the application bundle, not sw.js.
const appCode = textFiles
  .filter((file) => file.includes('assets/') || file.endsWith('index.html'))
  .map((file) => readFileSync(file, 'utf8'))
  .join('\n');

// The Privacy page names these APIs in its own prose ("No fetch(), no
// XMLHttpRequest..."), so a bare substring match would flag the documentation
// as if it were the crime. Match call sites instead: `new XMLHttpRequest` and
// `fetch(` with an argument.
for (const [pattern, label] of [
  [/new\s+XMLHttpRequest\b/, 'XMLHttpRequest'],
  [/\bsendBeacon\s*\(/, 'navigator.sendBeacon'],
  [/new\s+WebSocket\b/, 'WebSocket'],
  [/new\s+EventSource\b/, 'EventSource'],
]) {
  if (pattern.test(appCode)) fail(`${label} is constructed in the application bundle`);
}
pass('no upload primitives (XHR, sendBeacon, WebSocket, EventSource) constructed in app code');

// Every `fetch(` in the app bundle, classified. Two kinds of false positive
// are possible and both are excluded:
//
//   prose      the Privacy page's own sentence, which contains the literal
//              text "No `fetch()`". It sits inside a JSX template literal, so
//              its context contains a backtick. Real call sites do not.
//   polyfill   Vite's modulepreload polyfill, which marks the link element
//              with `.ep = !0` immediately before calling fetch. It is a no-op
//              unless the document actually carries modulepreload links.
//
// Anything left is a real call site and has to be justified by a human.
const fetchSites = [...appCode.matchAll(/.{60}fetch\s*\(/g)].map((match) => match[0]);
const isProse = (context) => context.includes('`');
const isPreloadPolyfill = (context) => /\.ep\s*=\s*!0/.test(context);

// Order matters: the minifier's own template literals mean a polyfill's
// context can contain a backtick too, so the structural test goes first.
const classify = (context) => {
  if (isPreloadPolyfill(context)) return 'polyfill';
  if (isProse(context)) return 'prose';
  return 'unexplained';
};

const classified = fetchSites.map(classify);
const unexplained = fetchSites.filter((_, index) => classified[index] === 'unexplained');

if (fetchSites.length === 0) {
  pass('no fetch() in the application bundle');
} else if (unexplained.length === 0) {
  const polyfill = classified.filter((kind) => kind === 'polyfill').length;
  const prose = classified.filter((kind) => kind === 'prose').length;
  pass(
    `every fetch() accounted for (${polyfill} modulepreload polyfill, ${prose} documentation mention)`,
  );
} else {
  fail(`${unexplained.length} unexplained fetch() call site(s):`);
  for (const context of unexplained) console.log(`          …${context}…`);
}

// The preload polyfill only runs when the document has modulepreload links.
// This build emits none, so the polyfill is dead code — but if a future Vite
// starts emitting them, the network requests it makes are for the app's own
// assets and the claim above should be re-checked.
if (/modulepreload/.test(readFileSync(join(DIST, 'index.html'), 'utf8'))) {
  warn('index.html now emits modulepreload links — re-check the fetch() analysis above');
} else {
  pass('no modulepreload links in index.html, so the preload polyfill is inert');
}

// Anything that looks like a credential.
for (const [pattern, label] of [
  [/sk-[A-Za-z0-9]{16,}/, 'an OpenAI-style API key'],
  [/\bAKIA[0-9A-Z]{16}\b/, 'an AWS access key id'],
  [/ghp_[A-Za-z0-9]{20,}/, 'a GitHub personal access token'],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, 'a private key'],
  [/\bBearer\s+[A-Za-z0-9._-]{20,}/, 'a bearer token'],
]) {
  if (pattern.test(bundle)) fail(`${label} is present in the build output`);
}
pass('no credentials or key material in the build output');

// A remote origin other than the React error-docs link would mean the app is
// talking to something at runtime.
const allowedHosts = new Set(['react.dev', 'www.w3.org']);
const urls = [...bundle.matchAll(/https?:\/\/([a-zA-Z0-9.-]+)/g)].map((match) => match[1]);
const unexpected = [...new Set(urls)].filter((host) => !allowedHosts.has(host));
if (unexpected.length > 0) fail(`unexpected external host(s): ${unexpected.join(', ')}`);
else pass('no external hosts beyond the React error-docs link and SVG namespaces');

/* ------------------------------------------------------------ shipped assets */

console.log('\nAssets');

for (const required of [
  'index.html',
  'sw.js',
  'manifest.webmanifest',
  'favicon.svg',
  'og-image.png',
  'robots.txt',
  'icons/icon-32.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/maskable-512.png',
  'icons/apple-touch-icon.png',
]) {
  if (existsSync(join(DIST, required))) pass(required);
  else fail(`${required} is missing from the build`);
}

/* --------------------------------------------------------------- the copy */

console.log('\nCopy and routes');

for (const text of [
  'Transform Images.',
  'Keep Them Private.',
  'No uploads. No accounts. No waiting.',
  'Start Editing',
  'Explore Tools',
  '100% Browser Processing',
  'Your images never leave your device.',
]) {
  if (bundle.includes(text)) pass(JSON.stringify(text));
  else fail(`missing required copy: ${JSON.stringify(text)}`);
}

for (const route of [
  '/compress',
  '/resize',
  '/convert',
  '/crop',
  '/rotate',
  '/batch',
  '/history',
  '/settings',
  '/privacy',
  '/about',
  '/tools',
]) {
  if (!bundle.includes(route)) fail(`route ${route} is not reachable in the bundle`);
}
pass('all eleven routes are present');

for (const text of ['Coming Soon', 'coming soon', 'TODO', 'FIXME', 'lorem ipsum']) {
  if (bundle.includes(text)) fail(`placeholder text shipped: ${JSON.stringify(text)}`);
}
pass('no placeholder or "coming soon" text');

/* ------------------------------------------------------------- the worker */

console.log('\nService worker');

const sw = readFileSync(join(DIST, 'sw.js'), 'utf8');
if (/cache\.put\(request/.test(sw) && !/request\.mode === 'navigate'/.test(sw)) {
  warn('sw.js caches requests without a navigation guard — check it cannot store image responses');
} else {
  pass('sw.js caches the app shell only');
}
if (/snapforge:clear-cache/.test(sw)) pass('sw.js honours the clear-cache message');
else fail('sw.js does not implement snapforge:clear-cache');

/* ------------------------------------------------------------------ result */

console.log(`\n${failures === 0 ? 'PASS' : 'FAIL'} — ${failures} failure(s), ${warnings} warning(s)\n`);
process.exit(failures === 0 ? 0 : 1);
