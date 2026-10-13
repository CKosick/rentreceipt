#!/usr/bin/env node
/**
 * RentReceipt Extension Packager for Chrome Web Store.
 * Runs comprehensive test suites and produces dist/rentreceipt-v1.0.0.zip.
 */

import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, unlinkSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';

const ROOT = resolve(process.cwd());
const DIST = join(ROOT, 'dist');
const ZIP_FILE = join(DIST, 'rentreceipt-v1.0.0.zip');

const INCLUDED_FILES = [
  'manifest.json',
  'privacy.html',
  'PRIVACY.md',
  'LICENSE',
  'README.md',
  'icons',
  'popup',
  'dashboard',
  'shared',
  'lib'
];

console.log('🧪 Step 1: Running full test suite...');
try {
  execSync('npm test', { stdio: 'inherit', cwd: ROOT });
} catch (err) {
  console.error('\n❌ Packaging aborted: Test suite failed.');
  process.exit(1);
}

console.log('\n📦 Step 2: Packaging extension for Chrome Web Store...');
if (!existsSync(DIST)) {
  mkdirSync(DIST, { recursive: true });
}

if (existsSync(ZIP_FILE)) {
  try {
    unlinkSync(ZIP_FILE);
  } catch (err) {
    // ignore
  }
}

try {
  const itemsArg = INCLUDED_FILES.join(' ');
  execSync(`tar -a -c -f dist/rentreceipt-v1.0.0.zip ${itemsArg}`, { stdio: 'inherit', cwd: ROOT });
  
  const stats = statSync(ZIP_FILE);
  const sizeKb = (stats.size / 1024).toFixed(2);
  
  console.log(`\n🎉 Success! Extension packaged:`);
  console.log(`   Archive:  dist/rentreceipt-v1.0.0.zip`);
  console.log(`   Size:     ${sizeKb} KB`);
  console.log(`   Included: ${INCLUDED_FILES.join(', ')}`);
  console.log(`\n🚀 Ready for review and CWS slot opening!\n`);
} catch (err) {
  console.error('❌ Failed to create zip archive:', err);
  process.exit(1);
}
