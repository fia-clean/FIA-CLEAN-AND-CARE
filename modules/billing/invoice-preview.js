/**
 * FIA CLEAN & CARE - Invoice Preview, WhatsApp Direct Photo Share & Thermal Printing
 */

import { state, formatDateDDMMYYYY } from '../core/state.js';

export function closeBillPreview() {
    state.isPreviewOpen = false;
    const modal = document.getElementById('billPreviewModal');
    if (modal) modal.classList.add('hidden');
}

export function sortBillItemsAlphabetically(items) {
    return [...(items || [])].sort((a, b) => String(a.productName || '').localeCompare(String(b.productName || ''), undefined, { sensitivity: 'base', numeric: true }));
}

export function getCleanInvoiceProductName(name) {
    if (!name) return '';
    return String(name)
        .replace(/\s*\(\s*\d+(?:\.\d+)?\s*(?:ml|millilitre|l|ltr|litre|liter|kg|kilogram|g|gm|gram|pcs|pc|bottle|pack)[^)]*\)/gi, '')
        .replace(/\s*\(\s*(?:bottle|pack|pcs|standard)[^)]*\)/gi, '')
        .trim();
}

export function formatInvoiceItemQty(item) {
    if (!item) return '1';
    let rawQty = item.qty;
    let unit = (item.unitType && item.unitType !== 'Standard' && item.unitType !== 'General') ? String(item.unitType).trim() : '';
    const units = Number(item.numberOfUnits || 1);

    // If unit is missing or empty, search product in state for its base unit
    if (!unit) {
        const name = item.productName;
        const p = (state.products || []).find(x => x && (x.name === name || (x.id && item.stockId && String(x.id) === String(item.stockId))))
            || (state.cosProducts || []).find(x => x && (x.name === name || (x.id && item.stockId && String(x.id) === String(item.stockId))))
            || (state.packages || []).find(x => x && (x.name === name || (x.id && item.packageId && String(x.id) === String(item.packageId))));
        if (p && p.unit && p.unit !== 'Standard' && p.unit !== 'General') {
            unit = String(p.unit).trim();
        }
    }

    // Standardize unit representation
    let cleanUnit = unit || '';
    if (/^(l|ltr|litre|litres|liter)$/i.test(cleanUnit)) cleanUnit = 'Ltr';
    else if (/^(ml|millilitre|millilitres)$/i.test(cleanUnit)) cleanUnit = 'ml';
    else if (/^(kg|kilogram|kilograms)$/i.test(cleanUnit)) cleanUnit = 'Kg';
    else if (/^(g|gram|grams|gm)$/i.test(cleanUnit)) cleanUnit = 'Gram';
    else if (/^(pcs|piece|pieces|pc)$/i.test(cleanUnit)) cleanUnit = 'Pcs';
    else if (/^(bottle|bottles)$/i.test(cleanUnit)) cleanUnit = 'Bottle';
    else if (/^(can|cans)$/i.test(cleanUnit)) cleanUnit = 'Can';
    else if (/^(pouch|pouches)$/i.test(cleanUnit)) cleanUnit = 'Pouch';
    else if (/^(box|boxes)$/i.test(cleanUnit)) cleanUnit = 'Box';

    // If still empty, check item quantityType or default to Ltr
    if (!cleanUnit) {
        if (item.quantityType && !/^(other|standard|general)$/i.test(item.quantityType)) {
            cleanUnit = item.quantityType;
        } else {
            cleanUnit = 'Ltr';
        }
    }

    let qtyVal = (rawQty !== undefined && rawQty !== null && rawQty !== '') ? Number(rawQty) : 1;
    if (isNaN(qtyVal) || qtyVal <= 0) qtyVal = 1;

    let displayStr = `${qtyVal} ${cleanUnit}`.trim();
    if (units > 1) {
        displayStr += ` (${units})`;
    }
    return displayStr;
}

