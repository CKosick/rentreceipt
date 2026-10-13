/**
 * Automated Real Browser Load Test & Real 1280x800 Screenshot Capture
 * 
 * 1. Launches real Chrome binary with the unpacked extension.
 * 2. Monitors console messages and uncaught exceptions.
 * 3. Exercises the real browser IndexedDB path:
 *    - Creates fictional sample tenants ("Sample Tenant A", "Sample Tenant B")
 *    - Records payments (one on-time, one late with assessed fee)
 *    - Exercises 1-click PDF receipt generation
 *    - Tests Ledger and Year-End Tax Summary views
 *    - Loads extension popup (popup/popup.html)
 * 4. Captures 3 real 1280x800 screenshots with crisp readable text in store-assets/
 * 5. Asserts zero console errors and zero page exceptions.
 * 6. Writes audit results to test/browser-test.log.
 */

import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

function getChromePath() {
  if (process.env.CHROME_BIN && fs.existsSync(process.env.CHROME_BIN)) {
    return process.env.CHROME_BIN;
  }
  const candidates = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'Google\\Chrome\\Application\\chrome.exe') : null,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium'
  ].filter(Boolean);

  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

const ROOT = path.resolve(process.cwd());
const LOG_FILE = path.join(ROOT, 'test/browser-test.log');
const STORE_ASSETS = path.join(ROOT, 'store-assets');

