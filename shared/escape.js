/**
 * RentReceipt HTML Sanitization Helper
 * Escapes characters with special meaning in HTML to prevent XSS / markup injection.
 */

/**
 * Escape HTML characters in user-controlled values before interpolating into HTML markup or attributes.
 * @param {*} value Any string or value
 * @returns {string} Sanitized string safe for innerHTML and attribute contexts
 */
export function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