export function previewBill(identifier) {
    let c = null;
    if (typeof identifier === 'number') {
        c = state.customers[identifier];
    } else if (identifier !== undefined && identifier !== null) {
        const idStr = String(identifier).trim();
        c = (state.customers || []).find(x => x && (String(x.billNo) === idStr || String(x.id) === idStr));
        if (!c && /^\d+$/.test(idStr)) {
            c = state.customers[parseInt(idStr, 10)];
        }
    }
    if (!c) { alert('Bill not found.'); return; }
    state.activePreviewCustomer = c;
    const saleTypeStr = (c.saleType || 'Retail').toUpperCase();
    const isWholesale = saleTypeStr === 'WHOLESALE';
    const themeColor = '#065f46';
    const themeHeaderBg = '#064e3b';
    
    let itemsRows = sortBillItemsAlphabetically(c.items || []).map((item, idx) => {
        const cleanName = getCleanInvoiceProductName(item.productName);
        const qtyDisplay = formatInvoiceItemQty(item);
        const rate = Number(item.rate || 0).toFixed(2);
        const total = Number(item.total || 0).toFixed(2);
        const cosTag = item.combinedCategory === 'Cosmetics' ? ` <span style="color:#db2777; font-size:9.5px; font-weight:bold;">(Cos)</span>` : '';
        const bg = idx % 2 === 1 ? 'background:#f9fafb;' : 'background:#ffffff;';
        return `<tr style="${bg}">
            <td style="padding:6px 4px; border-bottom:1px solid #e5e7eb; font-weight:600; color:#111827 !important; word-break:break-word;">${cleanName}${cosTag}</td>
            <td style="padding:6px 2px; border-bottom:1px solid #e5e7eb; text-align:center; color:#374151 !important; white-space:nowrap;">${qtyDisplay}</td>
            <td style="padding:6px 2px; border-bottom:1px solid #e5e7eb; text-align:right; color:#374151 !important; white-space:nowrap;">₹${rate}</td>
            <td style="padding:6px 4px; border-bottom:1px solid #e5e7eb; text-align:right; font-weight:700; color:#111827 !important; white-space:nowrap;">₹${total}</td>
        </tr>`;
    }).join('');

    const grandVal = Number(c.grandTotal || 0);
    const discountVal = Number(c.discount || 0);
    const subTotalVal = Number(c.subTotal || (grandVal + discountVal));
    const paidVal = c.paidAmount !== undefined ? Number(c.paidAmount) : grandVal;
    const pendingVal = c.pendingAmount !== undefined ? Number(c.pendingAmount) : Math.max(0, grandVal - paidVal);
    const excessVal = c.excessAmount !== undefined ? Number(c.excessAmount) : Math.max(0, paidVal - grandVal);

    const billHTML = `
        <div id="fiaInvoiceCaptureCard" style="font-family: Arial, Helvetica, sans-serif; color: #000000 !important; background-color: #ffffff !important; padding: 16px 14px; width: 380px; max-width: 100%; min-height: 520px; display: flex; flex-direction: column; justify-content: space-between; margin: 0 auto; box-sizing: border-box; border-radius: 12px; border: 2px solid ${themeColor};">
            <div>
                <!-- Brand Header with Logo -->
                <div style="text-align: center; border-bottom: 2px solid ${themeColor}; padding-bottom: 8px; margin-bottom: 8px;">
                    <div style="display: flex; align-items: center; justify-content: center; gap: 8px;">
                        <img src="./icon-192.png" alt="FIA" style="width: 38px; height: 38px; border-radius: 50%; object-fit: contain; border: 1.5px solid ${themeColor}; background: #000000; display: inline-block;">
                        <div style="text-align: left;">
                            <h2 style="margin: 0; color: ${themeColor}; font-size: 16px; font-weight: 900; letter-spacing: 0.5px; line-height: 1.15;">FIA CLEAN AND CARE</h2>
                            <div style="margin: 0; font-size: 9.5px; font-weight: 700; color: #374151 !important;">EDATHANATTUKARA • MOB: 8086452106</div>
                        </div>
                    </div>
                    <div style="margin-top: 5px;">
                        <span style="display:inline-block; padding: 2px 10px; border-radius: 12px; font-weight: 800; font-size: 9.5px; ${isWholesale ? 'background:#fef3c7; color:#92400e; border:1px solid #f59e0b;' : 'background:#ecfdf5; color:#065f46; border:1px solid #10b981;'}">
                            ${isWholesale ? '🏷️ WHOLESALE INVOICE' : '🛍️ RETAIL INVOICE'}
                        </span>
                    </div>
                    ${(c.isCancelled || c.status === 'cancelled') ? `
                    <div style="margin-top: 6px; background: #fee2e2; border: 1.5px solid #ef4444; color: #b91c1c; border-radius: 8px; padding: 4px 8px; text-align: center; font-weight: 900; font-size: 11px; letter-spacing: 0.5px;">
                        ⛔ THIS INVOICE IS CANCELLED ${c.cancelReason ? `(${c.cancelReason})` : ''}
                    </div>` : ''}
                </div>

                <!-- Bill & Customer Details -->
                <div style="background: #f3f4f6; border-radius: 8px; padding: 6px 8px; margin-bottom: 8px; font-size: 10.5px; line-height: 1.35; color: #111827 !important;">
                    <div style="display: flex; justify-content: space-between; border-bottom: 1px dashed #d1d5db; padding-bottom: 3px; margin-bottom: 3px;">
                        <span><strong>Bill No:</strong> <span style="color:${themeColor}; font-weight: 800;">${c.billNo || '—'}</span></span>
                        <span><strong>Date:</strong> ${formatDateDDMMYYYY(c.date)}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between;">
                        <span style="max-width: 60%; word-break: break-word;"><strong>Customer:</strong> ${String(c.name || 'Walk-in').toUpperCase()}</span>
                        <span><strong>${c.phone ? 'Mob: ' + c.phone : 'Mode: ' + (c.paymentMode || 'Cash')}</strong></span>
                    </div>
                </div>

                <!-- Particulars Table: 4 Columns, 100% Width, Zero Cutoff -->
                <table style="width: 100%; table-layout: fixed; border-collapse: collapse; font-size: 11px; margin: 6px 0; color: #000000 !important;">
                    <thead>
                        <tr style="background: ${themeHeaderBg}; color: #ffffff !important;">
                            <th style="width: 44%; padding: 6px 4px; text-align: left; color: #ffffff !important; border-top-left-radius: 4px;">Item</th>
                            <th style="width: 22%; padding: 6px 2px; text-align: center; color: #ffffff !important;">Qty</th>
                            <th style="width: 17%; padding: 6px 2px; text-align: right; color: #ffffff !important;">Rate</th>
                            <th style="width: 17%; padding: 6px 4px; text-align: right; color: #ffffff !important; border-top-right-radius: 4px;">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${itemsRows}
                    </tbody>
                </table>
            </div>

            <div>
                <!-- Totals & Payment Summary -->
                <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 6px 8px; margin-top: 6px; font-size: 11px; line-height: 1.45; color: #111827 !important;">
                    ${discountVal > 0 ? `
                    <div style="display: flex; justify-content: space-between; align-items: center; color: #4b5563 !important; font-weight: 600;">
                        <span>Subtotal:</span>
                        <span>₹${subTotalVal.toFixed(2)}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center; color: #d97706 !important; font-weight: 700; margin-bottom: 3px;">
                        <span>Discount:</span>
                        <span>-₹${discountVal.toFixed(2)}</span>
                    </div>` : ''}
                    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e5e7eb; padding-bottom: 3px; margin-bottom: 3px; ${discountVal > 0 ? 'border-top: 1px dashed #e5e7eb; padding-top: 3px;' : ''}">
                        <span style="font-size: 11.5px; font-weight: 800; color: #111827 !important;">Grand Total:</span>
                        <span style="font-size: 13px; font-weight: 900; color: ${themeColor} !important;">₹${grandVal.toFixed(2)}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center; color: #047857 !important; font-weight: 700;">
                        <span>Paid:</span>
                        <span>₹${paidVal.toFixed(2)}</span>
                    </div>
                    ${pendingVal > 0 ? `
                    <div style="display: flex; justify-content: space-between; align-items: center; color: #b91c1c !important; font-weight: 800; margin-top: 2px; padding: 2px 4px; background: #fef2f2; border-radius: 4px;">
                        <span>⚠️ Balance Due:</span>
                        <span>₹${pendingVal.toFixed(2)}</span>
                    </div>` : ''}
                    ${excessVal > 0 ? `
                    <div style="display: flex; justify-content: space-between; align-items: center; color: #b45309 !important; font-weight: 800; margin-top: 2px; padding: 2px 4px; background: #fffbeb; border-radius: 4px;">
                        <span>🔄 Return / Change:</span>
                        <span>₹${excessVal.toFixed(2)}</span>
                    </div>` : ''}
                </div>

                <!-- Footer Note -->
                <div style="text-align: center; margin-top: 8px; font-size: 9px; color: #6b7280 !important; font-style: italic;">
                    Thank you for your business! Visit again 🙏
                </div>
            </div>
        </div>`;
    
    document.getElementById('billPreviewContent').innerHTML = billHTML;
    document.getElementById('printSection').innerHTML = billHTML.replace('id="fiaInvoiceCaptureCard"', 'id="fiaInvoicePrintCard"');
    state.isPreviewOpen = true;
    document.getElementById('billPreviewModal').classList.remove('hidden');

    const itemsCount = (c.items || []).length;
    const btnText = document.getElementById('btnShareWhatsAppText');
    if (btnText) {
        btnText.textContent = itemsCount > 15
            ? `Share Bill on WhatsApp (PDF Document • ${itemsCount} Items)`
            : `Share Bill on WhatsApp (Photo)`;
    }
}