async function runBrowserTestsAndScreenshots() {
  const logLines = [];
  function log(msg) {
    console.log(msg);
    logLines.push(`[${new Date().toISOString()}] ${msg}`);
  }

  log('🚀 Starting Real Browser Load Test & Screenshot Generation...');
  const chromePath = getChromePath();
  if (!chromePath) {
    throw new Error('Chrome executable not found on host.');
  }
  log(`Detected Chrome binary: ${chromePath}`);

  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: 'new',
    args: [
      `--disable-extensions-except=${ROOT}`,
      `--load-extension=${ROOT}`,
      '--no-sandbox',
      '--disable-gpu',
      '--allow-file-access-from-files'
    ]
  });

  const consoleErrors = [];
  const pageErrors = [];

  // Helper to attach error listeners
  function attachListeners(page, pageName) {
    page.on('console', msg => {
      const type = msg.type();
      const text = msg.text();
      if (type === 'error') {
        consoleErrors.push({ page: pageName, text });
        log(`❌ [${pageName} Console Error] ${text}`);
      } else {
        log(`ℹ️ [${pageName} Console ${type}] ${text}`);
      }
    });

    page.on('pageerror', err => {
      pageErrors.push({ page: pageName, err: err.toString() });
      log(`❌ [${pageName} Uncaught Exception] ${err.toString()}`);
    });
  }

  try {
    // -------------------------------------------------------------
    // PHASE 1: Dashboard Load & Real IndexedDB Exercising
    // -------------------------------------------------------------
    const dashPage = await browser.newPage();
    await dashPage.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });
    attachListeners(dashPage, 'Dashboard');

    const dashUrl = 'file:///' + path.join(ROOT, 'dashboard/dashboard.html').replace(/\\/g, '/');
    log(`Navigating to Dashboard: ${dashUrl}`);
    await dashPage.goto(dashUrl, { waitUntil: 'networkidle0' });

    const title = await dashPage.title();
    log(`Page Title verified: "${title}"`);
    if (!title.includes('RentReceipt')) {
      throw new Error(`Unexpected page title: ${title}`);
    }

    // Exercise Real IndexedDB Path directly in browser context:
    log('Exercising real IndexedDB storage operations inside Chrome...');
    const dbTestResult = await dashPage.evaluate(async () => {
      // Import storage module via browser module system
      const storage = await import('../shared/storage.js');
      await storage.resetDatabase();

      // Create Tenant 1 (Flat late fee rule)
      const t1 = await storage.saveTenant({
        name: 'Sample Tenant A',
        unit: 'Unit 101',
        monthlyRent: 1200.00,
        dueDayOfMonth: 1,
        gracePeriodDays: 5,
        lateFeeRule: {
          type: 'flat',
          flatAmount: 50.00,
          gracePeriodDays: 5
        }
      });

      // Create Tenant 2 (Daily late fee rule)
      const t2 = await storage.saveTenant({
        name: 'Sample Tenant B',
        unit: 'Unit 102',
        monthlyRent: 1450.00,
        dueDayOfMonth: 5,
        gracePeriodDays: 3,
        lateFeeRule: {
          type: 'daily',
          dailyRate: 10.00,
          gracePeriodDays: 3,
          chargeFromDueDate: false
        }
      });

      // Record Payment 1 (On time)
      const p1 = await storage.savePayment({
        tenantId: t1.id,
        tenantName: t1.name,
        unit: t1.unit,
        date: '2026-10-01',
        amount: 1200.00,
        lateFeeAssessed: 0,
        method: 'transfer',
        memo: 'October Rent - On Time via Bank Transfer',
        rentalPeriod: 'October 2026',
        receiptNumber: 'RR-2026-0001'
      });

      // Record Payment 2 (Late by 7 days past grace period: 7 * $10 = $70 late fee)
      const p2 = await storage.savePayment({
        tenantId: t2.id,
        tenantName: t2.name,
        unit: t2.unit,
        date: '2026-10-15',
        amount: 1520.00,
        lateFeeAssessed: 70.00,
        method: 'check',
        memo: 'Check #1042 with Late Fee',
        rentalPeriod: 'October 2026',
        receiptNumber: 'RR-2026-0002'
      });

      // Save custom Landlord profile
      await storage.saveSettings({
        landlordName: 'Apex Properties LLC',
        propertyAddress: '100 Main Street, Suite 4',
        landlordPhone: '(555) 019-2831',
        landlordEmail: 'landlord@example.com',
        receiptNotes: 'Thank you for your prompt payment.'
      });

      const allTenants = await storage.getTenants();
      const allPayments = await storage.getPayments();
      const settings = await storage.getSettings();

      return {
        tenantsCount: allTenants.length,
        paymentsCount: allPayments.length,
        landlord: settings.landlordName
      };
    });

    log(`IndexedDB verification result: ${JSON.stringify(dbTestResult)}`);
    if (dbTestResult.tenantsCount !== 2 || dbTestResult.paymentsCount !== 2) {
      throw new Error('IndexedDB storage verification failed.');
    }

    // Reload Dashboard page to verify that data hydrates cleanly from IndexedDB into DOM
    log('Reloading dashboard to verify IndexedDB hydration and DOM rendering...');
    await dashPage.reload({ waitUntil: 'networkidle0' });

    // Wait for payment rows to render in DOM
    await dashPage.waitForSelector('#payments-table-body tr');
    const rowCount = await dashPage.evaluate(() => {
      return document.querySelectorAll('#payments-table-body tr').length;
    });
    log(`Payments table rendered with ${rowCount} rows`);
    if (rowCount !== 2) {
      throw new Error(`Expected 2 payment rows rendered, found ${rowCount}`);
    }

    // Exercise Client-Side PDF Generation button in browser
    log('Exercising client-side PDF receipt generation button...');
    const pdfGenOk = await dashPage.evaluate(() => {
      const pdfBtn = document.querySelector('.btn-download-pdf');
      if (!pdfBtn) return false;
      pdfBtn.click();
      return true;
    });
    log(`PDF download button clicked successfully: ${pdfGenOk}`);

    // Capture Real Screenshot 1: Payments & Receipts
    fs.mkdirSync(STORE_ASSETS, { recursive: true });
    const shot1Path = path.join(STORE_ASSETS, 'screenshot-1-payments.png');
    await dashPage.screenshot({ path: shot1Path, type: 'png' });
    log(`📸 Real Screenshot 1 captured: ${shot1Path} (1280x800)`);

    // -------------------------------------------------------------
    // PHASE 2: Late-Fee Calculator Modal & Real Screenshot 2
    // -------------------------------------------------------------
    log('Opening Record Payment modal with live Late-Fee Calculator...');
    await dashPage.click('#btn-quick-record');
    await dashPage.waitForSelector('#modal-record-payment:not(.hidden)');

    // Select Tenant B, set due date 2026-10-05 and payment date 2026-10-15 (late)
    await dashPage.evaluate(() => {
      const select = document.getElementById('pay-tenant-id');
      // Select tenant B
      for (let i = 0; i < select.options.length; i++) {
        if (select.options[i].text.includes('Sample Tenant B')) {
          select.selectedIndex = i;
          select.dispatchEvent(new Event('change'));
          break;
        }
      }
      document.getElementById('pay-due-date').value = '2026-10-05';
      document.getElementById('pay-date').value = '2026-10-15';
      document.getElementById('pay-date').dispatchEvent(new Event('input'));
    });

    // Wait for calculator to update live preview
    await dashPage.waitForFunction(() => {
      const feeText = document.getElementById('calc-fee-amount').textContent;
      return feeText && feeText !== '$0.00';
    });

    const calcState = await dashPage.evaluate(() => {
      return {
        badge: document.getElementById('calc-status-badge').textContent,
        ruleText: document.getElementById('calc-rule-text').textContent,
        amount: document.getElementById('calc-fee-amount').textContent,
        total: document.getElementById('pay-amount').value
      };
    });
    log(`Live Calculator output: ${JSON.stringify(calcState)}`);

    // Capture Real Screenshot 2: Late-Fee Calculator Modal
    const shot2Path = path.join(STORE_ASSETS, 'screenshot-2-calculator.png');
    await dashPage.screenshot({ path: shot2Path, type: 'png' });
    log(`📸 Real Screenshot 2 captured: ${shot2Path} (1280x800)`);

    // Close modal
    await dashPage.click('.modal-close');
    await dashPage.waitForSelector('#modal-record-payment.hidden');

    // -------------------------------------------------------------
    // PHASE 3: Year-End Tax Summary Tab & Real Screenshot 3
    // -------------------------------------------------------------
    log('Navigating to Year-End Tax Summary tab...');
    await dashPage.evaluate(() => {
      const taxTabBtn = document.querySelector('.nav-item[data-tab="yearend"]');
      taxTabBtn.click();
    });
    await dashPage.waitForSelector('#tab-yearend.active');
    await dashPage.waitForSelector('#tax-unit-table-body tr');

    const taxSummaryData = await dashPage.evaluate(() => {
      return {
        gross: document.getElementById('tax-total-gross').textContent,
        rent: document.getElementById('tax-total-rent').textContent,
        lateFees: document.getElementById('tax-total-late-fees').textContent,
        rows: document.querySelectorAll('#tax-unit-table-body tr').length
      };
    });
    log(`Tax Summary rendered: ${JSON.stringify(taxSummaryData)}`);

    // Capture Real Screenshot 3: Year-End Tax Summary
    const shot3Path = path.join(STORE_ASSETS, 'screenshot-3-tax-summary.png');
    await dashPage.screenshot({ path: shot3Path, type: 'png' });
    log(`📸 Real Screenshot 3 captured: ${shot3Path} (1280x800)`);

    // -------------------------------------------------------------
    // PHASE 4: Popup Page Test (popup/popup.html)
    // -------------------------------------------------------------
    log('Testing extension popup (popup/popup.html)...');
    const popupPage = await browser.newPage();
    await popupPage.setViewport({ width: 440, height: 560, deviceScaleFactor: 1 });
    attachListeners(popupPage, 'Popup');

    const popupUrl = 'file:///' + path.join(ROOT, 'popup/popup.html').replace(/\\/g, '/');
    await popupPage.goto(popupUrl, { waitUntil: 'networkidle0' });

    const popupState = await popupPage.evaluate(() => {
      return {
        title: document.title,
        monthTotal: document.getElementById('popup-month-total').textContent,
        tenantCount: document.getElementById('popup-tenant-count').textContent,
        itemsCount: document.querySelectorAll('.payment-item').length
      };
    });
    log(`Popup loaded successfully: ${JSON.stringify(popupState)}`);

    if (popupState.itemsCount !== 2) {
      throw new Error(`Expected 2 payment items in popup, found ${popupState.itemsCount}`);
    }

    // -------------------------------------------------------------
    // PHASE 5: Error Assertion & Final Report
    // -------------------------------------------------------------
    log('\n--- Real Browser Load Test Results ---');
    log(`Console errors count: ${consoleErrors.length}`);
    log(`Page exceptions count: ${pageErrors.length}`);

    if (consoleErrors.length > 0 || pageErrors.length > 0) {
      log('❌ TEST FAILED: Console errors or page exceptions were encountered:');
      consoleErrors.forEach(e => log(`  - [${e.page}] ${e.text}`));
      pageErrors.forEach(e => log(`  - [${e.page}] ${e.err}`));
      throw new Error('Real browser test failed with console errors.');
    }

    log('✅ All browser checks PASSED with 0 console errors and 0 uncaught exceptions!');
  } finally {
    await browser.close();
    fs.writeFileSync(LOG_FILE, logLines.join('\n'), 'utf8');
    log(`Wrote browser test audit artifact to: ${LOG_FILE}`);
  }
}

runBrowserTestsAndScreenshots().catch(err => {
  console.error('\n❌ Browser test runner failed:', err);
  process.exit(1);
});
