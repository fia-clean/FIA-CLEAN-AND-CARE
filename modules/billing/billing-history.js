/**
 * FIA CLEAN & CARE - Billing History & Sales Records Management
 */

import {
    state,
    markIdDeleted,
    formatDateDDMMYYYY,
    dateSortValue
} from '../core/state.js';
import { syncToFirebase, pullFromFirebase } from '../core/db.js';

export function normalizeCosSale(s) {
    const safeItems = Array.isArray(s?.items) ? s.items : (s?.items && typeof s.items === 'object' ? Object.values(s.items) : []);
    const itemsTotal = safeItems.reduce((sum, item) => sum + Number(item?.total || 0), 0);
    const grandTotal = Number(s?.grandTotal !== undefined ? s.grandTotal : (s?.netTotal !== undefined ? s.netTotal : (s?.total !== undefined ? s.total : itemsTotal)));
    const paidAmount = Number(s?.paidAmount !== undefined ? s.paidAmount : (s?.paid !== undefined ? s.paid : grandTotal));
    const pendingAmount = Math.max(0, Number(s?.pendingAmount !== undefined ? s.pendingAmount : (s?.balance !== undefined ? s.balance : (grandTotal - paidAmount))));
    return {
        customer: s?.customer || s?.name || 'Walk-in',
        phone: s?.phone || '',
        date: s?.date || '',
        billNo: s?.billNo || '',
        saleType: s?.saleType || 'Retail',
        paymentMode: s?.paymentMode || 'Cash',
        items: safeItems,
        grandTotal,
        paidAmount,
        pendingAmount
    };
}

export function getSalesHistoryRows() {
    const rows = [];
    (state.customers || []).forEach((c, i) => {
        if (!c) return;
        const safeItems = Array.isArray(c.items) 
            ? c.items 
            : (c.items && typeof c.items === 'object' ? Object.values(c.items) : []);
        const hasTotal = Number(c.grandTotal || c.paidAmount || 0) > 0;
        const isBill = Boolean(c.billNo) || safeItems.length > 0 || hasTotal;
        if (isBill) {
            const billNo = c.billNo || ('CLN-' + String(i + 1).padStart(4, '0'));
            rows.push({
                type: (c.billType === 'Combined' ? 'combined' : 'cleaning'),
                index: i,
                id: c.id || billNo,
                billNo: billNo,
                date: c.date,
                savedAt: c.savedAt || c.date,
                name: c.name || 'Customer',
                phone: c.phone || '',
                total: Number(c.grandTotal || 0),
                paid: Number(c.paidAmount !== undefined ? c.paidAmount : (c.grandTotal || 0)),
                due: Number(c.pendingAmount !== undefined ? c.pendingAmount : Math.max(0, Number(c.grandTotal || 0) - Number(c.paidAmount || 0))),
                items: safeItems,
                saleType: c.saleType || 'Retail',
                paymentMode: c.paymentMode || 'Cash'
            });
        }
    });

    (state.cosSales || []).forEach((s, i) => {
        if (!s) return;
        const n = normalizeCosSale(s);
        const billNo = s.billNo || ('COS-' + String(i + 1).padStart(4, '0'));
        rows.push({
            type: 'cosmetics',
            index: i,
            id: s.id || billNo,
            billNo: billNo,
            date: s.date,
            savedAt: s.savedAt || s.date,
            name: s.customer || 'Customer',
            phone: s.phone || '',
            total: Number(n.grandTotal || 0),
            paid: Number(n.paidAmount || 0),
            due: Number(n.pendingAmount || 0),
            items: n.items || [],
            saleType: n.saleType || 'Retail',
            paymentMode: n.paymentMode || 'Cash'
        });
    });

    return rows.sort((a, b) => {
        const d = dateSortValue(b.date) - dateSortValue(a.date);
        if (d !== 0) return d;
        const tB = b.savedAt ? new Date(b.savedAt).getTime() : 0;
        const tA = a.savedAt ? new Date(a.savedAt).getTime() : 0;
        if (tB && tA && tB !== tA) return tB - tA;
        return b.index - a.index;
    });
}