export function previewCosSaleBill(saleOrIdentifier) {
    let sale = saleOrIdentifier;
    if (typeof saleOrIdentifier === 'number') {
        sale = state.cosSales[saleOrIdentifier];
    } else if (typeof saleOrIdentifier === 'string') {
        sale = (state.cosSales || []).find(s => s && (String(s.billNo) === saleOrIdentifier || String(s.id) === saleOrIdentifier));
        if (!sale && /^\d+$/.test(saleOrIdentifier)) {
            sale = state.cosSales[parseInt(saleOrIdentifier, 10)];
        }
    }
    if (!sale) { alert('Cosmetics bill not found.'); return; }
    
    const isWholesale = (sale.saleType || '').toUpperCase() === 'WHOLESALE';
    const themeColor = '#db2777';
    const themeHeaderBg = '#831843';
    state.activePreviewCustomer = {
        name: sale.customer || '',
        billNo: sale.billNo || 'COS-0001',
        phone: sale.phone || '',
        date: sale.date
    };

    let itemsRows = sortBillItemsAlphabetically(sale.items || []).map((item, idx) => {
        const cleanName = getCleanInvoiceProductName(item.productName);
        const qtyDisplay = formatInvoiceItemQty(item);
        const rate = Number(item.rate || 0).toFixed(2);
        const total = Number(item.total || 0).toFixed(2);
        const bg = idx % 2 === 1 ? 'background:#fdf2f8;' : 'background:#ffffff;';
        return `<tr style="${bg}">
            <td style="padding:6px 4px; border-bottom:1px solid #fbcfe8; font-weight:600; color:#111827 !important; word-break:break-word;">${cleanName}</td>
            <td style="padding:6px 2px; border-bottom:1px solid #fbcfe8; text-align:center; color:#374151 !important; white-space:nowrap;">${qtyDisplay}</td>
            <td style="padding:6px 2px; border-bottom:1px solid #fbcfe8; text-align:right; color:#374151 !important; white-space:nowrap;">₹${rate}</td>
            <td style="padding:6px 4px; border-bottom:1px solid #fbcfe8; text-align:right; font-weight:700; color:#111827 !important; white-space:nowrap;">₹${total}</td>
        </tr>`;
    }).join('');

    const grandVal = Number(sale.grandTotal !== undefined ? sale.grandTotal : (sale.netTotal || sale.total || 0));
    const paidVal = Number(sale.paidAmount !== undefined ? sale.paidAmount : (grandVal - Number(sale.pendingAmount || 0)));
    const pendingVal = Math.max(0, Number(sale.pendingAmount || 0));
    const excessVal = Math.max(0, paidVal - grandVal);

    const billHTML = `
        <div id="fiaInvoiceCaptureCard" style="font-family: Arial, Helvetica, sans-serif; color: #000000 !important; background-color: #ffffff !important; padding: 16px 14px; width: 380px; max-width: 100%; min-height: 520px; display: flex; flex-direction: column; justify-content: space-between; margin: 0 auto; box-sizing: border-box; border-radius: 12px; border: 2px solid ${themeColor};">
            <div>
                <!-- Brand Header with Logo -->
                <div style="text-align: center; border-bottom: 2px solid ${themeColor}; padding-bottom: 8px; margin-bottom: 8px;">
                    <div style="display: flex; align-items: center; justify-content: center; gap: 8px;">
                        <img src="./icon-192.png" alt="FIA" style="width: 38px; height: 38px; border-radius: 50%; object-fit: contain; border: 1.5px solid ${themeColor}; background: #000000; display: inline-block;">
                        <div style="text-align: left;">
                            <h2 style="margin: 0; color: ${themeColor}; font-size: 16px; font-weight: 900; letter-spacing: 0.5px; line-height: 1.15;">FIA COSMETICS & CARE</h2>
                            <div style="margin: 0; font-size: 9.5px; font-weight: 700; color: #374151 !important;">EDATHANATTUKARA • MOB: 8086452106</div>
                        </div>
                    </div>
                    <div style="margin-top: 5px;">
                        <span style="display:inline-block; padding: 2px 10px; border-radius: 12px; font-weight: 800; font-size: 9.5px; ${isWholesale ? 'background:#fef3c7; color:#92400e; border:1px solid #f59e0b;' : 'background:#fdf2f8; color:#9d174d; border:1px solid #f472b6;'}">
                            ${isWholesale ? '🏷️ COSMETICS WHOLESALE INVOICE' : '💄 COSMETICS RETAIL INVOICE'}
                        </span>
                    </div>
                    ${(sale.isCancelled || sale.status === 'cancelled') ? `
                    <div style="margin-top: 6px; background: #fee2e2; border: 1.5px solid #ef4444; color: #b91c1c; border-radius: 8px; padding: 4px 8px; text-align: center; font-weight: 900; font-size: 11px; letter-spacing: 0.5px;">
                        ⛔ THIS INVOICE IS CANCELLED ${sale.cancelReason ? `(${sale.cancelReason})` : ''}
                    </div>` : ''}
                </div>

                <!-- Bill & Customer Details -->
                <div style="background: #fdf2f8; border-radius: 8px; padding: 6px 8px; margin-bottom: 8px; font-size: 10.5px; line-height: 1.35; color: #111827 !important;">
                    <div style="display: flex; justify-content: space-between; border-bottom: 1px dashed #fbcfe8; padding-bottom: 3px; margin-bottom: 3px;">
                        <span><strong>Bill No:</strong> <span style="color:${themeColor}; font-weight: 800;">${sale.billNo || 'COS-0001'}</span></span>
                        <span><strong>Date:</strong> ${formatDateDDMMYYYY(sale.date)}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between;">
                        <span style="max-width: 60%; word-break: break-word;"><strong>Customer:</strong> ${String(sale.customer || 'Walk-in').toUpperCase()}</span>
                        <span><strong>${sale.phone ? 'Mob: ' + sale.phone : 'Mode: ' + (sale.paymentMode || 'Cash')}</strong></span>
                    </div>
                </div>

                <!-- Particulars Table: 4 Columns, 100% Width, Zero Cutoff -->
                <table style="width: 100%; table-layout: fixed; border-collapse: collapse; font-size: 11px; margin: 6px 0; color: #000000 !important;">
                    <thead>
                        <tr style="background: ${themeHeaderBg}; color: #ffffff !important;">
                            <th style="width: 44%; padding: 6px 4px; text-align: left; color: #ffffff !important; border-top-left-radius: 4px;">Item</th>
                            <th style="width: 22%; padding: 6px 2px; text-align: center; color: #ffffff !important;">Qty</th>
                            <th style="width: 17%; padding: 6px 2px; text-align: right; color: #ffffff !important;">Rate</th>
                            <th style="width: 17%; padding: 6px 4px; text-align: right; color: #ffffff !important; border-top-right-radius: 4px;">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${itemsRows}
                    </tbody>
                </table>
            </div>

            <div>
                <!-- Totals & Payment Summary -->
                <div style="background: #fff5f7; border: 1px solid #fce7f3; border-radius: 8px; padding: 6px 8px; margin-top: 6px; font-size: 11px; line-height: 1.45; color: #111827 !important;">
                    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #fbcfe8; padding-bottom: 3px; margin-bottom: 3px;">
                        <span style="font-size: 11.5px; font-weight: 800; color: #111827 !important;">Grand Total:</span>
                        <span style="font-size: 13px; font-weight: 900; color: ${themeColor} !important;">₹${grandVal.toFixed(2)}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center; color: #047857 !important; font-weight: 700;">
                        <span>Paid:</span>
                        <span>₹${paidVal.toFixed(2)}</span>
                    </div>
                    ${pendingVal > 0 ? `
                    <div style="display: flex; justify-content: space-between; align-items: center; color: #b91c1c !important; font-weight: 800; margin-top: 2px; padding: 2px 4px; background: #fef2f2; border-radius: 4px;">
                        <span>⚠️ Balance Due:</span>
                        <span>₹${pendingVal.toFixed(2)}</span>
                    </div>` : ''}
                    ${excessVal > 0 ? `
                    <div style="display: flex; justify-content: space-between; align-items: center; color: #b45309 !important; font-weight: 800; margin-top: 2px; padding: 2px 4px; background: #fffbeb; border-radius: 4px;">
                        <span>🔄 Return / Change:</span>
                        <span>₹${excessVal.toFixed(2)}</span>
                    </div>` : ''}
                </div>

                <!-- Footer Note -->
                <div style="text-align: center; margin-top: 8px; font-size: 9px; color: #6b7280 !important; font-style: italic;">
                    Thank you for your business! Visit again 🙏
                </div>
            </div>
        </div>`;
    
    document.getElementById('billPreviewContent').innerHTML = billHTML;
    document.getElementById('printSection').innerHTML = billHTML.replace('id="fiaInvoiceCaptureCard"', 'id="fiaInvoicePrintCard"');
    state.isPreviewOpen = true;
    document.getElementById('billPreviewModal').classList.remove('hidden');

    const itemsCount = (sale.items || []).length;
    const btnText = document.getElementById('btnShareWhatsAppText');
    if (btnText) {
        btnText.textContent = itemsCount > 15
            ? `Share Bill on WhatsApp (PDF Document • ${itemsCount} Items)`
            : `Share Bill on WhatsApp (Photo)`;
    }
}

