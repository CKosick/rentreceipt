/**
 * Test Suite: HTML Sanitization & Markup Escaping
 * Verifies that user-controlled values (names, units, memos, IDs) containing
 * HTML tags, script injection, attributes, or special characters are safely escaped
 * and render as literal text.
 */

import assert from 'node:assert/strict';
import { escapeHtml } from '../shared/escape.js';

let passed = 0;
function test(name, fn) {
  fn();
  passed++;
  console.log(`  ✓ ${name}`);
}

console.log('\n--- Running HTML Sanitization & Escaping Tests ---');

test('escapeHtml handles null, undefined, numbers, and empty strings', () => {
  assert.equal(escapeHtml(null), '');
  assert.equal(escapeHtml(undefined), '');
  assert.equal(escapeHtml(''), '');
  assert.equal(escapeHtml(123), '123');
  assert.equal(escapeHtml(0), '0');
});

test('escapeHtml neutralizes <script> tags and HTML markup', () => {
  const malicious = '<script>alert("pwned")</script>';
  const escaped = escapeHtml(malicious);
  assert.equal(escaped, '&lt;script&gt;alert(&quot;pwned&quot;)&lt;/script&gt;');
  assert.ok(!escaped.includes('<script>'));
});

test('escapeHtml neutralizes img onerror and event handlers', () => {
  const payload = '<img src=x onerror=alert(1)>';
  const escaped = escapeHtml(payload);
  assert.equal(escaped, '&lt;img src=x onerror=alert(1)&gt;');
  assert.ok(!escaped.includes('<img'));
});

test('escapeHtml neutralizes quotes and attribute injection', () => {
  const attrPayload = '"><script>alert(1)</script><div class="';
  const escaped = escapeHtml(attrPayload);
  assert.equal(escaped, '&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;&lt;div class=&quot;');
  assert.ok(!escaped.includes('"'));
  assert.ok(!escaped.includes('>'));
});

test('Tenant with malicious name renders as literal text in HTML table markup', () => {
  const maliciousTenant = {
    id: 't_bad_123',
    name: '<b onmouseover="alert(1)">Hacker Tenant & Co</b>',
    unit: 'Unit <b>666</b>'
  };

  const renderedRow = `<tr><td><strong>${escapeHtml(maliciousTenant.name)}</strong></td><td>${escapeHtml(maliciousTenant.unit)}</td></tr>`;
  
  // Must not contain raw executable tags
  assert.ok(!renderedRow.includes('<b onmouseover'));
  assert.ok(!renderedRow.includes('<b>666</b>'));
  // Must contain safely escaped entity strings
  assert.ok(renderedRow.includes('&lt;b onmouseover=&quot;alert(1)&quot;&gt;Hacker Tenant &amp; Co&lt;/b&gt;'));
  assert.ok(renderedRow.includes('Unit &lt;b&gt;666&lt;/b&gt;'));
});

test('Single quotes and ampersands in names and memos are properly escaped', () => {
  const memo = "O'Connor & Sons Rent Payment";
  const escaped = escapeHtml(memo);
  assert.equal(escaped, 'O&#39;Connor &amp; Sons Rent Payment');
});

console.log(`✅ All ${passed} HTML Sanitization tests passed!\n`);
