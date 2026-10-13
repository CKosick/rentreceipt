/**
 * Test Suite: Local Storage Export & Import
 * Verifies full data export to JSON, complete restoration to a fresh profile,
 * schema validation, and preservation of tenants, rules, and payment history.
 */

import assert from 'node:assert/strict';
import {
  saveTenant,
  getTenants,
  savePayment,
  getPayments,
  saveSettings,
  getSettings,
  exportAllData,
  importAllData,
  resetDatabase
} from '../shared/storage.js';

let passed = 0;
function test(name, fn) {
  fn();
  passed++;
  console.log(`  ✓ ${name}`);
}

console.log('\n--- Running Export / Import & Backup Tests ---');

test('Export and import preserves all data into a clean profile', async () => {
  // Start fresh
  await resetDatabase();

  // 1. Create two sample tenants with different late fee rules
  const tenant1 = await saveTenant({
    name: 'Sample Tenant 1',
    unit: 'Unit 1A',
    monthlyRent: 1200,
    dueDayOfMonth: 1,
    gracePeriodDays: 5,
    lateFeeRule: {
      type: 'flat',
      flatAmount: 50,
      gracePeriodDays: 5
    }
  });

  const tenant2 = await saveTenant({
    name: 'Sample Tenant 2',
    unit: 'Unit 2B',
    monthlyRent: 1450,
    dueDayOfMonth: 5,
    gracePeriodDays: 3,
    lateFeeRule: {
      type: 'daily',
      dailyRate: 10,
      gracePeriodDays: 3,
      chargeFromDueDate: false
    }
  });

  // 2. Record two payments for tenant 1 (one on-time, one late)
  const payment1 = await savePayment({
    tenantId: tenant1.id,
    tenantName: tenant1.name,
    unit: tenant1.unit,
    date: '2026-09-01',
    amount: 1200,
    lateFeeAssessed: 0,
    method: 'transfer',
    memo: 'September Rent - On Time',
    rentalPeriod: 'September 2026',
    receiptNumber: 'RR-2026-0001'
  });

  const payment2 = await savePayment({
    tenantId: tenant1.id,
    tenantName: tenant1.name,
    unit: tenant1.unit,
    date: '2026-10-08',
    amount: 1250,
    lateFeeAssessed: 50,
    method: 'check',
    memo: 'October Rent - Check #1042 Late Fee Included',
    rentalPeriod: 'October 2026',
    receiptNumber: 'RR-2026-0002'
  });

  // 3. Save custom landlord settings
  await saveSettings({
    landlordName: 'Sample Management LLC',
    propertyAddress: '123 Pine St, Cityville',
    landlordPhone: '(555) 012-3456',
    landlordEmail: 'landlord@example.com'
  });

  // 4. Export all data to JSON
  const exported = await exportAllData();
  assert.equal(exported.app, 'RentReceipt');
  assert.equal(exported.version, 1);
  assert.equal(exported.tenants.length, 2);
  assert.equal(exported.payments.length, 2);
  assert.equal(exported.settings.landlordName, 'Sample Management LLC');

  // Convert to JSON string and parse back to simulate disk file transfer
  const jsonString = JSON.stringify(exported, null, 2);
  const parsedBackup = JSON.parse(jsonString);

  // 5. Simulate fresh browser profile by resetting database completely
  await resetDatabase();
  const emptyTenants = await getTenants();
  const emptyPayments = await getPayments();
  assert.equal(emptyTenants.length, 0);
  assert.equal(emptyPayments.length, 0);

  // 6. Import backup data into fresh profile
  const importResult = await importAllData(parsedBackup, { mode: 'replace' });
  assert.equal(importResult.tenantsRestored, 2);
  assert.equal(importResult.paymentsRestored, 2);

  // 7. Verify restored state matches original data exactly
  const restoredTenants = await getTenants();
  const restoredPayments = await getPayments();
  const restoredSettings = await getSettings();

  assert.equal(restoredTenants.length, 2);
  assert.equal(restoredPayments.length, 2);
  assert.equal(restoredSettings.landlordName, 'Sample Management LLC');
  assert.equal(restoredSettings.propertyAddress, '123 Pine St, Cityville');

  const restoredT1 = restoredTenants.find(t => t.id === tenant1.id);
  assert.ok(restoredT1);
  assert.equal(restoredT1.name, 'Sample Tenant 1');
  assert.equal(restoredT1.monthlyRent, 1200);
  assert.equal(restoredT1.lateFeeRule.type, 'flat');
  assert.equal(restoredT1.lateFeeRule.flatAmount, 50);

  const restoredT2 = restoredTenants.find(t => t.id === tenant2.id);
  assert.ok(restoredT2);
  assert.equal(restoredT2.lateFeeRule.type, 'daily');
  assert.equal(restoredT2.lateFeeRule.dailyRate, 10);

  const restoredP2 = restoredPayments.find(p => p.receiptNumber === 'RR-2026-0002');
  assert.ok(restoredP2);
  assert.equal(restoredP2.amount, 1250);
  assert.equal(restoredP2.lateFeeAssessed, 50);
  assert.equal(restoredP2.method, 'check');
});

test('Schema validation rejects malformed backup JSON payloads', async () => {
  await assert.rejects(async () => {
    await importAllData(null);
  }, /Invalid backup file/);

  await assert.rejects(async () => {
    await importAllData({ foo: 'bar' });
  }, /Missing tenants or payments array/);
});

console.log(`✅ All ${passed} Export / Import tests passed!\n`);