function getA4HeaderHtml(c, brandTitle, themeColor, isWholesale, brandBadge) {
    return `
        <div style="border-bottom: 2px solid ${themeColor}; padding-bottom: 8px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center;">
            <div style="display: flex; align-items: center; gap: 10px;">
                <img src="./icon-192.png" alt="FIA" style="width: 44px; height: 44px; border-radius: 50%; object-fit: contain; border: 2px solid ${themeColor}; background: #000000; display: inline-block;">
                <div>
                    <h2 style="margin: 0; color: ${themeColor}; font-size: 19px; font-weight: 900; letter-spacing: 0.5px; line-height: 1.2;">${brandTitle}</h2>
                    <div style="margin: 2px 0 0 0; font-size: 10.5px; font-weight: 700; color: #374151;">EDATHANATTUKARA • MOB: 8086452106</div>
                </div>
            </div>
            <div style="text-align: right;">
                <span style="display: inline-block; padding: 4px 12px; border-radius: 12px; font-weight: 800; font-size: 10.5px; ${isWholesale ? 'background: #fef3c7; color: #92400e; border: 1.5px solid #f59e0b;' : 'background: #ecfdf5; color: #065f46; border: 1.5px solid #10b981;'}">
                    ${brandBadge}
                </span>
            </div>
        </div>

        <div style="background: #f3f4f6; border: 1px solid #d1d5db; border-radius: 8px; padding: 8px 12px; margin-bottom: 12px; font-size: 11px; line-height: 1.45; color: #111827;">
            <div style="display: flex; justify-content: space-between; border-bottom: 1px dashed #d1d5db; padding-bottom: 4px; margin-bottom: 4px;">
                <span><strong>Bill No:</strong> <span style="color: ${themeColor}; font-weight: 800; font-size: 12.5px;">${c.billNo || '—'}</span></span>
                <span><strong>Date:</strong> ${formatDateDDMMYYYY(c.date)}</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
                <span style="max-width: 65%; word-break: break-word;"><strong>Customer:</strong> ${String(c.name || 'Walk-in').toUpperCase()}</span>
                <span><strong>${c.phone ? 'Mob: ' + c.phone : 'Mode: ' + (c.paymentMode || 'Cash')}</strong></span>
            </div>
        </div>
    `;
}

