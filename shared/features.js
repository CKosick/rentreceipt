/**
 * RentReceipt Feature Flags Architecture
 * 
 * Free MVP: All core features unlocked by default.
 * Pro feature seams are defined cleanly here as inactive flags without paywalls or license checks.
 */

export const FEATURE_FLAGS = Object.freeze({
  // Core MVP Features (Enabled)
  TENANT_PROFILES: true,
  PAYMENT_RECORDING: true,
  PDF_RECEIPTS: true,
  LATE_FEE_CALCULATOR: true,
  PER_TENANT_LEDGER: true,
  YEAR_END_TAX_SUMMARY: true,
  LOCAL_EXPORT_IMPORT: true,

  // Future Pro Seams (Explicitly Disabled in MVP, No Code / No Paywall)
  CLOUD_SYNC: false,
  BANK_INTEGRATION: false,
  AUTOMATED_REMINDERS: false,
  EXPENSE_TRACKING: false,
  MULTI_USER_COLLABORATION: false
});

/**
 * Check if a feature is enabled
 * @param {string} flag 
 * @returns {boolean}
 */
export function isFeatureEnabled(flag) {
  return Boolean(FEATURE_FLAGS[flag]);
}

/**
 * Returns current tier description for UI status display
 */
export function getTierInfo() {
  return {
    tier: 'MVP_FREE',
    name: 'RentReceipt Standard (Local-First Free Edition)',
    isPro: false,
    privacyGuarantee: '100% Offline. Zero Network Code. Local IndexedDB Only.'
  };
}