export function renderSalesHistory() {
    const container = document.getElementById('salesHistoryContainer');
    if (!container) return;
    const allRows = getSalesHistoryRows();
    const filter = (window.__fiaSalesHistoryFilter || 'all').toLowerCase();
    let rows = allRows;
    if (filter === 'wholesale') {
        rows = allRows.filter(r => String(r.saleType || '').toLowerCase() === 'wholesale');
    } else if (filter === 'retail') {
        rows = allRows.filter(r => String(r.saleType || '').toLowerCase() !== 'wholesale');
    } else if (filter === 'cleaning') {
        rows = allRows.filter(r => r.type === 'cleaning');
    } else if (filter === 'cosmetics') {
        rows = allRows.filter(r => r.type === 'cosmetics');
    }
    const label = r => r.type === 'cleaning' ? '🧹 Cleaning' : r.type === 'combined' ? '🧾 Combined' : '💄 Cosmetics';
    
    if (!rows.length) {
        container.innerHTML = `
            <div class="text-center py-8 text-slate-500 text-xs space-y-3 bg-slate-900/40 rounded-xl border border-slate-800/80 p-4">
                <p class="font-medium">No sales bills found for <span class="text-slate-300 font-bold uppercase">${filter}</span> filter.</p>
                <div class="flex justify-center gap-2 pt-1">
                    <button type="button" onclick="window.setSalesHistoryFilter('all')" class="bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-lg font-bold text-xs border border-slate-700 transition">Show All Bills</button>
                    <button type="button" onclick="window.refreshSalesHistoryFromCloud()" class="bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 px-3 py-1.5 rounded-lg font-bold text-xs border border-emerald-700/60 transition">↻ Sync Cloud</button>
                </div>
            </div>`;
        return;
    }

    container.innerHTML = rows.map(r => {
        const safeItems = Array.isArray(r.items) ? r.items : [];
        const itemText = safeItems.map(i => i && (i.productName || i.item || 'Item')).join(', ');
        const viewFn = (r.type === 'cleaning' || r.type === 'combined') ? `window.previewBill('${r.billNo || r.id || r.index}')` : `window.previewCosSaleBill('${r.billNo || r.id || r.index}')`;
        const editFn = (r.type === 'cleaning' || r.type === 'combined') ? `window.editCustomerBill('${r.billNo || r.id || r.index}')` : `window.editCosSale('${r.billNo || r.id || r.index}')`;
        const deleteFn = (r.type === 'cleaning' || r.type === 'combined') ? `window.deleteCustomerBill('${r.billNo || r.id || r.index}')` : `window.deleteCosSale('${r.billNo || r.id || r.index}')`;
        const isWholesale = String(r.saleType || '').toLowerCase() === 'wholesale';
        const badgeHtml = isWholesale
            ? `<span class="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-950/80 text-amber-300 border border-amber-700/60">🏷️ Wholesale</span>`
            : `<span class="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-950/80 text-emerald-300 border border-emerald-700/60">🛍️ Retail</span>`;
        return `<div class="bg-slate-900/70 p-3 rounded-xl border border-slate-800 text-xs">
            <div class="flex justify-between items-start gap-2">
                <div class="min-w-0 flex-1">
                    <div class="flex items-center gap-2 flex-wrap">
                        <span class="font-bold ${r.type==='cleaning'?'text-amber-300':r.type==='combined'?'text-cyan-300':'text-pink-300'}">${label(r)} — #${r.billNo} ${r.name}</span>
                        ${badgeHtml}
                    </div>
                    <div class="text-slate-400 mt-0.5">${formatDateDDMMYYYY(r.date)} | ${r.paymentMode}</div>
                    ${r.phone ? `<div class="text-slate-500 mt-0.5">📞 ${r.phone}</div>` : ''}
                    <div class="text-slate-300 mt-1">${itemText || 'No item details'}</div>
                    <div class="mt-1"><span>Total: ₹${r.total.toFixed(2)}</span> · <span class="text-emerald-300">Paid: ₹${r.paid.toFixed(2)}</span> · <span class="text-rose-300">Due: ₹${r.due.toFixed(2)}</span></div>
                </div>
                <div class="flex flex-wrap gap-1 justify-end shrink-0">
                    <button type="button" onclick="${viewFn}" class="bg-blue-900 hover:bg-blue-800 text-blue-200 px-2.5 py-1.5 rounded-lg font-bold transition">View</button>
                    <button type="button" onclick="${editFn}" class="bg-slate-800 hover:bg-slate-700 text-amber-400 px-2.5 py-1.5 rounded-lg font-bold border border-slate-700 transition">Edit</button>
                    <button type="button" onclick="${deleteFn}" class="bg-red-900 hover:bg-red-800 text-red-200 px-2.5 py-1.5 rounded-lg font-bold transition">Delete</button>
                </div>
            </div>
        </div>`;
    }).join('');
}

