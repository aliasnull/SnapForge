/**
 * SnapForge icon + social-card generator.
 *
 * Why hand-rolled raster instead of a library?
 *   - This project builds on an Android/Termux sandbox where installing a
 *     native image toolchain (sharp, canvas) is not practical.
 *   - It keeps the dependency count at zero, which is the same reason the ZIP
 *     writer is hand-rolled: no third-party code in the product's toolchain.
 *
 * The geometry below is the *same* artwork as the in-app `<Logo />` component,
 * transcribed from its 32x32 viewBox, so the favicon, the installed-app icon
 * and the header mark are guaranteed to match.
 *
 * Usage:  node scripts/generate-icons.mjs
 */

import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC_DIR = join(ROOT, 'public');
const ICONS_DIR = join(PUBLIC_DIR, 'icons');

/* -------------------------------------------------------------------------- */
/* PNG encoding                                                               */
/* -------------------------------------------------------------------------- */

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
  for (let i = 0; i < buffer.length; i += 1) {
    crc = CRC_TABLE[(crc ^ buffer[i]) & 0xff] ^ (crc >>> 8);
  }
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

/** Encode 8-bit RGBA bytes as a truecolour-with-alpha PNG. */
function encodePng(width, height, pixels) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (stride + 1);
    raw[rowStart] = 0; // filter: none
    for (let i = 0; i < stride; i += 1) {
      raw[rowStart + 1 + i] = pixels[y * stride + i];
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA
  ihdr[10] = 0; // deflate
  ihdr[11] = 0; // adaptive filtering
  ihdr[12] = 0; // no interlace

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* -------------------------------------------------------------------------- */
/* Canvas                                                                     */
/* -------------------------------------------------------------------------- */

class Canvas {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.data = new Float64Array(width * height * 4);
  }

  /** Source-over composite of a straight-alpha colour (0-255) onto one pixel. */
  blend(x, y, [r, g, b], alpha) {
    if (alpha <= 0 || x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    const i = (y * this.width + x) * 4;
    const dstA = this.data[i + 3];
    const outA = alpha + dstA * (1 - alpha);
    if (outA <= 0) return;
    this.data[i] = (r * alpha + this.data[i] * dstA * (1 - alpha)) / outA;
    this.data[i + 1] = (g * alpha + this.data[i + 1] * dstA * (1 - alpha)) / outA;
    this.data[i + 2] = (b * alpha + this.data[i + 2] * dstA * (1 - alpha)) / outA;
    this.data[i + 3] = outA;
  }

  /**
   * Straight (non-premultiplied) RGBA output. Colour channels are accumulated
   * in 0-255 and alpha in 0-1, so only alpha is rescaled here.
   */
  toPixels() {
    const out = new Uint8ClampedArray(this.width * this.height * 4);
    for (let i = 0; i < out.length; i += 4) {
      out[i] = Math.round(this.data[i]);
      out[i + 1] = Math.round(this.data[i + 1]);
      out[i + 2] = Math.round(this.data[i + 2]);
      out[i + 3] = Math.round(this.data[i + 3] * 255);
    }
    return out;
  }
}

/* -------------------------------------------------------------------------- */
/* Geometry — transcribed from the in-app Logo (32x32 viewBox)                 */
/* -------------------------------------------------------------------------- */

/** One cubic bezier segment: [c1x, c1y, c2x, c2y, x, y], relative to the cursor. */
const S_PATH = [
  [9.5, 21.5],
  [1.6, 1.3, 3.6, 2, 5.9, 2],
  [3.2, 0, 5.4, -1.5, 5.4, -3.8],
  [0, -2.1, -1.5, -3.2, -4.6, -3.9],
  [-1.9, -0.4],
  [-1.6, -0.4, -2.3, -0.9, -2.3, -1.8],
  [0, -1.1, 1.1, -1.8, 2.8, -1.8],
  [1.5, 0, 2.9, 0.5, 4.1, 1.4],
];

const SPARK = [
  [22.5, 6.5, 22.5, 9.9],
  [20.8, 8.2, 24.2, 8.2],
];

const S_STROKE = 2.2;
const SPARK_STROKE = 1.6;

/** Flatten the S path into a polyline in 32-unit space. */
function sampleSPath(steps = 24) {
  const points = [S_PATH[0].slice()];
  let [cx, cy] = S_PATH[0];

  for (let i = 1; i < S_PATH.length; i += 1) {
    const seg = S_PATH[i];
    if (seg.length === 2) {
      cx += seg[0];
      cy += seg[1];
      points.push([cx, cy]);
      continue;
    }
    const [c1x, c1y, c2x, c2y, ex, ey] = seg;
    const x1 = cx + c1x;
    const y1 = cy + c1y;
    const x2 = x1 + c2x;
    const y2 = y1 + c2y;
    const x3 = x2 + ex;
    const y3 = y2 + ey;

    for (let s = 1; s <= steps; s += 1) {
      const t = s / steps;
      const u = 1 - t;
      points.push([
        u * u * u * cx + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3,
        u * u * u * cy + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3,
      ]);
    }
    cx = x3;
    cy = y3;
  }

  return points;
}

const S_POINTS = sampleSPath();

function distanceToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSq = dx * dx + dy * dy;
  let t = lengthSq === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / lengthSq;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function distanceToPolyline(px, py, points) {
  let best = Infinity;
  for (let i = 1; i < points.length; i += 1) {
    const d = distanceToSegment(px, py, points[i - 1][0], points[i - 1][1], points[i][0], points[i][1]);
    if (d < best) best = d;
  }
  return best;
}

/** Signed distance to a rounded rectangle centred on the origin. */
function roundedRectDistance(px, py, halfW, halfH, radius) {
  const qx = Math.abs(px) - (halfW - radius);
  const qy = Math.abs(py) - (halfH - radius);
  const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0));
  return outside + Math.min(Math.max(qx, qy), 0) - radius;
}

