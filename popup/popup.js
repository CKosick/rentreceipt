/**
 * RentReceipt Action Popup Controller
 * 100% Local IndexedDB. Zero Network.
 */

import {
  formatCurrency,
  toCents,
  fromCents,
  calculateLateFee
} from '../shared/calculator.js';

import {
  getTenants,
  getPayments,
  savePayment,
  getSettings
} from '../shared/storage.js';

import { downloadReceiptPdf } from '../shared/pdf-generator.js';
import { escapeHtml } from '../shared/escape.js';

let cachedTenants = [];
let cachedPayments = [];
let cachedSettings = {};

const drawer = document.getElementById('popup-drawer');
const btnOpenDrawer = document.getElementById('btn-popup-record');
const btnCloseDrawer = document.getElementById('btn-close-drawer');
const btnCancelDrawer = document.getElementById('btn-cancel-drawer');

const formPayment = document.getElementById('form-popup-payment');
const popTenantSelect = document.getElementById('pop-tenant');
const popDueDate = document.getElementById('pop-due-date');
const popPayDate = document.getElementById('pop-pay-date');
const popRentAmount = document.getElementById('pop-rent-amount');
const popLateFee = document.getElementById('pop-late-fee');
const popTotalPaid = document.getElementById('pop-total-paid');
const popMethod = document.getElementById('pop-method');
const popMemo = document.getElementById('pop-memo');

const popCalcBadge = document.getElementById('pop-calc-badge');
const popCalcText = document.getElementById('pop-calc-text');

document.addEventListener('DOMContentLoaded', async () => {
  setupDrawer();
  setupCalculation();
  await refreshPopupData();
});

async function refreshPopupData() {
  const [tenants, payments, settings] = await Promise.all([
    getTenants(),
    getPayments(),
    getSettings()
  ]);

  cachedTenants = tenants;
  cachedPayments = payments;
  cachedSettings = settings;

  renderSummary();
  renderRecentPayments();
  populateTenantSelect();
}

function renderSummary() {
  const currentMonth = new Date().toISOString().slice(0, 7);
  let monthCents = 0;

  cachedPayments.forEach(p => {
    if (p.date && p.date.startsWith(currentMonth)) {
      monthCents += toCents(p.amount);
    }
  });

  document.getElementById('popup-month-total').textContent = formatCurrency(fromCents(monthCents));
  document.getElementById('popup-tenant-count').textContent = `${cachedTenants.length} Active`;
}

function renderRecentPayments() {
  const container = document.getElementById('popup-payments-list');
  if (cachedPayments.length === 0) {
    container.innerHTML = `<div class="empty-state">No payments recorded yet. Click "+ Record Payment" above.</div>`;
    return;
  }

  const recent = cachedPayments.slice(0, 10);
  container.innerHTML = recent.map(p => {
    const lateFee = Number(p.lateFeeAssessed || 0);
    const feeTag = lateFee > 0 ? `<span class="badge-danger">+$${lateFee.toFixed(2)} Fee</span>` : '';

    return `
      <div class="payment-item">
        <div class="payment-info">
          <span class="payment-title">${escapeHtml(p.tenantName || 'Tenant')} (${escapeHtml(p.unit || 'Unit')})</span>
          <span class="payment-meta">${escapeHtml(p.date)} • ${escapeHtml(p.receiptNumber)}</span>
        </div>
        <div class="payment-right">
          <span class="payment-amount">${formatCurrency(p.amount)} ${feeTag}</span>
          <button class="btn btn-secondary btn-sm btn-pdf" data-id="${escapeHtml(p.id)}">📄 Receipt PDF</button>
        </div>
      </div>
    `;
  }).join('');

  container.querySelectorAll('.btn-pdf').forEach(btn => {
    btn.addEventListener('click', () => {
      const pId = btn.getAttribute('data-id');
      const payment = cachedPayments.find(p => p.id === pId);
      if (payment) {
        const tenant = cachedTenants.find(t => t.id === payment.tenantId) || {};
        downloadReceiptPdf({ payment, tenant, settings: cachedSettings });
      }
    });
  });
}