export function renderCustomerSalesHistory() {
    const box = document.getElementById('salesHistoryContainer');
    if (!box) return;
    const q = (document.getElementById('salesHistoryCustomerQuery')?.value || '').trim().toLowerCase();
    if (!q) {
        box.innerHTML = '<div class="text-center py-8 text-slate-500 text-xs">Search by customer name, phone number, or bill number.</div>';
        return;
    }
    const allRows = getSalesHistoryRows();
    const data = allRows.filter(r => String(r.name).toLowerCase().includes(q) || String(r.phone).toLowerCase().includes(q) || String(r.billNo).toLowerCase().includes(q));
    const label = r => r.type === 'cleaning' ? '🧹 Cleaning' : r.type === 'combined' ? '🧾 Combined' : '💄 Cosmetics';
    box.innerHTML = data.length ? data.map(r => {
        const safeItems = Array.isArray(r.items) ? r.items : [];
        const itemText = safeItems.map(i => i && (i.productName || i.item || 'Item')).join(', ');
        const viewFn = (r.type === 'cleaning' || r.type === 'combined') ? `window.previewBill('${r.billNo || r.id || r.index}')` : `window.previewCosSaleBill('${r.billNo || r.id || r.index}')`;
        const editFn = (r.type === 'cleaning' || r.type === 'combined') ? `window.editCustomerBill('${r.billNo || r.id || r.index}')` : `window.editCosSale('${r.billNo || r.id || r.index}')`;
        const deleteFn = (r.type === 'cleaning' || r.type === 'combined') ? `window.deleteCustomerBill('${r.billNo || r.id || r.index}')` : `window.deleteCosSale('${r.billNo || r.id || r.index}')`;
        const isWholesale = String(r.saleType || '').toLowerCase() === 'wholesale';
        const badgeHtml = isWholesale
            ? `<span class="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-950/80 text-amber-300 border border-amber-700/60">🏷️ Wholesale</span>`
            : `<span class="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-950/80 text-emerald-300 border border-emerald-700/60">🛍️ Retail</span>`;
        return `<div class="bg-slate-900/70 p-3 rounded-xl border border-slate-800 text-xs"><div class="flex justify-between items-start gap-2"><div class="min-w-0 flex-1"><div class="flex items-center gap-2 flex-wrap"><div class="font-bold ${r.type==='cleaning'?'text-amber-300':r.type==='combined'?'text-cyan-300':'text-pink-300'}">${label(r)} — #${r.billNo} ${r.name}</div>${badgeHtml}</div><div class="text-slate-400">${formatDateDDMMYYYY(r.date)} | ${r.paymentMode}</div>${r.phone?`<div class="text-slate-500">📞 ${r.phone}</div>`:''}<div class="text-slate-300 mt-1">${itemText}</div><div class="mt-1">Total ₹${r.total.toFixed(2)} · <span class="text-emerald-300">Paid ₹${r.paid.toFixed(2)}</span> · <span class="text-rose-300">Due ₹${r.due.toFixed(2)}</span></div></div><div class="flex flex-wrap gap-1 justify-end shrink-0"><button type="button" onclick="${viewFn}" class="bg-blue-900 hover:bg-blue-800 text-blue-200 px-2.5 py-1.5 rounded-lg font-bold transition">View</button><button type="button" onclick="${editFn}" class="bg-slate-800 hover:bg-slate-700 text-amber-400 px-2.5 py-1.5 rounded-lg font-bold border border-slate-700 transition">Edit</button><button type="button" onclick="${deleteFn}" class="bg-red-900 hover:bg-red-800 text-red-200 px-2.5 py-1.5 rounded-lg font-bold transition">Delete</button></div></div></div>`;
    }).join('') : '<div class="text-center py-8 text-slate-500 text-xs">No sales found for this customer.</div>';
}

