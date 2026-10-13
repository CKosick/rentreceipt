#!/usr/bin/env node
/**
 * RentReceipt Extension Packager for Chrome Web Store.
 * Produces a verified, cross-platform standard PKZip archive: dist/rentreceipt-v1.0.0.zip.
 * Verifies the PK zip signature (0x50 0x4B 0x03 0x04) and entry structure.
 */

import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, statSync, stat } from 'node:fs';
import { resolve, join } from 'node:path';
import AdmZip from 'adm-zip';

const ROOT = resolve(process.cwd());
const DIST = join(ROOT, 'dist');
const ZIP_FILE = join(DIST, 'rentreceipt-v1.0.0.zip');

const INCLUDED_ENTRIES = [
  { path: 'manifest.json', type: 'file' },
  { path: 'privacy.html', type: 'file' },
  { path: 'PRIVACY.md', type: 'file' },
  { path: 'LICENSE', type: 'file' },
  { path: 'README.md', type: 'file' },
  { path: 'icons', type: 'dir' },
  { path: 'popup', type: 'dir' },
  { path: 'dashboard', type: 'dir' },
  { path: 'shared', type: 'dir' },
  { path: 'lib', type: 'dir' }
];

console.log('🧪 Step 1: Running full unit test suite...');
try {
  execSync('npm test', { stdio: 'inherit', cwd: ROOT });
} catch (err) {
  console.error('\n❌ Packaging aborted: Test suite failed.');
  process.exit(1);
}

console.log('\n🌐 Step 2: Running automated real browser load test in Chrome...');
try {
  execSync('npm run test:browser', { stdio: 'inherit', cwd: ROOT });
} catch (err) {
  console.error('\n❌ Packaging aborted: Browser load test failed.');
  process.exit(1);
}

console.log('\n📦 Step 3: Packaging extension for Chrome Web Store...');
if (!existsSync(DIST)) {
  mkdirSync(DIST, { recursive: true });
}

const zip = new AdmZip();

for (const entry of INCLUDED_ENTRIES) {
  const fullPath = join(ROOT, entry.path);
  if (!existsSync(fullPath)) {
    console.error(`❌ Packaging error: Required entry "${entry.path}" not found.`);
    process.exit(1);
  }

  if (entry.type === 'file') {
    zip.addLocalFile(fullPath);
  } else if (entry.type === 'dir') {
    zip.addLocalFolder(fullPath, entry.path);
  }
}

// Write the archive to disk
zip.writeZip(ZIP_FILE);

// Step 4: Rigorous verification of PKZip output
console.log('\n🔍 Step 4: Verifying zip archive integrity and PK signature...');
if (!existsSync(ZIP_FILE)) {
  console.error('❌ Verification failed: Output zip file does not exist on disk.');
  process.exit(1);
}

const fileBuffer = readFileSync(ZIP_FILE);

// Check standard PKZip magic signature: 'PK\x03\x04' (0x50 0x4B 0x03 0x04)
const isPkZip = fileBuffer.length >= 4 &&
  fileBuffer[0] === 0x50 &&
  fileBuffer[1] === 0x4B &&
  fileBuffer[2] === 0x03 &&
  fileBuffer[3] === 0x04;

if (!isPkZip) {
  console.error('❌ Verification failed: File header is NOT a valid PKZip signature!');
  console.error('   Expected magic bytes: 50 4B 03 04');
  console.error(`   Found header bytes:   ${fileBuffer.subarray(0, 4).toString('hex')}`);
  process.exit(1);
}

// Verify that the zip can be read back and contains the required manifest.json
const verifyZip = new AdmZip(ZIP_FILE);
const zipEntries = verifyZip.getEntries();
const entryNames = zipEntries.map(e => e.entryName);

if (!entryNames.includes('manifest.json')) {
  console.error('❌ Verification failed: Archive does not contain manifest.json at root level.');
  process.exit(1);
}

const stats = statSync(ZIP_FILE);
const sizeKb = (stats.size / 1024).toFixed(2);

console.log(`\n🎉 Success! Verified genuine PKZip package generated:`);
console.log(`   Archive:    dist/rentreceipt-v1.0.0.zip`);
console.log(`   Magic Byte: PK\\x03\\x04 (0x504B0304) [VERIFIED]`);
console.log(`   File Size:  ${sizeKb} KB`);
console.log(`   Entries:    ${zipEntries.length} items`);
console.log(`\n🚀 Ready for Chrome Developer Dashboard upload and Nova's review!\n`);
