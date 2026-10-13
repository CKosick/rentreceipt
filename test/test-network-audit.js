/**
 * Test Suite: Network & Privacy Source Code Audit
 * 
 * Verifies that the shipped codebase contains ZERO outbound network code paths:
 * - No fetch()
 * - No XMLHttpRequest
 * - No WebSocket
 * - No sendBeacon
 * - No remote script tags or stylesheets
 * - No analytics, telemetry, or external tracking
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

let passed = 0;
function test(name, fn) {
  fn();
  passed++;
  console.log(`  ✓ ${name}`);
}

console.log('\n--- Running Privacy & Zero-Network Audit Tests ---');

// Directories and files subject to the audit (all shipped extension files)
const AUDIT_DIRS = ['shared', 'popup', 'dashboard', 'lib'];
const AUDIT_FILES = ['manifest.json'];

function getAllFiles(dirPath, extFilter = ['.js', '.html', '.json', '.css']) {
  const fullPath = path.resolve(dirPath);
  if (!fs.existsSync(fullPath)) return [];
  const entries = fs.readdirSync(fullPath, { withFileTypes: true });
  let files = [];
  for (const entry of entries) {
    const res = path.join(fullPath, entry.name);
    if (entry.isDirectory()) {
      files = files.concat(getAllFiles(res, extFilter));
    } else if (extFilter.includes(path.extname(entry.name).toLowerCase())) {
      files.push(res);
    }
  }
  return files;
}

let filesToAudit = [];
AUDIT_DIRS.forEach(d => {
  filesToAudit = filesToAudit.concat(getAllFiles(d));
});
AUDIT_FILES.forEach(f => {
  const p = path.resolve(f);
  if (fs.existsSync(p)) filesToAudit.push(p);
});

console.log(`Auditing ${filesToAudit.length} shipped extension files for network APIs...`);

test('Shipped code contains ZERO fetch() calls', () => {
  const violations = [];
  filesToAudit.forEach(filepath => {
    const content = fs.readFileSync(filepath, 'utf8');
    // Match window.fetch or direct fetch(
    const matches = content.match(/\bfetch\s*\(/g);
    if (matches) {
      violations.push(`${path.relative(process.cwd(), filepath)}: ${matches.length} occurrences`);
    }
  });
  assert.equal(violations.length, 0, `Forbidden fetch() found in:\n${violations.join('\n')}`);
});

test('Shipped code contains ZERO XMLHttpRequest references', () => {
  const violations = [];
  filesToAudit.forEach(filepath => {
    const content = fs.readFileSync(filepath, 'utf8');
    const matches = content.match(/\bXMLHttpRequest\b/g);
    if (matches) {
      violations.push(`${path.relative(process.cwd(), filepath)}: ${matches.length} occurrences`);
    }
  });
  assert.equal(violations.length, 0, `Forbidden XMLHttpRequest found in:\n${violations.join('\n')}`);
});

test('Shipped code contains ZERO WebSocket references', () => {
  const violations = [];
  filesToAudit.forEach(filepath => {
    const content = fs.readFileSync(filepath, 'utf8');
    const matches = content.match(/\bWebSocket\b/g);
    if (matches) {
      violations.push(`${path.relative(process.cwd(), filepath)}: ${matches.length} occurrences`);
    }
  });
  assert.equal(violations.length, 0, `Forbidden WebSocket found in:\n${violations.join('\n')}`);
});

test('Shipped code contains ZERO sendBeacon references', () => {
  const violations = [];
  filesToAudit.forEach(filepath => {
    const content = fs.readFileSync(filepath, 'utf8');
    const matches = content.match(/\bsendBeacon\b/g);
    if (matches) {
      violations.push(`${path.relative(process.cwd(), filepath)}: ${matches.length} occurrences`);
    }
  });
  assert.equal(violations.length, 0, `Forbidden sendBeacon found in:\n${violations.join('\n')}`);
});

test('HTML files contain ZERO remote script tags or external CSS links', () => {
  const htmlFiles = filesToAudit.filter(f => f.endsWith('.html'));
  const violations = [];
  htmlFiles.forEach(filepath => {
    const content = fs.readFileSync(filepath, 'utf8');
    if (content.match(/<script[^>]+src=["']https?:\/\//i) || content.match(/<script[^>]+src=["']\/\//i)) {
      violations.push(`${path.relative(process.cwd(), filepath)} has remote script tag`);
    }
    if (content.match(/<link[^>]+href=["']https?:\/\//i) || content.match(/<link[^>]+href=["']\/\//i)) {
      violations.push(`${path.relative(process.cwd(), filepath)} has remote link/stylesheet`);
    }
  });
  assert.equal(violations.length, 0, `Remote references found in HTML:\n${violations.join('\n')}`);
});

test('Shipped JS code contains ZERO telemetry or analytics libraries', () => {
  const trackerKeywords = ['google-analytics', 'gtag', 'mixpanel', 'amplitude', 'sentry', 'hotjar'];
  const violations = [];
  filesToAudit.forEach(filepath => {
    const content = fs.readFileSync(filepath, 'utf8').toLowerCase();
    trackerKeywords.forEach(keyword => {
      if (content.includes(keyword)) {
        violations.push(`${path.relative(process.cwd(), filepath)} contains telemetry keyword: ${keyword}`);
      }
    });
  });
  assert.equal(violations.length, 0, `Telemetry references found:\n${violations.join('\n')}`);
});

console.log(`✅ All ${passed} Zero-Network Privacy tests passed!\n`);