function getA4TableHeadHtml(themeColor, themeHeaderBg) {
    return `
        <thead>
            <tr style="background-color: ${themeHeaderBg} !important; color: #ffffff !important; -webkit-print-color-adjust: exact; print-color-adjust: exact;">
                <th style="width: 46%; padding: 8px 6px; text-align: left; background-color: ${themeHeaderBg} !important; color: #ffffff !important; font-size: 11px; font-weight: 800; border-top: 1px solid ${themeHeaderBg}; border-bottom: 2px solid ${themeColor};">Item Description</th>
                <th style="width: 18%; padding: 8px 4px; text-align: center; background-color: ${themeHeaderBg} !important; color: #ffffff !important; font-size: 11px; font-weight: 800; border-top: 1px solid ${themeHeaderBg}; border-bottom: 2px solid ${themeColor};">Qty</th>
                <th style="width: 18%; padding: 8px 4px; text-align: right; background-color: ${themeHeaderBg} !important; color: #ffffff !important; font-size: 11px; font-weight: 800; border-top: 1px solid ${themeHeaderBg}; border-bottom: 2px solid ${themeColor};">Rate</th>
                <th style="width: 18%; padding: 8px 6px; text-align: right; background-color: ${themeHeaderBg} !important; color: #ffffff !important; font-size: 11px; font-weight: 800; border-top: 1px solid ${themeHeaderBg}; border-bottom: 2px solid ${themeColor};">Total</th>
            </tr>
        </thead>
    `;
}

function getA4ItemRowHtml(item, idx) {
    const cleanName = getCleanInvoiceProductName(item.productName);
    const qtyDisplay = formatInvoiceItemQty(item);
    const rate = Number(item.rate || 0).toFixed(2);
    const total = Number(item.total || 0).toFixed(2);
    const cosTag = item.combinedCategory === 'Cosmetics' ? ` <span style="color:#db2777; font-size:10px; font-weight:bold;">(Cos)</span>` : '';
    const bg = idx % 2 === 1 ? 'background-color: #f9fafb;' : 'background-color: #ffffff;';
    return `<tr style="${bg} page-break-inside: avoid !important; -webkit-print-color-adjust: exact; print-color-adjust: exact;">
        <td style="padding: 6px 6px; border-bottom: 1px solid #e5e7eb; font-weight: 600; color: #111827; font-size: 11px; word-break: break-word;">${cleanName}${cosTag}</td>
        <td style="padding: 6px 4px; border-bottom: 1px solid #e5e7eb; text-align: center; color: #374151; font-size: 11px; white-space: nowrap;">${qtyDisplay}</td>
        <td style="padding: 6px 4px; border-bottom: 1px solid #e5e7eb; text-align: right; color: #374151; font-size: 11px; white-space: nowrap;">₹${rate}</td>
        <td style="padding: 6px 6px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: 700; color: #111827; font-size: 11px; white-space: nowrap;">₹${total}</td>
    </tr>`;
}

