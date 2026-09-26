/**
 * FIA CLEAN & CARE - Billing History & Sales Records Management
 */

import {
    state,
    markIdDeleted,
    markRecordDeleted,
    saveLocalStateSafely,
    formatDateDDMMYYYY,
    dateSortValue,
    toTitleCase
} from '../core/state.js';
import { syncToFirebase, pullFromFirebase } from '../core/db.js';
import { isAuthorizedPin } from '../core/auth.js';

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
                paymentMode: c.paymentMode || 'Cash',
                isCancelled: Boolean(c.isCancelled || c.status === 'cancelled'),
                cancelReason: c.cancelReason || '',
                cancelledAt: c.cancelledAt || null
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
            paymentMode: n.paymentMode || 'Cash',
            isCancelled: Boolean(s.isCancelled || s.status === 'cancelled'),
            cancelReason: s.cancelReason || '',
            cancelledAt: s.cancelledAt || null
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

export function renderSalesHistoryCard(r, label) {
    const safeItems = Array.isArray(r.items) ? r.items : [];
    const itemText = safeItems.map(i => i && (i.productName || i.item || 'Item')).join(', ');
    const viewFn = (r.type === 'cleaning' || r.type === 'combined') ? `window.previewBill('${r.billNo || r.id || r.index}')` : `window.previewCosSaleBill('${r.billNo || r.id || r.index}')`;
    const editFn = (r.type === 'cleaning' || r.type === 'combined') ? `window.editCustomerBill('${r.billNo || r.id || r.index}')` : `window.editCosSale('${r.billNo || r.id || r.index}')`;
    const cancelFn = (r.type === 'cleaning' || r.type === 'combined') ? `window.cancelCustomerBill('${r.billNo || r.id || r.index}')` : `window.cancelCosSale('${r.billNo || r.id || r.index}')`;
    const deleteFn = (r.type === 'cleaning' || r.type === 'combined') ? `window.deleteCustomerBill('${r.billNo || r.id || r.index}')` : `window.deleteCosSale('${r.billNo || r.id || r.index}')`;

    const isWholesale = String(r.saleType || '').toLowerCase() === 'wholesale';
    const typeBadge = isWholesale
        ? `<span class="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-sky-950/80 text-sky-300 border border-sky-700/60">🏷️ Wholesale</span>`
        : `<span class="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-950/80 text-emerald-300 border border-emerald-700/60">🛍️ Retail</span>`;

    const isCancelled = Boolean(r.isCancelled);
    const statusBadge = isCancelled
        ? `<span class="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-950 text-rose-300 border border-rose-700/80 animate-pulse">⛔ CANCELLED</span>`
        : typeBadge;

    const totalDisplay = isCancelled
        ? `<span class="line-through text-slate-500 font-medium">Total: ₹${r.total.toFixed(2)}</span> <span class="text-rose-400 font-bold text-[11px] block sm:inline sm:ml-2">❌ ${r.cancelReason || 'Order Cancelled'}</span>`
        : `<span>Total: ₹${r.total.toFixed(2)}</span> · <span class="text-emerald-400 font-semibold">Paid: ₹${r.paid.toFixed(2)}</span> · <span class="${r.due > 0 ? 'text-rose-400 font-bold' : 'text-slate-400'}">Due: ₹${r.due.toFixed(2)}</span>`;

    const cardBg = isCancelled ? 'bg-rose-950/20 border-rose-900/60' : 'bg-slate-900/80 border-slate-800';

    const actionButtons = isCancelled
        ? `
            <button type="button" onclick="${viewFn}" class="flex-1 sm:flex-initial bg-slate-800 hover:bg-slate-700 text-sky-300 px-3 py-1.5 rounded-lg font-semibold border border-slate-700 text-center transition">View</button>
            <button type="button" onclick="${deleteFn}" class="flex-1 sm:flex-initial bg-slate-800 hover:bg-rose-950/60 text-rose-300 hover:text-rose-200 px-3 py-1.5 rounded-lg font-semibold border border-slate-700 hover:border-rose-800/60 text-center transition" title="Delete record permanently">Delete</button>
          `
        : `
            <button type="button" onclick="${viewFn}" class="flex-1 sm:flex-initial bg-slate-800 hover:bg-slate-700 text-sky-300 px-3 py-1.5 rounded-lg font-semibold border border-slate-700 text-center transition">View</button>
            <button type="button" onclick="${editFn}" class="flex-1 sm:flex-initial bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-lg font-semibold border border-slate-700 text-center transition">Edit</button>
            <button type="button" onclick="${cancelFn}" class="flex-1 sm:flex-initial bg-slate-800 hover:bg-amber-950/60 text-amber-300 hover:text-amber-200 px-2.5 py-1.5 rounded-lg font-semibold border border-slate-700 hover:border-amber-800/60 text-center transition" title="Cancel bill & restore stock">Cancel</button>
            <button type="button" onclick="${deleteFn}" class="flex-1 sm:flex-initial bg-slate-800 hover:bg-rose-950/60 text-rose-300 hover:text-rose-200 px-2.5 py-1.5 rounded-lg font-semibold border border-slate-700 hover:border-rose-800/60 text-center transition" title="Delete permanently with PIN">Delete</button>
          `;

    return `<div class="${cardBg} p-3.5 rounded-xl border text-xs">
        <div class="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2.5">
            <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2 flex-wrap">
                    <span class="font-bold text-slate-100 text-sm block leading-snug break-words ${isCancelled ? 'line-through text-slate-400' : ''}">${label(r)} — #${r.billNo} ${toTitleCase(r.name)}</span>
                    ${statusBadge}
                </div>
                <div class="text-slate-400 mt-1">${formatDateDDMMYYYY(r.date)} | ${r.paymentMode}</div>
                ${r.phone ? `<div class="text-slate-400 text-[11px] mt-0.5">📞 ${r.phone}</div>` : ''}
                <div class="text-slate-300 mt-1">${itemText || 'No item details'}</div>
                <div class="mt-1 font-medium">${totalDisplay}</div>
            </div>
            <div class="flex items-center gap-1.5 justify-end shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800/80 w-full sm:w-auto">
                ${actionButtons}
            </div>
        </div>
    </div>`;
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

    container.innerHTML = rows.map(r => renderSalesHistoryCard(r, label)).join('');
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
    box.innerHTML = data.length ? data.map(r => renderSalesHistoryCard(r, label)).join('') : '<div class="text-center py-8 text-slate-500 text-xs">No sales found for this customer.</div>';
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
    const updateUi = () => {
        if (window.__fiaSalesHistoryFilter === 'customer') {
            if (typeof renderCustomerSalesHistory === 'function') renderCustomerSalesHistory();
        } else {
            renderSalesHistory();
        }
        if (window.renderCustomers) window.renderCustomers();
        if (window.renderAccounts) window.renderAccounts();
        if (typeof window.updateBillingFormDisplays === 'function') window.updateBillingFormDisplays();
    };
    pullFromFirebase().then(() => {
        updateUi();
        if (b) {
            b.disabled = false;
            b.innerHTML = '✓ Synced';
            setTimeout(() => { b.innerHTML = '↻ Refresh'; }, 1500);
        }
    }).catch(() => {
        updateUi();
        if (b) { b.disabled = false; b.innerHTML = '↻ Refresh'; }
    });
}

