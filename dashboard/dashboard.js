/**
 * RentReceipt Dashboard Controller
 * 100% Client-Side. Pure IndexedDB Storage. Zero Network Code.
 */

import {
  formatCurrency,
  toCents,
  fromCents,
  calculateLateFee,
  computeLedger,
  generateYearEndSummary
} from '../shared/calculator.js';

import {
  getTenants,
  getTenant,
  saveTenant,
  deleteTenant,
  getPayments,
  savePayment,
  deletePayment,
  getSettings,
  saveSettings,
  exportAllData,
  importAllData
} from '../shared/storage.js';

import { downloadReceiptPdf } from '../shared/pdf-generator.js';

// State cache
let cachedTenants = [];
let cachedPayments = [];
let cachedSettings = {};

// DOM Elements
const navItems = document.querySelectorAll('.nav-item');
const tabViews = document.querySelectorAll('.tab-view');
const pageTitle = document.getElementById('page-title');
const pageSubtitle = document.getElementById('page-subtitle');

// Modals
const modalRecordPayment = document.getElementById('modal-record-payment');
const modalTenant = document.getElementById('modal-tenant');

// Forms
const formRecordPayment = document.getElementById('form-record-payment');
const formTenant = document.getElementById('form-tenant');
const formSettings = document.getElementById('form-settings');

// Inputs for Payment Form
const payTenantSelect = document.getElementById('pay-tenant-id');
const payDueDateInput = document.getElementById('pay-due-date');
const payDateInput = document.getElementById('pay-date');
const payBaseRentInput = document.getElementById('pay-base-rent');
const payLateFeeInput = document.getElementById('pay-late-fee');
const payAmountInput = document.getElementById('pay-amount');
const payMethodSelect = document.getElementById('pay-method');
const payPeriodInput = document.getElementById('pay-period');
const payMemoInput = document.getElementById('pay-memo');

// Live Calculator Preview Elements
const calcStatusBadge = document.getElementById('calc-status-badge');
const calcRuleText = document.getElementById('calc-rule-text');
const calcFeeAmount = document.getElementById('calc-fee-amount');

// Tenant Form Elements
const tenantIdInput = document.getElementById('tenant-id');
const tenantNameInput = document.getElementById('tenant-name');
const tenantUnitInput = document.getElementById('tenant-unit');
const tenantRentInput = document.getElementById('tenant-rent');
const tenantDueDayInput = document.getElementById('tenant-due-day');
const tenantGraceInput = document.getElementById('tenant-grace');
const tenantRuleTypeSelect = document.getElementById('tenant-rule-type');
const ruleFlatGroup = document.getElementById('rule-flat-group');
const ruleDailyGroup = document.getElementById('rule-daily-group');
const tenantRuleFlatInput = document.getElementById('tenant-rule-flat');
const tenantRuleDailyInput = document.getElementById('tenant-rule-daily');

// Initialize Dashboard
document.addEventListener('DOMContentLoaded', async () => {
  setupNavigation();
  setupModals();
  setupForms();
  setupBackupRestore();
  await refreshAllData();
});

// Setup Tab Navigation
function setupNavigation() {
  const titles = {
    payments: { title: 'Payments & Receipts', sub: 'Record rent, calculate late fees, and issue PDF receipts.' },
    tenants: { title: 'Tenants & Units', sub: 'Manage unit profiles, rental rates, and late fee policies.' },
    ledger: { title: 'Tenant Ledgers', sub: 'Complete historical transaction and running balance statement.' },
    yearend: { title: 'Year-End Tax Summary', sub: 'Consolidated rental income and fee breakdown for tax time.' },
    settings: { title: 'Settings & Local Backup', sub: 'Configure landlord profile and download local JSON backups.' }
  };

  navItems.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTab = btn.getAttribute('data-tab');
      navItems.forEach(i => i.classList.remove('active'));
      tabViews.forEach(v => v.classList.remove('active'));

      btn.classList.add('active');
      const targetView = document.getElementById(`tab-${targetTab}`);
      if (targetView) targetView.classList.add('active');

      if (titles[targetTab]) {
        pageTitle.textContent = titles[targetTab].title;
        pageSubtitle.textContent = titles[targetTab].sub;
      }

      if (targetTab === 'ledger') renderLedgerView();
      if (targetTab === 'yearend') renderYearEndView();
    });
  });
}