function getA4TotalsHtml(c, themeColor, grandVal, paidVal, pendingVal, excessVal) {
    const discountVal = Number(c.discount || 0);
    const subTotalVal = Number(c.subTotal || (grandVal + discountVal));
    return `
        <div class="totals-container" style="page-break-inside: avoid !important; break-inside: avoid !important; margin-top: 14px;">
            <div style="background: #f9fafb; border: 1.5px solid #d1d5db; border-radius: 8px; padding: 10px 14px; font-size: 11.5px; line-height: 1.5; color: #111827; width: 320px; max-width: 100%; margin-left: auto; box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact;">
                ${discountVal > 0 ? `
                <div style="display: flex; justify-content: space-between; align-items: center; color: #4b5563; font-weight: 600;">
                    <span>Subtotal:</span>
                    <span>₹${subTotalVal.toFixed(2)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; color: #d97706; font-weight: 700; margin-bottom: 4px;">
                    <span>Discount:</span>
                    <span>-₹${discountVal.toFixed(2)}</span>
                </div>` : ''}
                <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e5e7eb; padding-bottom: 5px; margin-bottom: 5px; ${discountVal > 0 ? 'border-top: 1px dashed #e5e7eb; padding-top: 4px;' : ''}">
                    <span style="font-size: 12.5px; font-weight: 800; color: #111827;">Grand Total:</span>
                    <span style="font-size: 14.5px; font-weight: 900; color: ${themeColor};">₹${grandVal.toFixed(2)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; color: #047857; font-weight: 700;">
                    <span>Paid Amount:</span>
                    <span>₹${paidVal.toFixed(2)}</span>
                </div>
                ${pendingVal > 0 ? `
                <div style="display: flex; justify-content: space-between; align-items: center; color: #b91c1c; font-weight: 800; margin-top: 4px; padding: 3px 6px; background: #fef2f2; border-radius: 4px; -webkit-print-color-adjust: exact; print-color-adjust: exact;">
                    <span>⚠️ Balance Due:</span>
                    <span>₹${pendingVal.toFixed(2)}</span>
                </div>` : ''}
                ${excessVal > 0 ? `
                <div style="display: flex; justify-content: space-between; align-items: center; color: #b45309; font-weight: 800; margin-top: 4px; padding: 3px 6px; background: #fffbeb; border-radius: 4px; -webkit-print-color-adjust: exact; print-color-adjust: exact;">
                    <span>🔄 Return / Change:</span>
                    <span>₹${excessVal.toFixed(2)}</span>
                </div>` : ''}
            </div>
            <div style="text-align: center; margin-top: 12px; font-size: 10px; color: #6b7280; font-style: italic;">
                Thank you for your business! Visit again 🙏
            </div>
        </div>
    `;
}

export function generateA4Pages(c) {
    if (!c) return [];
    const isCosmetics = String(c.billNo || '').toUpperCase().startsWith('COS') || c.category === 'Cosmetics';
    const saleTypeStr = (c.saleType || 'Retail').toUpperCase();
    const isWholesale = saleTypeStr === 'WHOLESALE';
    const themeColor = isCosmetics ? '#db2777' : '#065f46';
    const themeHeaderBg = isCosmetics ? '#831843' : '#064e3b';
    const brandTitle = isCosmetics ? 'FIA COSMETICS & CARE' : 'FIA CLEAN AND CARE';
    const brandBadge = isWholesale ? (isCosmetics ? '🏷️ COSMETICS WHOLESALE' : '🏷️ WHOLESALE INVOICE') : (isCosmetics ? '💄 COSMETICS RETAIL' : '🛍️ RETAIL INVOICE');

    const grandVal = Number(c.grandTotal !== undefined ? c.grandTotal : (c.netTotal || c.total || 0));
    const paidVal = Number(c.paidAmount !== undefined ? c.paidAmount : (grandVal - Number(c.pendingAmount || 0)));
    const pendingVal = Math.max(0, Number(c.pendingAmount !== undefined ? c.pendingAmount : (grandVal - paidVal)));
    const excessVal = Math.max(0, Number(c.excessAmount !== undefined ? c.excessAmount : (paidVal - grandVal)));

    const allItems = sortBillItemsAlphabetically(c.items || []);
    const itemsCount = allItems.length;

    if (itemsCount <= 13) {
        // Single Page Layout
        const rows = allItems.map(getA4ItemRowHtml).join('');
        const page1 = `
            <div class="print-page print-page-single" style="width: 100%; max-width: 650px; margin: 0 auto; box-sizing: border-box; font-family: Arial, Helvetica, sans-serif; color: #000000;">
                ${getA4HeaderHtml(c, brandTitle, themeColor, isWholesale, brandBadge)}
                <table style="width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 8px;">
                    ${getA4TableHeadHtml(themeColor, themeHeaderBg)}
                    <tbody>${rows}</tbody>
                </table>
                ${getA4TotalsHtml(c, themeColor, grandVal, paidVal, pendingVal, excessVal)}
            </div>
        `;
        return [page1];
    } else {
        // Multi-page Layout: Page 1 (items 0-13), Page 2 (items 13-end)
        const page1Items = allItems.slice(0, 13);
        const page2Items = allItems.slice(13);

        const rows1 = page1Items.map(getA4ItemRowHtml).join('');
        const rows2 = page2Items.map((it, idx) => getA4ItemRowHtml(it, idx + 13)).join('');

        const page1 = `
            <div class="print-page print-page-1" style="width: 100%; max-width: 650px; margin: 0 auto; box-sizing: border-box; font-family: Arial, Helvetica, sans-serif; color: #000000;">
                ${getA4HeaderHtml(c, brandTitle, themeColor, isWholesale, brandBadge)}
                <table style="width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 8px;">
                    ${getA4TableHeadHtml(themeColor, themeHeaderBg)}
                    <tbody>${rows1}</tbody>
                </table>
                <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1.5px dashed #9ca3af; padding: 8px 4px; margin-top: 10px; font-size: 11px; font-weight: bold; color: #4b5563;">
                    <span>📄 Bill No: ${c.billNo || '—'} (Page 1 of 2)</span>
                    <span style="color: ${themeColor}; font-weight: 800;">(Continued on Page 2 ➔)</span>
                </div>
            </div>
        `;

        const page2 = `
            <div class="print-page print-page-2" style="width: 100%; max-width: 650px; margin: 0 auto; box-sizing: border-box; font-family: Arial, Helvetica, sans-serif; color: #000000; padding-top: 4px;">
                <div style="display: flex; justify-content: space-between; align-items: center; background: #f3f4f6; border: 1px solid #d1d5db; border-bottom: 2px solid ${themeColor}; padding: 8px 12px; margin-bottom: 12px; border-radius: 6px; -webkit-print-color-adjust: exact; print-color-adjust: exact;">
                    <div>
                        <strong style="color: ${themeColor}; font-size: 13px; font-weight: 900;">${brandTitle} — BILL NO: ${c.billNo || '—'}</strong>
                        <span style="font-size: 11px; color: #4b5563; margin-left: 12px;">Customer: ${String(c.name || 'Walk-in').toUpperCase()} • Date: ${formatDateDDMMYYYY(c.date)}</span>
                    </div>
                    <span style="background: ${themeColor}; color: #ffffff; padding: 4px 10px; border-radius: 12px; font-size: 10px; font-weight: 800; -webkit-print-color-adjust: exact; print-color-adjust: exact;">PAGE 2 (CONTINUED)</span>
                </div>
                <table style="width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 8px;">
                    ${getA4TableHeadHtml(themeColor, themeHeaderBg)}
                    <tbody>${rows2}</tbody>
                </table>
                ${getA4TotalsHtml(c, themeColor, grandVal, paidVal, pendingVal, excessVal)}
            </div>
        `;

        return [page1, page2];
    }
}

export function generateA4PrintHTML(c) {
    const pages = generateA4Pages(c);
    return pages.join('<div style="page-break-after: always; break-after: page; height: 0; line-height: 0; margin: 0; padding: 0;"></div>');
}

export function printBill() {
    const c = state.activePreviewCustomer;
    if (!c) {
        alert('Bill data is not available for printing.');
        return;
    }
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        alert('Please allow pop-ups to print the bill.');
        return;
    }
    const contentHtml = generateA4PrintHTML(c);

    printWindow.document.open();
    printWindow.document.write(`<!doctype html>
<html>
<head>
    <meta charset="UTF-8">
    <title>FIA Bill ${c.billNo || ''}</title>
    <style>
        @page {
            size: letter portrait;
            margin: 8mm 12mm 8mm 12mm;
        }
        *, *:before, *:after {
            box-sizing: border-box;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
        }
        html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            color: #000000 !important;
            font-family: Arial, Helvetica, sans-serif !important;
        }
        .print-body-content {
            width: 100%;
            padding: 0;
            margin: 0;
        }
        table {
            width: 100% !important;
            border-collapse: collapse !important;
        }
        tr {
            page-break-inside: avoid !important;
        }
        .totals-container {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
        }
        button, .no-print {
            display: none !important;
        }
    </style>
</head>
<body>
    <div class="print-body-content">
        ${contentHtml}
    </div>
</body>
</html>`);
    printWindow.document.close();
    setTimeout(() => { printWindow.focus(); printWindow.print(); }, 700);
}

