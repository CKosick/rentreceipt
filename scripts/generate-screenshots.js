/**
 * Generates 1280x800 Chrome Web Store Screenshots
 * Using visibly fictional sample data only ("Sample Tenant A", "Sample Tenant B").
 */

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

function createPNG(width, height, drawCallback) {
  const rowSize = width * 4 + 1;
  const rawData = Buffer.alloc(height * rowSize);

  // Fill background with dark navy #0B0F19
  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowSize;
    rawData[rowOffset] = 0; // Filter None
    for (let x = 0; x < width; x++) {
      const px = rowOffset + 1 + x * 4;
      rawData[px] = 11;
      rawData[px + 1] = 15;
      rawData[px + 2] = 25;
      rawData[px + 3] = 255;
    }
  }

  function setPixel(x, y, r, g, b, a = 255) {
    if (x < 0 || x >= width || y < 0 || y >= height) return;
    const px = y * rowSize + 1 + x * 4;
    rawData[px] = r;
    rawData[px + 1] = g;
    rawData[px + 2] = b;
    rawData[px + 3] = a;
  }

  function fillRect(x, y, w, h, [r, g, b, a = 255]) {
    const xEnd = Math.min(width, x + w);
    const yEnd = Math.min(height, y + h);
    for (let py = Math.max(0, y); py < yEnd; py++) {
      for (let px = Math.max(0, x); px < xEnd; px++) {
        setPixel(px, py, r, g, b, a);
      }
    }
  }

  drawCallback({ setPixel, fillRect, width, height });

  const compressed = zlib.deflateSync(rawData);
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  function makeChunk(type, data) {
    const typeBuf = Buffer.from(type, 'ascii');
    const lenBuf = Buffer.alloc(4);
    lenBuf.writeUInt32BE(data.length, 0);
    const crc = crc32(Buffer.concat([typeBuf, data]));
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc >>> 0, 0);
    return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
  }

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

  return Buffer.concat([
    signature,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', compressed),
    makeChunk('IEND', Buffer.alloc(0))
  ]);
}

// Colors
const NAVY = [30, 58, 138];
const SLATE_BG = [248, 250, 252];
const WHITE = [255, 255, 255];
const SIDEBAR = [15, 23, 42];
const BORDER = [226, 232, 240];
const EMERALD = [16, 185, 129];
const RED = [220, 38, 38];
const TEXT_MUTED = [148, 163, 184];

function drawBrowserFrame(ctx) {
  const { fillRect } = ctx;
  // Browser card outer
  fillRect(40, 30, 1200, 740, SIDEBAR);
  // Browser top bar
  fillRect(40, 30, 1200, 44, [30, 41, 59]);
  // Red, Yellow, Green window dots
  fillRect(60, 48, 10, 10, [239, 68, 68]);
  fillRect(78, 48, 10, 10, [245, 158, 11]);
  fillRect(96, 48, 10, 10, [16, 185, 129]);
  // URL bar
  fillRect(124, 42, 600, 20, SIDEBAR);
}

function drawSidebar(ctx, activeIdx = 0) {
  const { fillRect } = ctx;
  // Sidebar container
  fillRect(40, 74, 220, 696, SIDEBAR);
  // Brand box
  fillRect(60, 96, 32, 32, NAVY);
  fillRect(100, 104, 120, 16, WHITE);

  // Menu items
  const menuY = [160, 205, 250, 295, 340];
  menuY.forEach((y, i) => {
    if (i === activeIdx) {
      fillRect(54, y, 192, 36, NAVY);
    } else {
      fillRect(54, y, 192, 36, [24, 34, 53]);
    }
  });

  // 100% Local Privacy Pill
  fillRect(54, 700, 192, 48, [20, 30, 48]);
  fillRect(66, 718, 12, 12, EMERALD);
}

// Screenshot 1: Payments & Receipts
function drawPaymentsShot(ctx) {
  const { fillRect } = ctx;
  drawBrowserFrame(ctx);
  drawSidebar(ctx, 0);

  // Main content area
  fillRect(260, 74, 980, 696, SLATE_BG);

  // App Header
  fillRect(290, 100, 280, 24, NAVY);
  fillRect(290, 130, 360, 14, TEXT_MUTED);

  // Action Button
  fillRect(1070, 104, 140, 38, NAVY);

  // 3 Stats Cards
  fillRect(290, 165, 290, 95, WHITE);
  fillRect(605, 165, 290, 95, WHITE);
  fillRect(920, 165, 290, 95, WHITE);

  // Payments Table Card
  fillRect(290, 285, 920, 455, WHITE);
  // Table Header
  fillRect(290, 285, 920, 44, [241, 245, 249]);

  // Table Rows (Sample Tenant rows)
  for (let r = 0; r < 5; r++) {
    const rowY = 345 + r * 54;
    fillRect(310, rowY, 880, 1, BORDER);
    // Receipt # badge
    fillRect(310, rowY + 12, 85, 18, [224, 231, 255]);
    // Tenant name
    fillRect(420, rowY + 14, 110, 14, [51, 65, 85]);
    // Unit badge
    fillRect(560, rowY + 12, 65, 18, [241, 245, 249]);
    // Method badge
    fillRect(655, rowY + 12, 75, 18, [241, 245, 249]);
    // Late fee indicator (some late, some 0)
    if (r === 1 || r === 3) {
      fillRect(760, rowY + 12, 70, 18, [254, 226, 226]);
    } else {
      fillRect(760, rowY + 12, 50, 18, [236, 253, 245]);
    }
    // Amount
    fillRect(860, rowY + 14, 70, 14, NAVY);
    // PDF Button
    fillRect(950, rowY + 10, 80, 24, NAVY);
  }
}

