/**
 * RentReceipt Money Math & Calculations Engine
 * 100% pure functions, deterministic, zero network, zero floating-point drift.
 */

/**
 * Convert dollar amount to integer cents to avoid floating-point drift.
 * @param {number|string} amount 
 * @returns {number} Integer cents
 */
export function toCents(amount) {
  if (amount === null || amount === undefined || amount === '') return 0;
  const num = typeof amount === 'number' ? amount : parseFloat(String(amount).replace(/[^0-9.-]/g, ''));
  if (isNaN(num)) return 0;
  return Math.round(num * 100);
}

/**
 * Convert integer cents back to standard dollar float.
 * @param {number} cents 
 * @returns {number}
 */
export function fromCents(cents) {
  if (!Number.isFinite(cents)) return 0;
  return Math.round(cents) / 100;
}

/**
 * Format currency with 2 decimal places and optional symbol.
 * @param {number|string} amount 
 * @param {string} symbol Default '$'
 * @returns {string} e.g. "$1,250.00"
 */
export function formatCurrency(amount, symbol = '$') {
  const cents = toCents(amount);
  const isNegative = cents < 0;
  const absCents = Math.abs(cents);
  const dollars = Math.floor(absCents / 100);
  const remainder = absCents % 100;
  const formattedDollars = dollars.toLocaleString('en-US');
  const formattedCents = remainder.toString().padStart(2, '0');
  const sign = isNegative ? '-' : '';
  return `${sign}${symbol}${formattedDollars}.${formattedCents}`;
}

/**
 * Calculate difference in whole calendar days between two YYYY-MM-DD dates (d2 - d1).
 * @param {string} date1 YYYY-MM-DD
 * @param {string} date2 YYYY-MM-DD
 * @returns {number} Days difference (positive if date2 is after date1)
 */
export function calendarDaysBetween(date1, date2) {
  if (!date1 || !date2) return 0;
  const [y1, m1, d1] = date1.split('-').map(Number);
  const [y2, m2, d2] = date2.split('-').map(Number);
  
  // Use UTC to prevent daylight saving shifts
  const utc1 = Date.UTC(y1, m1 - 1, d1);
  const utc2 = Date.UTC(y2, m2 - 1, d2);
  
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.floor((utc2 - utc1) / msPerDay);
}

/**
 * Calculate late fee based on tenant rule, due date, and payment date.
 * 
 * Rule shapes:
 * - Flat: { type: 'flat', flatAmount: 50.00, gracePeriodDays: 5 }
 * - Daily: { type: 'daily', dailyRate: 10.00, gracePeriodDays: 5, chargeFromDueDate: false }
 * 
 * @param {Object} options
 * @param {string} options.dueDate YYYY-MM-DD
 * @param {string} options.paymentDate YYYY-MM-DD
 * @param {Object} options.rule
 * @param {number} [options.gracePeriodDays]
 * @returns {Object} { isLate: boolean, daysLate: number, calendarDaysDiff: number, lateFee: number, ruleDescription: string }
 */