export async function generateBillPdfBlob() {
    const c = state.activePreviewCustomer;
    if (!c) throw new Error('Bill preview data not found.');

    const pages = generateA4Pages(c);
    if (!pages || pages.length === 0) throw new Error('Could not generate bill pages.');

    // Create temporary offscreen rendering container with positive high z-index and white background
    const container = document.createElement('div');
    container.id = 'fiaPdfRenderContainer';
    container.style.position = 'fixed';
    container.style.left = '0px';
    container.style.top = '0px';
    container.style.width = '816px'; // 8.5in (Letter) at 96 DPI
    container.style.background = '#ffffff';
    container.style.color = '#000000';
    container.style.zIndex = '999999';
    container.style.pointerEvents = 'none';
    container.style.opacity = '1';
    container.style.visibility = 'visible';

    // Insert each page wrapped with 816px width and white background
    container.innerHTML = pages.map((pageHtml, idx) => `
        <div id="fiaPdfPage_${idx}" style="width: 816px; min-height: 1020px; background: #ffffff; padding: 20px 28px; box-sizing: border-box; font-family: Arial, Helvetica, sans-serif; color: #000000;">
            ${pageHtml}
        </div>
    `).join('');

    document.body.appendChild(container);

    try {
        const { jsPDF } = window.jspdf || (typeof window.jsPDF === 'function' ? window : { jsPDF: window.jsPDF });
        if (!jsPDF) throw new Error('jsPDF library not available');

        const pdf = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'letter'
        });
        const pdfW = pdf.internal.pageSize.getWidth(); // 215.9mm
        const pdfH = pdf.internal.pageSize.getHeight(); // 279.4mm
        const marginX = 8;
        const marginY = 8;
        const printableW = pdfW - (marginX * 2); // 199.9mm

        for (let i = 0; i < pages.length; i++) {
            const pageEl = document.getElementById(`fiaPdfPage_${i}`);
            if (!pageEl) continue;

            const canvas = await window.html2canvas(pageEl, {
                scale: 2,
                useCORS: true,
                backgroundColor: '#ffffff',
                logging: false,
                width: 794,
                scrollX: 0,
                scrollY: 0
            });

            const imgData = canvas.toDataURL('image/jpeg', 0.95);
            const imgH = (canvas.height * printableW) / canvas.width;

            if (i > 0) pdf.addPage();
            pdf.addImage(imgData, 'JPEG', marginX, marginY, printableW, Math.min(imgH, pdfH - marginY * 2));
        }

        const outBlob = pdf.output('blob');
        if (!outBlob || outBlob.size < 500) {
            throw new Error('Generated PDF blob is empty');
        }
        return outBlob;
    } finally {
        if (document.body.contains(container)) {
            document.body.removeChild(container);
        }
    }
}

export async function downloadBillPDF() {
    const c = state.activePreviewCustomer;
    if (!c) {
        alert('Bill data is not available.');
        return;
    }
    const billNo = c?.billNo || 'BILL';
    const fileName = `FIA_Bill_${billNo}.pdf`;

    try {
        const blob = await generateBillPdfBlob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (err) {
        console.warn('PDF blob generation error, opening print dialog:', err);
        alert('PDF download encountered an issue. Opening print window (choose Save as PDF).');
        printBill();
    }
}

export async function shareBillPdfWhatsApp() {
    if (!state.activePreviewCustomer) return;
    const c = state.activePreviewCustomer;
    const billNo = c.billNo || 'BILL';
    const btn = document.getElementById('btnShareWhatsApp');
    const btnText = document.getElementById('btnShareWhatsAppText');
    const originalText = btnText ? btnText.textContent : 'Share Bill on WhatsApp';

    if (btnText) btnText.textContent = '⏳ Preparing PDF Document...';
    if (btn) btn.disabled = true;

    try {
        const blob = await generateBillPdfBlob();
        const fileName = `FIA_Bill_${billNo}.pdf`;
        const file = new File([blob], fileName, { type: 'application/pdf' });

        if (navigator.canShare && navigator.canShare({ files: [file] })) {
            if (btnText) btnText.textContent = '📲 Opening WhatsApp...';
            await navigator.share({
                files: [file],
                title: `FIA CLEAN & CARE Bill ${billNo}`,
                text: `FIA CLEAN & CARE Invoice ${billNo} for ${c.name || 'Customer'}`
            });
        } else {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(url), 2000);

            const cleanPhone = (c.phone || '').replace(/\D/g, '');
            const waUrl = cleanPhone
                ? `https://api.whatsapp.com/send?phone=91${cleanPhone}`
                : `https://api.whatsapp.com/send`;
            window.open(waUrl, '_blank');
            alert(`Invoice PDF (${fileName}) saved to your Downloads. You can attach it in WhatsApp.`);
        }
    } catch (err) {
        console.warn('WhatsApp PDF share issue:', err);
        if (err && err.name !== 'AbortError') {
            downloadBillPDF();
            alert('Could not share PDF directly to WhatsApp. The file has been saved to your Downloads.');
        }
    } finally {
        if (btnText) btnText.textContent = originalText;
        if (btn) btn.disabled = false;
    }
}

export function generateBillImageBlob() {
    return new Promise((resolve, reject) => {
        const target = document.getElementById('fiaInvoiceCaptureCard') || document.getElementById('billPreviewContent');
        if (!target) {
            reject(new Error('Bill preview content element not found.'));
            return;
        }

        if (typeof window.html2canvas !== 'undefined') {
            const targetWidth = Math.ceil(target.offsetWidth || 380);
            const targetHeight = Math.ceil(target.offsetHeight || 520);

            let scale = 3;
            if (targetHeight > 1600) scale = 1.5;
            else if (targetHeight > 1000) scale = 2;

            window.html2canvas(target, {
                scale: scale,
                useCORS: true,
                backgroundColor: '#ffffff',
                logging: false,
                width: targetWidth,
                height: targetHeight,
                scrollX: 0,
                scrollY: 0,
                onclone: (clonedDoc) => {
                    const card = clonedDoc.getElementById('fiaInvoiceCaptureCard');
                    if (card) {
                        card.style.margin = '0 auto';
                        card.style.width = targetWidth + 'px';
                        card.style.maxWidth = targetWidth + 'px';
                    }
                }
            }).then(canvas => {
                canvas.toBlob(blob => {
                    if (blob) resolve(blob);
                    else reject(new Error('Canvas blob conversion failed'));
                }, 'image/png', 0.95);
            }).catch(reject);
            return;
        }

        reject(new Error('No image generation library available.'));
    });
}

