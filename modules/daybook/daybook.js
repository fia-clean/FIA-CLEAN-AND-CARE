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
    saveLocalStateSafely
} from '../core/state.js';
import { syncToFirebase } from '../core/db.js';
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

export function updateDayBookPresetButtons(preset) {
    state.currentDayBookPreset = preset || 'today';
    const btnToday = document.getElementById('dayBookTabToday');
    const btnMonth = document.getElementById('dayBookTabMonth');
    const btnAll = document.getElementById('dayBookTabAll');
    const periodBadge = document.getElementById('dayBookActivePeriodBadge');

    const activeClassToday = 'flex-1 bg-purple-600 text-white py-2 rounded-xl text-xs font-black shadow-md border border-purple-400 transition cursor-pointer';
    const activeClassMonth = 'flex-1 bg-emerald-600 text-white py-2 rounded-xl text-xs font-black shadow-md border border-emerald-400 transition cursor-pointer';
    const activeClassAll = 'flex-1 bg-sky-600 text-white py-2 rounded-xl text-xs font-black shadow-md border border-sky-400 transition cursor-pointer';
    const inactiveClass = 'flex-1 bg-slate-900/90 text-slate-400 py-2 rounded-xl text-xs font-bold border border-slate-800 hover:bg-slate-800 hover:text-slate-200 transition cursor-pointer';

    if (btnToday) btnToday.className = (preset === 'today') ? activeClassToday : inactiveClass;
    if (btnMonth) btnMonth.className = (preset === 'month') ? activeClassMonth : inactiveClass;
    if (btnAll) btnAll.className = (preset === 'all') ? activeClassAll : inactiveClass;

    if (periodBadge) {
        if (preset === 'today') periodBadge.textContent = '📅 Today';
        else if (preset === 'month') periodBadge.textContent = '🗓️ This Month';
        else if (preset === 'all') periodBadge.textContent = '🌐 All Time';
        else periodBadge.textContent = '🔍 Custom Range';
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

    updateDayBookPresetButtons(preset);
    renderAccounts();
}

export function onDayBookDateInputChange() {
    const fromVal = document.getElementById('filterFromDate')?.value;
    const toVal = document.getElementById('filterToDate')?.value;
    const todayStr = getTodayDateString();
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const firstDayStr = y + '-' + m + '-01';
    const lastDayNum = new Date(y, d.getMonth() + 1, 0).getDate();
    const lastDayStr = y + '-' + m + '-' + String(lastDayNum).padStart(2, '0');

    let matched = 'custom';
    if (!fromVal && !toVal) matched = 'all';
    else if (fromVal === todayStr && toVal === todayStr) matched = 'today';
    else if (fromVal === firstDayStr && (toVal === lastDayStr || toVal === todayStr)) matched = 'month';

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
                item.id = (item.billNo ? String(item.billNo) : (prefix + '_' + (item.savedAt || Date.now()) + '_' + i));
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
    (state.customers || []).forEach((c, i) => {
        if (!c) return;
        let incomeVal = Number(c.grandTotal || c.paidAmount || 0);
        const entryId = c.id ? ('bill_' + c.id) : (c.billNo ? ('bill_' + c.billNo + '_' + (c.savedAt || i)) : ('c_' + (c.savedAt || i)));
        if (incomeVal > 0) {
            const cleanDate = normalizeToDateKey(c.date) || normalizeToDateKey(c.savedAt) || getTodayDateString();
            entries.push({
                id: entryId,
                originalId: c.id || c.billNo,
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
    (state.cosSales || []).forEach((s, i) => {
        if (!s) return;
        const norm = normalizeCosSale(s) || {};
        let incomeVal = Number(norm.grandTotal || norm.paidAmount || 0);
        const entryId = s.id ? ('cossale_' + s.id) : (s.billNo ? ('cossale_' + s.billNo + '_' + (s.savedAt || i)) : ('cs_' + (s.savedAt || i)));
        if (incomeVal > 0) {
            const cleanDate = normalizeToDateKey(s.date) || normalizeToDateKey(s.savedAt) || getTodayDateString();
            entries.push({
                id: entryId,
                originalId: s.id || s.billNo,
                type: 'Income',
                category: 'Cosmetics Sale',
                desc: `Cosmetics Bill #${s.billNo || (i + 1)} (${s.customer || s.name || 'Customer'})`,
                amount: incomeVal,
                paidAmount: Number(norm.paidAmount !== undefined ? norm.paidAmount : (incomeVal - Number(norm.pendingAmount || 0))),
                pendingAmount: Math.max(0, Number(norm.pendingAmount || 0)),
                paymentMode: s.paymentMode || 'Cash',
                date: cleanDate,
                timestamp: Number(s.savedAt || s.createdAt || dateSortValue(cleanDate) || 0)
            });
        }
    });
    (state.purchases || []).forEach((p, i) => {
        if (!p) return;
        const gross = Number(p.rawCost || p.paid || 0);
        const amount = p.netPurchaseAmount !== undefined ? Number(p.netPurchaseAmount) : gross;
        const entryId = p.id ? ('purch_' + p.id) : ('p_' + (p.savedAt || i));
        if (amount > 0 || gross > 0) {
            const cleanDate = normalizeToDateKey(p.date) || normalizeToDateKey(p.savedAt) || getTodayDateString();
            entries.push({
                id: entryId,
                originalId: p.id,
                type: 'Expense',
                category: 'Purchase',
                desc: `Purchase: ${p.rawMaterial || 'Item'} (${p.supplierName || 'Supplier'})${p.returnedQty > 0 ? ` [↩️ Ret: ${p.returnedQty} ${p.rawUnit || ''}]` : ''}`,
                amount,
                paidAmount: Number(p.paid || 0),
                pendingAmount: Math.max(0, Number(p.netBalance ?? p.balance ?? 0)),
                date: cleanDate,
                timestamp: Number(p.savedAt || dateSortValue(cleanDate) || 0)
            });
        }
    });
    (state.cosPurchases || []).forEach((p, i) => {
        if (!p) return;
        const gross = Number(p.amount || p.paid || 0);
        const amount = p.netPurchaseAmount !== undefined ? Number(p.netPurchaseAmount) : gross;
        const entryId = p.id ? ('cospurch_' + p.id) : ('cp_' + (p.savedAt || i));
        if (amount > 0 || gross > 0) {
            const cleanDate = normalizeToDateKey(p.date) || normalizeToDateKey(p.savedAt) || getTodayDateString();
            entries.push({
                id: entryId,
                originalId: p.id,
                type: 'Expense',
                category: 'Cosmetics Purchase',
                desc: `Cosmetics Purchase: ${p.item || 'Item'} (${p.supplier || 'Supplier'})${p.returnedQty > 0 ? ` [↩️ Ret: ${p.returnedQty} ${p.unit || ''}]` : ''}`,
                amount,
                paidAmount: Number(p.paid || 0),
                pendingAmount: Math.max(0, Number(p.netBalance ?? p.balance ?? 0)),
                date: cleanDate,
                timestamp: Number(p.savedAt || dateSortValue(cleanDate) || 0)
            });
        }
    });
    (state.expenses || []).forEach((ex, i) => {
        if (!ex) return;
        const amount = Number(ex.amount || 0);
        const entryId = ex.id ? ('exp_' + ex.id) : ('e_' + (ex.savedAt || i));
        if (amount > 0) {
            const cleanDate = normalizeToDateKey(ex.date) || normalizeToDateKey(ex.savedAt) || getTodayDateString();
            entries.push({
                id: entryId,
                originalId: ex.id,
                type: 'Expense',
                category: 'Expense',
                desc: `Expense: ${ex.title || 'General Expense'}`,
                amount,
                date: cleanDate,
                timestamp: Number(ex.savedAt || dateSortValue(cleanDate) || 0)
            });
        }
    });
    (state.cosPurchases || []).forEach((cp, i) => {
        if (!cp) return;
        const amount = Number(cp.amount || cp.paid || 0);
        const entryId = cp.id ? ('cospurch_' + cp.id) : ('cp_' + (cp.savedAt || i));
        if (amount > 0) {
            const cleanDate = normalizeToDateKey(cp.date) || normalizeToDateKey(cp.savedAt) || getTodayDateString();
            entries.push({
                id: entryId,
                originalId: cp.id,
                type: 'Expense',
                category: 'Cosmetics Purchase',
                desc: `Cosmetics Purchase: ${cp.item || 'Item'} (${cp.supplier || 'Supplier'})`,
                amount,
                paidAmount: Number(cp.paid || 0),
                pendingAmount: Math.max(0, Number(cp.balance || 0)),
                date: cleanDate,
                timestamp: Number(cp.savedAt || dateSortValue(cleanDate) || 0)
            });
        }
    });
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
    syncToFirebase();
    renderAccounts();
}

export function deleteDayBookEntry(id) {
    if (!id) return;
    if (!confirm('Remove this entry from Day Book view?')) return;
    if (!state.clearedDayBookEntries.includes(id)) {
        state.clearedDayBookEntries.push(id);
    }
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

    // Filter by date range and exclude cleared entries
    let filtered = getAllMasterEntries().filter(e => {
        if (state.clearedDayBookEntries.includes(e.id) || (e.originalId && state.clearedDayBookEntries.includes(e.originalId))) return false;
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
    const headingEl = document.getElementById('dayBookEntriesHeading');

    if (headingEl) headingEl.textContent = `Filtered Day Book Entries (${filtered.length})`;

    if (restoreBtn) {
        if (state.clearedDayBookEntries && state.clearedDayBookEntries.length > 0) {
            restoreBtn.classList.remove('hidden');
            restoreBtn.textContent = `🔄 Restore (${state.clearedDayBookEntries.length})`;
        } else {
            restoreBtn.classList.add('hidden');
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
    const periodLabel = (state.currentDayBookPreset === 'today') ? "Today's" : (state.currentDayBookPreset === 'month' ? "This Month" : "Period");
    const summaryEl = document.getElementById('accountsSummaryContainer');
    if (summaryEl) {
        summaryEl.innerHTML = `
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs pt-1">
                <div class="bg-slate-900/90 p-2.5 rounded-xl border border-emerald-700/50 flex flex-col justify-between shadow-sm">
                    <span class="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">${periodLabel} Sales</span>
                    <b class="text-emerald-300 font-extrabold text-sm mt-1">₹${incSales.toFixed(2)}</b>
                    <span class="text-[9px] text-slate-400 mt-0.5">Total Billed</span>
                </div>
                <div class="bg-slate-900/90 p-2.5 rounded-xl border border-amber-700/50 flex flex-col justify-between shadow-sm">
                    <span class="text-[10px] text-amber-400 font-bold uppercase tracking-wider">${periodLabel} Collection</span>
                    <b class="text-amber-300 font-extrabold text-sm mt-1">₹${incCollection.toFixed(2)}</b>
                    <span class="text-[9px] text-slate-400 mt-0.5">Cash / Paid In</span>
                </div>
                <div class="bg-slate-900/90 p-2.5 rounded-xl border border-rose-700/50 flex flex-col justify-between shadow-sm">
                    <span class="text-[10px] text-rose-400 font-bold uppercase tracking-wider">${periodLabel} Due</span>
                    <b class="text-rose-300 font-extrabold text-sm mt-1">₹${incDue.toFixed(2)}</b>
                    <span class="text-[9px] text-slate-400 mt-0.5">Credit Pending</span>
                </div>
                <div class="bg-slate-900/90 p-2.5 rounded-xl border border-slate-700 flex flex-col justify-between shadow-sm">
                    <span class="text-[10px] text-slate-300 font-bold uppercase tracking-wider">${periodLabel} Expense</span>
                    <b class="text-rose-400 font-extrabold text-sm mt-1">₹${expTotal.toFixed(2)}</b>
                    <span class="text-[9px] text-slate-400 mt-0.5">Purchases & Costs</span>
                </div>
            </div>
            <div class="flex justify-between items-center text-[10px] text-slate-400 px-1 pt-0.5">
                <span>Opening Bal: <b class="text-slate-200">₹${openingBalance.toFixed(2)}</b> · Opening Exp: <b class="text-slate-200">₹${openingExpense.toFixed(2)}</b></span>
                <span>Net Balance: <b class="${isProfit ? 'text-emerald-400' : 'text-rose-400'} font-bold">₹${netBalance.toFixed(2)}</b></span>
            </div>`;
    }

    // Render Day Book items
    const listContainer = document.getElementById('dayBookListContainer');
    if (!listContainer) return;
    if (filtered.length === 0) {
        const clearedNote = (state.clearedDayBookEntries && state.clearedDayBookEntries.length > 0)
            ? `<div class="mt-2 text-amber-300 text-[11px] bg-amber-950/40 p-2 rounded-lg border border-amber-800/40">⚠️ ${state.clearedDayBookEntries.length} transaction(s) are currently marked as cleared. <button type="button" onclick="restoreClearedDayBook()" class="underline font-bold text-amber-200 ml-1 hover:text-white">Click here to restore</button></div>`
            : '';
        listContainer.innerHTML = `
            <div class="bg-slate-950/40 border border-slate-800/70 p-6 rounded-2xl text-center space-y-2">
                <div class="text-2xl">📋</div>
                <p class="text-xs text-slate-400 font-medium">No transactions found for the selected period.</p>
                <div class="flex justify-center gap-2 pt-1">
                    <button type="button" onclick="setFilterPreset('all')" class="text-[11px] bg-sky-900/60 text-sky-300 border border-sky-700/60 px-3 py-1.5 rounded-lg hover:bg-sky-800 transition font-bold">🌐 Show All Time</button>
                </div>
                ${clearedNote}
            </div>`;
    } else {
        listContainer.innerHTML = filtered.map(e => {
            const isInc = e.type === 'Income';
            const badgeBg = isInc ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700/60' : 'bg-rose-950/80 text-rose-300 border-rose-700/60';
            const icon = isInc ? '💰' : '💸';
            const payBadge = e.paymentMode ? `<span class="text-[9px] px-1.5 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-800">${e.paymentMode}</span>` : '';
            return `
            <div class="bg-slate-950/70 p-3 rounded-xl border border-slate-800 flex items-center justify-between gap-3 text-xs hover:border-slate-700 transition">
                <div class="flex items-start gap-2.5 min-w-0">
                    <span class="text-base shrink-0 mt-0.5">${icon}</span>
                    <div class="min-w-0 space-y-0.5">
                        <div class="flex items-center gap-1.5 flex-wrap">
                            <span class="px-1.5 py-0.5 rounded text-[9px] font-extrabold border ${badgeBg}">[${e.type}]</span>
                            <span class="font-bold text-slate-200 truncate">${e.desc}</span>
                            ${payBadge}
                        </div>
                        <p class="text-[10px] text-slate-400">📅 ${formatDateDDMMYYYY(e.date)} ${e.category ? '• ' + e.category : ''}</p>
                    </div>
                </div>
                <div class="flex items-center gap-2 shrink-0">
                    <span class="font-black text-xs ${isInc ? 'text-emerald-400' : 'text-rose-400'}">₹${Number(e.amount || 0).toFixed(2)}</span>
                    <button type="button" onclick="deleteDayBookEntry('${e.id}')" title="Remove from Day Book view" class="text-slate-400 hover:text-red-300 hover:bg-red-950/60 border border-transparent hover:border-red-800/60 p-1 rounded-lg text-xs transition cursor-pointer">🗑️</button>
                </div>
            </div>`;
        }).join('');
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
    window.exportDayBookToCSV = exportDayBookToCSV;
    window.exportDayBookToExcel = exportDayBookToCSV;
}
