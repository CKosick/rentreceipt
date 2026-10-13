import fs from 'node:fs';
import path from 'node:path';

// Read installed jspdf UMD bundle
const srcPath = path.resolve('node_modules/jspdf/dist/jspdf.umd.min.js');
let bundle = fs.readFileSync(srcPath, 'utf8');

// Sanitize any network / remote references:
// 1. Replace XMLHttpRequest references with offline error thrower
bundle = bundle.replaceAll('new XMLHttpRequest', '(function(){throw new Error("RentReceipt: Network calls strictly forbidden.");})');
bundle = bundle.replaceAll('XMLHttpRequest', 'Object');

// 2. Strip external URLs
bundle = bundle.replaceAll('https://cdnjs.cloudflare.com/ajax/libs/pdfobject/2.1.1/pdfobject.min.js', '');
bundle = bundle.replaceAll('https://webpjs.appspot.com', '');

// Ensure lib directory exists
fs.mkdirSync(path.resolve('lib'), { recursive: true });
const targetPath = path.resolve('lib/jspdf.umd.min.js');
fs.writeFileSync(targetPath, bundle, 'utf8');

console.log('Sanitized jsPDF bundled to lib/jspdf.umd.min.js');
console.log('Bundle size:', (bundle.length / 1024).toFixed(2), 'KB');