export async function shareBillImageWhatsApp() {
    if (!state.activePreviewCustomer) return;
    const c = state.activePreviewCustomer;
    const billNo = c.billNo || 'BILL';
    const btn = document.getElementById('btnShareWhatsApp');
    const btnText = document.getElementById('btnShareWhatsAppText');
    const originalText = btnText ? btnText.textContent : 'Share Bill on WhatsApp (Photo)';
    
    if (btnText) btnText.textContent = '⏳ Preparing Image...';
    if (btn) btn.disabled = true;

    try {
        const blob = await generateBillImageBlob();
        const fileName = `FIA_Bill_${billNo}.png`;
        const file = new File([blob], fileName, { type: 'image/png' });

        if (navigator.canShare && navigator.canShare({ files: [file] })) {
            if (btnText) btnText.textContent = '📲 Opening WhatsApp...';
            await navigator.share({
                files: [file]
            });
        } else {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(url), 2000);

            const cleanPhone = (c.phone || '').replace(/\D/g, '');
            const waUrl = cleanPhone
                ? `https://api.whatsapp.com/send?phone=91${cleanPhone}`
                : `https://api.whatsapp.com/send`;
            window.open(waUrl, '_blank');
            alert('Invoice image saved to your Gallery / Downloads. You can attach it in WhatsApp.');
        }
    } catch (err) {
        console.warn('WhatsApp image share encountered issue:', err);
        if (err && err.name !== 'AbortError') {
            downloadBillImage();
            alert('Could not share image directly to WhatsApp. The image has been saved to your Downloads.');
        }
    } finally {
        if (btnText) btnText.textContent = originalText;
        if (btn) btn.disabled = false;
    }
}

export async function shareBillSmartWhatsApp() {
    if (!state.activePreviewCustomer) return;
    const c = state.activePreviewCustomer;
    const itemsCount = (c.items || []).length;

    // Smart logic: if > 15 items, automatically share as PDF Document; otherwise share as Photo
    if (itemsCount > 15) {
        await shareBillPdfWhatsApp();
    } else {
        await shareBillImageWhatsApp();
    }
}

export async function downloadBillImage() {
    if (!state.activePreviewCustomer) return;
    const c = state.activePreviewCustomer;
    const billNo = c.billNo || 'BILL';
    try {
        const blob = await generateBillImageBlob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `FIA_Bill_${billNo}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (err) {
        console.error('Download bill image error:', err);
        alert('Could not generate bill image.');
    }
}

export function sendBillViaWhatsApp() {
    if (!state.activePreviewCustomer) return;
    const c = state.activePreviewCustomer;
    const isWholesale = (c.saleType || '').toLowerCase() === 'wholesale';
    let itemsText = (c.items || []).map((i, idx) => {
        const cleanName = getCleanInvoiceProductName(i.productName);
        const qtyDisplay = formatInvoiceItemQty(i);
        const rate = Number(i.rate || 0).toFixed(2);
        const total = Number(i.total || 0).toFixed(2);
        return `${idx + 1}. *${cleanName}* | ${qtyDisplay} | ₹${rate} | ₹${total}`;
    }).join('\n');
    const paidVal = c.paidAmount !== undefined ? c.paidAmount : c.grandTotal;
    const pendingVal = c.pendingAmount !== undefined ? c.pendingAmount : 0;
    
    const excessVal = Number(c.excessAmount || 0);
    const dueLine = Number(pendingVal) > 0 ? `*Balance Due:* ₹${Number(pendingVal).toFixed(2)}\n` : '';
    const returnLine = excessVal > 0 ? `*Balance Return:* ₹${excessVal.toFixed(2)}\n` : '';
    const discountVal = Number(c.discount || 0);
    const subTotalVal = Number(c.subTotal || (Number(c.grandTotal || 0) + discountVal));
    const discountLine = discountVal > 0 ? `*Subtotal:* ₹${subTotalVal.toFixed(2)}\n*Discount:* -₹${discountVal.toFixed(2)}\n` : '';
    let msg = `*FIA CLEAN AND CARE*\n*EDATHANATTUKARA*\n*MOB: 8086452106*\n*${isWholesale ? '🏷️ WHOLESALE INVOICE' : '🛍️ RETAIL INVOICE'}*\n\n*Bill No:* ${c.billNo || '—'}\n*Date:* ${formatDateDDMMYYYY(c.date)}\n*Customer:* ${String(c.name || 'Walk-in').toUpperCase()}\n*Mobile:* ${c.phone || '—'}\n\n*Items:*\n${itemsText}\n\n${discountLine}*Grand Total:* *₹${Number(c.grandTotal || 0).toFixed(2)}*\n*Paid:* ₹${Number(paidVal).toFixed(2)}\n${dueLine}${returnLine}\n_Thank you for your business!_`;
    
    if (window.history && window.history.pushState) {
        window.history.pushState({ loggedIn: true, tab: 'billing' }, "", "#billing");
    }
    
    const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;
    window.location.href = whatsappUrl;
}

// Window attachments for inline HTML onclick handlers
if (typeof window !== 'undefined') {
    window.previewBill = previewBill;
    window.previewCosSaleBill = previewCosSaleBill;
    window.closeBillPreview = closeBillPreview;
    window.printBill = printBill;
    window.downloadBillPDF = downloadBillPDF;
    window.generateBillPdfBlob = generateBillPdfBlob;
    window.shareBillPdfWhatsApp = shareBillPdfWhatsApp;
    window.shareBillImageWhatsApp = shareBillImageWhatsApp;
    window.shareBillSmartWhatsApp = shareBillSmartWhatsApp;
    window.downloadBillImage = downloadBillImage;
    window.sendBillViaWhatsApp = sendBillViaWhatsApp;
    window.sortBillItemsAlphabetically = sortBillItemsAlphabetically;
    window.getCleanInvoiceProductName = getCleanInvoiceProductName;
    window.formatInvoiceItemQty = formatInvoiceItemQty;
    window.generateA4Pages = generateA4Pages;
    window.generateA4PrintHTML = generateA4PrintHTML;
}

