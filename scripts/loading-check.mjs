/**
 * Prove the "opening an image" state is real, safe, and temporary.
 *
 * This exists because of a shipped bug: `useImageSource` reports
 * `status: 'loading'` with `meta` still null, and the tools used to fall through
 * to `source.meta!` and crash. The end-to-end check could not see it — it waits
 * for the decode to settle, so it passes whether or not the loading state threw
 * on the way there.
 *
 * So this samples the DOM from inside the page while the decode is in flight,
 * and it asserts three things: the loading state was actually reached (otherwise
 * the run proves nothing), nothing crashed during it, and the tool came back out
 * of it. CPU throttling widens the window — a 12 MP decode is a few frames on a
 * desktop CPU and would otherwise be missed entirely.
 *
 * Usage: node scripts/loading-check.mjs <baseUrl> <imagePath> [route]
 */
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BASE = process.argv[2] ?? 'http://127.0.0.1:5173';
const IMAGE = process.argv[3] ?? join(process.env.HOME, 'big-image.png');
const PORT = 9336;
const CHROME = process.env.CHROME_BIN ?? 'chromium-browser';
const b64 = readFileSync(IMAGE).toString('base64');
const name = IMAGE.split('/').pop();
const profile = mkdtempSync(join(tmpdir(), 'sf-load-'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const chrome = spawn(CHROME, ['--headless=new','--disable-gpu','--no-sandbox',
  '--disable-dev-shm-usage','--no-first-run','--disable-sync','--disable-background-networking',
  `--remote-debugging-port=${PORT}`,`--user-data-dir=${profile}`,'about:blank'],
  { stdio: ['ignore','ignore','ignore'] });

const STAGE = `(() => {
  const bin = atob(${JSON.stringify(b64)});
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const dt = new DataTransfer();
  dt.items.add(new File([bytes], ${JSON.stringify(name)}, { type: 'image/png' }));
  const input = document.querySelector('input[type=file]');
  if (!input) return 'no-input';
  input.files = dt.files;
  input.dispatchEvent(new Event('change', { bubbles: true }));
  return 'staged';
})()`;

/**
 * Poll from inside the page rather than round-tripping over CDP: a decode that
 * takes 40 ms cannot be caught by a protocol call that takes 30 ms to arrive.
 * This records every distinct state seen while the image settles.
 */
const WATCH = `(() => {
  window.__sf = { sawLoading: false, sawCrash: false, sawReady: false, samples: 0, first: '', last: '' };
  // textContent, not innerText: innerText forces a layout, which under 20x
  // throttling is slow enough to miss a short state entirely. A timer also
  // samples far more often than rAF does on a starved main thread.
  const tick = () => {
    const text = (document.body.textContent || '').replace(/\s+/g, ' ');
    window.__sf.samples++;
    if (!window.__sf.first) window.__sf.first = text.slice(0, 90);
    window.__sf.last = text.slice(0, 90);
    if (text.includes('Something went wrong')) window.__sf.sawCrash = true;
    if (text.includes('Opening image…')) window.__sf.sawLoading = true;
    // Ready is the meta panel being on screen and the busy label gone. A button
    // caption is not a reliable signal — most tools say "Resize image", not
    // "Resize again", until the first run completes.
    if (text.includes('Filename') && !text.includes('Opening image')) window.__sf.sawReady = true;
  };
  window.__sfTimer = setInterval(tick, 8);
  tick();
  return 'watching';
})()`;

const RESULT = `(() => { clearInterval(window.__sfTimer); return JSON.stringify(window.__sf ?? { samples: 0 }); })()`;

let failures = 0;
try {
  let page;
  for (let i = 0; i < 40 && !page; i++) {
    try { page = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find(t => t.type === 'page'); } catch {}
    if (!page) await sleep(250);
  }
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.addEventListener('open', res, {once:true}); ws.addEventListener('error', () => rej(new Error('ws')), {once:true}); });
  let id = 0; const pending = new Map(); const events = [];
  ws.addEventListener('message', (e) => { const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } else if (m.method) events.push(m); });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const i = ++id; pending.set(i, (m) => m.error ? reject(new Error(m.error.message)) : resolve(m.result));
    ws.send(JSON.stringify({ id: i, method, params })); });
  const evaluate = async (expression) => (await send('Runtime.evaluate', { expression, returnByValue: true })).result.value;

  await send('Runtime.enable'); await send('Log.enable'); await send('Page.enable');
  console.log(`\nSnapForge loading-state check — ${name} through each tool\n`);

  const only = process.argv[4];
  const routes = only ? [only] : ['/compress','/resize','/convert','/rotate','/crop'];
  for (const route of routes) {
    events.length = 0;
    await send('Emulation.setCPUThrottlingRate', { rate: 20 });
    await send('Page.navigate', { url: `${BASE}/#${route}` });
    await sleep(2500);
    // Wait for React to actually mount before staging. At 20x throttle the app
    // boot alone can outlast a fixed sleep, and staging into a page that has not
    // rendered its input yet reports a phantom failure.
    let mounted = false;
    for (let i = 0; i < 120 && !mounted; i++) {
      mounted = (await evaluate("!!document.querySelector('input[type=file]')")) === true;
      if (!mounted) await sleep(250);
    }
    if (!mounted) {
      console.log(`FAIL   ${route.padEnd(10)} the app never mounted`);
      failures += 1;
      continue;
    }

    await evaluate(WATCH);
    await evaluate(STAGE);
    await sleep(6000);                     // long enough at 20x throttle
    const seen = JSON.parse(await evaluate(RESULT));
    const exc = events.filter(e => e.method === 'Runtime.exceptionThrown')
      .map(e => e.params.exceptionDetails.exception?.description ?? e.params.exceptionDetails.text);

    // The probe only means something if it actually observed the loading state.
    const observed = seen.sawLoading;
    // Both halves matter: the guard has to render, and the tool has to come
    // back out of it. A loading screen that never resolves is its own bug.
    const ok = observed && seen.sawReady && !seen.sawCrash && exc.length === 0;
    if (!ok) failures++;
    console.log(`${ok ? 'ok    ' : 'FAIL  '} ${route.padEnd(10)} loading=${seen.sawLoading} crash=${seen.sawCrash} ready=${seen.sawReady} frames=${seen.samples}`);
    for (const e of exc.slice(0, 2)) console.log(`         ${e.split('\n')[0]}`);
    if (!ok) {
      console.log(`         first: ${JSON.stringify(seen.first)}`);
      console.log(`         last : ${JSON.stringify(seen.last)}`);
    }
    await send('Emulation.setCPUThrottlingRate', { rate: 1 });
  }
} finally { chrome.kill('SIGKILL'); }

console.log(`\n${failures === 0 ? 'PASS' : 'FAIL'} — ${failures} tool(s) with a problem in the loading state\n`);
process.exit(failures === 0 ? 0 : 1);