// Screenshot 2: Late-Fee Calculator
function drawCalculatorShot(ctx) {
  const { fillRect } = ctx;
  drawPaymentsShot(ctx);

  // Modal Backdrop
  fillRect(260, 74, 980, 696, [15, 23, 42, 180]);

  // Modal Box
  const modalX = 500;
  const modalY = 120;
  fillRect(modalX, modalY, 520, 560, WHITE);
  // Modal Header
  fillRect(modalX, modalY, 520, 56, [248, 250, 252]);
  fillRect(modalX + 24, modalY + 18, 200, 20, NAVY);

  // Tenant Dropdown
  fillRect(modalX + 24, modalY + 84, 472, 38, [248, 250, 252]);

  // Date Inputs
  fillRect(modalX + 24, modalY + 144, 226, 38, [248, 250, 252]);
  fillRect(modalX + 270, modalY + 144, 226, 38, [248, 250, 252]);

  // Highlighted Late Fee Calculator Preview Banner
  fillRect(modalX + 24, modalY + 204, 472, 90, [239, 246, 255]);
  fillRect(modalX + 40, modalY + 220, 140, 16, NAVY);
  // Late badge
  fillRect(modalX + 40, modalY + 246, 75, 22, [254, 226, 226]);
  // Fee amount
  fillRect(modalX + 380, modalY + 246, 90, 22, RED);

  // Base rent & fee inputs
  fillRect(modalX + 24, modalY + 316, 226, 38, [248, 250, 252]);
  fillRect(modalX + 270, modalY + 316, 226, 38, [248, 250, 252]);

  // Total Payment received
  fillRect(modalX + 24, modalY + 376, 226, 38, [248, 250, 252]);
  fillRect(modalX + 270, modalY + 376, 226, 38, [248, 250, 252]);

  // Modal Footer & Action
  fillRect(modalX, modalY + 490, 520, 70, [248, 250, 252]);
  fillRect(modalX + 270, modalY + 505, 226, 40, NAVY);
}

// Screenshot 3: Year-End Tax Summary
function drawTaxSummaryShot(ctx) {
  const { fillRect } = ctx;
  drawBrowserFrame(ctx);
  drawSidebar(ctx, 3); // Active tab = Year-End Summary

  fillRect(260, 74, 980, 696, SLATE_BG);

  // Header & Export CSV button
  fillRect(290, 100, 280, 24, NAVY);
  fillRect(290, 130, 360, 14, TEXT_MUTED);

  // Tax Action Buttons (Export CSV & Print)
  fillRect(930, 104, 120, 38, [241, 245, 249]);
  fillRect(1065, 104, 145, 38, NAVY);

  // Tax Summary Stats (Gross Income, Rent, Late Fees)
  fillRect(290, 165, 290, 95, WHITE);
  fillRect(605, 165, 290, 95, WHITE);
  fillRect(920, 165, 290, 95, WHITE);

  // Tax Table Card
  fillRect(290, 285, 920, 455, WHITE);
  fillRect(290, 285, 920, 44, [241, 245, 249]);

  // Fictional Sample Data Rows
  for (let r = 0; r < 4; r++) {
    const rowY = 345 + r * 64;
    fillRect(310, rowY, 880, 1, BORDER);
    fillRect(310, rowY + 14, 80, 20, [241, 245, 249]); // Unit
    fillRect(415, rowY + 16, 130, 16, [51, 65, 85]);   // Tenant
    fillRect(575, rowY + 16, 90, 16, TEXT_MUTED);       // Payments count
    fillRect(710, rowY + 16, 90, 16, NAVY);             // Rent collected
    fillRect(840, rowY + 16, 70, 16, RED);              // Late fees collected
    fillRect(950, rowY + 16, 110, 16, NAVY);            // Total
  }
}

const assetsDir = path.resolve('store-assets');
fs.mkdirSync(assetsDir, { recursive: true });

const shots = [
  { name: 'screenshot-1-payments.png', fn: drawPaymentsShot },
  { name: 'screenshot-2-calculator.png', fn: drawCalculatorShot },
  { name: 'screenshot-3-tax-summary.png', fn: drawTaxSummaryShot }
];

shots.forEach(({ name, fn }) => {
  const buf = createPNG(1280, 800, fn);
  const outPath = path.join(assetsDir, name);
  fs.writeFileSync(outPath, buf);
  console.log(`Generated: store-assets/${name} (${(buf.length / 1024).toFixed(1)} KB)`);
});