// Refresh Data from IndexedDB
async function refreshAllData() {
  const [tenants, payments, settings] = await Promise.all([
    getTenants(),
    getPayments(),
    getSettings()
  ]);

  cachedTenants = tenants;
  cachedPayments = payments;
  cachedSettings = settings;

  renderStats();
  renderPaymentsTable();
  renderTenantsTable();
  populateTenantDropdowns();
  populateSettingsForm();
}

// Render Top Stats
function renderStats() {
  const currentMonth = new Date().toISOString().slice(0, 7);
  let monthCollectedCents = 0;

  cachedPayments.forEach(p => {
    if (p.date && p.date.startsWith(currentMonth)) {
      monthCollectedCents += toCents(p.amount);
    }
  });

  const statMonth = document.getElementById('stat-month-collected');
  if (statMonth) statMonth.textContent = formatCurrency(fromCents(monthCollectedCents));

  const statTenants = document.getElementById('stat-active-tenants');
  if (statTenants) statTenants.textContent = cachedTenants.length;

  const statReceipts = document.getElementById('stat-total-receipts');
  if (statReceipts) statReceipts.textContent = cachedPayments.length;
}

// Render Payments Table
function renderPaymentsTable() {
  const tbody = document.getElementById('payments-table-body');
  if (!tbody) return;

  const searchTerm = (document.getElementById('payment-search')?.value || '').toLowerCase().trim();

  const filtered = cachedPayments.filter(p => {
    if (!searchTerm) return true;
    return (
      (p.receiptNumber || '').toLowerCase().includes(searchTerm) ||
      (p.tenantName || '').toLowerCase().includes(searchTerm) ||
      (p.unit || '').toLowerCase().includes(searchTerm) ||
      (p.memo || '').toLowerCase().includes(searchTerm)
    );
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" class="text-center py-4 text-muted">No payments found.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(p => {
    const lateFee = Number(p.lateFeeAssessed || 0);
    const rentPart = Math.max(0, Number(p.amount) - lateFee);
    const lateFeeBadge = lateFee > 0
      ? `<span class="badge-danger">${formatCurrency(lateFee)}</span>`
      : `<span class="badge-neutral">$0.00</span>`;

    return `
      <tr>
        <td><strong>${p.receiptNumber || 'RR-0000'}</strong></td>
        <td>${p.date || '—'}</td>
        <td>${p.tenantName || '—'}</td>
        <td>${p.unit || '—'}</td>
        <td><span class="badge-neutral">${(p.method || 'direct').toUpperCase()}</span></td>
        <td>${formatCurrency(rentPart)}</td>
        <td>${lateFeeBadge}</td>
        <td><strong>${formatCurrency(p.amount)}</strong></td>
        <td>
          <button class="btn btn-secondary btn-sm btn-download-pdf" data-id="${p.id}" title="Download Official PDF Receipt">
            📄 PDF
          </button>
          <button class="btn btn-secondary btn-sm btn-delete-payment" data-id="${p.id}" title="Delete Payment Record">
            🗑️
          </button>
        </td>
      </tr>
    `;
  }).join('');

  // Attach dynamic button event listeners
  tbody.querySelectorAll('.btn-download-pdf').forEach(btn => {
    btn.addEventListener('click', () => {
      const pId = btn.getAttribute('data-id');
      const payment = cachedPayments.find(p => p.id === pId);
      if (!payment) return;
      const tenant = cachedTenants.find(t => t.id === payment.tenantId) || {};
      downloadReceiptPdf({ payment, tenant, settings: cachedSettings });
    });
  });

  tbody.querySelectorAll('.btn-delete-payment').forEach(btn => {
    btn.addEventListener('click', async () => {
      const pId = btn.getAttribute('data-id');
      if (confirm('Are you sure you want to delete this payment record?')) {
        await deletePayment(pId);
        await refreshAllData();
      }
    });
  });
}