export function cancelCustomerBill(billIdentifier, askConfirm = true) {
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
        alert('Bill not found for cancellation.');
        return;
    }

    const c = state.customers[index];
    if (c.isCancelled || c.status === 'cancelled') {
        alert(`Bill #${c.billNo || 'selected'} is already cancelled.`);
        return;
    }

    if (askConfirm) {
        const ok = confirm(`Are you sure you want to CANCEL Bill #${c.billNo || 'selected'} (${c.name || 'Customer'})?\n\n• The bill will remain in history marked as [CANCELLED].\n• Product stock will be safely restored back to inventory.\n• Day Book income and customer due will be reversed.`);
        if (!ok) return;
    }

    const reason = prompt('Reason for cancellation (optional):', 'Customer returned goods') || 'Cancelled by user';

    c.isCancelled = true;
    c.status = 'cancelled';
    c.cancelledAt = Date.now();
    c.cancelReason = reason;
    c.savedAt = Date.now();

    // Safely restore stock once
    if (!c.stockRestored && c.items && Array.isArray(c.items)) {
        if (window.restorePackageStock) window.restorePackageStock(c.items);
        c.items.forEach(oldItem => {
            const rec = window.getStockProductRecord ? window.getStockProductRecord(oldItem) : null;
            if (rec && rec.product) {
                rec.product.stock = (parseFloat(rec.product.stock) || 0) + (parseFloat(oldItem.stockDeductionQty ?? oldItem.qty) || 0);
                rec.product.savedAt = Date.now();
            }
        });
        c.stockRestored = true;
    }

    saveLocalStateSafely();
    syncToFirebase();
    if (window.renderAll) window.renderAll();
    if (typeof window.renderSalesHistory === 'function') window.renderSalesHistory();
    if (typeof window.renderProductSalesAnalysis === 'function') window.renderProductSalesAnalysis();
    alert(`Bill #${c.billNo || ''} has been cancelled successfully.\nStock has been restored and Day Book updated.`);
}