export function setSalesHistoryFilter(f) {
    window.__fiaSalesHistoryFilter = f;
    ['All','Wholesale','Retail','Customer','Cleaning','Cosmetics'].forEach(x => {
        const b = document.getElementById('salesHistoryTab' + x);
        if (b) b.className = 'py-2 rounded-lg bg-slate-900 text-slate-300 border border-slate-700 text-[10px] font-bold';
    });
    const key = f.charAt(0).toUpperCase() + f.slice(1);
    const activeBtn = document.getElementById('salesHistoryTab' + key);
    if (activeBtn) {
        if (f === 'wholesale') activeBtn.className = 'py-2 rounded-lg bg-amber-600 text-white text-[10px] font-bold shadow';
        else if (f === 'retail') activeBtn.className = 'py-2 rounded-lg bg-emerald-600 text-white text-[10px] font-bold shadow';
        else if (f === 'customer') activeBtn.className = 'py-2 rounded-lg bg-cyan-700 text-white text-[10px] font-bold shadow';
        else activeBtn.className = 'py-2 rounded-lg bg-slate-700 text-white text-[10px] font-bold shadow';
    }
    
    const q = document.getElementById('salesHistoryCustomerSearch');
    if (q) {
        q.classList.toggle('hidden', f !== 'customer');
        if (f === 'customer') {
            const input = document.getElementById('salesHistoryCustomerQuery');
            if (input) setTimeout(() => input.focus(), 50);
        }
    }
    
    if (f === 'customer') {
        renderCustomerSalesHistory();
    } else {
        renderSalesHistory();
    }
}

export function refreshSalesHistoryFromCloud() {
    const b = document.getElementById('centralSalesHistoryRefreshBtn');
    if (b) { b.disabled = true; b.innerHTML = '⟳ Syncing with Cloud…'; }
    pullFromFirebase().then(() => {
        renderSalesHistory();
        if (window.renderCustomers) window.renderCustomers();
        if (window.renderAccounts) window.renderAccounts();
        if (b) {
            b.disabled = false;
            b.innerHTML = '✓ Synced';
            setTimeout(() => { b.innerHTML = '↻ Refresh'; }, 1500);
        }
    }).catch(() => {
        renderSalesHistory();
        if (b) { b.disabled = false; b.innerHTML = '↻ Refresh'; }
    });
}

export function deleteCustomerBill(billIdentifier, askConfirm = true) {
    let index = -1;
    if (typeof billIdentifier === 'number') {
        index = billIdentifier;
    } else if (billIdentifier !== undefined && billIdentifier !== null) {
        const idStr = String(billIdentifier).trim().toLowerCase();
        index = (state.customers || []).findIndex(c => c && (String(c.billNo || '').trim().toLowerCase() === idStr || String(c.id || '').trim().toLowerCase() === idStr));
        if (index === -1 && /^\d+$/.test(idStr)) {
            index = parseInt(idStr, 10);
        }
    }
    if (index < 0 || !state.customers[index]) {
        console.warn('Bill not found for deletion:', billIdentifier);
        return;
    }
    if (askConfirm && !confirm('Are you sure you want to delete this bill?')) return;

    const c = state.customers[index];
    if (c.billNo) markIdDeleted(c.billNo);
    if (c.id) markIdDeleted(c.id);
    if (Array.isArray(state.clearedDayBookEntries)) {
        state.clearedDayBookEntries = state.clearedDayBookEntries.filter(x => x !== c.billNo && x !== c.id && x !== ('cust_' + c.billNo) && x !== ('bill_' + c.billNo));
    }

    if (c.items && Array.isArray(c.items)) {
        if (window.restorePackageStock) window.restorePackageStock(c.items);
        c.items.forEach(oldItem => {
            const rec = window.getStockProductRecord ? window.getStockProductRecord(oldItem) : null;
            if (rec && rec.product) {
                rec.product.stock = (parseFloat(rec.product.stock) || 0) + (parseFloat(oldItem.stockDeductionQty ?? oldItem.qty) || 0);
            }
        });
    }

    state.customers.splice(index, 1);
    syncToFirebase();
    if (window.renderAll) window.renderAll();
    alert("Bill deleted successfully!");
}