// Render Tenants Table
function renderTenantsTable() {
  const tbody = document.getElementById('tenants-table-body');
  if (!tbody) return;

  if (cachedTenants.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-muted">No tenants added yet.</td></tr>`;
    return;
  }

  tbody.innerHTML = cachedTenants.map(t => {
    const rule = t.lateFeeRule || {};
    const ruleText = rule.type === 'daily'
      ? `Daily: ${formatCurrency(rule.dailyRate || 10)}/day`
      : `Flat: ${formatCurrency(rule.flatAmount || 50)}`;

    return `
      <tr>
        <td><strong>${t.name}</strong></td>
        <td><span class="badge-neutral">${t.unit}</span></td>
        <td><strong>${formatCurrency(t.monthlyRent)}</strong></td>
        <td>Day ${t.dueDayOfMonth || 1}</td>
        <td>${t.gracePeriodDays ?? 5} days</td>
        <td><span class="badge-neutral">${ruleText}</span></td>
        <td>
          <button class="btn btn-secondary btn-sm btn-edit-tenant" data-id="${t.id}">✏️ Edit</button>
          <button class="btn btn-secondary btn-sm btn-delete-tenant" data-id="${t.id}">🗑️</button>
        </td>
      </tr>
    `;
  }).join('');

  tbody.querySelectorAll('.btn-edit-tenant').forEach(btn => {
    btn.addEventListener('click', () => {
      const tId = btn.getAttribute('data-id');
      const tenant = cachedTenants.find(t => t.id === tId);
      if (tenant) openTenantModal(tenant);
    });
  });

  tbody.querySelectorAll('.btn-delete-tenant').forEach(btn => {
    btn.addEventListener('click', async () => {
      const tId = btn.getAttribute('data-id');
      if (confirm('Delete this tenant profile? (Their recorded payments will remain in history).')) {
        await deleteTenant(tId);
        await refreshAllData();
      }
    });
  });
}

// Populate Dropdowns
function populateTenantDropdowns() {
  const paymentSelect = document.getElementById('pay-tenant-id');
  const ledgerSelect = document.getElementById('ledger-tenant-select');

  const optionsHtml = '<option value="">-- Choose Tenant --</option>' +
    cachedTenants.map(t => `<option value="${t.id}">${t.name} (${t.unit})</option>`).join('');

  if (paymentSelect) paymentSelect.innerHTML = optionsHtml;
  if (ledgerSelect) ledgerSelect.innerHTML = optionsHtml;
}

// Live Late Fee Calculation in Record Payment Modal
function updateLateFeePreview() {
  const tenantId = payTenantSelect.value;
  const dueDate = payDueDateInput.value;
  const paymentDate = payDateInput.value;

  if (!tenantId || !dueDate || !paymentDate) {
    calcStatusBadge.className = 'badge-neutral';
    calcStatusBadge.textContent = 'Pending Dates';
    calcRuleText.textContent = 'Select tenant and dates to calculate';
    calcFeeAmount.textContent = '$0.00';
    return;
  }

  const tenant = cachedTenants.find(t => t.id === tenantId);
  const rule = tenant?.lateFeeRule || { type: 'flat', flatAmount: 50, gracePeriodDays: tenant?.gracePeriodDays ?? 5 };

  const calc = calculateLateFee({
    dueDate,
    paymentDate,
    rule,
    gracePeriodDays: tenant?.gracePeriodDays ?? 5
  });

  if (calc.isLate) {
    calcStatusBadge.className = 'badge-danger';
    calcStatusBadge.textContent = `Late (${calc.daysLate}d)`;
    calcRuleText.textContent = calc.ruleDescription;
    calcFeeAmount.textContent = formatCurrency(calc.lateFee);
    payLateFeeInput.value = calc.lateFee.toFixed(2);
  } else {
    calcStatusBadge.className = 'badge-success';
    calcStatusBadge.textContent = 'On Time';
    calcRuleText.textContent = calc.ruleDescription;
    calcFeeAmount.textContent = '$0.00';
    payLateFeeInput.value = '0.00';
  }

  // Update total payment amount
  const baseRent = parseFloat(payBaseRentInput.value) || 0;
  const lateFee = parseFloat(payLateFeeInput.value) || 0;
  payAmountInput.value = (baseRent + lateFee).toFixed(2);
}

