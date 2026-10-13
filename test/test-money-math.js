/**
 * Test Suite: Money Math & Late-Fee Calculator
 * Verifies zero floating-point drift, exact late fee calculations for both rule shapes,
 * payment on due date, early payments, grace periods, and edge cases.
 */

import assert from 'node:assert/strict';
import {
  toCents,
  fromCents,
  formatCurrency,
  calendarDaysBetween,
  calculateLateFee
} from '../shared/calculator.js';

let passed = 0;
function test(name, fn) {
  fn();
  passed++;
  console.log(`  ✓ ${name}`);
}

console.log('\n--- Running Money Math & Late Fee Tests ---');

// 1. Currency precision & Cents conversion
test('toCents and fromCents handle standard decimals without precision loss', () => {
  assert.equal(toCents(10.50), 1050);
  assert.equal(toCents('10.50'), 1050);
  assert.equal(toCents('$1,250.75'), 125075);
  assert.equal(toCents(0.1) + toCents(0.2), 30); // No 0.30000000000000004 bug
  assert.equal(fromCents(30), 0.3);
  assert.equal(fromCents(125075), 1250.75);
});

test('formatCurrency formats USD correctly with commas and decimals', () => {
  assert.equal(formatCurrency(1250), '$1,250.00');
  assert.equal(formatCurrency(0), '$0.00');
  assert.equal(formatCurrency(10.5), '$10.50');
  assert.equal(formatCurrency(-50), '-$50.00');
});

// 2. Calendar Days Calculations
test('calendarDaysBetween calculates correct UTC whole day difference', () => {
  assert.equal(calendarDaysBetween('2026-10-01', '2026-10-01'), 0);
  assert.equal(calendarDaysBetween('2026-10-01', '2026-10-06'), 5);
  assert.equal(calendarDaysBetween('2026-10-06', '2026-10-01'), -5);
  // Month boundary
  assert.equal(calendarDaysBetween('2026-09-28', '2026-10-03'), 5);
  // Leap year Feb boundary
  assert.equal(calendarDaysBetween('2024-02-28', '2024-03-01'), 2);
});

// 3. Flat Amount Late Fee Rule
test('Flat rule: Payment on due date assesses $0 late fee', () => {
  const result = calculateLateFee({
    dueDate: '2026-10-01',
    paymentDate: '2026-10-01',
    rule: { type: 'flat', flatAmount: 50, gracePeriodDays: 5 }
  });
  assert.equal(result.isLate, false);
  assert.equal(result.daysLate, 0);
  assert.equal(result.lateFee, 0);
});

test('Flat rule: Early payment assesses $0 late fee', () => {
  const result = calculateLateFee({
    dueDate: '2026-10-01',
    paymentDate: '2026-09-29',
    rule: { type: 'flat', flatAmount: 50, gracePeriodDays: 5 }
  });
  assert.equal(result.isLate, false);
  assert.equal(result.daysLate, 0);
  assert.equal(result.lateFee, 0);
});

test('Flat rule: Payment within grace period assesses $0 late fee', () => {
  // Grace period 5 days: Oct 1 + 5 = Oct 6
  const result = calculateLateFee({
    dueDate: '2026-10-01',
    paymentDate: '2026-10-06',
    rule: { type: 'flat', flatAmount: 50, gracePeriodDays: 5 }
  });
  assert.equal(result.isLate, false);
  assert.equal(result.daysLate, 0);
  assert.equal(result.lateFee, 0);
});

test('Flat rule: Payment 1 day past grace period assesses configured flat fee ($50)', () => {
  // Oct 7 is 6 days after Oct 1, which is 1 day past 5-day grace period
  const result = calculateLateFee({
    dueDate: '2026-10-01',
    paymentDate: '2026-10-07',
    rule: { type: 'flat', flatAmount: 50, gracePeriodDays: 5 }
  });
  assert.equal(result.isLate, true);
  assert.equal(result.daysLate, 1);
  assert.equal(result.lateFee, 50.00);
});

test('Flat rule: Payment 20 days past grace period assesses same flat fee ($50)', () => {
  const result = calculateLateFee({
    dueDate: '2026-10-01',
    paymentDate: '2026-10-26',
    rule: { type: 'flat', flatAmount: 50, gracePeriodDays: 5 }
  });
  assert.equal(result.isLate, true);
  assert.equal(result.daysLate, 20);
  assert.equal(result.lateFee, 50.00);
});

// 4. Daily Rate Late Fee Rule
test('Daily rule: Payment on due date assesses $0 late fee', () => {
  const result = calculateLateFee({
    dueDate: '2026-10-01',
    paymentDate: '2026-10-01',
    rule: { type: 'daily', dailyRate: 10, gracePeriodDays: 3 }
  });
  assert.equal(result.isLate, false);
  assert.equal(result.daysLate, 0);
  assert.equal(result.lateFee, 0);
});

test('Daily rule: Payment within grace period assesses $0 late fee', () => {
  const result = calculateLateFee({
    dueDate: '2026-10-01',
    paymentDate: '2026-10-04',
    rule: { type: 'daily', dailyRate: 10, gracePeriodDays: 3 }
  });
  assert.equal(result.isLate, false);
  assert.equal(result.daysLate, 0);
  assert.equal(result.lateFee, 0);
});

test('Daily rule: Payment 1 day past grace period assesses 1 × dailyRate ($10)', () => {
  // Oct 5 is 4 days after Oct 1 -> 4 - 3 = 1 day late
  const result = calculateLateFee({
    dueDate: '2026-10-01',
    paymentDate: '2026-10-05',
    rule: { type: 'daily', dailyRate: 10, gracePeriodDays: 3 }
  });
  assert.equal(result.isLate, true);
  assert.equal(result.daysLate, 1);
  assert.equal(result.lateFee, 10.00);
});

test('Daily rule: Payment 5 days past grace period assesses 5 × dailyRate ($50)', () => {
  // Oct 9 is 8 days after Oct 1 -> 8 - 3 = 5 days late
  const result = calculateLateFee({
    dueDate: '2026-10-01',
    paymentDate: '2026-10-09',
    rule: { type: 'daily', dailyRate: 10, gracePeriodDays: 3 }
  });
  assert.equal(result.isLate, true);
  assert.equal(result.daysLate, 5);
  assert.equal(result.lateFee, 50.00);
});

test('Daily rule: chargeFromDueDate=true assesses dailyRate from original due date once grace period lapses', () => {
  // Oct 5 is 4 days after Oct 1 -> 4 days × $10 = $40
  const result = calculateLateFee({
    dueDate: '2026-10-01',
    paymentDate: '2026-10-05',
    rule: { type: 'daily', dailyRate: 10, gracePeriodDays: 3, chargeFromDueDate: true }
  });
  assert.equal(result.isLate, true);
  assert.equal(result.daysLate, 4);
  assert.equal(result.lateFee, 40.00);
});

// 5. Zero Grace Period Case
test('Rule with zero grace period assesses fee starting the day immediately following due date', () => {
  const result = calculateLateFee({
    dueDate: '2026-10-01',
    paymentDate: '2026-10-02',
    rule: { type: 'daily', dailyRate: 15, gracePeriodDays: 0 }
  });
  assert.equal(result.isLate, true);
  assert.equal(result.daysLate, 1);
  assert.equal(result.lateFee, 15.00);
});

console.log(`✅ All ${passed} Money Math tests passed!\n`);