export function cancelCosSale(billIdentifier, askConfirm = true) {
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
    if (index < 0 || !state.cosSales[index]) {
        alert('Cosmetics bill not found for cancellation.');
        return;
    }

    const s = state.cosSales[index];
    if (s.isCancelled || s.status === 'cancelled') {
        alert(`Cosmetics Bill #${s.billNo || 'selected'} is already cancelled.`);
        return;
    }

    if (askConfirm) {
        const ok = confirm(`Are you sure you want to CANCEL Cosmetics Bill #${s.billNo || 'selected'} (${s.customer || 'Customer'})?\n\n• The bill will remain in history marked as [CANCELLED].\n• Cosmetics stock will be safely restored back to inventory.\n• Day Book income will be reversed.`);
        if (!ok) return;
    }

    const reason = prompt('Reason for cancellation (optional):', 'Customer returned goods') || 'Cancelled by user';

    s.isCancelled = true;
    s.status = 'cancelled';
    s.cancelledAt = Date.now();
    s.cancelReason = reason;
    s.savedAt = Date.now();

    if (!s.stockRestored) {
        if (window.restoreCosSaleStock) window.restoreCosSaleStock(s);
        if (window.restorePackageStock) window.restorePackageStock(s.items || []);
        s.stockRestored = true;
    }

    saveLocalStateSafely();
    syncToFirebase();
    if (window.renderAll) window.renderAll();
    if (typeof window.renderSalesHistory === 'function') window.renderSalesHistory();
    if (typeof window.renderProductSalesAnalysis === 'function') window.renderProductSalesAnalysis();
    alert(`Cosmetics Bill #${s.billNo || ''} has been cancelled successfully.\nStock has been restored and Day Book updated.`);
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

    const c = state.customers[index];

    if (askConfirm) {
        // App Security PIN verification to prevent accidental permanent deletion
        const enteredPin = prompt(`🔒 Security PIN Required\n\nPermanently deleting Bill #${c.billNo || 'selected'} (${c.name || 'Customer'}) will erase it from records.\n\nPlease enter App PIN to confirm:`);
        if (enteredPin === null) return; // User cancelled
        const activePin = (state.appPin || localStorage.getItem('fia_app_pin') || '1234').trim();
        if (!isAuthorizedPin(enteredPin, activePin)) {
            alert('❌ Incorrect PIN! Deletion cancelled for security.');
            return;
        }

        if (!confirm(`Are you absolutely sure you want to permanently delete bill #${c.billNo || 'selected'}?`)) return;
    }

    // Ask stock restoration choice if bill wasn't already cancelled
    let shouldRestoreStock = false;
    if (!c.stockRestored && !c.isCancelled && c.status !== 'cancelled') {
        shouldRestoreStock = confirm(`Bill #${c.billNo || 'selected'} is being deleted.\n\nDo you want to RESTORE items back into product inventory stock?\n\n• Click [OK] = Restore Stock to Inventory\n• Click [Cancel] = Delete WITHOUT restoring stock`);
    }

    c._deleted = true;
    // Tombstone only the specific unique record ID to prevent suppressing other bills
    if (c.id) {
        markIdDeleted(c.id);
    } else if (c.billNo) {
        c.id = 'bill_' + c.billNo;
        markIdDeleted(c.id);
    }
    if (Array.isArray(state.clearedDayBookEntries)) {
        state.clearedDayBookEntries = state.clearedDayBookEntries.filter(x => x !== c.billNo && x !== c.id && x !== ('cust_' + c.billNo) && x !== ('bill_' + c.billNo));
    }

    if (shouldRestoreStock && !c.stockRestored && c.items && Array.isArray(c.items)) {
        if (window.restorePackageStock) window.restorePackageStock(c.items);
        c.items.forEach(oldItem => {
            const rec = window.getStockProductRecord ? window.getStockProductRecord(oldItem) : null;
            if (rec && rec.product) {
                rec.product.stock = (parseFloat(rec.product.stock) || 0) + (parseFloat(oldItem.stockDeductionQty ?? oldItem.qty) || 0);
                rec.product.savedAt = Date.now();
            }
        });
        c.stockRestored = true;
    }

    state.customers.splice(index, 1);
    saveLocalStateSafely();
    syncToFirebase();
    if (window.renderAll) window.renderAll();
    if (typeof window.renderSalesHistory === 'function') window.renderSalesHistory();
    if (typeof window.renderProductSalesAnalysis === 'function') window.renderProductSalesAnalysis();
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

    const s = state.cosSales[index];

    if (askConfirm) {
        const enteredPin = prompt(`🔒 Security PIN Required\n\nPermanently deleting Cosmetics Bill #${s.billNo || 'selected'} (${s.customer || 'Customer'}) will erase it from records.\n\nPlease enter App PIN to confirm:`);
        if (enteredPin === null) return;
        const activePin = (state.appPin || localStorage.getItem('fia_app_pin') || '1234').trim();
        if (!isAuthorizedPin(enteredPin, activePin)) {
            alert('❌ Incorrect PIN! Deletion cancelled for security.');
            return;
        }
        if (!confirm(`Are you absolutely sure you want to permanently delete cosmetics bill #${s.billNo || 'selected'}?`)) return;
    }

    let shouldRestoreStock = false;
    if (!s.stockRestored && !s.isCancelled && s.status !== 'cancelled') {
        shouldRestoreStock = confirm(`Cosmetics Bill #${s.billNo || 'selected'} is being deleted.\n\nDo you want to RESTORE items back into cosmetics stock?\n\n• Click [OK] = Restore Stock to Inventory\n• Click [Cancel] = Delete WITHOUT restoring stock`);
    }

    s._deleted = true;
    // Tombstone only the specific unique record ID
    if (s.id) {
        markIdDeleted(s.id);
    } else if (s.billNo) {
        s.id = 'cossale_' + s.billNo;
        markIdDeleted(s.id);
    }

    if (shouldRestoreStock && !s.stockRestored) {
        if (window.restoreCosSaleStock) window.restoreCosSaleStock(s);
        if (window.restorePackageStock) window.restorePackageStock(s.items || []);
        s.stockRestored = true;
    }

    state.cosSales.splice(index, 1);
    saveLocalStateSafely();
    syncToFirebase();
    if (window.renderAll) window.renderAll();
    if (typeof window.renderSalesHistory === 'function') window.renderSalesHistory();
    if (typeof window.renderProductSalesAnalysis === 'function') window.renderProductSalesAnalysis();
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
    window.cancelCustomerBill = cancelCustomerBill;
    window.cancelCosSale = cancelCosSale;
    window.deleteCustomerBill = deleteCustomerBill;
    window.deleteCosSale = deleteCosSale;
    window.normalizeCosSale = normalizeCosSale;
    window.adjustEditedPayment = adjustEditedPayment;
    window.adjustCosmeticsSalePayment = adjustCosmeticsSalePayment;
}