// Setup Modals and Triggers
function setupModals() {
  // Open Record Payment
  document.getElementById('btn-quick-record')?.addEventListener('click', () => {
    openRecordPaymentModal();
  });

  // Open New Tenant
  const openTenantHandler = () => openTenantModal();
  document.getElementById('btn-add-tenant-top')?.addEventListener('click', openTenantHandler);
  document.getElementById('btn-add-tenant-page')?.addEventListener('click', openTenantHandler);

  // Close modals
  document.querySelectorAll('.modal-close, .modal-cancel').forEach(btn => {
    btn.addEventListener('click', () => {
      modalRecordPayment.classList.add('hidden');
      modalTenant.classList.add('hidden');
    });
  });

  // Live calculator inputs
  [payTenantSelect, payDueDateInput, payDateInput, payBaseRentInput].forEach(el => {
    el?.addEventListener('change', updateLateFeePreview);
    el?.addEventListener('input', updateLateFeePreview);
  });

  // Pay late fee manual override updates total amount
  payLateFeeInput?.addEventListener('input', () => {
    const baseRent = parseFloat(payBaseRentInput.value) || 0;
    const lateFee = parseFloat(payLateFeeInput.value) || 0;
    payAmountInput.value = (baseRent + lateFee).toFixed(2);
  });

  // Tenant dropdown selection autofills default due date & rent
  payTenantSelect?.addEventListener('change', () => {
    const t = cachedTenants.find(item => item.id === payTenantSelect.value);
    if (t) {
      payBaseRentInput.value = Number(t.monthlyRent || 0).toFixed(2);
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const dueDay = String(t.dueDayOfMonth || 1).padStart(2, '0');
      
      payDueDateInput.value = `${year}-${month}-${dueDay}`;
      if (!payDateInput.value) {
        payDateInput.value = today.toISOString().slice(0, 10);
      }
      if (!payPeriodInput.value) {
        const monthName = today.toLocaleString('default', { month: 'long' });
        payPeriodInput.value = `${monthName} ${year}`;
      }
      updateLateFeePreview();
    }
  });

  // Tenant rule type toggle
  tenantRuleTypeSelect?.addEventListener('change', () => {
    const isDaily = tenantRuleTypeSelect.value === 'daily';
    ruleFlatGroup.classList.toggle('hidden', isDaily);
    ruleDailyGroup.classList.toggle('hidden', !isDaily);
  });

  // Search filter
  document.getElementById('payment-search')?.addEventListener('input', renderPaymentsTable);
}

function openRecordPaymentModal() {
  formRecordPayment.reset();
  const today = new Date();
  payDateInput.value = today.toISOString().slice(0, 10);
  modalRecordPayment.classList.remove('hidden');
}

function openTenantModal(tenant = null) {
  formTenant.reset();
  if (tenant) {
    document.getElementById('modal-tenant-title').textContent = 'Edit Tenant Profile';
    tenantIdInput.value = tenant.id;
    tenantNameInput.value = tenant.name;
    tenantUnitInput.value = tenant.unit;
    tenantRentInput.value = tenant.monthlyRent;
    tenantDueDayInput.value = tenant.dueDayOfMonth || 1;
    tenantGraceInput.value = tenant.gracePeriodDays ?? 5;
    
    const rule = tenant.lateFeeRule || {};
    tenantRuleTypeSelect.value = rule.type || 'flat';
    tenantRuleFlatInput.value = rule.flatAmount ?? 50.00;
    tenantRuleDailyInput.value = rule.dailyRate ?? 10.00;
    
    const isDaily = tenantRuleTypeSelect.value === 'daily';
    ruleFlatGroup.classList.toggle('hidden', isDaily);
    ruleDailyGroup.classList.toggle('hidden', !isDaily);
  } else {
    document.getElementById('modal-tenant-title').textContent = 'Add New Tenant Profile';
    tenantIdInput.value = '';
    tenantDueDayInput.value = 1;
    tenantGraceInput.value = 5;
    tenantRuleTypeSelect.value = 'flat';
    tenantRuleFlatInput.value = '50.00';
    ruleFlatGroup.classList.remove('hidden');
    ruleDailyGroup.classList.add('hidden');
  }
  modalTenant.classList.remove('hidden');
}

