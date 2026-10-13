/**
 * RentReceipt Client-Side PDF Generator
 * 
 * Generates clean, crisp, professional one-click PDF rent receipts.
 * 100% client-side with bundled jsPDF. Zero CDN, zero network requests.
 */

import { formatCurrency, fromCents, toCents } from './calculator.js';

/**
 * Get jsPDF constructor from global or module
 */
function getJsPdfClass() {
  if (typeof window !== 'undefined' && window.jspdf && window.jspdf.jsPDF) {
    return window.jspdf.jsPDF;
  }
  if (typeof globalThis !== 'undefined' && globalThis.jspdf && globalThis.jspdf.jsPDF) {
    return globalThis.jspdf.jsPDF;
  }
  return null;
}

/**
 * Build a professional PDF receipt document
 * @param {Object} params
 * @param {Object} params.payment Payment record
 * @param {Object} params.tenant Tenant record
 * @param {Object} params.settings Landlord settings
 * @returns {jsPDF} Generated jsPDF instance
 */
export function buildReceiptPdf({ payment, tenant = {}, settings = {} }) {
  const JsPdf = getJsPdfClass();
  if (!JsPdf) {
    throw new Error('jsPDF library is not loaded');
  }

  // Standard Letter page in portrait, points or mm (use mm: 210 x 297 mm)
  const doc = new JsPdf({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = 210;
  const margin = 18;
  const contentWidth = pageWidth - (margin * 2);

  // Styling palette
  const primaryColor = [30, 58, 138];   // Deep Navy #1E3A8A
  const darkTextColor = [31, 41, 55];    // Slate 800 #1F2937
  const mutedTextColor = [100, 116, 139];// Slate 500 #64748B
  const lightBgColor = [248, 250, 252];  // Slate 50 #F8FAFC
  const borderColor = [226, 232, 240];   // Slate 200 #E2E8F0
  const successColor = [16, 185, 129];   // Emerald 500 #10B981

  let y = margin;

  // --- TOP HEADER ACCENT BAR ---
  doc.setFillColor(...primaryColor);
  doc.rect(margin, y, contentWidth, 5, 'F');
  y += 12;

  // --- RECEIPT TITLE & NUMBER ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(...primaryColor);
  doc.text('OFFICIAL RENT RECEIPT', margin, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...mutedTextColor);
  doc.text('Tenant Copy & Landlord Record', margin, y + 5);

  // Receipt Number & Date (Right aligned)
  const receiptNo = payment.receiptNumber || 'RR-0000';
  const receiptDate = payment.date || new Date().toISOString().slice(0, 10);
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...darkTextColor);
  doc.text(`Receipt #: ${receiptNo}`, pageWidth - margin, y, { align: 'right' });
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...mutedTextColor);
  doc.text(`Issued: ${receiptDate}`, pageWidth - margin, y + 5, { align: 'right' });

  y += 16;

  // --- LANDLORD & TENANT INFO BOXES ---
  const boxWidth = (contentWidth - 6) / 2;
  const boxHeight = 34;

  // Landlord Box
  doc.setFillColor(...lightBgColor);
  doc.setDrawColor(...borderColor);
  doc.rect(margin, y, boxWidth, boxHeight, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...primaryColor);
  doc.text('RECEIVED FROM (LANDLORD / PROPERTY)', margin + 4, y + 6);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...darkTextColor);
  const landlordName = settings.landlordName || 'Property Management';
  doc.text(landlordName, margin + 4, y + 13);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...mutedTextColor);
  if (settings.propertyAddress) {
    doc.text(settings.propertyAddress, margin + 4, y + 19);
  }
  const contactParts = [settings.landlordPhone, settings.landlordEmail].filter(Boolean).join(' • ');
  if (contactParts) {
    doc.text(contactParts, margin + 4, y + 25);
  }

  // Tenant Box
  const tenantX = margin + boxWidth + 6;
  doc.setFillColor(...lightBgColor);
  doc.rect(tenantX, y, boxWidth, boxHeight, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...primaryColor);
  doc.text('TENANT & UNIT DETAILS', tenantX + 4, y + 6);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...darkTextColor);
  const tenantName = tenant.name || payment.tenantName || 'Tenant';
  doc.text(tenantName, tenantX + 4, y + 13);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...mutedTextColor);
  const unitText = `Unit / Property: ${tenant.unit || payment.unit || 'Standard Unit'}`;
  doc.text(unitText, tenantX + 4, y + 19);
  const periodText = `Rental Period: ${payment.rentalPeriod || payment.date?.slice(0, 7) || 'Current Month'}`;
  doc.text(periodText, tenantX + 4, y + 25);

  y += boxHeight + 10;

  // --- PAYMENT DETAILS TABLE ---
  doc.setFillColor(...primaryColor);
  doc.rect(margin, y, contentWidth, 7, 'F');
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text('LINE ITEM / DESCRIPTION', margin + 4, y + 5);
  doc.text('METHOD / REF', margin + 85, y + 5);
  doc.text('DATE', margin + 125, y + 5);
  doc.text('AMOUNT', pageWidth - margin - 4, y + 5, { align: 'right' });

  y += 7;

  // Item Rows
  const totalPaid = toCents(payment.amount);
  const lateFeeAssessed = toCents(payment.lateFeeAssessed || 0);
  const rentPortion = Math.max(0, totalPaid - lateFeeAssessed);

  const rows = [
    {
      desc: `Monthly Rent (${payment.rentalPeriod || payment.date?.slice(0, 7) || 'Rent'})`,
      method: (payment.method || 'Direct').toUpperCase(),
      date: payment.date || receiptDate,
      amount: fromCents(rentPortion)
    }
  ];

  if (lateFeeAssessed > 0) {
    rows.push({
      desc: 'Late Fee Assessed',
      method: 'Assessed Fee',
      date: payment.date || receiptDate,
      amount: fromCents(lateFeeAssessed)
    });
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);

  rows.forEach((row, idx) => {
    const rowBg = idx % 2 === 0 ? [255, 255, 255] : lightBgColor;
    doc.setFillColor(...rowBg);
    doc.rect(margin, y, contentWidth, 8, 'F');
    doc.setDrawColor(...borderColor);
    doc.line(margin, y + 8, margin + contentWidth, y + 8);

    doc.setTextColor(...darkTextColor);
    doc.text(row.desc, margin + 4, y + 5.5);
    doc.text(row.method, margin + 85, y + 5.5);
    doc.text(row.date, margin + 125, y + 5.5);
    doc.text(formatCurrency(row.amount), pageWidth - margin - 4, y + 5.5, { align: 'right' });
    y += 8;
  });

  // Optional Memo Row
  if (payment.memo) {
    doc.setFillColor(...lightBgColor);
    doc.rect(margin, y, contentWidth, 7, 'F');
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8.5);
    doc.setTextColor(...mutedTextColor);
    doc.text(`Memo / Note: ${payment.memo}`, margin + 4, y + 5);
    y += 7;
  }

  y += 4;

  // --- TOTALS SUMMARY BOX (RIGHT ALIGNED) ---
  const summaryBoxWidth = 80;
  const summaryX = pageWidth - margin - summaryBoxWidth;
  
  // Total Received
  doc.setFillColor(...primaryColor);
  doc.rect(summaryX, y, summaryBoxWidth, 10, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text('TOTAL RECEIVED:', summaryX + 4, y + 6.8);
  doc.text(formatCurrency(fromCents(totalPaid)), pageWidth - margin - 4, y + 6.8, { align: 'right' });

  // Paid In Full Badge
  const isPaidInFull = (payment.balanceRemaining === 0 || payment.balanceRemaining === undefined || payment.balanceRemaining === null);
  const badgeText = isPaidInFull ? '✓ PAID IN FULL' : `BALANCE: ${formatCurrency(payment.balanceRemaining)}`;
  const badgeColor = isPaidInFull ? successColor : [220, 38, 38];

  doc.setFillColor(...badgeColor);
  doc.roundedRect(margin, y + 1, 45, 8, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text(badgeText, margin + 5, y + 6.2);

  y += 24;

  // --- LANDLORD NOTES / POLICIES ---
  const notesText = settings.receiptNotes || 'Thank you for your timely payment. Please keep this receipt for your personal tax and housing records.';
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...mutedTextColor);
  const splitNotes = doc.splitTextToSize(notesText, contentWidth);
  doc.text(splitNotes, margin, y);

  y += (splitNotes.length * 4.5) + 16;

  // --- SIGNATURE SECTION ---
  const sigColWidth = (contentWidth - 20) / 2;
  
  // Landlord signature line
  doc.setDrawColor(...darkTextColor);
  doc.line(margin, y + 10, margin + sigColWidth, y + 10);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...darkTextColor);
  doc.text('AUTHORIZED SIGNATURE / AGENT', margin, y + 15);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...mutedTextColor);
  doc.text(`Date Signed: ${receiptDate}`, margin, y + 20);

  // Tenant acknowledgment line
  const tenantSigX = margin + sigColWidth + 20;
  doc.setDrawColor(...darkTextColor);
  doc.line(tenantSigX, y + 10, tenantSigX + sigColWidth, y + 10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...darkTextColor);
  doc.text('TENANT ACKNOWLEDGMENT (OPTIONAL)', tenantSigX, y + 15);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...mutedTextColor);
  doc.text('Printed Name & Signature', tenantSigX, y + 20);

  // --- BOTTOM FOOTER ---
  const footerY = 285;
  doc.setDrawColor(...borderColor);
  doc.line(margin, footerY - 4, pageWidth - margin, footerY - 4);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...mutedTextColor);
  doc.text('RentReceipt Extension • 100% Private, Local-First Financial Kit for Landlords • Zero Network Code', margin, footerY);
  doc.text(`Page 1 of 1`, pageWidth - margin, footerY, { align: 'right' });

  return doc;
}

/**
 * Generate PDF blob and trigger browser download
 * @param {Object} params Same as buildReceiptPdf
 * @returns {Blob}
 */
export function downloadReceiptPdf(params) {
  const doc = buildReceiptPdf(params);
  const blob = doc.output('blob');
  
  const receiptNo = params.payment?.receiptNumber || 'receipt';
  const tenantName = (params.tenant?.name || params.payment?.tenantName || 'tenant').replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `RentReceipt_${receiptNo}_${tenantName}.pdf`;

  if (typeof window !== 'undefined' && window.URL && document.createElement) {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }

  return blob;
}