export function deleteCosSale(billIdentifier, askConfirm = true) {
    let index = -1;
    if (typeof billIdentifier === 'number') {
        index = billIdentifier;
    } else if (billIdentifier !== undefined && billIdentifier !== null) {
        const idStr = String(billIdentifier).trim().toLowerCase();
        index = (state.cosSales || []).findIndex(s => s && (String(s.billNo || '').trim().toLowerCase() === idStr || String(s.id || '').trim().toLowerCase() === idStr));
        if (index === -1 && /^\d+$/.test(idStr)) {
            index = parseInt(idStr, 10);
        }
    }
    if (index < 0 || !state.cosSales[index]) return;
    if (askConfirm && !confirm('Are you sure you want to delete this cosmetics bill?')) return;

    const s = state.cosSales[index];
    if (s.billNo) markIdDeleted(s.billNo);
    if (s.id) markIdDeleted(s.id);

    if (window.restoreCosSaleStock) window.restoreCosSaleStock(s);
    if (window.restorePackageStock) window.restorePackageStock(s.items || []);

    state.cosSales.splice(index, 1);
    syncToFirebase();
    if (window.renderAll) window.renderAll();
    alert("Cosmetics bill deleted successfully!");
}

export function adjustEditedPayment(direction) {
    const index = parseInt(document.getElementById('custIndex')?.value, 10);
    if (isNaN(index) || index < 0 || !state.customers[index]) {
        alert('Please click Edit on a Due bill first.');
        return;
    }
    const amount = parseFloat(document.getElementById('paymentAdjustmentAmt')?.value) || 0;
    if (amount <= 0) {
        alert('Enter a valid adjustment amount.');
        return;
    }
    const c = state.customers[index];
    const grandTotal = Number(c.grandTotal || (state.currentBillItems || []).reduce((sum, i) => sum + Number(i.total || 0), 0));
    let paid = Number(document.getElementById('billPaidAmt')?.value) || 0;
    paid = direction === 'add' ? Math.min(grandTotal, paid + amount) : Math.max(0, paid - amount);
    const paidInput = document.getElementById('billPaidAmt');
    if (paidInput) paidInput.value = paid.toFixed(2);
    const adjInput = document.getElementById('paymentAdjustmentAmt');
    if (adjInput) adjInput.value = '';
    if (window.calculateBalance) window.calculateBalance();
}

export function adjustCosmeticsSalePayment(direction) {
    const index = parseInt(document.getElementById('cosSIndex')?.value, 10);
    if (isNaN(index) || index < 0 || !state.cosSales[index]) {
        alert('Please click Edit on a cosmetics due bill first.');
        return;
    }
    const amount = parseFloat(document.getElementById('cosmeticsPaymentAdjustmentAmt')?.value || document.getElementById('paymentAdjustmentAmt')?.value) || 0;
    if (amount <= 0) {
        alert('Enter a valid adjustment amount.');
        return;
    }
    const sale = state.cosSales[index];
    const total = normalizeCosSale(sale).grandTotal;
    let paid = Number(document.getElementById('cosSPaid')?.value) || 0;
    paid = direction === 'add' ? Math.min(total, paid + amount) : Math.max(0, paid - amount);
    if (Array.isArray(sale.items)) {
        sale.paidAmount = paid;
        sale.pendingAmount = Math.max(0, total - paid);
    } else {
        sale.paid = paid;
        sale.balance = Math.max(0, total - paid);
    }
    const paidEl = document.getElementById('cosSPaid');
    if (paidEl) paidEl.value = paid.toFixed(2);
    const balEl = document.getElementById('cosSBalance');
    if (balEl) balEl.value = Math.max(0, total - paid).toFixed(2);
    const cosAdj = document.getElementById('cosmeticsPaymentAdjustmentAmt');
    if (cosAdj) cosAdj.value = '';
    syncToFirebase();
    if (window.renderCosSales) window.renderCosSales();
    if (window.renderCosmeticsSummary) window.renderCosmeticsSummary();
    if (window.renderAccounts) window.renderAccounts();
    if (window.updateDashboard) window.updateDashboard();
    renderSalesHistory();
}

// Window attachments for inline HTML onclick handlers
if (typeof window !== 'undefined') {
    window.getSalesHistoryRows = getSalesHistoryRows;
    window.renderSalesHistory = renderSalesHistory;
    window.renderCustomerSalesHistory = renderCustomerSalesHistory;
    window.setSalesHistoryFilter = setSalesHistoryFilter;
    window.refreshSalesHistoryFromCloud = refreshSalesHistoryFromCloud;
    window.deleteCustomerBill = deleteCustomerBill;
    window.deleteCosSale = deleteCosSale;
    window.normalizeCosSale = normalizeCosSale;
    window.adjustEditedPayment = adjustEditedPayment;
    window.adjustCosmeticsSalePayment = adjustCosmeticsSalePayment;
}

