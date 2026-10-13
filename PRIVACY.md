# Privacy Policy for RentReceipt

**Effective Date:** October 12, 2026  
**Extension:** RentReceipt (Chrome Extension)  
**Version:** 1.0.0  
**License:** MIT  
**Public Repository:** [https://github.com/CKosick/rentreceipt](https://github.com/CKosick/rentreceipt)  

---

## The Core Guarantee: Zero Data Leaves Your Machine

RentReceipt is built on a non-negotiable principle: **a landlord's financial records must never leave their device.**

1. **No External Transmission:** RentReceipt has zero backend servers, zero cloud databases, and zero analytics.
2. **Zero Outbound Network APIs:** The shipped code contains **no `fetch()`**, **no `XMLHttpRequest`**, **no `WebSocket`**, and **no `sendBeacon`**.
3. **100% Local Storage:** All tenant profiles, payment histories, late fee policies, and landlord settings are stored exclusively in your local browser IndexedDB database on your device.
4. **Client-Side PDF Receipts:** Receipts are generated in-memory in your browser using a locally bundled copy of `jsPDF`. No financial numbers or names are ever uploaded to a remote renderer.
5. **Zero Manifest Permissions:** RentReceipt requests zero browser permissions (`"permissions": []`). It cannot read your browsing history, tabs, or web cookies.

---

## Data Portability: No Vendor Lock-In

You own your data completely:
- You can export a full JSON backup of all tenants, payments, and settings at any time with a single click.
- You can import your JSON backup to restore your records on a new computer or browser profile.

---

## Contact & Inquiries

For technical questions or security audits, please review the public open-source code on GitHub or contact the developer:

- **Repository:** [https://github.com/CKosick/rentreceipt](https://github.com/CKosick/rentreceipt)
- **Developer:** Cliff Kosick (`CKosick`)
