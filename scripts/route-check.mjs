/**
 * Drive the real SnapForge build in a real Chromium via the DevTools Protocol.
 *
 * `--dump-dom` only shows the settled DOM and hides console errors, so this
 * attaches over CDP instead: it can evaluate in the page, read the console, and
 * catch exceptions. That is the difference between "the HTML looks right" and
 * "the app ran without throwing".
 *
 * Usage: node scripts/route-check.mjs <baseUrl>
 */

const BASE = process.argv[2] ?? 'http://localhost:4200';
const DEBUG_PORT = 9333;
const CHROME = process.env.CHROME_BIN ?? 'chromium-browser';

import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const profile = mkdtempSync(join(tmpdir(), 'sf-cdp-'));

const chrome = spawn(
  CHROME,
  [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--no-first-run',
    '--disable-sync',
    '--disable-background-networking',
    '--disable-features=Translate,MediaRouter',
    `--remote-debugging-port=${DEBUG_PORT}`,
    `--user-data-dir=${profile}`,
    'about:blank',
  ],
  { stdio: ['ignore', 'ignore', 'ignore'] },
);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function targets() {
  for (let i = 0; i < 40; i += 1) {
    try {
      const res = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`);
      const list = await res.json();
      const page = list.find((t) => t.type === 'page');
      if (page?.webSocketDebuggerUrl) return page;
    } catch {
      /* not up yet */
    }
    await sleep(250);
  }
  throw new Error('Chromium never exposed a debuggable page');
}

class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    this.events = [];
    ws.addEventListener('message', (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && this.pending.has(msg.id)) {
        this.pending.get(msg.id)(msg);
        this.pending.delete(msg.id);
      } else if (msg.method) {
        this.events.push(msg);
      }
    });
  }

  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, (msg) => (msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result)));
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
}

async function connect(url) {
  const ws = new WebSocket(url);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', () => reject(new Error('websocket failed')), { once: true });
  });
  return new Cdp(ws);
}

const ROUTES = [
  ['/', 'Home'],
  ['/tools', 'Tools'],
  ['/compress', 'Image Compressor'],
  ['/resize', 'Resize'],
  ['/convert', 'Convert'],
  ['/crop', 'Crop'],
  ['/rotate', 'Rotate'],
  ['/batch', 'Batch'],
  ['/history', 'History'],
  ['/settings', 'Settings'],
  ['/privacy', 'Privacy'],
  ['/about', 'About'],
];

let failures = 0;

try {
  const target = await targets();
  const cdp = await connect(target.webSocketDebuggerUrl);
  await cdp.send('Runtime.enable');
  await cdp.send('Log.enable');
  await cdp.send('Page.enable');

  console.log(`\nSnapForge runtime check against ${BASE}\n`);

  for (const [route, label] of ROUTES) {
    cdp.events.length = 0;

    await cdp.send('Page.navigate', { url: `${BASE}/#${route}` });
    await sleep(1400);

    const result = await cdp.send('Runtime.evaluate', {
      expression: `JSON.stringify({
        h1: (document.querySelector('main h1') || {}).textContent || null,
        crashed: document.body.innerText.includes('Something went wrong'),
        rootChildren: document.getElementById('root').childElementCount,
        svgs: document.querySelectorAll('svg').length,
        buttons: document.querySelectorAll('button').length,
      })`,
      returnByValue: true,
    });

    const info = JSON.parse(result.result.value);

    // Exceptions and console errors raised since the last navigation.
    const errors = cdp.events
      .filter((e) => e.method === 'Runtime.exceptionThrown' || e.method === 'Log.entryAdded')
      .map((e) =>
        e.method === 'Runtime.exceptionThrown'
          ? `exception: ${e.params.exceptionDetails.exception?.description ?? e.params.exceptionDetails.text}`
          : `console.${e.params.entry.level}: ${e.params.entry.text}`,
      )
      .filter((text) => !/favicon|manifest|dbus|GCM|Registration response/i.test(text));

    const crashed = info.crashed || info.rootChildren === 0;
    if (crashed || errors.length > 0) failures += 1;

    const status = crashed ? 'CRASHED' : errors.length > 0 ? 'ERRORS ' : 'ok     ';
    console.log(`${status} ${route.padEnd(10)} h1=${JSON.stringify(info.h1)} svg=${info.svgs} btn=${info.buttons}`);
    if (info.h1 && !info.h1.toLowerCase().includes(label.toLowerCase().split(' ')[0])) {
      console.log(`         note: h1 does not contain ${JSON.stringify(label)}`);
    }
    for (const error of errors.slice(0, 4)) console.log(`         ${error}`);
  }
} finally {
  chrome.kill('SIGKILL');
}

console.log(`\n${failures === 0 ? 'PASS' : 'FAIL'} — ${failures} route(s) with problems\n`);
process.exit(failures === 0 ? 0 : 1);