export function calculateLateFee({ dueDate, paymentDate, rule = {}, gracePeriodDays = 0 }) {
  if (!dueDate || !paymentDate) {
    return { isLate: false, daysLate: 0, calendarDaysDiff: 0, lateFee: 0, ruleDescription: 'No dates provided' };
  }

  const diffDays = calendarDaysBetween(dueDate, paymentDate);
  const effectiveGrace = Number.isInteger(rule.gracePeriodDays) ? rule.gracePeriodDays : (gracePeriodDays || 0);

  // If paid on or before due date, or within grace period
  if (diffDays <= effectiveGrace) {
    return {
      isLate: false,
      daysLate: 0,
      calendarDaysDiff: diffDays,
      lateFee: 0,
      ruleDescription: diffDays <= 0 ? 'Paid on time or early' : `Paid within ${effectiveGrace}-day grace period`
    };
  }

  const ruleType = (rule.type || 'flat').toLowerCase();
  
  if (ruleType === 'flat') {
    const flatAmount = fromCents(toCents(rule.flatAmount ?? 50));
    const daysLate = diffDays - effectiveGrace;
    return {
      isLate: true,
      daysLate,
      calendarDaysDiff: diffDays,
      lateFee: flatAmount,
      ruleDescription: `Flat fee of ${formatCurrency(flatAmount)} (${daysLate} days past grace period)`
    };
  }

  if (ruleType === 'daily') {
    const dailyRateCents = toCents(rule.dailyRate ?? 10);
    // If chargeFromDueDate is true, daily fee applies for all days past due date;
    // otherwise, applies for days past the grace period.
    const daysLate = rule.chargeFromDueDate ? diffDays : (diffDays - effectiveGrace);
    const lateFeeCents = Math.max(0, daysLate * dailyRateCents);
    const lateFee = fromCents(lateFeeCents);
    const dailyRate = fromCents(dailyRateCents);
    return {
      isLate: true,
      daysLate,
      calendarDaysDiff: diffDays,
      lateFee,
      ruleDescription: `${formatCurrency(dailyRate)}/day × ${daysLate} days = ${formatCurrency(lateFee)}`
    };
  }

  return {
    isLate: false,
    daysLate: 0,
    calendarDaysDiff: diffDays,
    lateFee: 0,
    ruleDescription: 'No valid late fee rule'
  };
}

/**
 * Compute ledger running balances for a tenant.
 * @param {Array} entries Sorted chronological ledger entries
 * Entries can be charges { type: 'rent'|'late_fee', date, amount, description }
 * or payments { type: 'payment', date, amount, method, receiptNumber }
 * @returns {Array} Entries annotated with running balance and summary
 */
export function computeLedger(entries = []) {
  let runningBalanceCents = 0;
  let totalChargesCents = 0;
  let totalPaymentsCents = 0;
  let totalLateFeesCents = 0;

  const annotated = entries.map((entry) => {
    const entryCents = toCents(entry.amount);
    const isPayment = entry.type === 'payment';
    const isLateFee = entry.type === 'late_fee';

    if (isPayment) {
      totalPaymentsCents += entryCents;
      runningBalanceCents -= entryCents;
    } else {
      totalChargesCents += entryCents;
      runningBalanceCents += entryCents;
      if (isLateFee) {
        totalLateFeesCents += entryCents;
      }
    }

    return {
      ...entry,
      amount: fromCents(entryCents),
      runningBalance: fromCents(runningBalanceCents)
    };
  });

  return {
    entries: annotated,
    summary: {
      totalCharges: fromCents(totalChargesCents),
      totalPayments: fromCents(totalPaymentsCents),
      totalLateFees: fromCents(totalLateFeesCents),
      currentBalance: fromCents(runningBalanceCents),
      isPaidInFull: runningBalanceCents <= 0
    }
  };
}

/**
 * Generate year-end summary breakdown for tax preparation.
 * @param {Array} payments List of all payment records
 * @param {Array} tenants List of tenant profiles
 * @param {number|string} year Target tax year (e.g. 2026)
 * @returns {Object} Year-end summary object
 */