/* -------------------------------------------------------------------------- */
/* Brand colour                                                               */
/* -------------------------------------------------------------------------- */

const STOPS = [
  [0, [0x22, 0xd3, 0xee]],
  [0.55, [0x4f, 0x7c, 0xff]],
  [1, [0x8b, 0x5c, 0xf6]],
];

/** Linear gradient along the 32-unit diagonal, matching the SVG's x1/y1 -> x2/y2. */
function brandColor(px, py) {
  const t = Math.min(1, Math.max(0, (px + py) / 64));
  for (let i = 1; i < STOPS.length; i += 1) {
    const [t0, c0] = STOPS[i - 1];
    const [t1, c1] = STOPS[i];
    if (t <= t1) {
      const k = (t - t0) / (t1 - t0);
      return [c0[0] + (c1[0] - c0[0]) * k, c0[1] + (c1[1] - c0[1]) * k, c0[2] + (c1[2] - c0[2]) * k];
    }
  }
  return STOPS[STOPS.length - 1][1];
}

/* -------------------------------------------------------------------------- */
/* Blitting                                                                   */
/* -------------------------------------------------------------------------- */

/** Composite a raw RGBA buffer onto a canvas at (originX, originY). */
function blitPixels(canvas, buffer, edge, originX, originY) {
  for (let y = 0; y < edge; y += 1) {
    for (let x = 0; x < edge; x += 1) {
      const i = (y * edge + x) * 4;
      canvas.blend(originX + x, originY + y, [buffer[i], buffer[i + 1], buffer[i + 2]], buffer[i + 3] / 255);    }
  }
}

/* -------------------------------------------------------------------------- */
/* The app icon                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Render the logo tile to raw RGBA.
 *
 * @param {number} size
 * @param {object} [options]
 * @param {boolean} [options.maskable] full-bleed background with the artwork
 *   pulled into the 80% safe zone, so Android can crop it to any shape
 * @param {number}  [options.supersample]
 */
function renderIconPixels(size, options = {}) {
  const { maskable = false, supersample = size <= 192 ? 4 : 3 } = options;
  const canvas = new Canvas(size, size);
  const scale = size / 32;
  const artScale = maskable ? 0.76 : 1;
  const half = 15; // the rounded rect spans 1..31 in the 32-unit box
  const radius = maskable ? 0 : 9;
  const total = supersample * supersample;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let bgHits = 0;
      let fgHits = 0;

      for (let sy = 0; sy < supersample; sy += 1) {
        for (let sx = 0; sx < supersample; sx += 1) {
          const px = (x + (sx + 0.5) / supersample) / scale;
          const py = (y + (sy + 0.5) / supersample) / scale;

          if (roundedRectDistance(px - 16, py - 16, half, half, radius) <= 0) bgHits += 1;

          const ax = (px - 16) / artScale + 16;
          const ay = (py - 16) / artScale + 16;

          if (distanceToPolyline(ax, ay, S_POINTS) <= S_STROKE / 2) fgHits += 1;
          else if (
            SPARK.some(
              (seg) => distanceToSegment(ax, ay, seg[0], seg[1], seg[2], seg[3]) <= SPARK_STROKE / 2,
            )
          ) {
            fgHits += 1;
          }
        }
      }

      const bgAlpha = bgHits / total;
      if (bgAlpha > 0) canvas.blend(x, y, brandColor(x / scale, y / scale), bgAlpha);

      const fgAlpha = fgHits / total;
      if (fgAlpha > 0) canvas.blend(x, y, [255, 255, 255], fgAlpha);
    }
  }

  return { size, pixels: canvas.toPixels() };
}

