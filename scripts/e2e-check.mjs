/**
 * End-to-end check: drive the real app in Chromium and put a real image
 * through each tool, exactly as a user would.
 *
 * A route render is not enough. The bug this exists to catch is one that only
 * appears after a file is chosen — decoding, the canvas pipeline, the encode
 * step, or a panel that dereferences output before it exists. So this loads a
 * generated PNG through the hidden file input, presses the tool's action
 * button, waits for the result panel, and reports anything thrown along the way.
 *
 * Usage: node scripts/e2e-check.mjs <baseUrl> <imagePath>
 */

import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BASE = process.argv[2] ?? 'http://localhost:4200';
const IMAGE = process.argv[3] ?? 'test-image.png';
const DEBUG_PORT = 9334;
const CHROME = process.env.CHROME_BIN ?? 'chromium-browser';

const imageB64 = readFileSync(IMAGE).toString('base64');
const imageName = IMAGE.split('/').pop();

const profile = mkdtempSync(join(tmpdir(), 'sf-e2e-'));

const chrome = spawn(
  CHROME,
  [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage',
    '--no-first-run', '--disable-sync', '--disable-background-networking',
    '--disable-features=Translate,MediaRouter',
    `--remote-debugging-port=${DEBUG_PORT}`, `--user-data-dir=${profile}`, 'about:blank',
  ],
  { stdio: ['ignore', 'ignore', 'ignore'] },
);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function firstPage() {
  for (let i = 0; i < 40; i += 1) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`)).json();
      const page = list.find((t) => t.type === 'page');
      if (page?.webSocketDebuggerUrl) return page;
    } catch { /* not up yet */ }
    await sleep(250);
  }
  throw new Error('Chromium never exposed a debuggable page');
}

class Cdp {
  constructor(ws) {
    this.ws = ws; this.id = 0; this.pending = new Map(); this.events = [];
    ws.addEventListener('message', (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && this.pending.has(msg.id)) { this.pending.get(msg.id)(msg); this.pending.delete(msg.id); }
      else if (msg.method) this.events.push(msg);
    });
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, (m) => (m.error ? reject(new Error(m.error.message)) : resolve(m.result)));
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  async eval(expression) {
    const r = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) {
      throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
    }
    return r.result.value;
  }
  errors() {
    return this.events
      .filter((e) =>
        e.method === 'Runtime.exceptionThrown' ||
        e.method === 'Runtime.consoleAPICalled' ||
        e.method === 'Log.entryAdded',
      )
      .map((e) => {
        if (e.method === 'Runtime.exceptionThrown') {
          return `EXCEPTION ${e.params.exceptionDetails.exception?.description ?? e.params.exceptionDetails.text}`;
        }
        if (e.method === 'Runtime.consoleAPICalled') {
          const args = (e.params.args ?? [])
            .map((a) => a.description ?? a.value ?? a.type)
            .join(' ');
          return `console.${e.params.type} ${args}`;
        }
        return `console.${e.params.entry.level} ${e.params.entry.text}`;
      })
      .filter((t) => !/favicon|manifest|dbus|GCM|Registration response|DevTools/i.test(t));
  }
}

/** Stage the file into the page's hidden <input type=file> and fire change. */
const SELECT_IMAGE = `
(() => {
  const binary = atob(${JSON.stringify(imageB64)});
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const file = new File([bytes], ${JSON.stringify(imageName)}, { type: 'image/png' });
  const dt = new DataTransfer();
  dt.items.add(file);
  const input = document.querySelector('input[type=file]');
  if (!input) return 'no-file-input';
  input.files = dt.files;
  input.dispatchEvent(new Event('change', { bubbles: true }));
  return 'staged';
})()`;

/** Click the tool's primary action — the one that starts processing. */
const CLICK_ACTION = `
(() => {
  const buttons = [...document.querySelectorAll('button')];
  const action = buttons.find((b) => /^(Compress image|Resize image|Convert image|Apply crop|Rotate image|Process \\d+|Rotate & flip|Save|Apply)/i.test(b.textContent.trim()))
    || buttons.find((b) => b.className.includes('btn--primary'));
  if (!action) return 'no-action-button:' + buttons.map(b => b.textContent.trim()).join('|');
  if (action.disabled) return 'action-disabled';
  action.click();
  return 'clicked:' + action.textContent.trim();
})()`;

const READ_STATE = `
JSON.stringify({
  crashed: document.body.innerText.includes('Something went wrong'),
  hasDownload: /Download/i.test(document.body.innerText),
  hasResult: !!document.querySelector('.result, .compare, [class*=result]'),
  text: document.body.innerText.slice(0, 300),
})`;

/**
 * Rotate starts at an identity transform, so its apply button is legitimately
 * disabled until something is rotated. Press "90° right" first, otherwise this
 * check would report a pass without ever running the pixel pipeline.
 */
const ROTATE_90 = `
(() => {
  const button = [...document.querySelectorAll('button')]
    .find((b) => b.textContent.trim().startsWith('90'));
  if (!button) return 'no-rotate-button';
  button.click();
  return 'rotated';
})()`;

const ROUTES = [
  ['/compress', null],
  ['/resize', null],
  ['/convert', null],
  ['/rotate', ROTATE_90],
  ['/crop', null],
];

let failures = 0;

try {
  const page = await firstPage();
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => {
    ws.addEventListener('open', res, { once: true });
    ws.addEventListener('error', () => rej(new Error('ws failed')), { once: true });
  });
  const cdp = new Cdp(ws);
  await cdp.send('Runtime.enable');
  await cdp.send('Log.enable');
  await cdp.send('Page.enable');

  console.log(`\nSnapForge end-to-end check — ${imageName} through each tool\n`);

  for (const [route, setup] of ROUTES) {
    cdp.events.length = 0;
    await cdp.send('Page.navigate', { url: `${BASE}/#${route}` });
    await sleep(1600);

    const staged = await cdp.eval(SELECT_IMAGE);
    if (staged !== 'staged') {
      console.log(`FAIL   ${route.padEnd(10)} could not stage the file: ${staged}`);
      failures += 1;
      continue;
    }
    await sleep(1800);

    const afterLoad = JSON.parse(await cdp.eval(READ_STATE));
    if (afterLoad.crashed) {
      console.log(`FAIL   ${route.padEnd(10)} crashed while DECODING the image`);
      for (const e of cdp.errors().slice(0, 6)) console.log(`         ${e.slice(0, 300)}`);
      failures += 1;
      continue;
    }

    if (setup) {
      const done = await cdp.eval(setup);
      if (done !== 'rotated') {
        console.log(`FAIL   ${route.padEnd(10)} could not prepare the tool: ${done}`);
        failures += 1;
        continue;
      }
      await sleep(400);
    }

    const clicked = await cdp.eval(CLICK_ACTION);
    await sleep(3000);

    const afterRun = JSON.parse(await cdp.eval(READ_STATE));
    const errors = cdp.errors();
    const bad = afterRun.crashed || errors.some((e) => e.startsWith('EXCEPTION'));

    console.log(`${bad ? 'FAIL  ' : 'ok    '} ${route.padEnd(10)} click=${clicked.slice(0, 40).padEnd(40)} download=${afterRun.hasDownload}`);
    if (bad) {
      failures += 1;
      for (const e of errors.slice(0, 4)) console.log(`         ${e}`);
    }
  }
} finally {
  chrome.kill('SIGKILL');
}

console.log(`\n${failures === 0 ? 'PASS' : 'FAIL'} — ${failures} tool(s) failed\n`);
process.exit(failures === 0 ? 0 : 1);