// Setup Forms (Submit Handlers)
function setupForms() {
  // Save Payment
  formRecordPayment.addEventListener('submit', async (e) => {
    e.preventDefault();

    const tenantId = payTenantSelect.value;
    const tenant = cachedTenants.find(t => t.id === tenantId);
    if (!tenant) {
      alert('Please select a valid tenant');
      return;
    }

    const totalAmount = parseFloat(payAmountInput.value);
    const lateFee = parseFloat(payLateFeeInput.value) || 0;
    const paymentDate = payDateInput.value;

    const payment = {
      tenantId,
      tenantName: tenant.name,
      unit: tenant.unit,
      date: paymentDate,
      amount: totalAmount,
      lateFeeAssessed: lateFee,
      method: payMethodSelect.value,
      rentalPeriod: payPeriodInput.value || paymentDate.slice(0, 7),
      memo: payMemoInput.value || ''
    };

    const saved = await savePayment(payment);
    modalRecordPayment.classList.add('hidden');
    await refreshAllData();

    // Instant One-Click PDF Receipt generation & download
    downloadReceiptPdf({ payment: saved, tenant, settings: cachedSettings });
  });

  // Save Tenant
  formTenant.addEventListener('submit', async (e) => {
    e.preventDefault();

    const isDaily = tenantRuleTypeSelect.value === 'daily';
    const lateFeeRule = {
      type: tenantRuleTypeSelect.value,
      gracePeriodDays: parseInt(tenantGraceInput.value, 10) || 0,
      flatAmount: isDaily ? undefined : (parseFloat(tenantRuleFlatInput.value) || 0),
      dailyRate: isDaily ? (parseFloat(tenantRuleDailyInput.value) || 0) : undefined
    };

    const tenant = {
      id: tenantIdInput.value || undefined,
      name: tenantNameInput.value.trim(),
      unit: tenantUnitInput.value.trim(),
      monthlyRent: parseFloat(tenantRentInput.value) || 0,
      dueDayOfMonth: parseInt(tenantDueDayInput.value, 10) || 1,
      gracePeriodDays: parseInt(tenantGraceInput.value, 10) || 0,
      lateFeeRule
    };

    await saveTenant(tenant);
    modalTenant.classList.add('hidden');
    await refreshAllData();
  });

  // Save Settings
  formSettings.addEventListener('submit', async (e) => {
    e.preventDefault();
    const updated = {
      landlordName: document.getElementById('set-landlord-name').value.trim(),
      propertyAddress: document.getElementById('set-property-address').value.trim(),
      landlordPhone: document.getElementById('set-landlord-phone').value.trim(),
      landlordEmail: document.getElementById('set-landlord-email').value.trim(),
      receiptNotes: document.getElementById('set-receipt-notes').value.trim()
    };
    cachedSettings = await saveSettings(updated);
    alert('Landlord business settings saved locally.');
  });
}

function populateSettingsForm() {
  document.getElementById('set-landlord-name').value = cachedSettings.landlordName || '';
  document.getElementById('set-property-address').value = cachedSettings.propertyAddress || '';
  document.getElementById('set-landlord-phone').value = cachedSettings.landlordPhone || '';
  document.getElementById('set-landlord-email').value = cachedSettings.landlordEmail || '';
  document.getElementById('set-receipt-notes').value = cachedSettings.receiptNotes || '';
}