function renderIcon(size, options) {
  const { size: edge, pixels } = renderIconPixels(size, options);
  return encodePng(edge, edge, pixels);
}

/* -------------------------------------------------------------------------- */
/* A minimal stroke font, for the social card                                 */
/* -------------------------------------------------------------------------- */

/** Uppercase glyphs on a 4x6 grid (y grows downward). */
const GLYPHS = {
  A: [[[0, 6], [2, 0], [4, 6]], [[0.9, 4], [3.1, 4]]],
  B: [[[0, 6], [0, 0], [3, 0], [4, 1], [4, 2], [3, 3], [0, 3]], [[3, 3], [4, 4], [4, 5], [3, 6], [0, 6]]],
  C: [[[4, 1], [3, 0], [1, 0], [0, 1], [0, 5], [1, 6], [3, 6], [4, 5]]],
  D: [[[0, 6], [0, 0], [2.4, 0], [4, 1.6], [4, 4.4], [2.4, 6], [0, 6]]],
  E: [[[4, 0], [0, 0], [0, 6], [4, 6]], [[0, 3], [2.8, 3]]],
  F: [[[4, 0], [0, 0], [0, 6]], [[0, 3], [2.8, 3]]],
  G: [[[4, 1], [3, 0], [1, 0], [0, 1], [0, 5], [1, 6], [3, 6], [4, 5], [4, 3.4], [2.3, 3.4]]],
  H: [[[0, 6], [0, 0]], [[4, 6], [4, 0]], [[0, 3], [4, 3]]],
  I: [[[1, 0], [3, 0]], [[2, 0], [2, 6]], [[1, 6], [3, 6]]],
  J: [[[4, 0], [4, 5], [3, 6], [1, 6], [0, 5]]],
  K: [[[0, 6], [0, 0]], [[4, 0], [0, 3.2]], [[1.3, 2.3], [4, 6]]],
  L: [[[0, 0], [0, 6], [4, 6]]],
  M: [[[0, 6], [0, 0], [2, 3.2], [4, 0], [4, 6]]],
  N: [[[0, 6], [0, 0], [4, 6], [4, 0]]],
  O: [[[1, 0], [3, 0], [4, 1], [4, 5], [3, 6], [1, 6], [0, 5], [0, 1], [1, 0]]],
  P: [[[0, 6], [0, 0], [3, 0], [4, 1], [4, 2.6], [3, 3.6], [0, 3.6]]],
  Q: [[[1, 0], [3, 0], [4, 1], [4, 5], [3, 6], [1, 6], [0, 5], [0, 1], [1, 0]], [[2.4, 4.4], [4, 6]]],
  R: [[[0, 6], [0, 0], [3, 0], [4, 1], [4, 2.6], [3, 3.6], [0, 3.6]], [[1.7, 3.6], [4, 6]]],
  S: [[[4, 1], [3, 0], [1, 0], [0, 1], [0, 2], [1, 3], [3, 3], [4, 4], [4, 5], [3, 6], [1, 6], [0, 5]]],
  T: [[[0, 0], [4, 0]], [[2, 0], [2, 6]]],
  U: [[[0, 0], [0, 5], [1, 6], [3, 6], [4, 5], [4, 0]]],
  V: [[[0, 0], [2, 6], [4, 0]]],
  W: [[[0, 0], [1, 6], [2, 3.2], [3, 6], [4, 0]]],
  X: [[[0, 0], [4, 6]], [[4, 0], [0, 6]]],
  Y: [[[0, 0], [2, 3], [4, 0]], [[2, 3], [2, 6]]],
  Z: [[[0, 0], [4, 0], [0, 6], [4, 6]]],
  '.': [[[2, 5.6], [2, 6]]],
  '-': [[[1, 3], [3, 3]]],
};

const GLYPH_UNITS = 4;
const LETTER_SPACING_UNITS = 1.7;
const SPACE_UNITS = 2.4;

function measureText(text, capHeight) {
  const unit = capHeight / 6;
  let width = 0;
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] === ' ') {
      width += SPACE_UNITS * unit;
      continue;
    }
    width += GLYPH_UNITS * unit;
    if (i < text.length - 1 && text[i + 1] !== ' ') width += LETTER_SPACING_UNITS * unit;
  }
  return width;
}

