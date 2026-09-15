/**
 * FIA CLEAN & CARE - Operations: Expenses & Other Income Management Module
 * Handles general shop expenses (rent, electricity, wages, maintenance)
 * and additional shop income (scrap sale, empty can/barrel sale, surplus cash).
 */

import {
    state,
    dateSortValue,
    formatDateDDMMYYYY,
    normalizeToDateKey,
    getTodayDateString,
    markIdDeleted,
    unmarkIdDeleted,
    saveLocalStateSafely,
    toTitleCase
} from '../core/state.js';
import { syncToFirebase } from '../core/db.js';
import { ensurePurchaseTimestamps } from './purchases.js';

export let currentExpenseTab = 'Expense'; // 'Expense' | 'Income'
export let expenseListFilter = 'all';    // 'all' | 'Expense' | 'Income'

/**
 * Switches the active tab in the Expenses module between Shop Expenses and Additional Income.
 */
export function switchExpenseTab(tab) {
    currentExpenseTab = tab === 'Income' ? 'Income' : 'Expense';
    
    const tabBtnExpense = document.getElementById('tabBtnExpense');
    const tabBtnIncome = document.getElementById('tabBtnIncome');
    const formCard = document.getElementById('expenseFormCard');
    const formIcon = document.getElementById('expFormIcon');
    const formTitle = document.getElementById('expFormTitle');
    const formTypePill = document.getElementById('expFormTypePill');
    const expTypeInput = document.getElementById('expType');
    const titleInput = document.getElementById('expTitle');
    const submitBtn = document.getElementById('expSubmitBtn');
    const isEdit = parseInt(document.getElementById('expIndex')?.value || '-1', 10) >= 0;

    if (currentExpenseTab === 'Income') {
        if (tabBtnIncome) {
            tabBtnIncome.className = "py-2.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 bg-emerald-600 text-white shadow-md cursor-pointer";
        }
        if (tabBtnExpense) {
            tabBtnExpense.className = "py-2.5 px-3 rounded-xl text-xs font-medium transition flex items-center justify-center gap-1.5 text-slate-400 hover:text-slate-200 cursor-pointer";
        }
        if (formCard) {
            formCard.className = "bg-slate-950/60 p-4 rounded-2xl border border-emerald-900/40 shadow-inner";
        }
        if (formIcon) formIcon.textContent = '🟢';
        if (formTitle) formTitle.textContent = isEdit ? 'Edit Additional Income' : 'Additional / Other Income (Scrap, Cans, Surplus)';
        if (formTypePill) {
            formTypePill.textContent = '🟢 Income';
            formTypePill.className = "text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800";
        }
        if (expTypeInput) expTypeInput.value = 'Income';
        if (titleInput) titleInput.placeholder = 'Income Title (e.g., 50 Empty Cans Sale, Scrap Iron/Boxes, Surplus Cash)';
        if (submitBtn) {
            submitBtn.textContent = isEdit ? 'Update Income' : 'Save Income';
            submitBtn.className = "flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-xl font-bold text-sm transition shadow-lg shadow-emerald-950/40 cursor-pointer";
        }
    } else {
        if (tabBtnExpense) {
            tabBtnExpense.className = "py-2.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 bg-rose-600 text-white shadow-md cursor-pointer";
        }
        if (tabBtnIncome) {
            tabBtnIncome.className = "py-2.5 px-3 rounded-xl text-xs font-medium transition flex items-center justify-center gap-1.5 text-slate-400 hover:text-slate-200 cursor-pointer";
        }
        if (formCard) {
            formCard.className = "bg-slate-950/60 p-4 rounded-2xl border border-rose-900/40 shadow-inner";
        }
        if (formIcon) formIcon.textContent = '💸';
        if (formTitle) formTitle.textContent = isEdit ? 'Edit Shop Expense' : 'General Shop Expenses (Rent, Current, Wages)';
        if (formTypePill) {
            formTypePill.textContent = '🔻 Expense';
            formTypePill.className = "text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-950 text-rose-300 border border-rose-800";
        }
        if (expTypeInput) expTypeInput.value = 'Expense';
        if (titleInput) titleInput.placeholder = 'Expense Title (e.g., Electricity Bill, Shop Rent, Staff Wage)';
        if (submitBtn) {
            submitBtn.textContent = isEdit ? 'Update Expense' : 'Save Expense';
            submitBtn.className = "flex-1 bg-rose-600 hover:bg-rose-500 text-white py-3 rounded-xl font-bold text-sm transition shadow-lg shadow-rose-950/40 cursor-pointer";
        }
    }
}

