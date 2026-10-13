/**
 * Test Suite: Ledger Balances & Year-End Tax Summary
 * Verifies ledger running balance calculations, partial payment handling,
 * late fee accrual, and exact year-end financial summaries.
 */

import assert from 'node:assert/strict';
import {
  computeLedger,
  generateYearEndSummary
} from '../shared/calculator.js';

let passed = 0;
function test(name, fn) {
  fn();
  passed++;
  console.log(`  ✓ ${name}`);
}

console.log('\n--- Running Ledger & Year-End Summary Tests ---');

// 1. Ledger Balance Computation
test('Empty ledger starts with zero balance', () => {
  const result = computeLedger([]);
  assert.equal(result.summary.currentBalance, 0);
  assert.equal(result.summary.totalCharges, 0);
  assert.equal(result.summary.totalPayments, 0);
  assert.equal(result.summary.isPaidInFull, true);
});

test('Rent charge increases balance; full payment brings balance to zero', () => {
  const entries = [
    { type: 'rent', date: '2026-10-01', amount: 1200, description: 'October Rent' },
    { type: 'payment', date: '2026-10-02', amount: 1200, method: 'transfer', receiptNumber: 'RR-2026-0001' }
  ];

  const result = computeLedger(entries);
  assert.equal(result.entries[0].runningBalance, 1200.00);
  assert.equal(result.entries[1].runningBalance, 0.00);
  assert.equal(result.summary.totalCharges, 1200.00);
  assert.equal(result.summary.totalPayments, 1200.00);
  assert.equal(result.summary.currentBalance, 0.00);
  assert.equal(result.summary.isPaidInFull, true);
});

test('Partial payment leaves correct remaining positive balance', () => {
  const entries = [
    { type: 'rent', date: '2026-10-01', amount: 1500, description: 'October Rent' },
    { type: 'payment', date: '2026-10-02', amount: 900, method: 'check', receiptNumber: 'RR-2026-0002' }
  ];

  const result = computeLedger(entries);
  assert.equal(result.entries[1].runningBalance, 600.00);
  assert.equal(result.summary.currentBalance, 600.00);
  assert.equal(result.summary.isPaidInFull, false);
});

test('Subsequent payment after partial payment clears the balance', () => {
  const entries = [
    { type: 'rent', date: '2026-10-01', amount: 1500, description: 'October Rent' },
    { type: 'payment', date: '2026-10-02', amount: 900, method: 'check', receiptNumber: 'RR-2026-0002' },
    { type: 'payment', date: '2026-10-15', amount: 600, method: 'cash', receiptNumber: 'RR-2026-0003' }
  ];

  const result = computeLedger(entries);
  assert.equal(result.entries[2].runningBalance, 0.00);
  assert.equal(result.summary.totalPayments, 1500.00);
  assert.equal(result.summary.currentBalance, 0.00);
  assert.equal(result.summary.isPaidInFull, true);
});

test('Late fee assessed adds to charges and increases balance', () => {
  const entries = [
    { type: 'rent', date: '2026-10-01', amount: 1000, description: 'October Rent' },
    { type: 'late_fee', date: '2026-10-08', amount: 50, description: 'Late Fee Assessed' },
    { type: 'payment', date: '2026-10-08', amount: 1050, method: 'check', receiptNumber: 'RR-2026-0004' }
  ];

  const result = computeLedger(entries);
  assert.equal(result.entries[0].runningBalance, 1000.00);
  assert.equal(result.entries[1].runningBalance, 1050.00);
  assert.equal(result.entries[2].runningBalance, 0.00);
  assert.equal(result.summary.totalCharges, 1050.00);
  assert.equal(result.summary.totalLateFees, 50.00);
  assert.equal(result.summary.totalPayments, 1050.00);
  assert.equal(result.summary.currentBalance, 0.00);
});

test('Overpayment results in negative running balance (tenant credit)', () => {
  const entries = [
    { type: 'rent', date: '2026-10-01', amount: 1000, description: 'October Rent' },
    { type: 'payment', date: '2026-10-01', amount: 1200, method: 'transfer', receiptNumber: 'RR-2026-0005' }
  ];

  const result = computeLedger(entries);
  assert.equal(result.summary.currentBalance, -200.00);
  assert.equal(result.summary.isPaidInFull, true);
});

// 2. Year-End Tax Summary Calculations
test('generateYearEndSummary aggregates payments exactly by tenant, unit, and payment method', () => {
  const tenants = [
    { id: 't1', name: 'Sample Tenant A', unit: 'Unit 101' },
    { id: 't2', name: 'Sample Tenant B', unit: 'Unit 102' }
  ];

  const payments = [
    // Tenant A (Unit 101) - 2 payments in 2026
    { tenantId: 't1', date: '2026-01-02', amount: 1200, lateFeeAssessed: 0, method: 'transfer' },
    { tenantId: 't1', date: '2026-02-08', amount: 1250, lateFeeAssessed: 50, method: 'check' },
    
    // Tenant B (Unit 102) - 2 payments in 2026
    { tenantId: 't2', date: '2026-01-01', amount: 1500, lateFeeAssessed: 0, method: 'transfer' },
    { tenantId: 't2', date: '2026-02-01', amount: 1500, lateFeeAssessed: 0, method: 'cash' },

    // Prior year payment (should be excluded from 2026 summary)
    { tenantId: 't1', date: '2025-12-01', amount: 1200, lateFeeAssessed: 0, method: 'check' }
  ];

  const summary = generateYearEndSummary(payments, tenants, 2026);

  // Overall Totals
  assert.equal(summary.year, 2026);
  assert.equal(summary.summary.totalCollected, 5450.00); // 1200 + 1250 + 1500 + 1500
  assert.equal(summary.summary.totalRentCollected, 5400.00);
  assert.equal(summary.summary.totalLateFeesCollected, 50.00);
  assert.equal(summary.summary.totalPaymentsCount, 4);
  assert.equal(summary.summary.tenantCount, 2);
  assert.equal(summary.summary.unitCount, 2);

  // Method Breakdown
  assert.equal(summary.summary.paymentMethods.transfer, 2700.00); // 1200 + 1500
  assert.equal(summary.summary.paymentMethods.check, 1250.00);
  assert.equal(summary.summary.paymentMethods.cash, 1500.00);

  // Tenant Breakdown
  const tenantA = summary.byTenant.find(t => t.tenantId === 't1');
  assert.ok(tenantA);
  assert.equal(tenantA.totalCollected, 2450.00);
  assert.equal(tenantA.rentCollected, 2400.00);
  assert.equal(tenantA.lateFeesCollected, 50.00);
  assert.equal(tenantA.paymentCount, 2);

  const tenantB = summary.byTenant.find(t => t.tenantId === 't2');
  assert.ok(tenantB);
  assert.equal(tenantB.totalCollected, 3000.00);
  assert.equal(tenantB.rentCollected, 3000.00);
  assert.equal(tenantB.lateFeesCollected, 0.00);
  assert.equal(tenantB.paymentCount, 2);

  // Unit Breakdown
  const unit101 = summary.byUnit.find(u => u.unit === 'Unit 101');
  assert.ok(unit101);
  assert.equal(unit101.totalCollected, 2450.00);

  const unit102 = summary.byUnit.find(u => u.unit === 'Unit 102');
  assert.ok(unit102);
  assert.equal(unit102.totalCollected, 3000.00);
});

console.log(`✅ All ${passed} Ledger & Year-End Summary tests passed!\n`);