// Render Ledger View
function renderLedgerView() {
  const ledgerSelect = document.getElementById('ledger-tenant-select');
  const tenantId = ledgerSelect.value;
  const tbody = document.getElementById('ledger-table-body');

  if (!tenantId) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-muted">Select a tenant above to view their full ledger.</td></tr>`;
    document.getElementById('ledger-monthly-rent').textContent = '$0.00';
    document.getElementById('ledger-total-paid').textContent = '$0.00';
    document.getElementById('ledger-total-late-fees').textContent = '$0.00';
    document.getElementById('ledger-current-balance').textContent = '$0.00';
    return;
  }

  const tenant = cachedTenants.find(t => t.id === tenantId);
  const tenantPayments = cachedPayments.filter(p => p.tenantId === tenantId);

  // Synthesize ledger events from tenant's payment records & scheduled rent charges
  const entries = [];
  
  tenantPayments.forEach(p => {
    const lateFee = Number(p.lateFeeAssessed || 0);
    const rentPart = Math.max(0, Number(p.amount) - lateFee);

    // Charge line for monthly rent
    entries.push({
      type: 'rent',
      date: p.date,
      amount: rentPart,
      description: `Rent Accrual - ${p.rentalPeriod || p.date}`
    });

    // If late fee was assessed, add charge entry
    if (lateFee > 0) {
      entries.push({
        type: 'late_fee',
        date: p.date,
        amount: lateFee,
        description: `Late Fee Assessed (${p.rentalPeriod || p.date})`
      });
    }

    // Payment entry
    entries.push({
      type: 'payment',
      date: p.date,
      amount: Number(p.amount),
      description: `Payment Received (${(p.method || 'direct').toUpperCase()}${p.memo ? ' - ' + p.memo : ''})`,
      receiptNumber: p.receiptNumber,
      paymentRecord: p
    });
  });

  // Sort chronological
  entries.sort((a, b) => a.date.localeCompare(b.date));

  const ledgerResult = computeLedger(entries);

  document.getElementById('ledger-monthly-rent').textContent = formatCurrency(tenant?.monthlyRent || 0);
  document.getElementById('ledger-total-paid').textContent = formatCurrency(ledgerResult.summary.totalPayments);
  document.getElementById('ledger-total-late-fees').textContent = formatCurrency(ledgerResult.summary.totalLateFees);
  document.getElementById('ledger-current-balance').textContent = formatCurrency(ledgerResult.summary.currentBalance);

  if (ledgerResult.entries.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-muted">No transactions recorded for ${tenant?.name}.</td></tr>`;
    return;
  }

  tbody.innerHTML = ledgerResult.entries.map(e => {
    const isPayment = e.type === 'payment';
    const typeBadge = isPayment
      ? `<span class="badge-success">Payment</span>`
      : (e.type === 'late_fee' ? `<span class="badge-danger">Late Fee</span>` : `<span class="badge-neutral">Rent Charge</span>`);

    const amountFormatted = isPayment
      ? `<span style="color: #059669;">-${formatCurrency(e.amount)}</span>`
      : `<span style="color: #1E3A8A;">+${formatCurrency(e.amount)}</span>`;

    const receiptBtn = e.paymentRecord
      ? `<button class="btn btn-secondary btn-sm btn-ledger-pdf" data-id="${e.paymentRecord.id}">📄 PDF</button>`
      : '—';

    return `
      <tr>
        <td>${e.date}</td>
        <td>${typeBadge}</td>
        <td>${e.description}</td>
        <td><strong>${amountFormatted}</strong></td>
        <td><strong>${formatCurrency(e.runningBalance)}</strong></td>
        <td>${receiptBtn}</td>
      </tr>
    `;
  }).join('');

  tbody.querySelectorAll('.btn-ledger-pdf').forEach(btn => {
    btn.addEventListener('click', () => {
      const pId = btn.getAttribute('data-id');
      const payment = cachedPayments.find(p => p.id === pId);
      if (payment) {
        downloadReceiptPdf({ payment, tenant, settings: cachedSettings });
      }
    });
  });
}

document.getElementById('ledger-tenant-select')?.addEventListener('change', renderLedgerView);

