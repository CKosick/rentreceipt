/**
 * Test Suite: Client-Side PDF Generation
 * Verifies that buildReceiptPdf produces valid PDF byte output with correct headers
 * using the bundled, offline jsPDF library.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { buildReceiptPdf } from '../shared/pdf-generator.js';

let passed = 0;
function test(name, fn) {
  fn();
  passed++;
  console.log(`  ✓ ${name}`);
}

console.log('\n--- Running Client-Side PDF Generation Tests ---');

// Setup VM sandbox with bundled jsPDF
const jspdfSource = fs.readFileSync('lib/jspdf.umd.min.js', 'utf8');
const sandbox = {
  window: {},
  self: {},
  navigator: { userAgent: 'node' },
  TextEncoder,
  TextDecoder,
  Uint8Array,
  Uint16Array,
  Uint32Array,
  Int8Array,
  Int16Array,
  Int32Array,
  BigInt64Array,
  BigUint64Array,
  Float32Array,
  Float64Array,
  ArrayBuffer,
  DataView,
  atob: (s) => Buffer.from(s, 'base64').toString('binary'),
  btoa: (s) => Buffer.from(s, 'binary').toString('base64'),
  console
};
sandbox.window = sandbox;
sandbox.self = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(jspdfSource, sandbox);

globalThis.jspdf = sandbox.jspdf;

test('buildReceiptPdf generates a valid standard PDF binary', () => {
  const doc = buildReceiptPdf({
    payment: {
      receiptNumber: 'RR-2026-0001',
      date: '2026-10-08',
      amount: 1250,
      lateFeeAssessed: 50,
      method: 'check',
      memo: 'Check #1042',
      rentalPeriod: 'October 2026',
      tenantName: 'Sample Tenant',
      unit: 'Unit 2B',
      balanceRemaining: 0
    },
    tenant: {
      name: 'Sample Tenant',
      unit: 'Unit 2B'
    },
    settings: {
      landlordName: 'Apex Properties LLC',
      propertyAddress: '100 Main Street, Suite 4',
      landlordPhone: '(555) 019-2831',
      landlordEmail: 'landlord@example.com'
    }
  });

  const arrayBuf = doc.output('arraybuffer');
  const buffer = Buffer.from(arrayBuf);

  assert.ok(buffer.length > 2000, 'PDF buffer should have substantial size');
  const header = buffer.subarray(0, 5).toString('ascii');
  assert.equal(header, '%PDF-', 'PDF must begin with %PDF- header');
});

test('buildReceiptPdf handles partial payments and missing optional settings gracefully', () => {
  const doc = buildReceiptPdf({
    payment: {
      receiptNumber: 'RR-2026-0002',
      date: '2026-10-02',
      amount: 700,
      lateFeeAssessed: 0,
      method: 'cash',
      balanceRemaining: 500
    },
    tenant: {
      name: 'Sample Tenant B',
      unit: 'Unit 101'
    },
    settings: {}
  });

  const arrayBuf = doc.output('arraybuffer');
  const buffer = Buffer.from(arrayBuf);
  assert.ok(buffer.length > 2000);
  assert.equal(buffer.subarray(0, 5).toString('ascii'), '%PDF-');
});

console.log(`✅ All ${passed} PDF Generation tests passed!\n`);