function drawText(canvas, text, startX, baselineY, capHeight, thickness, color) {
  const unit = capHeight / 6;
  const half = thickness / 2;
  const ss = 3;
  let penX = startX;

  for (const char of text.toUpperCase()) {
    const glyph = GLYPHS[char];
    if (glyph === undefined) {
      penX += SPACE_UNITS * unit;
      continue;
    }

    const strokes = glyph.map((polyline) =>
      polyline.map(([gx, gy]) => [penX + gx * unit, baselineY + (gy - 6) * unit]),
    );

    const minX = Math.max(0, Math.floor(penX - half - 1));
    const maxX = Math.min(canvas.width - 1, Math.ceil(penX + GLYPH_UNITS * unit + half + 1));
    const minY = Math.max(0, Math.floor(baselineY - capHeight - half - 1));
    const maxY = Math.min(canvas.height - 1, Math.ceil(baselineY + half + 1));

    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        let hits = 0;
        for (let sy = 0; sy < ss; sy += 1) {
          for (let sx = 0; sx < ss; sx += 1) {
            const px = x + (sx + 0.5) / ss;
            const py = y + (sy + 0.5) / ss;
            let inside = false;
            for (const polyline of strokes) {
              if (polyline.length === 1) {
                inside = Math.hypot(px - polyline[0][0], py - polyline[0][1]) <= half;
              } else {
                inside = distanceToPolyline(px, py, polyline) <= half;
              }
              if (inside) break;
            }
            if (inside) hits += 1;
          }
        }
        if (hits > 0) canvas.blend(x, y, color, hits / (ss * ss));
      }
    }

    penX += GLYPH_UNITS * unit + LETTER_SPACING_UNITS * unit;
  }
}

/* -------------------------------------------------------------------------- */
/* Social card                                                                */
/* -------------------------------------------------------------------------- */

function renderSocialCard(width = 1200, height = 630) {
  const canvas = new Canvas(width, height);

  const glowX = width / 2;
  const glowY = height * 0.32;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      canvas.blend(x, y, [0x08, 0x09, 0x0c], 1);
      const d = Math.hypot(x - glowX, (y - glowY) * 1.5);
      const falloff = Math.max(0, 1 - d / (width * 0.52));
      if (falloff > 0) canvas.blend(x, y, [0x4f, 0x7c, 0xff], falloff * falloff * 0.22);
    }
  }

  // Logo tile, centred above the wordmark.
  const tileEdge = 132;
  const tile = renderIconPixels(tileEdge, { supersample: 3 });
  blitPixels(canvas, tile.pixels, tileEdge, Math.round((width - tileEdge) / 2), 88);

  const title = 'SNAPFORGE';
  const titleSize = 92;
  drawText(canvas, title, (width - measureText(title, titleSize)) / 2, 336, titleSize, 11, [255, 255, 255]);

  const tagline = 'FAST. PRIVATE. IN YOUR BROWSER.';
  const taglineSize = 33;
  drawText(
    canvas,
    tagline,
    (width - measureText(tagline, taglineSize)) / 2,
    424,
    taglineSize,
    4.5,
    [0x9a, 0xa3, 0xb5],
  );

  // A brand-gradient hairline, brightest in the middle.
  const ruleY = 476;
  const ruleHalf = 300;
  for (let i = 0; i <= ruleHalf * 2; i += 1) {
    const x = Math.round(width / 2 - ruleHalf + i);
    const fade = Math.sin((i / (ruleHalf * 2)) * Math.PI);
    canvas.blend(x, ruleY, [0x22, 0xd3, 0xee], fade * 0.55);
    canvas.blend(x, ruleY + 1, [0x8b, 0x5c, 0xf6], fade * 0.35);
  }

  const foot = 'YOUR IMAGES NEVER LEAVE YOUR DEVICE';
  const footSize = 29;
  drawText(canvas, foot, (width - measureText(foot, footSize)) / 2, 546, footSize, 4, [0x6f, 0x78, 0x8c]);

  return encodePng(width, height, canvas.toPixels());
}

/* -------------------------------------------------------------------------- */
/* Entry point                                                                */
/* -------------------------------------------------------------------------- */

mkdirSync(ICONS_DIR, { recursive: true });

const outputs = [
  ['icons/icon-32.png', renderIcon(32)],
  ['icons/icon-192.png', renderIcon(192)],
  ['icons/icon-512.png', renderIcon(512)],
  ['icons/apple-touch-icon.png', renderIcon(180)],
  ['icons/maskable-512.png', renderIcon(512, { maskable: true, supersample: 3 })],
  ['og-image.png', renderSocialCard()],
];

for (const [name, buffer] of outputs) {
  writeFileSync(join(PUBLIC_DIR, name), buffer);
  console.log(`  ${name.padEnd(28)} ${(buffer.length / 1024).toFixed(1)} kB`);
}
