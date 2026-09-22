/**
 * FIA CLEAN & CARE - Day Book & Financial Analytics Engine
 * Aggregates all transactions (Sales, Collections, Purchases, Expenses), calculates profit margins,
 * handles Day Book ledgers, CSV export, and date preset filters.
 */

import {
    state,
    normalizeToDateKey,
    dateSortValue,
    formatDateDDMMYYYY,
    parseDateDDMMYYYY,
    getTodayDateString,
    todayDDMMYYYY,
    saveLocalStateSafely,
    isItemDeleted,
    isCustItemDeleted
} from '../core/state.js';
import { syncToFirebase, pullFromFirebase } from '../core/db.js';
import { normalizeCosSale } from '../billing/billing-history.js';

export function dashboardDateKey(v) {
    return normalizeToDateKey(v);
}

export function setupDateFields() {
    const expDateEl = document.getElementById('expDate');
    if (expDateEl) {
        if (!expDateEl.value || typeof expDateEl.value === 'function' || String(expDateEl.value).includes('function')) {
            expDateEl.value = getTodayDateString();
        } else {
            expDateEl.value = normalizeToDateKey(expDateEl.value) || getTodayDateString();
        }
    }
}

export function getYesterdayDateString() {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

export function syncFolderDateInputs() {
    const fromVal = document.getElementById('filterFromDate')?.value || '';
    const toVal = document.getElementById('filterToDate')?.value || '';

    const folderFrom = document.getElementById('folderFilterFromDate');
    const folderTo = document.getElementById('folderFilterToDate');
    const folderDate = document.getElementById('folderSpecificDate');

    if (folderFrom && folderFrom.value !== fromVal) folderFrom.value = fromVal;
    if (folderTo && folderTo.value !== toVal) folderTo.value = toVal;

    if (folderDate) {
        if (fromVal && fromVal === toVal) {
            folderDate.value = fromVal;
        } else {
            folderDate.value = '';
        }
    }
}

export function onFolderSpecificDateChange(val) {
    const fromEl = document.getElementById('filterFromDate');
    const toEl = document.getElementById('filterToDate');
    const folderFrom = document.getElementById('folderFilterFromDate');
    const folderTo = document.getElementById('folderFilterToDate');

    if (!val) {
        setFilterPreset('all');
        return;
    }

    if (fromEl) fromEl.value = val;
    if (toEl) toEl.value = val;
    if (folderFrom) folderFrom.value = val;
    if (folderTo) folderTo.value = val;

    const todayStr = getTodayDateString();
    const yestStr = getYesterdayDateString();

    let matched = 'custom';
    if (val === todayStr) matched = 'today';
    else if (val === yestStr) matched = 'yesterday';

    updateDayBookPresetButtons(matched);
    renderAccounts();
}

export function onFolderDateRangeChange() {
    const folderFrom = document.getElementById('folderFilterFromDate');
    const folderTo = document.getElementById('folderFilterToDate');
    const fromEl = document.getElementById('filterFromDate');
    const toEl = document.getElementById('filterToDate');
    const folderDate = document.getElementById('folderSpecificDate');

    const fromVal = folderFrom?.value || '';
    const toVal = folderTo?.value || '';

    if (fromEl) fromEl.value = fromVal;
    if (toEl) toEl.value = toVal;

    if (folderDate) {
        if (fromVal && fromVal === toVal) {
            folderDate.value = fromVal;
        } else {
            folderDate.value = '';
        }
    }

    onDayBookDateInputChange();
}

export function updateDayBookPresetButtons(preset) {
    state.currentDayBookPreset = preset || 'all';

    // Top filter buttons
    const btnToday = document.getElementById('dayBookTabToday');
    const btnYesterday = document.getElementById('dayBookTabYesterday');
    const btnMonth = document.getElementById('dayBookTabMonth');
    const btnAll = document.getElementById('dayBookTabAll');

    // Folder filter buttons
    const folderToday = document.getElementById('folderTabToday');
    const folderYesterday = document.getElementById('folderTabYesterday');
    const folderMonth = document.getElementById('folderTabMonth');
    const folderAll = document.getElementById('folderTabAll');

    // Badges
    const periodBadge = document.getElementById('dayBookActivePeriodBadge');
    const folderBadge = document.getElementById('folderCurrentFilterBadge');

    const topActiveClass = 'bg-indigo-600 text-white py-2 rounded-xl text-xs font-bold shadow-xs border border-indigo-600 transition cursor-pointer text-center';
    const topInactiveClass = 'bg-white text-slate-700 py-2 rounded-xl text-xs font-semibold border border-slate-300 hover:bg-slate-100 transition cursor-pointer text-center';

    const folderActiveClass = 'py-1.5 px-1 text-center rounded-lg font-bold transition text-[11px] bg-indigo-600 text-white border border-indigo-600 shadow-xs cursor-pointer';
    const folderInactiveClass = 'py-1.5 px-1 text-center rounded-lg font-bold transition text-[11px] bg-white text-slate-700 hover:bg-slate-100 border border-slate-300 cursor-pointer';

    if (btnToday) btnToday.className = (preset === 'today') ? topActiveClass : topInactiveClass;
    if (btnYesterday) btnYesterday.className = (preset === 'yesterday') ? topActiveClass : topInactiveClass;
    if (btnMonth) btnMonth.className = (preset === 'month') ? topActiveClass : topInactiveClass;
    if (btnAll) btnAll.className = (preset === 'all') ? topActiveClass : topInactiveClass;

    if (folderToday) folderToday.className = (preset === 'today') ? folderActiveClass : folderInactiveClass;
    if (folderYesterday) folderYesterday.className = (preset === 'yesterday') ? folderActiveClass : folderInactiveClass;
    if (folderMonth) folderMonth.className = (preset === 'month') ? folderActiveClass : folderInactiveClass;
    if (folderAll) folderAll.className = (preset === 'all') ? folderActiveClass : folderInactiveClass;

    // Determine badge text and styles based on dates and preset
    const fromVal = document.getElementById('filterFromDate')?.value || '';
    const toVal = document.getElementById('filterToDate')?.value || '';
    const todayStr = getTodayDateString();
    const yestStr = getYesterdayDateString();

    let badgeText = '🌐 All Time';
    let badgeClass = 'text-[10px] text-sky-800 font-bold bg-sky-50 px-2.5 py-0.5 rounded-md border border-sky-200';

    if (preset === 'today' || (fromVal && fromVal === toVal && fromVal === todayStr)) {
        badgeText = '📅 Today';
        badgeClass = 'text-[10px] text-emerald-800 font-bold bg-emerald-50 px-2.5 py-0.5 rounded-md border border-emerald-200';
    } else if (preset === 'yesterday' || (fromVal && fromVal === toVal && fromVal === yestStr)) {
        badgeText = '⏮️ Yesterday';
        badgeClass = 'text-[10px] text-amber-800 font-bold bg-amber-50 px-2.5 py-0.5 rounded-md border border-amber-200';
    } else if (preset === 'month') {
        badgeText = '🗓️ This Month';
        badgeClass = 'text-[10px] text-indigo-800 font-bold bg-indigo-50 px-2.5 py-0.5 rounded-md border border-indigo-200';
    } else if (preset === 'all' || (!fromVal && !toVal)) {
        badgeText = '🌐 All Time';
        badgeClass = 'text-[10px] text-sky-800 font-bold bg-sky-50 px-2.5 py-0.5 rounded-md border border-sky-200';
    } else if (fromVal && toVal && fromVal === toVal) {
        badgeText = `📅 ${formatDateDDMMYYYY(fromVal)}`;
        badgeClass = 'text-[10px] text-teal-800 font-bold bg-teal-50 px-2.5 py-0.5 rounded-md border border-teal-200';
    } else {
        const fromDisp = fromVal ? formatDateDDMMYYYY(fromVal) : 'Start';
        const toDisp = toVal ? formatDateDDMMYYYY(toVal) : 'Now';
        badgeText = `🔍 ${fromDisp} → ${toDisp}`;
        badgeClass = 'text-[10px] text-purple-800 font-bold bg-purple-50 px-2.5 py-0.5 rounded-md border border-purple-200';
    }

    if (periodBadge) {
        periodBadge.textContent = badgeText;
        periodBadge.className = `hidden sm:inline-block ${badgeClass}`;
    }
    if (folderBadge) {
        folderBadge.textContent = badgeText;
        folderBadge.className = badgeClass;
    }
}

export function setFilterPreset(preset) {
    const fromEl = document.getElementById('filterFromDate');
    const toEl = document.getElementById('filterToDate');
    const todayStr = getTodayDateString();
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');

    if (preset === 'today') {
        if (fromEl) fromEl.value = todayStr;
        if (toEl) toEl.value = todayStr;
    } else if (preset === 'yesterday') {
        const yestStr = getYesterdayDateString();
        if (fromEl) fromEl.value = yestStr;
        if (toEl) toEl.value = yestStr;
    } else if (preset === 'month') {
        const firstDayStr = y + '-' + m + '-01';
        const lastDayNum = new Date(y, d.getMonth() + 1, 0).getDate();
        const lastDayStr = y + '-' + m + '-' + String(lastDayNum).padStart(2, '0');
        if (fromEl) fromEl.value = firstDayStr;
        if (toEl) toEl.value = lastDayStr;
    } else {
        preset = 'all';
        if (fromEl) fromEl.value = '';
        if (toEl) toEl.value = '';
    }

    syncFolderDateInputs();
    updateDayBookPresetButtons(preset);
    renderAccounts();
}

export function onDayBookDateInputChange() {
    const fromVal = document.getElementById('filterFromDate')?.value || '';
    const toVal = document.getElementById('filterToDate')?.value || '';
    const todayStr = getTodayDateString();
    const yestStr = getYesterdayDateString();
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const firstDayStr = y + '-' + m + '-01';
    const lastDayNum = new Date(y, d.getMonth() + 1, 0).getDate();
    const lastDayStr = y + '-' + m + '-' + String(lastDayNum).padStart(2, '0');

    let matched = 'custom';
    if (!fromVal && !toVal) matched = 'all';
    else if (fromVal === todayStr && toVal === todayStr) matched = 'today';
    else if (fromVal === yestStr && toVal === yestStr) matched = 'yesterday';
    else if (fromVal === firstDayStr && (toVal === lastDayStr || toVal === todayStr)) matched = 'month';

    syncFolderDateInputs();
    updateDayBookPresetButtons(matched);
    renderAccounts();
}

export function restoreClearedDayBook() {
    if (!state.clearedDayBookEntries || state.clearedDayBookEntries.length === 0) {
        alert('No cleared transactions to restore.');
        return;
    }
    if (!confirm(`Restore ${state.clearedDayBookEntries.length} hidden transaction(s) back to Day Book ledger?`)) return;
    const count = state.clearedDayBookEntries.length;
    state.clearedDayBookEntries = [];
    saveLocalStateSafely();
    syncToFirebase();
    renderAccounts();
    alert(`✅ Restored ${count} transaction(s) back to Day Book view.`);
}

export async function refreshDayBookRealtime() {
    const refreshBtn = document.getElementById('dayBookRefreshBtn');
    if (refreshBtn) {
        refreshBtn.classList.add('animate-spin');
        refreshBtn.disabled = true;
    }
    try {
        ensureStableTransactionIds();
        if (typeof pullFromFirebase === 'function') {
            await pullFromFirebase();
        }
        renderAccounts();
    } catch (e) {
        console.error('Day Book refresh error:', e);
        renderAccounts();
    } finally {
        if (refreshBtn) {
            refreshBtn.classList.remove('animate-spin');
            refreshBtn.disabled = false;
        }
    }
}

export function ensureStableTransactionIds() {
    let changed = false;
    const ensure = (arr, prefix) => {
        (arr || []).forEach((item, i) => {
            if (!item || typeof item !== 'object') return;
            if (!item.savedAt) {
                item.savedAt = Date.now() + i;
                changed = true;
            }
            if (!item.id) {
                item.id = prefix + '_' + (item.billNo ? item.billNo + '_' : '') + (item.savedAt || Date.now()) + '_' + i;
                changed = true;
            }
        });
    };
    ensure(state.purchases, 'purch');
    ensure(state.expenses, 'exp');
    ensure(state.cosPurchases, 'cospurch');
    ensure(state.customers, 'cust');
    ensure(state.cosSales, 'cossale');
    if (changed) {
        try { saveLocalStateSafely(); } catch (e) {}
    }
}

export function getAllMasterEntries() {
    ensureStableTransactionIds();
    let entries = [];

    // 1. Cleaning & Combined Customer Bills
    (state.customers || []).forEach((c, i) => {
        if (!c || c._deleted || isCustItemDeleted(c)) return;
        const safeItems = Array.isArray(c.items) ? c.items : (c.items && typeof c.items === 'object' ? Object.values(c.items) : []);
        const itemsSum = safeItems.reduce((s, it) => s + (Number(it?.total || (Number(it?.price || it?.rate || 0) * Number(it?.qty || 1))) || 0), 0);
        let incomeVal = Number(c.grandTotal !== undefined ? c.grandTotal : (c.netTotal !== undefined ? c.netTotal : (c.total !== undefined ? c.total : (c.paidAmount !== undefined ? c.paidAmount : itemsSum))));
        if ((!incomeVal || incomeVal <= 0) && itemsSum > 0) incomeVal = itemsSum;

        const entryId = c.id ? (c.id.startsWith('bill_') || c.id.startsWith('cust_') ? c.id : 'bill_' + c.id) : ('bill_' + (c.billNo ? String(c.billNo) : (c.savedAt || i)));
        if (incomeVal > 0 || Number(c.paidAmount || 0) > 0) {
            const cleanDate = normalizeToDateKey(c.date) || normalizeToDateKey(c.savedAt) || normalizeToDateKey(c.createdAt) || getTodayDateString();
            entries.push({
                id: entryId,
                originalId: c.id || (c.billNo ? String(c.billNo) : entryId),
                type: 'Income',
                category: c.billType === 'Combined' ? 'Combined Sale' : 'Cleaning Sale',
                desc: `${c.billType === 'Combined' ? 'Bill' : 'Cleaning Bill'} #${c.billNo || (i + 1)} (${c.name || 'Customer'})`,
                amount: incomeVal,
                paidAmount: Number(c.paidAmount !== undefined ? c.paidAmount : (incomeVal - Number(c.pendingAmount || 0))),
                pendingAmount: Math.max(0, Number(c.pendingAmount || 0)),
                paymentMode: c.paymentMode || 'Cash',
                date: cleanDate,
                timestamp: Number(c.savedAt || c.createdAt || dateSortValue(cleanDate) || 0)
            });
        }
    });

    // 2. Cosmetics Sales Bills
    (state.cosSales || []).forEach((s, i) => {
        if (!s || s._deleted || isItemDeleted(s, 'cosSale')) return;
        const norm = normalizeCosSale(s) || {};
        let incomeVal = Number(norm.grandTotal !== undefined ? norm.grandTotal : (norm.paidAmount || 0));
        if ((!incomeVal || incomeVal <= 0) && Array.isArray(norm.items) && norm.items.length > 0) {
            incomeVal = norm.items.reduce((sum, it) => sum + (Number(it?.total || (Number(it?.price || it?.rate || 0) * Number(it?.qty || 1))) || 0), 0);
        }
        const entryId = s.id ? (s.id.startsWith('cossale_') ? s.id : 'cossale_' + s.id) : ('cossale_' + (s.billNo ? String(s.billNo) : (s.savedAt || i)));
        if (incomeVal > 0 || Number(norm.paidAmount || 0) > 0) {
            const cleanDate = normalizeToDateKey(s.date) || normalizeToDateKey(s.savedAt) || normalizeToDateKey(s.createdAt) || getTodayDateString();
            entries.push({
                id: entryId,
                originalId: s.id || (s.billNo ? String(s.billNo) : entryId),
                type: 'Income',
                category: 'Cosmetics Sale',
                desc: `Cosmetics Bill #${s.billNo || (i + 1)} (${norm.customer || s.customer || s.name || 'Customer'})`,
                amount: incomeVal,
                paidAmount: Number(norm.paidAmount !== undefined ? norm.paidAmount : (incomeVal - Number(norm.pendingAmount || 0))),
                pendingAmount: Math.max(0, Number(norm.pendingAmount || 0)),
                paymentMode: norm.paymentMode || s.paymentMode || 'Cash',
                date: cleanDate,
                timestamp: Number(s.savedAt || s.createdAt || dateSortValue(cleanDate) || 0)
            });
        }
    });

    // 3. Cleaning Purchases
    (state.purchases || []).forEach((p, i) => {
        if (!p || p._deleted || isItemDeleted(p, 'purchase')) return;
        const gross = Number(p.rawCost !== undefined ? p.rawCost : (p.cost !== undefined ? p.cost : (p.amount !== undefined ? p.amount : (p.paid || 0))));
        const amount = p.netPurchaseAmount !== undefined ? Number(p.netPurchaseAmount) : (gross || Number(p.paid || 0));
        const entryId = p.id ? (p.id.startsWith('purch_') ? p.id : 'purch_' + p.id) : ('purch_' + (p.savedAt || i));
        if (amount > 0 || gross > 0 || Number(p.paid || 0) > 0) {
            const cleanDate = normalizeToDateKey(p.date) || normalizeToDateKey(p.savedAt) || normalizeToDateKey(p.createdAt) || getTodayDateString();
            entries.push({
                id: entryId,
                originalId: p.id || entryId,
                type: 'Expense',
                category: 'Purchase',
                desc: `Purchase: ${p.rawMaterial || p.item || 'Raw Material'} (${p.supplierName || p.supplier || 'Supplier'})${p.returnedQty > 0 ? ` [↩️ Ret: ${p.returnedQty} ${p.rawUnit || ''}]` : ''}`,
                amount,
                paidAmount: Number(p.paid || 0),
                pendingAmount: Math.max(0, Number(p.netBalance !== undefined ? p.netBalance : (p.balance !== undefined ? p.balance : (amount - Number(p.paid || 0))))),
                date: cleanDate,
                timestamp: Number(p.savedAt || p.createdAt || dateSortValue(cleanDate) || 0)
            });
        }
    });

    // 4. Cosmetics Purchases
    (state.cosPurchases || []).forEach((p, i) => {
        if (!p || p._deleted || isItemDeleted(p, 'cosPurchase')) return;
        const gross = Number(p.amount !== undefined ? p.amount : (p.cost !== undefined ? p.cost : (p.total !== undefined ? p.total : (p.paid || 0))));
        const amount = p.netPurchaseAmount !== undefined ? Number(p.netPurchaseAmount) : (gross || Number(p.paid || 0));
        const entryId = p.id ? (p.id.startsWith('cospurch_') ? p.id : 'cospurch_' + p.id) : ('cospurch_' + (p.savedAt || i));
        if (amount > 0 || gross > 0 || Number(p.paid || 0) > 0) {
            const cleanDate = normalizeToDateKey(p.date) || normalizeToDateKey(p.savedAt) || normalizeToDateKey(p.createdAt) || getTodayDateString();
            entries.push({
                id: entryId,
                originalId: p.id || entryId,
                type: 'Expense',
                category: 'Cosmetics Purchase',
                desc: `Cosmetics Purchase: ${p.item || 'Item'} (${p.supplier || 'Supplier'})${p.returnedQty > 0 ? ` [↩️ Ret: ${p.returnedQty} ${p.unit || ''}]` : ''}`,
                amount,
                paidAmount: Number(p.paid || 0),
                pendingAmount: Math.max(0, Number(p.netBalance !== undefined ? p.netBalance : (p.balance !== undefined ? p.balance : (amount - Number(p.paid || 0))))),
                date: cleanDate,
                timestamp: Number(p.savedAt || p.createdAt || dateSortValue(cleanDate) || 0)
            });
        }
    });

    // 5. Operating Expenses & Additional Incomes
    (state.expenses || []).forEach((ex, i) => {
        if (!ex || ex._deleted || isItemDeleted(ex, 'expense')) return;
        const amount = Number(ex.amount !== undefined ? ex.amount : (ex.cost !== undefined ? ex.cost : 0));
        const entryId = ex.id ? (ex.id.startsWith('exp_') ? ex.id : 'exp_' + ex.id) : ('exp_' + (ex.savedAt || i));
        if (amount > 0) {
            const cleanDate = normalizeToDateKey(ex.date) || normalizeToDateKey(ex.savedAt) || normalizeToDateKey(ex.createdAt) || getTodayDateString();
            const isIncome = ex.type === 'Income';
            entries.push({
                id: entryId,
                originalId: ex.id || entryId,
                type: isIncome ? 'Income' : 'Expense',
                category: isIncome ? 'Additional Income' : 'Expense',
                desc: isIncome ? `🟢 Other Income: ${ex.title || 'Additional Income'}` : `Expense: ${ex.title || ex.category || 'General Expense'}`,
                amount,
                paidAmount: amount,
                pendingAmount: 0,
                paymentMode: 'Cash',
                date: cleanDate,
                timestamp: Number(ex.savedAt || ex.createdAt || dateSortValue(cleanDate) || 0)
            });
        }
    });

    // 6. Purchase Return Cash Refunds (Incoming Cash Refund into Cash Counter)
    const scanPurchaseReturns = (arr, isCos) => {
        (arr || []).forEach((p, i) => {
            if (!p || p._deleted || !Array.isArray(p.returns)) return;
            p.returns.forEach((r, j) => {
                if (!r || !r.isCashRefund || Number(r.amount || 0) <= 0) return;
                const supplierName = String(isCos ? p.supplier : (p.supplierName || p.supplier || 'Supplier'));
                const itemName = String(isCos ? (p.item || p.name) : (p.rawMaterial || p.item || 'Item'));
                const returnDate = normalizeToDateKey(r.date) || normalizeToDateKey(r.savedAt) || getTodayDateString();
                const returnAmt = Number(r.amount || 0);
                
                entries.push({
                    id: `retcash_${isCos ? 'cos_' : ''}${p.id || i}_${r.savedAt || j}`,
                    originalId: p.id || String(i),
                    type: 'Income',
                    category: isCos ? 'Cosmetics Return Cash' : 'Purchase Return Cash',
                    desc: `↩️ Cash Refund: ${itemName} (${supplierName})${r.reason ? ' - ' + r.reason : ''}`,
                    amount: returnAmt,
                    paidAmount: returnAmt,
                    pendingAmount: 0,
                    paymentMode: 'Cash',
                    date: returnDate,
                    timestamp: Number(r.savedAt || dateSortValue(returnDate) || 0)
                });
            });
        });
    };
    scanPurchaseReturns(state.purchases, false);
    scanPurchaseReturns(state.cosPurchases, true);

    return entries;
}

export function clearDayBook() {
    let fromDate = normalizeToDateKey(document.getElementById('filterFromDate')?.value);
    let toDate = normalizeToDateKey(document.getElementById('filterToDate')?.value);
    if (!confirm('Clear all currently filtered Day Book entries from view?')) return;
    getAllMasterEntries().forEach(e => {
        const ed = normalizeToDateKey(e.date);
        if ((!fromDate || ed >= fromDate) && (!toDate || ed <= toDate)) {
            if (!state.clearedDayBookEntries.includes(e.id)) state.clearedDayBookEntries.push(e.id);
        }
    });
    saveLocalStateSafely();
    syncToFirebase();
    renderAccounts();
}

export function deleteDayBookEntry(id) {
    if (!id) return;
    if (!confirm('Remove this entry from Day Book view?')) return;
    if (!state.clearedDayBookEntries.includes(id)) {
        state.clearedDayBookEntries.push(id);
    }
    saveLocalStateSafely();
    syncToFirebase();
    renderAccounts();
}

export function saveDayBookOpeningValues() {
    const balanceInput = document.getElementById('dayBookOpeningBalanceInput');
    const expenseInput = document.getElementById('dayBookOpeningExpenseInput');
    state.dayBookOpeningBalance = Math.max(0, Number(balanceInput?.value || 0));
    state.dayBookOpeningExpense = Math.max(0, Number(expenseInput?.value || 0));
    saveLocalStateSafely();
    syncToFirebase();
    renderAccounts();
}

export function renderAccounts() {
    const openingBalanceInput = document.getElementById('dayBookOpeningBalanceInput');
    const openingExpenseInput = document.getElementById('dayBookOpeningExpenseInput');
    if (openingBalanceInput && document.activeElement !== openingBalanceInput) openingBalanceInput.value = Number(state.dayBookOpeningBalance || 0);
    if (openingExpenseInput && document.activeElement !== openingExpenseInput) openingExpenseInput.value = Number(state.dayBookOpeningExpense || 0);

    const fromEl = document.getElementById('filterFromDate');
    const toEl = document.getElementById('filterToDate');

    if (state.currentDayBookPreset === 'today' && fromEl && toEl && !fromEl.value && !toEl.value) {
        const todayStr = getTodayDateString();
        fromEl.value = todayStr;
        toEl.value = todayStr;
    }

    const fromDate = normalizeToDateKey(fromEl?.value);
    const toDate = normalizeToDateKey(toEl?.value);
    const allEntries = getAllMasterEntries();

    // Filter by date range and exclude cleared entries
    let filtered = allEntries.filter(e => {
        if (state.clearedDayBookEntries && state.clearedDayBookEntries.includes(e.id)) return false;
        const ed = normalizeToDateKey(e.date);
        if (fromDate && ed && ed < fromDate) return false;
        if (toDate && ed && ed > toDate) return false;
        if ((fromDate || toDate) && !ed) return false;
        return true;
    });

    // Sort: Date descending, tie-break on timestamp descending
    filtered.sort((a, b) => {
        const diff = dateSortValue(b.date) - dateSortValue(a.date);
        if (diff !== 0) return diff;
        return (Number(b.timestamp) || 0) - (Number(a.timestamp) || 0);
    });

    const incSales = filtered.filter(e => e.type === 'Income').reduce((s, e) => s + Number(e.amount || 0), 0);
    const incCollection = filtered.filter(e => e.type === 'Income').reduce((s, e) => s + Number(e.paidAmount !== undefined ? e.paidAmount : (e.amount || 0)), 0);
    const incDue = filtered.filter(e => e.type === 'Income').reduce((s, e) => s + Math.max(0, Number(e.pendingAmount || 0)), 0);
    const expTotal = filtered.filter(e => e.type === 'Expense').reduce((s, e) => s + Number(e.amount || 0), 0);

    const openingBalance = Number(state.dayBookOpeningBalance || 0);
    const openingExpense = Number(state.dayBookOpeningExpense || 0);
    const currentIncome = openingBalance + incSales;
    const currentExpense = openingExpense + expTotal;
    const netBalance = currentIncome - currentExpense;

    const totalTurnover = currentIncome + currentExpense;
    const incPct = totalTurnover > 0 ? Math.round((currentIncome / totalTurnover) * 100) : 50;
    const expPct = totalTurnover > 0 ? (100 - incPct) : 50;
    const rawMarginPct = currentIncome > 0 ? (netBalance / currentIncome) * 100 : 0;
    const marginPct = Math.abs(rawMarginPct).toFixed(1);
    const isProfit = netBalance >= 0;

    // SVG Donut Ring & Graphical Widget
    const circle = document.getElementById('profitRingCircle');
    const marginText = document.getElementById('profitMarginPercentText');
    const incomeText = document.getElementById('dbIncomeText');
    const expenseText = document.getElementById('dbExpenseText');
    const profitText = document.getElementById('dbNetProfitText');
    const statusBadge = document.getElementById('profitStatusBadge');
    const progressBar = document.getElementById('profitProgressBar');
    const expProgressBar = document.getElementById('expenseProgressBar');
    const incomeRatioText = document.getElementById('dbIncomeRatioText');
    const expenseRatioText = document.getElementById('dbExpenseRatioText');
    const restoreBtn = document.getElementById('restoreDayBookBtn');
    const clearedBanner = document.getElementById('dayBookClearedBanner');
    const headingEl = document.getElementById('dayBookEntriesHeading');
    const countBadge = document.getElementById('dayBookEntriesCountBadge');

    if (countBadge) countBadge.textContent = `${filtered.length} Entries`;
    if (headingEl) headingEl.textContent = `Filtered (${filtered.length})`;

    if (restoreBtn) {
        if (state.clearedDayBookEntries && state.clearedDayBookEntries.length > 0) {
            restoreBtn.classList.remove('hidden');
            restoreBtn.textContent = `🔄 Restore (${state.clearedDayBookEntries.length})`;
        } else {
            restoreBtn.classList.add('hidden');
        }
    }

    if (clearedBanner) {
        if (state.clearedDayBookEntries && state.clearedDayBookEntries.length > 0) {
            clearedBanner.classList.remove('hidden');
            clearedBanner.innerHTML = `
                <div class="bg-slate-900/90 border border-slate-700 p-2.5 rounded-xl flex items-center justify-between text-xs text-slate-200">
                    <span>⚠️ <b>${state.clearedDayBookEntries.length}</b> transaction(s) are hidden from Day Book view.</span>
                    <button type="button" onclick="restoreClearedDayBook()" class="bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1 rounded-lg text-[11px] font-bold shadow transition cursor-pointer">Restore All</button>
                </div>`;
        } else {
            clearedBanner.classList.add('hidden');
            clearedBanner.innerHTML = '';
        }
    }

    if (incomeText) incomeText.textContent = '₹' + currentIncome.toFixed(2);
    if (expenseText) expenseText.textContent = '₹' + currentExpense.toFixed(2);
    if (profitText) {
        profitText.textContent = (isProfit ? '+₹' : '-₹') + Math.abs(netBalance).toFixed(2);
        profitText.className = 'text-xs font-black ' + (isProfit ? 'text-emerald-400' : 'text-rose-400');
    }

    const circumference = 201.06; // 2 * PI * 32
    if (circle) {
        const effectivePct = Math.min(100, Math.max(0, isProfit ? Number(marginPct) : Math.min(100, currentExpense > 0 ? (Math.abs(netBalance) / currentExpense) * 100 : 0)));
        const offset = circumference * (1 - (effectivePct / 100));
        circle.style.strokeDashoffset = offset;
        circle.setAttribute('stroke', isProfit ? '#10b981' : '#f43f5e');
    }

    if (marginText) {
        marginText.textContent = (isProfit ? '' : '-') + marginPct + '%';
        marginText.className = 'text-xs font-black ' + (isProfit ? 'text-emerald-400' : 'text-rose-400');
    }

    if (statusBadge) {
        if (isProfit) {
            const num = Number(marginPct);
            statusBadge.textContent = num >= 30 ? '🚀 High Margin' : (num >= 15 ? '✅ Healthy Margin' : '⚡ Moderate Margin');
            statusBadge.className = 'text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-700/60';
        } else {
            statusBadge.textContent = '⚠️ Operating Loss';
            statusBadge.className = 'text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-rose-950 text-rose-300 border border-rose-700/60';
        }
    }

    if (incomeRatioText) incomeRatioText.textContent = `Income: ${incPct}% (₹${currentIncome.toFixed(2)})`;
    if (expenseRatioText) expenseRatioText.textContent = `Expense: ${expPct}% (₹${currentExpense.toFixed(2)})`;

    if (progressBar) progressBar.style.width = incPct + '%';
    if (expProgressBar) expProgressBar.style.width = expPct + '%';

    // Financial Cards: Sales, Collection, Due & Expense
    const periodLabel = (state.currentDayBookPreset === 'today') ? "Today's" : (state.currentDayBookPreset === 'month' ? "This Month" : "Total");
    const summaryEl = document.getElementById('accountsSummaryContainer');
    if (summaryEl) {
        summaryEl.innerHTML = `
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs pt-1">
                <div class="bg-emerald-50 p-2.5 rounded-xl border border-emerald-200 flex flex-col justify-between shadow-xs">
                    <span class="text-[10px] text-emerald-800 font-bold uppercase tracking-wider">${periodLabel} Sales</span>
                    <b class="text-emerald-950 font-black text-sm mt-1">₹${incSales.toFixed(2)}</b>
                    <span class="text-[9px] text-emerald-700 mt-0.5 font-medium">Total Billed</span>
                </div>
                <div class="bg-sky-50 p-2.5 rounded-xl border border-sky-200 flex flex-col justify-between shadow-xs">
                    <span class="text-[10px] text-sky-800 font-bold uppercase tracking-wider">${periodLabel} Collection</span>
                    <b class="text-sky-950 font-black text-sm mt-1">₹${incCollection.toFixed(2)}</b>
                    <span class="text-[9px] text-sky-700 mt-0.5 font-medium">Cash / Paid In</span>
                </div>
                <div class="bg-rose-50 p-2.5 rounded-xl border border-rose-200 flex flex-col justify-between shadow-xs">
                    <span class="text-[10px] text-rose-800 font-bold uppercase tracking-wider">${periodLabel} Due</span>
                    <b class="text-rose-950 font-black text-sm mt-1">₹${incDue.toFixed(2)}</b>
                    <span class="text-[9px] text-rose-700 mt-0.5 font-medium">Credit Pending</span>
                </div>
                <div class="bg-amber-50 p-2.5 rounded-xl border border-amber-200 flex flex-col justify-between shadow-xs">
                    <span class="text-[10px] text-amber-800 font-bold uppercase tracking-wider">${periodLabel} Expense</span>
                    <b class="text-amber-950 font-black text-sm mt-1">₹${expTotal.toFixed(2)}</b>
                    <span class="text-[9px] text-amber-700 mt-0.5 font-medium">Purchases & Costs</span>
                </div>
            </div>
            <div class="flex justify-between items-center text-[10px] text-slate-500 px-1 pt-0.5">
                <span>Opening Bal: <b class="text-slate-800 font-bold">₹${openingBalance.toFixed(2)}</b> · Opening Exp: <b class="text-slate-800 font-bold">₹${openingExpense.toFixed(2)}</b></span>
                <span>Net Balance: <b class="${isProfit ? 'text-emerald-700' : 'text-rose-700'} font-black">₹${netBalance.toFixed(2)}</b></span>
            </div>`;
    }

    // Render Day Book items
    const listContainer = document.getElementById('dayBookListContainer');
    if (!listContainer) return;

    // Optional Search Filter inside the folder
    const searchVal = (document.getElementById('dayBookSearchInput')?.value || '').trim().toLowerCase();
    let displayList = filtered;
    if (searchVal) {
        displayList = filtered.filter(e => {
            const desc = String(e.desc || '').toLowerCase();
            const type = String(e.type || '').toLowerCase();
            const cat = String(e.category || '').toLowerCase();
            const mode = String(e.paymentMode || '').toLowerCase();
            const amt = String(e.amount || '');
            const date = formatDateDDMMYYYY(e.date).toLowerCase();
            return desc.includes(searchVal) || type.includes(searchVal) || cat.includes(searchVal) || mode.includes(searchVal) || amt.includes(searchVal) || date.includes(searchVal);
        });
    }

    if (headingEl) {
        headingEl.textContent = searchVal 
            ? `Filtered (${displayList.length}/${filtered.length})` 
            : `Filtered (${filtered.length})`;
    }

    if (filtered.length === 0) {
        const totalMasterCount = allEntries.length;
        const clearedNote = (state.clearedDayBookEntries && state.clearedDayBookEntries.length > 0)
            ? `<div class="mt-2 text-sky-800 text-[11px] bg-sky-50 p-2 rounded-xl border border-sky-200">⚠️ ${state.clearedDayBookEntries.length} transaction(s) are currently marked as cleared. <button type="button" onclick="restoreClearedDayBook()" class="underline font-bold text-sky-900 ml-1 hover:text-sky-700">Click here to restore</button></div>`
            : '';
        listContainer.innerHTML = `
            <div class="bg-white border border-dashed border-slate-300 p-6 rounded-2xl text-center space-y-2">
                <div class="text-2xl">📋</div>
                <p class="text-xs text-slate-700 font-bold">No transactions found for the selected filter period.</p>
                ${totalMasterCount > 0 ? `<p class="text-[11px] text-slate-500">You have <span class="text-slate-900 font-bold">${totalMasterCount}</span> total transaction(s) in your system.</p>` : `<p class="text-[11px] text-slate-500">No transactions have been recorded yet.</p>`}
                <div class="flex justify-center gap-2 pt-2">
                    ${totalMasterCount > 0 ? `<button type="button" onclick="setFilterPreset('all')" class="text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold px-4 py-2 rounded-xl shadow-xs transition cursor-pointer">🌐 Show All Transactions (${totalMasterCount})</button>` : ''}
                </div>
                ${clearedNote}
            </div>`;
    } else if (displayList.length === 0) {
        listContainer.innerHTML = `
            <div class="bg-slate-50 border border-slate-200 p-4 rounded-xl text-center space-y-2">
                <p class="text-xs text-slate-600">No transactions match your search "<b>${searchVal}</b>".</p>
                <button type="button" onclick="document.getElementById('dayBookSearchInput').value=''; renderAccounts();" class="text-[11px] bg-white hover:bg-slate-100 text-slate-700 px-3 py-1 rounded-lg border border-slate-300 transition cursor-pointer font-bold">Clear Search</button>
            </div>`;
    } else {
        listContainer.innerHTML = displayList.map(e => {
            const isInc = e.type === 'Income';
            const badgeBg = isInc ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-rose-50 text-rose-800 border-rose-200';
            const icon = isInc ? '💰' : '💸';
            const payBadge = e.paymentMode ? `<span class="text-[9px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 font-semibold">${e.paymentMode}</span>` : '';
            return `
            <div class="bg-white p-3 rounded-xl border border-slate-200 flex items-center justify-between gap-3 text-xs shadow-xs hover:border-slate-300 transition">
                <div class="flex items-start gap-2.5 min-w-0">
                    <span class="text-base shrink-0 mt-0.5">${icon}</span>
                    <div class="min-w-0 space-y-0.5">
                        <div class="flex items-center gap-1.5 flex-wrap">
                            <span class="px-1.5 py-0.5 rounded-full text-[9px] font-extrabold border ${badgeBg}">[${e.type}]</span>
                            <span class="font-extrabold text-slate-900 truncate">${e.desc}</span>
                            ${payBadge}
                        </div>
                        <p class="text-[10px] text-slate-500">📅 ${formatDateDDMMYYYY(e.date)} ${e.category ? '• ' + e.category : ''}</p>
                    </div>
                </div>
                <div class="flex items-center gap-2 shrink-0">
                    <span class="font-black text-xs ${isInc ? 'text-emerald-700' : 'text-slate-800'}">₹${Number(e.amount || 0).toFixed(2)}</span>
                    <button type="button" onclick="deleteDayBookEntry('${e.id}')" title="Remove from Day Book view" class="text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 p-1 rounded-lg text-xs transition cursor-pointer">🗑️</button>
                </div>
            </div>`;
        }).join('');
    }
}

export function toggleDayBookEntriesFolder(forceState) {
    const content = document.getElementById('dayBookEntriesFolderContent');
    const toggleBtn = document.getElementById('dayBookFolderToggleBtn');
    const btnIcon = document.getElementById('dayBookFolderBtnIcon');
    const btnText = document.getElementById('dayBookFolderBtnText');
    const statusText = document.getElementById('dayBookFolderStatusText');
    if (!content) return;

    const isCurrentlyHidden = content.classList.contains('hidden');
    const willOpen = (typeof forceState === 'boolean') ? forceState : isCurrentlyHidden;

    if (willOpen) {
        syncFolderDateInputs();
        content.classList.remove('hidden');
        if (btnIcon) btnIcon.textContent = '📁';
        if (btnText) btnText.textContent = 'Close';
        if (statusText) statusText.textContent = 'Showing transactions • Tap to fold';
        if (toggleBtn) {
            toggleBtn.className = 'bg-slate-800 hover:bg-slate-700 text-slate-200 px-2.5 py-1.5 rounded-xl border border-slate-700 text-xs font-bold transition flex items-center gap-1 cursor-pointer whitespace-nowrap';
        }
        setTimeout(() => {
            document.getElementById('dayBookSearchInput')?.focus();
        }, 80);
    } else {
        content.classList.add('hidden');
        if (btnIcon) btnIcon.textContent = '👁️';
        if (btnText) btnText.textContent = 'View';
        if (statusText) statusText.textContent = 'Tap to view transactions';
        if (toggleBtn) {
            toggleBtn.className = 'bg-indigo-600 hover:bg-indigo-500 text-white px-2.5 py-1.5 rounded-xl border border-indigo-500 text-xs font-bold shadow-md shadow-indigo-950/40 transition flex items-center gap-1 cursor-pointer whitespace-nowrap';
        }
    }
}

export function exportDayBookToCSV() {
    let fromDate = normalizeToDateKey(document.getElementById('filterFromDate')?.value);
    let toDate = normalizeToDateKey(document.getElementById('filterToDate')?.value);
    let filtered = getAllMasterEntries().filter(e => {
        if (state.clearedDayBookEntries.includes(e.id)) return false;
        const ed = normalizeToDateKey(e.date);
        if (fromDate && ed && ed < fromDate) return false;
        if (toDate && ed && ed > toDate) return false;
        if ((fromDate || toDate) && !ed) return false;
        return true;
    });
    filtered.sort((a, b) => {
        const diff = dateSortValue(a.date) - dateSortValue(b.date);
        if (diff !== 0) return diff;
        return (Number(a.timestamp) || 0) - (Number(b.timestamp) || 0);
    });

    const openingBalance = Number(state.dayBookOpeningBalance || 0);
    const openingExpense = Number(state.dayBookOpeningExpense || 0);
    let runningBalance = openingBalance - openingExpense;

    let csv = "Date,Type,Description,Income (Rs),Expense (Rs),Running Balance (Rs)\r\n";
    csv += `"${todayDDMMYYYY()}","Opening","Opening Balance / Expense","${openingBalance.toFixed(2)}","${openingExpense.toFixed(2)}","${runningBalance.toFixed(2)}"\r\n`;

    let totalIncome = openingBalance;
    let totalExpense = openingExpense;

    filtered.forEach(e => {
        const isInc = e.type === 'Income';
        const incAmt = isInc ? Number(e.amount || 0) : 0;
        const expAmt = !isInc ? Number(e.amount || 0) : 0;
        totalIncome += incAmt;
        totalExpense += expAmt;
        runningBalance += (incAmt - expAmt);
        const desc = String(e.desc || '').replace(/"/g, '""');
        csv += `"${formatDateDDMMYYYY(e.date)}","${e.type}","${desc}","${incAmt > 0 ? incAmt.toFixed(2) : '0.00'}","${expAmt > 0 ? expAmt.toFixed(2) : '0.00'}","${runningBalance.toFixed(2)}"\r\n`;
    });

    const netProfit = totalIncome - totalExpense;
    csv += "\r\n";
    csv += `Total Income (Rs),${totalIncome.toFixed(2)}\r\n`;
    csv += `Total Expense (Rs),${totalExpense.toFixed(2)}\r\n`;
    csv += `Net ${netProfit >= 0 ? 'Profit' : 'Loss'} (Rs),${Math.abs(netProfit).toFixed(2)}\r\n`;

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const dateStr = (fromDate && toDate) ? `${fromDate}_to_${toDate}` : getTodayDateString();
    a.download = `FIA_DAYBOOK_REPORT_${dateStr}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Global window bindings for HTML inline onclick attributes
if (typeof window !== 'undefined') {
    window.dashboardDateKey = dashboardDateKey;
    window.setupDateFields = setupDateFields;
    window.updateDayBookPresetButtons = updateDayBookPresetButtons;
    window.setFilterPreset = setFilterPreset;
    window.onDayBookDateInputChange = onDayBookDateInputChange;
    window.restoreClearedDayBook = restoreClearedDayBook;
    window.ensureStableTransactionIds = ensureStableTransactionIds;
    window.getAllMasterEntries = getAllMasterEntries;
    window.clearDayBook = clearDayBook;
    window.deleteDayBookEntry = deleteDayBookEntry;
    window.saveDayBookOpeningValues = saveDayBookOpeningValues;
    window.renderAccounts = renderAccounts;
    window.refreshDayBookRealtime = refreshDayBookRealtime;
    window.exportDayBookToCSV = exportDayBookToCSV;
    window.exportDayBookToExcel = exportDayBookToCSV;
    window.toggleDayBookEntriesFolder = toggleDayBookEntriesFolder;
    window.onFolderSpecificDateChange = onFolderSpecificDateChange;
    window.onFolderDateRangeChange = onFolderDateRangeChange;
    window.syncFolderDateInputs = syncFolderDateInputs;
    window.getYesterdayDateString = getYesterdayDateString;
}
