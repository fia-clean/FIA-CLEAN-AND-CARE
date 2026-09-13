import { SaleRecord } from '../types';

export function formatCurrency(amount: number): string {
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  return '₹ ' + safeAmount.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatNumber(val: number): string {
  const safe = Number.isFinite(val) ? val : 0;
  return safe.toLocaleString('en-IN');
}

export function normalizeToDateKey(v: unknown): string {
  if (!v && v !== 0) return '';
  if (typeof v === 'number' || /^\d{10,14}$/.test(String(v).trim())) {
    const d = new Date(Number(v));
    if (!isNaN(d.getTime())) {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
  }
  const s = String(v).trim();
  if (!s) return '';
  let m = s.match(/^(\d{4})[-/. ](\d{1,2})[-/. ](\d{1,2})/);
  if (m) {
    return `${m[1]}-${String(m[2]).padStart(2, '0')}-${String(m[3]).padStart(2, '0')}`;
  }
  m = s.match(/^(\d{1,2})[-/. ](\d{1,2})[-/. ](\d{4})/);
  if (m) {
    return `${m[3]}-${String(m[2]).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}`;
  }
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  return '';
}

export function formatDateDDMMYYYY(dateStr: string | number | undefined): string {
  if (!dateStr && dateStr !== 0) return '';
  const key = normalizeToDateKey(dateStr);
  if (!key) return String(dateStr);
  const parts = key.split('-');
  return `${parts[2]}-${parts[1]}-${parts[0]}`;
}

export function getTodayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function generateNextBillNo(prefix: string, existingBills: SaleRecord[]): string {
  const matching = existingBills
    .filter((b) => b.billNo && b.billNo.startsWith(prefix))
    .map((b) => {
      const match = b.billNo.match(/(\d+)$/);
      return match ? parseInt(match[1], 10) : 0;
    });
  const max = matching.length > 0 ? Math.max(...matching) : 0;
  return `${prefix}-${String(max + 1).padStart(4, '0')}`;
}

export function downloadCSV(filename: string, headers: string[], rows: (string | number)[][]) {
  let csvContent = 'data:text/csv;charset=utf-8,';
  csvContent += headers.map((h) => `"${h}"`).join(',') + '\n';
  rows.forEach((row) => {
    csvContent +=
      row
        .map((val) => `"${String(val).replace(/"/g, '""')}"`)
        .join(',') + '\n';
  });
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function exportJSONBackup(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function formatPackDisplay(item: {
  packageSizeMl?: number;
  packDisplay?: string;
  packUnit?: string;
  unitType?: string;
}): string {
  if (item.packDisplay) return item.packDisplay;
  if (item.packageSizeMl !== undefined && item.packageSizeMl > 0) {
    const ml = item.packageSizeMl;
    if (item.packUnit === 'Kg' || item.packUnit === 'g' || item.packUnit === 'mg') {
      if (item.packUnit === 'mg') return `${ml} mg`;
      if (ml >= 1000 && ml % 1000 === 0) return `${ml / 1000} Kg`;
      if (ml >= 1000) return `${(ml / 1000).toFixed(2).replace(/\.?0+$/, '')} Kg`;
      return `${ml} g`;
    }
    // Liquid
    if (ml >= 1000 && ml % 1000 === 0) return `${ml / 1000} Ltr`;
    if (ml >= 1000) return `${(ml / 1000).toFixed(2).replace(/\.?0+$/, '')} Ltr`;
    return `${ml} ml`;
  }
  return item.unitType || '—';
}

export function getCleanInvoiceProductName(name: string): string {
  if (!name) return '';
  return String(name)
    .replace(/\s*\(\s*\d+(?:\.\d+)?\s*(?:ml|millilitre|l|ltr|litre|liter|kg|kilogram|g|gm|gram|pcs|pc|bottle|pack)[^)]*\)/gi, '')
    .replace(/\s*\(\s*(?:bottle|pack|pcs|standard)[^)]*\)/gi, '')
    .trim();
}

export function createWhatsAppBillMessage(sale: SaleRecord): string {
  const isWholesale = (sale.saleType || '').toLowerCase() === 'wholesale';
  const itemsText = sale.items
    .map((item, idx) => {
      const cleanName = getCleanInvoiceProductName(item.productName);
      const qtyStr = formatPackDisplay(item) || `${item.qty || ''}`;
      const units = item.qty;
      const rate = Number(item.rate || 0).toFixed(2);
      const total = Number(item.total || 0).toFixed(2);
      return `${idx + 1}. *${cleanName}* | ${qtyStr} | ${units} | ₹${rate} | ₹${total}`;
    })
    .join('\n');

  const pendingText =
    sale.pendingAmount > 0
      ? `*Balance Due:* ₹${sale.pendingAmount.toFixed(2)}\n`
      : '';
  const excessText =
    (sale.excessAmount || 0) > 0
      ? `*Balance Return:* ₹${(sale.excessAmount || 0).toFixed(2)}\n`
      : '';

  return (
    `*FIA CLEAN AND CARE*\n` +
    `*EDATHANATTUKARA*\n` +
    `*MOB: 8086452106*\n` +
    `*${isWholesale ? '🏷️ WHOLESALE INVOICE' : '🛍️ RETAIL INVOICE'}*\n\n` +
    `*Bill No:* #${sale.billNo}\n` +
    `*Customer:* ${sale.name}\n` +
    `*Date:* ${formatDateDDMMYYYY(sale.date)}\n` +
    `*Type:* ${sale.saleType} | *Payment:* ${sale.paymentMode}\n\n` +
    `*Items:*\n${itemsText}\n\n` +
    `*Grand Total:* *₹${sale.grandTotal.toFixed(2)}*\n` +
    `*Paid Amount:* ₹${sale.paidAmount.toFixed(2)}\n` +
    `${pendingText}${excessText}\n` +
    `_Thank you for choosing FIA Clean & Care!_`
  );
}
