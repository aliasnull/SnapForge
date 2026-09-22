/**
 * Generate a PNG to test the tools with.
 *
 * The interesting case is a large one: a 12 MP photo is what a phone's camera
 * roll actually contains, and it is the size at which decoding takes long enough
 * to be visible. A small gradient settles too fast to expose a loading-state bug.
 *
 * Zero dependencies, for the same reason the ZIP writer and the icon generator
 * are hand-rolled.
 *
 * Usage:  node scripts/make-test-image.mjs [width] [height] [outfile]
 */

import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';

const WIDTH = Number(process.argv[2] ?? 4000);
const HEIGHT = Number(process.argv[3] ?? 3000);
const OUT = process.argv[4] ?? 'test-image.png';

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buffer) {
  let crc = 0xffffffff;
  for (let i = 0; i < buffer.length; i += 1) crc = CRC_TABLE[(crc ^ buffer[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const out = Buffer.alloc(8 + data.length + 4);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'latin1');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

// Truecolour (no alpha) RGB: a smooth two-axis gradient, which makes a wrong
// crop rectangle or a flipped axis obvious at a glance.
const stride = WIDTH * 3;
const raw = Buffer.alloc((stride + 1) * HEIGHT);
for (let y = 0; y < HEIGHT; y += 1) {
  const rowStart = y * (stride + 1);
  raw[rowStart] = 0; // filter: none
  for (let x = 0; x < WIDTH; x += 1) {
    const i = rowStart + 1 + x * 3;
    raw[i] = Math.round((x * 255) / WIDTH);
    raw[i + 1] = Math.round((y * 255) / HEIGHT);
    raw[i + 2] = Math.round(((x + y) * 255) / (WIDTH + HEIGHT));
  }
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(WIDTH, 0);
ihdr.writeUInt32BE(HEIGHT, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 2; // colour type: RGB

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(raw, { level: 6 })),
  chunk('IEND', Buffer.alloc(0)),
]);

writeFileSync(OUT, png);
console.log(`${OUT} — ${WIDTH}x${HEIGHT}, ${(png.length / 1024).toFixed(0)} KB`);