/**
 * Changes the filter applied to the transaction history list.
 */
export function setExpenseListFilter(filter) {
    expenseListFilter = filter || 'all';
    const btnAll = document.getElementById('expFilterBtnAll');
    const btnExp = document.getElementById('expFilterBtnExpenses');
    const btnInc = document.getElementById('expFilterBtnIncomes');

    const activeClass = "px-2.5 py-1 rounded-lg text-[10px] font-bold transition bg-indigo-600 text-white cursor-pointer";
    const inactiveClass = "px-2.5 py-1 rounded-lg text-[10px] font-bold transition text-slate-400 hover:text-slate-200 cursor-pointer";

    if (btnAll) btnAll.className = expenseListFilter === 'all' ? activeClass : inactiveClass;
    if (btnExp) btnExp.className = expenseListFilter === 'Expense' ? activeClass : inactiveClass;
    if (btnInc) btnInc.className = expenseListFilter === 'Income' ? activeClass : inactiveClass;

    renderExpenses();
}

export function saveExpense(e) {
    e.preventDefault();
    const idx = parseInt(document.getElementById('expIndex').value, 10);
    const expId = (idx >= 0 && state.expenses[idx]?.id) || ('exp_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7));
    unmarkIdDeleted(expId);
    
    const rawDate = document.getElementById('expDate')?.value;
    const cleanDate = normalizeToDateKey(rawDate) || getTodayDateString();
    const now = Date.now();
    const type = document.getElementById('expType')?.value || currentExpenseTab || 'Expense';

    const data = {
        id: expId,
        type: type === 'Income' ? 'Income' : 'Expense',
        title: toTitleCase(document.getElementById('expTitle').value.trim()),
        amount: parseFloat(document.getElementById('expAmount').value) || 0,
        date: cleanDate,
        savedAt: now,
        updatedAt: now
    };

    if (idx >= 0 && state.expenses[idx]) {
        state.expenses[idx] = { ...state.expenses[idx], ...data };
    } else {
        state.expenses.push({ ...data });
    }

    saveLocalStateSafely();
    syncToFirebase();
    resetExpenseForm();
    renderExpenses();
    if (typeof window.renderAccounts === 'function') window.renderAccounts();
    if (typeof window.renderDashboard === 'function') window.renderDashboard();

    if (data.type === 'Income') {
        alert('✓ Additional income recorded successfully!');
    } else {
        alert('✓ Expense details saved successfully!');
    }
}

export function editExpense(index) {
    const ex = state.expenses[index];
    if (!ex) return;
    
    const recordType = ex.type === 'Income' ? 'Income' : 'Expense';
    switchExpenseTab(recordType);

    document.getElementById('expIndex').value = index;
    document.getElementById('expTitle').value = ex.title || '';
    document.getElementById('expAmount').value = ex.amount ?? '';
    document.getElementById('expDate').value = normalizeToDateKey(ex.date) || getTodayDateString();
    
    const isIncome = recordType === 'Income';
    document.getElementById('expFormTitle').innerText = isIncome ? 'Edit Additional Income' : 'Edit Shop Expense';
    document.getElementById('expSubmitBtn').innerText = isIncome ? 'Update Income' : 'Update Expense';
    
    if (typeof window.switchTab === 'function') window.switchTab('expenses', false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

export function deleteExpense(identifier) {
    let index = -1;
    if (typeof identifier === 'number') {
        index = identifier;
    } else if (identifier !== undefined && identifier !== null) {
        const idStr = String(identifier).trim();
        index = state.expenses.findIndex(e => e && String(e.id) === idStr);
        if (index === -1 && /^\d+$/.test(idStr)) {
            index = parseInt(idStr, 10);
        }
    }
    if (index < 0 || !state.expenses[index]) return;
    const ex = state.expenses[index];
    const isIncome = ex.type === 'Income';
    if (!confirm(isIncome ? 'Delete this additional income record?' : 'Delete this expense record?')) return;
    
    if (ex.id) markIdDeleted(ex.id);
    state.expenses.splice(index, 1);
    saveLocalStateSafely();
    syncToFirebase();
    renderExpenses();
    if (typeof window.renderAccounts === 'function') window.renderAccounts();
    if (typeof window.renderDashboard === 'function') window.renderDashboard();
    if (typeof window.renderAll === 'function') window.renderAll();
}

export function renderExpenses() {
    ensurePurchaseTimestamps(state.expenses);

    // Calculate overall summaries
    let totalExpenses = 0;
    let totalIncome = 0;
    (state.expenses || []).forEach(e => {
        if (!e || e._deleted) return;
        const amt = Number(e.amount || 0);
        if (e.type === 'Income') {
            totalIncome += amt;
        } else {
            totalExpenses += amt;
        }
    });
    const netTotal = totalIncome - totalExpenses;

    const badgeExp = document.getElementById('expTotalExpensesBadge');
    const badgeInc = document.getElementById('expTotalIncomeBadge');
    const badgeNet = document.getElementById('expNetTotalBadge');

    if (badgeExp) badgeExp.textContent = '₹' + totalExpenses.toFixed(2);
    if (badgeInc) badgeInc.textContent = '₹' + totalIncome.toFixed(2);
    if (badgeNet) {
        badgeNet.textContent = (netTotal >= 0 ? '+₹' : '-₹') + Math.abs(netTotal).toFixed(2);
        badgeNet.className = `text-xs sm:text-sm font-extrabold ${netTotal >= 0 ? 'text-emerald-400' : 'text-rose-400'}`;
    }

    // Filter list entries based on selected filter
    let itemsToRender = state.expenses.map((ex, i) => ({ ...ex, _originalIndex: i })).filter(ex => !ex._deleted);
    if (expenseListFilter === 'Expense') {
        itemsToRender = itemsToRender.filter(ex => !ex.type || ex.type === 'Expense');
    } else if (expenseListFilter === 'Income') {
        itemsToRender = itemsToRender.filter(ex => ex.type === 'Income');
    }

    itemsToRender.sort((a, b) => {
        const diff = dateSortValue(b.date) - dateSortValue(a.date);
        if (diff !== 0) return diff;
        const timeDiff = (Number(b.savedAt) || 0) - (Number(a.savedAt) || 0);
        return timeDiff || b._originalIndex - a._originalIndex;
    });

    const container = document.getElementById('expenseListContainer');
    if (container) {
        container.innerHTML = itemsToRender.map((ex) => {
            const isIncome = ex.type === 'Income';
            const badgeHtml = isIncome 
                ? '<span class="bg-emerald-950 text-emerald-400 border border-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1">🟢 Other Income</span>'
                : '<span class="bg-rose-950 text-rose-300 border border-rose-800 text-[10px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1">🔻 Shop Expense</span>';
            const amountColor = isIncome ? 'text-emerald-400' : 'text-rose-400';
            const amountPrefix = isIncome ? '+ ₹' : '- ₹';

            return `
            <div class="bg-slate-900/80 p-3.5 rounded-xl border ${isIncome ? 'border-emerald-950/80 hover:border-emerald-800/60' : 'border-slate-800 hover:border-slate-700'} flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2.5 text-xs transition">
                <div class="min-w-0 flex-1">
                    <div class="flex items-center gap-2 flex-wrap">
                        <span class="font-bold text-slate-100 text-sm block leading-snug break-words">${ex.title}</span>
                        ${badgeHtml}
                    </div>
                    <p class="text-slate-400 mt-1 flex items-center gap-2 font-medium">
                        <span class="${amountColor} font-bold text-sm">${amountPrefix}${Number(ex.amount || 0).toFixed(2)}</span>
                        <span>•</span>
                        <span>${formatDateDDMMYYYY(ex.date)}</span>
                    </p>
                </div>
                <div class="flex items-center gap-1.5 justify-end shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800/80 w-full sm:w-auto">
                    <button type="button" onclick="viewExpense(${ex._originalIndex})" class="flex-1 sm:flex-initial bg-slate-800 hover:bg-slate-700 text-sky-300 px-3 py-1.5 rounded-lg font-semibold border border-slate-700 text-center transition cursor-pointer">View</button>
                    <button type="button" onclick="editExpense(${ex._originalIndex})" class="flex-1 sm:flex-initial bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-lg font-semibold border border-slate-700 text-center transition cursor-pointer">Edit</button>
                    <button type="button" onclick="deleteExpense('${ex.id || ex._originalIndex}')" class="flex-1 sm:flex-initial bg-slate-800 hover:bg-rose-950/60 text-rose-300 hover:text-rose-200 px-3 py-1.5 rounded-lg font-semibold border border-slate-700 hover:border-rose-800/60 text-center transition cursor-pointer">Delete</button>
                </div>
            </div>`;
        }).join('') || '<p class="text-xs text-slate-500 text-center py-6 bg-slate-950/40 rounded-xl border border-dashed border-slate-800">No records found for the selected view.</p>';
    }
}

export function resetExpenseForm() {
    const f = document.getElementById('expenseForm');
    if (f) f.reset();
    document.getElementById('expIndex').value = '-1';
    
    // Maintain the active tab's style and placeholders
    switchExpenseTab(currentExpenseTab);

    const expDateEl = document.getElementById('expDate');
    if (expDateEl) expDateEl.value = getTodayDateString();
    if (typeof window.setupDateFields === 'function') window.setupDateFields();
}

export function viewExpense(index) {
    const ex = state.expenses[index];
    if (!ex) return;
    const isIncome = ex.type === 'Income';
    const typeLabel = isIncome ? '🟢 Additional Income' : '🔻 Shop Expense';
    const amountLabel = (isIncome ? '+ ₹' : '- ₹') + Number(ex.amount || 0).toFixed(2);
    
    if (typeof window.showRecordView === 'function') {
        window.showRecordView(
            isIncome ? 'Additional Income Details' : 'Shop Expense Details', 
            `<div class="space-y-3 text-xs">
                <div class="flex justify-between items-center bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
                    <span class="text-slate-400">Record Type</span>
                    <span class="font-bold ${isIncome ? 'text-emerald-400' : 'text-rose-400'}">${typeLabel}</span>
                </div>
                <div class="flex justify-between items-center bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
                    <span class="text-slate-400">Particulars / Title</span>
                    <span class="font-bold text-slate-100 text-right">${ex.title}</span>
                </div>
                <div class="flex justify-between items-center bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
                    <span class="text-slate-400">Amount</span>
                    <span class="font-extrabold text-sm ${isIncome ? 'text-emerald-400' : 'text-rose-400'}">${amountLabel}</span>
                </div>
                <div class="flex justify-between items-center bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
                    <span class="text-slate-400">Date</span>
                    <span class="font-semibold text-slate-200">${formatDateDDMMYYYY(ex.date)}</span>
                </div>
            </div>
            <div class="flex gap-2 pt-4 border-t border-slate-800 mt-4 justify-end">
                <button type="button" onclick="closeRecordView(); editExpense(${index});" class="bg-slate-800 text-slate-200 px-3.5 py-1.5 rounded-lg border border-slate-700 hover:bg-slate-700 font-semibold text-xs cursor-pointer">Edit</button>
                <button type="button" onclick="closeRecordView(); deleteExpense('${ex.id || index}');" class="bg-slate-800 text-rose-300 hover:bg-rose-950/60 px-3.5 py-1.5 rounded-lg border border-slate-700 hover:border-rose-800/60 font-semibold text-xs cursor-pointer">Delete</button>
            </div>`
        );
    }
}

// Global window bindings for HTML inline onclick attributes
if (typeof window !== 'undefined') {
    window.switchExpenseTab = switchExpenseTab;
    window.setExpenseListFilter = setExpenseListFilter;
    window.saveExpense = saveExpense;
    window.editExpense = editExpense;
    window.deleteExpense = deleteExpense;
    window.renderExpenses = renderExpenses;
    window.resetExpenseForm = resetExpenseForm;
    window.viewExpense = viewExpense;
}

