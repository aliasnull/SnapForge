/**
 * ZIP archive writer — store method (no compression).
 *
 * Why hand-rolled instead of a library?
 *   - Every image we put in a ZIP is already compressed (JPEG/PNG/WebP/AVIF),
 *     so deflate would spend CPU on a phone to save ~0%.
 *   - It keeps the dependency count at zero, which matters for a privacy-first
 *     tool: there is no third-party code in the download path at all.
 *
 * Output is a standard ZIP that every OS unzips natively. Files larger than
 * 4 GB or more than 65 535 entries would need ZIP64 — both are refused with a
 * clear message rather than producing a corrupt archive.
 */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) {
    crc = CRC_TABLE[(crc ^ bytes[i]!) & 0xff]! ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/** MS-DOS date/time pair used by the ZIP local header. */
function dosDateTime(date: Date): { time: number; date: number } {
  const time =
    ((date.getHours() & 0x1f) << 11) |
    ((date.getMinutes() & 0x3f) << 5) |
    ((Math.floor(date.getSeconds() / 2)) & 0x1f);
  const dosDate =
    (((date.getFullYear() - 1980) & 0x7f) << 9) |
    (((date.getMonth() + 1) & 0x0f) << 5) |
    (date.getDate() & 0x1f);
  return { time, date: dosDate };
}

export interface ZipEntry {
  name: string;
  blob: Blob;
}

const MAX_ENTRIES = 65_535;
const MAX_TOTAL_BYTES = 0xffffffff; // 4 GiB - 1

/**
 * Build a ZIP from the given entries and return it as a Blob.
 * Entries are read into memory one at a time; peak usage is roughly the size of
 * the archive itself, which is why the caller should keep batches reasonable.
 */
export async function createZip(
  entries: ZipEntry[],
  onProgress?: (done: number, total: number) => void,
): Promise<Blob> {
  if (entries.length === 0) {
    throw new Error('Nothing to archive.');
  }
  if (entries.length > MAX_ENTRIES) {
    throw new Error(`A ZIP can hold at most ${MAX_ENTRIES} files. Split the batch and try again.`);
  }

  const encoder = new TextEncoder();
  const now = new Date();
  const { time, date } = dosDateTime(now);

  const parts: BlobPart[] = [];
  // Typed over `ArrayBuffer` (not `ArrayBufferLike`) so the chunks stay valid
  // `BlobPart`s — TypeScript will not widen a SharedArrayBuffer-backed view.
  const central: Uint8Array<ArrayBuffer>[] = [];
  let offset = 0;

  // Track duplicate names so the archive stays valid.
  const usedNames = new Set<string>();

  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index]!;
    const bytes = new Uint8Array(await entry.blob.arrayBuffer());
    const crc = crc32(bytes);

    let name = entry.name;
    if (usedNames.has(name)) {
      const dot = name.lastIndexOf('.');
      const stem = dot > 0 ? name.slice(0, dot) : name;
      const ext = dot > 0 ? name.slice(dot) : '';
      let counter = 2;
      while (usedNames.has(`${stem}-${counter}${ext}`)) counter += 1;
      name = `${stem}-${counter}${ext}`;
    }
    usedNames.add(name);

    const nameBytes = encoder.encode(name);

    const localHeader = new Uint8Array(30 + nameBytes.length);
    const localView = new DataView(localHeader.buffer);
    localView.setUint32(0, 0x04034b50, true); // local file header signature
    localView.setUint16(4, 20, true); // version needed
    localView.setUint16(6, 0x0800, true); // flags: UTF-8 names
    localView.setUint16(8, 0, true); // method: store
    localView.setUint16(10, time, true);
    localView.setUint16(12, date, true);
    localView.setUint32(14, crc, true);
    localView.setUint32(18, bytes.length, true); // compressed size
    localView.setUint32(22, bytes.length, true); // uncompressed size
    localView.setUint16(26, nameBytes.length, true);
    localView.setUint16(28, 0, true); // extra length
    localHeader.set(nameBytes, 30);

    parts.push(localHeader, bytes);

    const centralHeader = new Uint8Array(46 + nameBytes.length);
    const centralView = new DataView(centralHeader.buffer);
    centralView.setUint32(0, 0x02014b50, true); // central directory signature
    centralView.setUint16(4, 20, true); // version made by
    centralView.setUint16(6, 20, true); // version needed
    centralView.setUint16(8, 0x0800, true);
    centralView.setUint16(10, 0, true);
    centralView.setUint16(12, time, true);
    centralView.setUint16(14, date, true);
    centralView.setUint32(16, crc, true);
    centralView.setUint32(20, bytes.length, true);
    centralView.setUint32(24, bytes.length, true);
    centralView.setUint16(28, nameBytes.length, true);
    centralView.setUint16(30, 0, true); // extra
    centralView.setUint16(32, 0, true); // comment
    centralView.setUint16(34, 0, true); // disk number
    centralView.setUint16(36, 0, true); // internal attrs
    centralView.setUint32(38, 0, true); // external attrs
    centralView.setUint32(42, offset, true); // local header offset
    centralHeader.set(nameBytes, 46);
    central.push(centralHeader);

    offset += localHeader.length + bytes.length;
    if (offset > MAX_TOTAL_BYTES) {
      throw new Error('The archive would exceed 4 GB. Split the batch into smaller groups.');
    }

    onProgress?.(index + 1, entries.length);

    // Yield so the UI can paint the progress bar on a slow phone.
    if (index % 4 === 3) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }

  const centralSize = central.reduce((sum, chunk) => sum + chunk.length, 0);

  const end = new Uint8Array(new ArrayBuffer(22));
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true); // end of central directory
  endView.setUint16(4, 0, true);
  endView.setUint16(6, 0, true);
  endView.setUint16(8, entries.length, true);
  endView.setUint16(10, entries.length, true);
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, offset, true);
  endView.setUint16(20, 0, true); // comment length

  return new Blob([...parts, ...central, end], { type: 'application/zip' });
}

/** Turn `SnapForge-batch-2026-09-22.zip` style names. */
export function buildZipName(prefix = 'snapforge', count?: number): string {
  const now = new Date();
  const stamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-');
  const suffix = count && count > 0 ? `-${count}-images` : '';
  return `${prefix}-batch-${stamp}${suffix}.zip`;
}
