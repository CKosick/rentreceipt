/**
 * Test Suite: Manifest V3 Compliance
 * Verifies Manifest V3 requirements, icon existence, permissions, and security policies.
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

console.log('\n--- Running Manifest V3 Compliance Tests ---');

const manifestPath = path.resolve('manifest.json');
assert.ok(fs.existsSync(manifestPath), 'manifest.json must exist');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

test('manifest_version is exactly 3', () => {
  assert.equal(manifest.manifest_version, 3);
});

test('Extension name, version, and description are non-empty strings', () => {
  assert.ok(manifest.name && typeof manifest.name === 'string');
  assert.ok(manifest.version && typeof manifest.version === 'string');
  assert.ok(manifest.description && typeof manifest.description === 'string');
  assert.ok(manifest.description.length <= 132, 'Chrome Web Store description should be concise');
});

test('Icons referenced in manifest exist on disk', () => {
  assert.ok(manifest.icons);
  [16, 48, 128].forEach(size => {
    const iconRel = manifest.icons[String(size)];
    assert.ok(iconRel, `Icon size ${size} must be defined in manifest.icons`);
    const iconAbs = path.resolve(iconRel);
    assert.ok(fs.existsSync(iconAbs), `Icon file missing on disk: ${iconRel}`);
  });
});

test('Action popup and icons are configured properly', () => {
  assert.ok(manifest.action);
  assert.ok(manifest.action.default_popup);
  const popupAbs = path.resolve(manifest.action.default_popup);
  assert.ok(fs.existsSync(popupAbs), `Popup file missing on disk: ${manifest.action.default_popup}`);
});

test('Permissions are minimal (strictly empty array for local-first privacy)', () => {
  assert.ok(Array.isArray(manifest.permissions));
  assert.equal(manifest.permissions.length, 0, 'RentReceipt must declare 0 permissions for maximum privacy');
  assert.equal(manifest.host_permissions, undefined, 'No host permissions allowed');
});

test('Options page is configured and exists on disk', () => {
  assert.ok(manifest.options_ui);
  assert.ok(manifest.options_ui.page);
  const optAbs = path.resolve(manifest.options_ui.page);
  assert.ok(fs.existsSync(optAbs), `Options page missing on disk: ${manifest.options_ui.page}`);
});

console.log(`✅ All ${passed} Manifest V3 tests passed!\n`);
