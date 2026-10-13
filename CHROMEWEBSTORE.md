# Chrome Web Store Listing: RentReceipt

*Last Updated: 2026-10-12*  
*Version: 1.0.0*  
*Status: Ready for upload when developer account publication queue opens (Draft stage)*  

---

## 1. Store Metadata

- **Extension Name:** RentReceipt - Rent Receipts & Landlord Ledger
- **Summary / Short Description (max 132 chars):**  
  `100% private, local rent receipts, tenant ledgers, late-fee calculation, and year-end tax summaries for small landlords.` (113 chars)
- **Category:** Productivity / Workflow & Planning
- **Language:** English (United States)
- **Pricing:** Free (Zero paywalls, no accounts, no subscriptions)
- **Support / Website URL:** `https://github.com/CKosick/rentreceipt`

---

## 2. Detailed Store Description

```markdown
Rent receipts, tenant ledgers, late fees, and year-end tax totals—built specifically for small landlords who value privacy. 100% offline and stored exclusively on your device.

Tired of scrambling at tax time through bank statements and paper checks? Tired of expensive landlord SaaS tools that store your sensitive tenant names and rental income on third-party servers?

RentReceipt gives independent landlords a private, reliable toolkit that runs entirely inside your browser. No accounts to create, no monthly subscriptions, and zero data leaving your machine.

KEY FEATURES:

✓ PROFESSIONAL 1-CLICK PDF RECEIPTS
Generate clean, official PDF rent receipts with a single click right after recording a payment. Prints crisply and includes landlord contact info, rental unit, payment method, memo, and balance status.

✓ CONFIGURABLE LATE-FEE CALCULATOR
Configure tenant-specific rent due dates, grace periods, and late-fee policies (both flat fee and daily rate rules). The calculator automatically detects whether rent is on time or overdue and calculates the exact amount due.

✓ PER-TENANT TRANSACTION LEDGERS
View complete chronological statements for any tenant: scheduled monthly rent, late fees assessed, payments received, and running account balances.

✓ YEAR-END TAX SUMMARIES
Tax season made painless: instantly calculate total rental income collected per tenant and per unit across any tax year. Export clean CSV reports directly to your accountant or print a formatted summary report.

✓ 100% PRIVATE & OFFLINE (ZERO NETWORK CALLS)
Your financial data is strictly your business. RentReceipt contains zero outbound network calls—no fetch, no XMLHttpRequest, no tracking beacons, and no analytics. All records are stored locally in your browser's IndexedDB.

✓ ZERO VENDOR LOCK-IN (JSON BACKUP & RESTORE)
Export your complete records to a standardized JSON backup at any time. Move between machines or archive backups with full confidence.

PERMISSIONS DISCLOSURE:
RentReceipt requires ZERO browser permissions. It does not request access to your browsing history, tabs, web pages, or storage permissions.

Open source and verified under the MIT License.
```

---

## 3. Permissions Justification

| Permission | Scope | Technical Justification |
| :--- | :--- | :--- |
| **None** (`"permissions": []`) | None | RentReceipt operates 100% locally using standard web APIs (IndexedDB, Blob URLs, Canvas). Zero special browser permissions are required or requested. |

---

## 4. Privacy & Data Use Disclosure

- **Does this extension collect or transmit user data?**  
  **No.** RentReceipt collects, transmits, and processes zero user data on remote servers.
- **Single Purpose Description:**  
  Manage rental payment records, calculate late fees, generate client-side PDF receipts, and export year-end tax summaries for small landlords with 100% local-only storage.
- **Data Categories Collected:** None. All data is kept strictly on local client device storage (IndexedDB).
- **Remote Code Policy:** 100% compliant with Manifest V3. No externally hosted code or CDNs are loaded; all libraries (jsPDF) are bundled locally in the extension package.

---

## 5. Store Assets

- **Icons:**
  - `icons/icon-16.png` (16×16 px)
  - `icons/icon-48.png` (48×48 px)
  - `icons/icon-128.png` (128×128 px)
- **Screenshots (1280×800 px, Sample Data Only):**
  - `store-assets/screenshot-1-payments.png`: Payments table & 1-click PDF receipts
  - `store-assets/screenshot-2-calculator.png`: Live automatic late-fee calculator
  - `store-assets/screenshot-3-tax-summary.png`: Year-end tax summary & CSV export

---

## 6. Version History

- **v1.0.0 (2026-10-12):**  
  - Initial MVP build.
  - Tenant and unit profiles with configurable late fee rules (flat and daily).
  - One-click client-side PDF receipt generation with bundled jsPDF.
  - Per-tenant ledgers with running balances.
  - Year-end tax summary grouped by tenant and unit with CSV export.
  - Full JSON backup export and import.
  - Zero outbound network requests verified via automated audit.