function populateTenantSelect() {
  if (cachedTenants.length === 0) {
    popTenantSelect.innerHTML = `<option value="">-- No tenants created --</option>`;
    return;
  }

  popTenantSelect.innerHTML = `<option value="">-- Select Tenant --</option>` +
    cachedTenants.map(t => `<option value="${escapeHtml(t.id)}">${escapeHtml(t.name)} (${escapeHtml(t.unit)})</option>`).join('');
}

function setupDrawer() {
  btnOpenDrawer.addEventListener('click', () => {
    if (cachedTenants.length === 0) {
      alert('Please add a tenant first in the Full Tab Dashboard.');
      window.open('../dashboard/dashboard.html');
      return;
    }
    formPayment.reset();
    const today = new Date();
    popPayDate.value = today.toISOString().slice(0, 10);
    drawer.classList.remove('hidden');
  });

  const closeDrawer = () => drawer.classList.add('hidden');
  btnCloseDrawer.addEventListener('click', closeDrawer);
  btnCancelDrawer.addEventListener('click', closeDrawer);

  formPayment.addEventListener('submit', async (e) => {
    e.preventDefault();
    const tenantId = popTenantSelect.value;
    const tenant = cachedTenants.find(t => t.id === tenantId);
    if (!tenant) return;

    const totalAmount = parseFloat(popTotalPaid.value);
    const lateFee = parseFloat(popLateFee.value) || 0;
    const paymentDate = popPayDate.value;

    const payment = {
      tenantId,
      tenantName: tenant.name,
      unit: tenant.unit,
      date: paymentDate,
      amount: totalAmount,
      lateFeeAssessed: lateFee,
      method: popMethod.value,
      rentalPeriod: paymentDate.slice(0, 7),
      memo: popMemo.value || ''
    };

    const saved = await savePayment(payment);
    drawer.classList.add('hidden');
    await refreshPopupData();

    // Instant download
    downloadReceiptPdf({ payment: saved, tenant, settings: cachedSettings });
  });
}

function setupCalculation() {
  popTenantSelect.addEventListener('change', () => {
    const t = cachedTenants.find(item => item.id === popTenantSelect.value);
    if (t) {
      popRentAmount.value = Number(t.monthlyRent || 0).toFixed(2);
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const dueDay = String(t.dueDayOfMonth || 1).padStart(2, '0');
      popDueDate.value = `${year}-${month}-${dueDay}`;
      updateCalc();
    }
  });

  [popDueDate, popPayDate, popRentAmount].forEach(el => {
    el.addEventListener('input', updateCalc);
    el.addEventListener('change', updateCalc);
  });

  popLateFee.addEventListener('input', () => {
    const base = parseFloat(popRentAmount.value) || 0;
    const fee = parseFloat(popLateFee.value) || 0;
    popTotalPaid.value = (base + fee).toFixed(2);
  });
}

function updateCalc() {
  const tenantId = popTenantSelect.value;
  const dueDate = popDueDate.value;
  const payDate = popPayDate.value;

  if (!tenantId || !dueDate || !payDate) {
    popCalcBadge.className = 'badge-neutral';
    popCalcBadge.textContent = 'Dates Needed';
    popCalcText.textContent = '';
    return;
  }

  const tenant = cachedTenants.find(t => t.id === tenantId);
  const rule = tenant?.lateFeeRule || { type: 'flat', flatAmount: 50 };

  const calc = calculateLateFee({
    dueDate,
    paymentDate: payDate,
    rule,
    gracePeriodDays: tenant?.gracePeriodDays ?? 5
  });

  if (calc.isLate) {
    popCalcBadge.className = 'badge-danger';
    popCalcBadge.textContent = `Late (${calc.daysLate}d)`;
    popCalcText.textContent = calc.ruleDescription;
    popLateFee.value = calc.lateFee.toFixed(2);
  } else {
    popCalcBadge.className = 'badge-success';
    popCalcBadge.textContent = 'On Time';
    popCalcText.textContent = calc.ruleDescription;
    popLateFee.value = '0.00';
  }

  const base = parseFloat(popRentAmount.value) || 0;
  const fee = parseFloat(popLateFee.value) || 0;
  popTotalPaid.value = (base + fee).toFixed(2);
}
