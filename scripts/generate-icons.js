/**
 * Generates PNG icons (16x16, 48x48, 128x128) using pure Node.js (zlib).
 * Creates a distinctive receipt / ledger icon in professional navy and emerald.
 */

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

function createPNG(width, height, pixelShader) {
  // RGBA buffer with filter byte (0) per scanline
  const rowSize = width * 4 + 1;
  const rawData = Buffer.alloc(height * rowSize);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowSize;
    rawData[rowOffset] = 0; // Filter type 0 (None)

    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = pixelShader(x, y, width, height);
      const pxOffset = rowOffset + 1 + x * 4;
      rawData[pxOffset] = r;
      rawData[pxOffset + 1] = g;
      rawData[pxOffset + 2] = b;
      rawData[pxOffset + 3] = a;
    }
  }

  const compressed = zlib.deflateSync(rawData);

  // PNG Signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR Chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type 6: RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  function makeChunk(type, data) {
    const typeBuf = Buffer.from(type, 'ascii');
    const len = data.length;
    const lenBuf = Buffer.alloc(4);
    lenBuf.writeUInt32BE(len, 0);

    const crcBuf = Buffer.alloc(4);
    const crc = crc32(Buffer.concat([typeBuf, data]));
    crcBuf.writeUInt32BE(crc >>> 0, 0);

    return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
  }

  // CRC-32 table calculation
  function crc32(buf) {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
      c ^= buf[i];
      for (let k = 0; k < 8; k++) {
        c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0);
      }
    }
    return ~c;
  }

  const ihdrChunk = makeChunk('IHDR', ihdr);
  const idatChunk = makeChunk('IDAT', compressed);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

/**
 * Pixel shader for RentReceipt brand icon:
 * A rich deep navy container with smooth rounded corners,
 * holding a crisp white receipt document with emerald green check badge.
 */
function iconShader(x, y, w, h) {
  // Normalize coordinates (0.0 to 1.0)
  const nx = x / w;
  const ny = y / h;

  // Background rounded rectangle
  const pad = 0.06;
  const rad = 0.22;
  const rx = Math.min(Math.max(nx, pad + rad), 1 - pad - rad);
  const ry = Math.min(Math.max(ny, pad + rad), 1 - pad - rad);
  const dist = Math.hypot(nx - rx, ny - ry);

  if (dist > rad) {
    return [0, 0, 0, 0]; // Transparent outside icon border
  }

  // Navy gradient background
  let bgR = 30 + Math.round(ny * 15);
  let bgG = 58 + Math.round(ny * 20);
  let bgB = 138 + Math.round(ny * 25);

  // Receipt paper rectangle: nx in [0.22, 0.78], ny in [0.18, 0.82]
  const paperL = 0.24;
  const paperR = 0.76;
  const paperT = 0.18;
  const paperB = 0.82;

  if (nx >= paperL && nx <= paperR && ny >= paperT && ny <= paperB) {
    // Check if on folded top-right corner
    const foldSize = 0.12;
    if (nx > (paperR - foldSize) && ny < (paperT + foldSize) && (nx - (paperR - foldSize) + (ny - paperT) > foldSize)) {
      // Folded flap
      return [203, 213, 225, 255]; // Slate 300
    }

    // Receipt horizontal lines
    const lineXStart = 0.32;
    const lineXEnd = 0.68;
    const isLine1 = (ny >= 0.32 && ny <= 0.36 && nx >= lineXStart && nx <= lineXEnd);
    const isLine2 = (ny >= 0.42 && ny <= 0.46 && nx >= lineXStart && nx <= lineXEnd);
    const isLine3 = (ny >= 0.52 && ny <= 0.56 && nx >= lineXStart && nx <= 0.55);

    if (isLine1 || isLine2 || isLine3) {
      return [148, 163, 184, 255]; // Slate 400 line
    }

    // Emerald stamp / badge at bottom-right of receipt: circle center (0.64, 0.68), radius 0.12
    const badgeDist = Math.hypot(nx - 0.64, ny - 0.68);
    if (badgeDist < 0.12) {
      // Emerald badge #10B981
      return [16, 185, 129, 255];
    }

    // White paper body
    return [255, 255, 255, 255];
  }

  return [bgR, bgG, bgB, 255];
}

const iconsDir = path.resolve('icons');
fs.mkdirSync(iconsDir, { recursive: true });

[16, 48, 128].forEach(size => {
  const buf = createPNG(size, size, iconShader);
  const filePath = path.join(iconsDir, `icon-${size}.png`);
  fs.writeFileSync(filePath, buf);
  console.log(`Generated: icons/icon-${size}.png (${buf.length} bytes)`);
});