export function generateYearEndSummary(payments = [], tenants = [], year) {
  const targetYearStr = String(year);
  const tenantMap = new Map();
  tenants.forEach(t => tenantMap.set(t.id, t));

  // Filter payments for target tax year
  const yearPayments = payments.filter(p => {
    if (!p.date) return false;
    return p.date.startsWith(`${targetYearStr}-`);
  });

  const tenantTotals = {};
  const unitTotals = {};
  const methodTotals = {
    cash: 0,
    check: 0,
    transfer: 0,
    other: 0
  };

  let grandTotalCents = 0;
  let totalRentCents = 0;
  let totalLateFeeCents = 0;

  yearPayments.forEach(p => {
    const totalPaidCents = toCents(p.amount);
    const lateFeeCents = toCents(p.lateFeeAssessed || 0);
    // Rent portion is total paid minus late fee portion, or base amount
    const rentPaidCents = Math.max(0, totalPaidCents - lateFeeCents);

    grandTotalCents += totalPaidCents;
    totalRentCents += rentPaidCents;
    totalLateFeeCents += lateFeeCents;

    // Method breakdown
    const rawMethod = (p.method || 'other').toLowerCase();
    const method = methodTotals[rawMethod] !== undefined ? rawMethod : 'other';
    methodTotals[method] += totalPaidCents;

    // Tenant breakdown
    const tId = p.tenantId || 'unassigned';
    const tenant = tenantMap.get(tId) || { name: p.tenantName || 'Unknown Tenant', unit: p.unit || 'Unknown Unit' };
    
    if (!tenantTotals[tId]) {
      tenantTotals[tId] = {
        tenantId: tId,
        tenantName: tenant.name,
        unit: tenant.unit,
        paymentCount: 0,
        rentCollectedCents: 0,
        lateFeesCollectedCents: 0,
        totalCollectedCents: 0,
        monthsPaid: new Set()
      };
    }
    tenantTotals[tId].paymentCount += 1;
    tenantTotals[tId].rentCollectedCents += rentPaidCents;
    tenantTotals[tId].lateFeesCollectedCents += lateFeeCents;
    tenantTotals[tId].totalCollectedCents += totalPaidCents;
    if (p.date) {
      tenantTotals[tId].monthsPaid.add(p.date.slice(0, 7)); // YYYY-MM
    }

    // Unit breakdown
    const unitKey = tenant.unit || 'Unknown Unit';
    if (!unitTotals[unitKey]) {
      unitTotals[unitKey] = {
        unit: unitKey,
        tenantName: tenant.name,
        paymentCount: 0,
        rentCollectedCents: 0,
        lateFeesCollectedCents: 0,
        totalCollectedCents: 0
      };
    }
    unitTotals[unitKey].paymentCount += 1;
    unitTotals[unitKey].rentCollectedCents += rentPaidCents;
    unitTotals[unitKey].lateFeesCollectedCents += lateFeeCents;
    unitTotals[unitKey].totalCollectedCents += totalPaidCents;
  });

  const tenantsSummary = Object.values(tenantTotals).map(t => ({
    tenantId: t.tenantId,
    tenantName: t.tenantName,
    unit: t.unit,
    paymentCount: t.paymentCount,
    monthsPaidCount: t.monthsPaid.size,
    rentCollected: fromCents(t.rentCollectedCents),
    lateFeesCollected: fromCents(t.lateFeesCollectedCents),
    totalCollected: fromCents(t.totalCollectedCents)
  })).sort((a, b) => a.unit.localeCompare(b.unit));

  const unitsSummary = Object.values(unitTotals).map(u => ({
    unit: u.unit,
    tenantName: u.tenantName,
    paymentCount: u.paymentCount,
    rentCollected: fromCents(u.rentCollectedCents),
    lateFeesCollected: fromCents(u.lateFeesCollectedCents),
    totalCollected: fromCents(u.totalCollectedCents)
  })).sort((a, b) => a.unit.localeCompare(b.unit));

  return {
    year: Number(targetYearStr),
    summary: {
      totalCollected: fromCents(grandTotalCents),
      totalRentCollected: fromCents(totalRentCents),
      totalLateFeesCollected: fromCents(totalLateFeeCents),
      totalPaymentsCount: yearPayments.length,
      tenantCount: Object.keys(tenantTotals).length,
      unitCount: Object.keys(unitTotals).length,
      paymentMethods: {
        cash: fromCents(methodTotals.cash),
        check: fromCents(methodTotals.check),
        transfer: fromCents(methodTotals.transfer),
        other: fromCents(methodTotals.other)
      }
    },
    byTenant: tenantsSummary,
    byUnit: unitsSummary
  };
}