// Render Year-End Tax Summary
function renderYearEndView() {
  const yearSelect = document.getElementById('tax-year-select');
  const years = new Set([new Date().getFullYear()]);
  cachedPayments.forEach(p => {
    if (p.date) years.add(Number(p.date.slice(0, 4)));
  });

  const sortedYears = Array.from(years).sort((a, b) => b - a);
  const currentSelectedYear = yearSelect.value || String(sortedYears[0]);

  yearSelect.innerHTML = sortedYears.map(y => `<option value="${y}" ${String(y) === String(currentSelectedYear) ? 'selected' : ''}>${y}</option>`).join('');

  const targetYear = Number(yearSelect.value);
  const taxSummary = generateYearEndSummary(cachedPayments, cachedTenants, targetYear);

  document.getElementById('tax-total-gross').textContent = formatCurrency(taxSummary.summary.totalCollected);
  document.getElementById('tax-total-rent').textContent = formatCurrency(taxSummary.summary.totalRentCollected);
  document.getElementById('tax-total-late-fees').textContent = formatCurrency(taxSummary.summary.totalLateFeesCollected);

  const tbody = document.getElementById('tax-unit-table-body');
  if (taxSummary.byTenant.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-muted">No rental payments recorded for ${targetYear}.</td></tr>`;
    return;
  }

  tbody.innerHTML = taxSummary.byTenant.map(row => `
    <tr>
      <td><strong>${row.unit}</strong></td>
      <td>${row.tenantName}</td>
      <td>${row.paymentCount} payments</td>
      <td>${row.monthsPaidCount} months</td>
      <td>${formatCurrency(row.rentCollected)}</td>
      <td>${formatCurrency(row.lateFeesCollected)}</td>
      <td><strong>${formatCurrency(row.totalCollected)}</strong></td>
    </tr>
  `).join('');
}

document.getElementById('tax-year-select')?.addEventListener('change', renderYearEndView);

// Print Tax Report
document.getElementById('btn-print-tax')?.addEventListener('click', () => {
  window.print();
});

// Export CSV for Taxes
document.getElementById('btn-export-csv')?.addEventListener('click', () => {
  const targetYear = Number(document.getElementById('tax-year-select').value);
  const summary = generateYearEndSummary(cachedPayments, cachedTenants, targetYear);

  let csv = `RentReceipt Tax Summary - Year ${targetYear}\n`;
  csv += `Generated Locally,${new Date().toISOString()}\n\n`;
  csv += `Unit,Tenant Name,Payments Count,Rent Collected,Late Fees Collected,Total Income\n`;

  summary.byTenant.forEach(r => {
    csv += `"${r.unit}","${r.tenantName}",${r.paymentCount},${r.rentCollected.toFixed(2)},${r.lateFeesCollected.toFixed(2)},${r.totalCollected.toFixed(2)}\n`;
  });

  csv += `\nTotals,,,${summary.summary.totalRentCollected.toFixed(2)},${summary.summary.totalLateFeesCollected.toFixed(2)},${summary.summary.totalCollected.toFixed(2)}\n`;

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `RentReceipt_Tax_Summary_${targetYear}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
});

// Setup JSON Backup & Restore
function setupBackupRestore() {
  // Export JSON
  document.getElementById('btn-export-backup')?.addEventListener('click', async () => {
    const data = await exportAllData();
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const dateStr = new Date().toISOString().slice(0, 10);
    const a = document.createElement('a');
    a.href = url;
    a.download = `RentReceipt_Backup_${dateStr}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });

  // Import JSON
  const importInput = document.getElementById('file-import-backup');
  importInput?.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const parsed = JSON.parse(evt.target.result);
        if (confirm('Restoring this backup will replace current local data. Continue?')) {
          const res = await importAllData(parsed, { mode: 'replace' });
          alert(`Backup restored successfully!\n${res.tenantsRestored} tenants and ${res.paymentsRestored} payments imported.`);
          await refreshAllData();
        }
      } catch (err) {
        alert('Failed to restore backup: ' + err.message);
      } finally {
        importInput.value = '';
      }
    };
    reader.readAsText(file);
  });
}
