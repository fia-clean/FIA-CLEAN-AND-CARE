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
        const rawQty = item.qty || '';
        const unitStr = (item.unitType && item.unitType !== 'Standard') ? item.unitType : '';
        const units = Number(item.numberOfUnits || 1);
        let qtyDisplay = `${rawQty} ${unitStr}`.trim();
        if (units > 1) qtyDisplay += ` (${units})`;
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
                </div>

                <!-- Bill & Customer Details -->
                <div style="background: #f3f4f6; border-radius: 8px; padding: 6px 8px; margin-bottom: 8px; font-size: 10.5px; line-height: 1.35; color: #111827 !important;">
                    <div style="display: flex; justify-content: space-between; border-bottom: 1px dashed #d1d5db; padding-bottom: 3px; margin-bottom: 3px;">
                        <span><strong>Bill No:</strong> <span style="color:${themeColor}; font-weight: 800;">${c.billNo || '—'}</span></span>
                        <span><strong>Date:</strong> ${formatDateDDMMYYYY(c.date)}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between;">
                        <span style="max-width: 60%; word-break: break-word;"><strong>Customer:</strong> ${c.name || 'Walk-in'}</span>
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
                    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e5e7eb; padding-bottom: 3px; margin-bottom: 3px;">
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
        const rawQty = item.qty || '';
        const unitStr = (item.unitType && item.unitType !== 'Standard') ? item.unitType : '';
        const units = Number(item.numberOfUnits || 1);
        let qtyDisplay = `${rawQty} ${unitStr}`.trim();
        if (units > 1) qtyDisplay += ` (${units})`;
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
                </div>

                <!-- Bill & Customer Details -->
                <div style="background: #fdf2f8; border-radius: 8px; padding: 6px 8px; margin-bottom: 8px; font-size: 10.5px; line-height: 1.35; color: #111827 !important;">
                    <div style="display: flex; justify-content: space-between; border-bottom: 1px dashed #fbcfe8; padding-bottom: 3px; margin-bottom: 3px;">
                        <span><strong>Bill No:</strong> <span style="color:${themeColor}; font-weight: 800;">${sale.billNo || 'COS-0001'}</span></span>
                        <span><strong>Date:</strong> ${formatDateDDMMYYYY(sale.date)}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between;">
                        <span style="max-width: 60%; word-break: break-word;"><strong>Customer:</strong> ${sale.customer || 'Walk-in'}</span>
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
}

export function printBill() {
    const printSection = document.getElementById('printSection');
    if (!printSection || !printSection.innerHTML.trim()) {
        alert('Bill data is not available for printing.');
        return;
    }
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        alert('Please allow pop-ups to print the bill.');
        return;
    }
    printWindow.document.open();
    printWindow.document.write(`<!doctype html><html><head><meta charset="UTF-8"><title>FIA CLEAN & CARE Bill</title><style>@page{size:A4;margin:25.4mm 25.4mm 20mm 25.4mm}html,body{margin:0!important;padding:0!important;background:#fff!important;color:#000!important;font-family:Arial,sans-serif}body{display:flex!important;justify-content:center!important;align-items:flex-start!important}.fia-print-box{width:100%!important;max-width:none!important;margin:0!important;padding:6mm!important;border:3px solid #000!important;border-radius:4px!important;box-sizing:border-box!important;background:#fff!important;color:#000!important;font-size:11px!important;line-height:1.35!important}.fia-print-box *{color:#000!important}.fia-print-box table{width:100%!important;border-collapse:collapse!important}.fia-print-box th,.fia-print-box td{padding:4px!important}.fia-print-box tr{page-break-inside:avoid!important}.fia-print-box button,.no-print{display:none!important}</style></head><body><div class="fia-print-box">${printSection.innerHTML}</div></body></html>`);
    printWindow.document.close();
    setTimeout(() => { printWindow.focus(); printWindow.print(); }, 700);
}

export function downloadBillPDF() {
    const printSection = document.getElementById('printSection');
    if (!printSection || !printSection.innerHTML.trim()) {
        alert('Bill data is not available for download.');
        return;
    }
    const c = state.activePreviewCustomer;
    const billNo = c?.billNo || 'BILL';
    const opt = {
        margin: [8, 8, 8, 8],
        filename: `FIA_Bill_${billNo}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    if (typeof window.html2pdf !== 'undefined') {
        window.html2pdf().set(opt).from(printSection).save();
    } else {
        printBill();
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

            window.html2canvas(target, {
                scale: 3,
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
                }, 'image/png', 1.0);
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
            alert('ബില്ലിന്റെ ഫോട്ടോ നിങ്ങളുടെ ഗാലറിയിൽ / ഡൗൺലോഡ്സിൽ സേവ് ചെയ്തിട്ടുണ്ട്. വാട്സാപ്പിൽ ആ ഫോട്ടോ മാത്രം അറ്റാച്ച് ചെയ്ത് അയക്കാവുന്നതാണ്.');
        }
    } catch (err) {
        console.warn('WhatsApp image share encountered issue:', err);
        if (err && err.name !== 'AbortError') {
            downloadBillImage();
            alert('ഇമേജ് നേരിട്ട് വാട്സാപ്പിൽ ഷെയർ ചെയ്യാൻ സാധിച്ചില്ല. ബിൽ ഫോട്ടോ നിങ്ങളുടെ ഡൗൺലോഡ്സിൽ സേവ് ചെയ്തിട്ടുണ്ട്.');
        }
    } finally {
        if (btnText) btnText.textContent = originalText;
        if (btn) btn.disabled = false;
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
        const qtyStr = `${i.qty} ${i.unitType && i.unitType !== 'Standard' ? i.unitType : ''}`.trim();
        const units = Number(i.numberOfUnits || 1);
        const rate = Number(i.rate || 0).toFixed(2);
        const total = Number(i.total || 0).toFixed(2);
        return `${idx + 1}. *${cleanName}* | ${qtyStr} | ${units} | ₹${rate} | ₹${total}`;
    }).join('\n');
    const paidVal = c.paidAmount !== undefined ? c.paidAmount : c.grandTotal;
    const pendingVal = c.pendingAmount !== undefined ? c.pendingAmount : 0;
    
    const excessVal = Number(c.excessAmount || 0);
    const dueLine = Number(pendingVal) > 0 ? `*Balance Due:* ₹${Number(pendingVal).toFixed(2)}\n` : '';
    const returnLine = excessVal > 0 ? `*Balance Return:* ₹${excessVal.toFixed(2)}\n` : '';
    let msg = `*FIA CLEAN AND CARE*\n*EDATHANATTUKARA*\n*MOB: 8086452106*\n*${isWholesale ? '🏷️ WHOLESALE INVOICE' : '🛍️ RETAIL INVOICE'}*\n\n*Bill No:* ${c.billNo || '—'}\n*Date:* ${formatDateDDMMYYYY(c.date)}\n*Customer:* ${c.name}\n*Mobile:* ${c.phone || '—'}\n\n*Items:*\n${itemsText}\n\n*Grand Total:* *₹${Number(c.grandTotal || 0).toFixed(2)}*\n*Paid:* ₹${Number(paidVal).toFixed(2)}\n${dueLine}${returnLine}\n_Thank you for your business!_`;
    
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
    window.shareBillImageWhatsApp = shareBillImageWhatsApp;
    window.downloadBillImage = downloadBillImage;
    window.sendBillViaWhatsApp = sendBillViaWhatsApp;
    window.sortBillItemsAlphabetically = sortBillItemsAlphabetically;
    window.getCleanInvoiceProductName = getCleanInvoiceProductName;
}

