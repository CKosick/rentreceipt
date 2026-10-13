# RentReceipt 🧾

> **100% private, local rent receipts, tenant ledgers, late-fee calculations, and year-end tax summaries for small landlords.**  
> Built as a Chrome Extension with Manifest V3. No cloud, no tracking, zero outbound network code.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Manifest V3](https://img.shields.io/badge/Manifest-V3-success.svg)](manifest.json)
[![Privacy: 100% Local](https://img.shields.io/badge/Privacy-100%25%20Local-emerald.svg)](PRIVACY.md)

---

## Why RentReceipt?

Small independent landlords handle sensitive financial records every month: tenant names, home addresses, payment methods, and annual rental earnings. Most modern software solutions require uploading this sensitive financial data to cloud servers with recurring SaaS subscription fees.

**RentReceipt takes the opposite approach:**
- **Zero data leaves your machine, ever.** All tenant profiles, payment histories, and notes are stored 100% locally in your browser's IndexedDB.
- **Zero outbound network requests.** No `fetch()`, no `XMLHttpRequest`, no `WebSocket`, no `sendBeacon`, and zero analytics or telemetry scripts.
- **Zero permissions required.** RentReceipt requests `"permissions": []`. It cannot inspect your browsing history, tabs, or web activity.
- **Free open-source MVP.** No accounts, no paywalls, no trial limits.

---

## Core Features

- **🏢 Tenant & Unit Profiles:**  
  Manage unit names, monthly rent rates, due days (1–31), grace periods, and custom late-fee policies (both flat fee and daily rate).
- **⚡ Automatic Late-Fee Calculator:**  
  Instantly computes whether rent was paid on time, during a grace period, or late. Computes exact owed penalties per the tenant's configured rule.
- **📄 One-Click Professional PDF Receipts:**  
  Generate and download crisp, official PDF rent receipts right from the browser using a locally bundled client-side library (`jsPDF`).
- **📑 Per-Tenant Transaction Ledgers:**  
  Chronological financial statements displaying scheduled rent charges, assessed late fees, payments received, and running account balances.
- **📊 Year-End Tax Summaries:**  
  Instant tax season totals grouped by unit and tenant. Download accountant-ready CSV files or print clean tax summary statements.
- **💾 JSON Backup & Restore:**  
  Export all data to a single JSON file anytime to back up your records or move between computers with zero vendor lock-in.

---

## Getting Started (Unpacked Development)

1. Clone this repository:
   ```bash
   git clone https://github.com/CKosick/rentreceipt.git
   cd rentreceipt
   ```
2. Vendor bundled dependencies (self-contained, sanitized jsPDF):
   ```bash
   npm install
   npm run vendor
   ```
3. Load in Google Chrome:
   - Navigate to `chrome://extensions`
   - Enable **Developer mode** (top right)
   - Click **Load unpacked**
   - Select the `rentreceipt` repository folder

---

## Automated Test Suite

Run the full automated test suite covering money math precision, late-fee rule shapes, ledger balances, PDF generation, export/import, and privacy network audits:

```bash
npm test
```

### What is tested:
- **Money Math:** Floating-point precision, currency formatting, UTC calendar day differences, flat rules ($50), daily rules ($10/day), grace periods, payment on due date ($0 fee), early payments.
- **Ledger & Tax:** Running balance continuity, partial payments, late fee accrual, overpayments, exact year-end aggregations.
- **PDF Generation:** Valid binary `%PDF-1.3` generation using bundled offline jsPDF.
- **Export / Import:** Clean JSON backup serialization, complete profile restoration, schema validation.
- **HTML Sanitization:** `escapeHtml` neutralizes script injection, tags, quotes, and malicious tenant names.
- **Zero-Network Audit:** Automated source audit across all shipped code ensuring 0 occurrences of `fetch()`, `XMLHttpRequest`, `WebSocket`, `sendBeacon`, or tracking libraries.
- **Manifest V3:** Version 3 compliance, icon paths, and strictly zero permissions.

### Real Browser Automated Load Test

To run the automated browser test that launches Chrome with the unpacked extension, exercises real IndexedDB storage, tests PDF generation, verifies zero console errors, and captures 1280×800 store screenshots:

```bash
npm run test:browser
```

Audit results are written to `test/browser-test.log`.

---

## Packaging for Chrome Web Store

To produce a verified, cross-platform PKZip package for Chrome Web Store upload:

```bash
npm run package
```

This runs both the unit test suite and real browser test, verifies the `0x504B0304` PKZip signature, and generates `dist/rentreceipt-v1.0.0.zip`.

---

## License

MIT License. Copyright (c) 2026 Cliff Kosick. Open source and free for all landlords.
