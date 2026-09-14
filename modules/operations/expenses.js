/**
 * FIA CLEAN & CARE - Operations: Expenses Management Module
 * Handles general shop expenses (rent, electricity, wages, maintenance).
 */

import {
    state,
    dateSortValue,
    formatDateDDMMYYYY,
    normalizeToDateKey,
    getTodayDateString,
    markIdDeleted,
    unmarkIdDeleted,
    saveLocalStateSafely
} from '../core/state.js';
import { syncToFirebase } from '../core/db.js';
import { ensurePurchaseTimestamps } from './purchases.js';

export function saveExpense(e) {
    e.preventDefault();
    const idx = parseInt(document.getElementById('expIndex').value);
    const expId = (idx >= 0 && state.expenses[idx]?.id) || ('exp_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7));
    unmarkIdDeleted(expId);
    
    const rawDate = document.getElementById('expDate')?.value;
    const cleanDate = normalizeToDateKey(rawDate) || getTodayDateString();
    const now = Date.now();

    const data = {
        id: expId,
        title: document.getElementById('expTitle').value.trim(),
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
    alert('✅ ചിലവ് വിവരങ്ങൾ വിജയകരമായി സേവ് ചെയ്തു!');
}

export function editExpense(index) {
    const ex = state.expenses[index];
    if (!ex) return;
    document.getElementById('expIndex').value = index;
    document.getElementById('expTitle').value = ex.title || '';
    document.getElementById('expAmount').value = ex.amount ?? '';
    document.getElementById('expDate').value = normalizeToDateKey(ex.date) || getTodayDateString();
    document.getElementById('expFormTitle').innerText = 'Edit Shop Expense';
    document.getElementById('expSubmitBtn').innerText = 'Update Expense';
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
    if (!confirm('Delete this expense?')) return;
    const ex = state.expenses[index];
    if (ex.id) markIdDeleted(ex.id);
    state.expenses.splice(index, 1);
    syncToFirebase();
    if (typeof window.renderAll === 'function') window.renderAll();
}

export function renderExpenses() {
    ensurePurchaseTimestamps(state.expenses);
    const sortedExpenses = state.expenses.map((ex, i) => ({ ...ex, _originalIndex: i })).sort((a, b) => {
        const diff = dateSortValue(b.date) - dateSortValue(a.date);
        if (diff !== 0) return diff;
        const timeDiff = (Number(b.savedAt) || 0) - (Number(a.savedAt) || 0);
        return timeDiff || b._originalIndex - a._originalIndex;
    });
    const container = document.getElementById('expenseListContainer');
    if (container) {
        container.innerHTML = sortedExpenses.map((ex) => `
            <div class="bg-slate-950/60 p-3 rounded-xl border border-slate-800 flex flex-col sm:flex-row justify-between gap-2 text-xs">
                <div class="min-w-0 flex-1 break-words"><span class="font-bold text-rose-300">${ex.title}</span><p class="text-slate-400">₹${ex.amount} | ${formatDateDDMMYYYY(ex.date)}</p></div>
                <div class="flex flex-wrap gap-1 shrink-0">
                    <button type="button" onclick="viewExpense(${ex._originalIndex})" class="bg-blue-900 text-blue-200 px-2 py-1.5 rounded-lg">View</button>
                    <button type="button" onclick="editExpense(${ex._originalIndex})" class="bg-slate-800 text-amber-400 px-2 py-1.5 rounded-lg">Edit</button>
                    <button type="button" onclick="deleteExpense('${ex.id || ex._originalIndex}')" class="bg-red-900 text-red-200 px-2 py-1.5 rounded-lg">Delete</button>
                </div>
            </div>`).join('') || '<p class="text-xs text-slate-500 text-center">No expenses found.</p>';
    }
}

export function resetExpenseForm() {
    const f = document.getElementById('expenseForm');
    if (f) f.reset();
    document.getElementById('expIndex').value = '-1';
    document.getElementById('expFormTitle').innerText = 'General Shop Expenses (Rent, Current, Wages)';
    document.getElementById('expSubmitBtn').innerText = 'Save Expense';
    const expDateEl = document.getElementById('expDate');
    if (expDateEl) expDateEl.value = getTodayDateString();
    if (typeof window.setupDateFields === 'function') window.setupDateFields();
}

export function viewExpense(index) {
    const ex = state.expenses[index];
    if (!ex) return;
    if (typeof window.showRecordView === 'function') {
        window.showRecordView('Expense Details', `<div class="space-y-2"><p><b>Title:</b> ${ex.title}</p><p><b>Amount:</b> ₹${Number(ex.amount || 0).toFixed(2)}</p><p><b>Date:</b> ${formatDateDDMMYYYY(ex.date)}</p></div><div class="flex gap-2 pt-4 border-t border-slate-800 mt-4 justify-end"><button type="button" onclick="closeRecordView(); editExpense(${index});" class="bg-slate-800 text-amber-400 px-3 py-1.5 rounded-lg border border-slate-700 font-bold">Edit</button><button type="button" onclick="closeRecordView(); deleteExpense(${index});" class="bg-red-900 text-red-200 px-3 py-1.5 rounded-lg font-bold">Delete</button></div>`);
    }
}

// Global window bindings for HTML inline onclick attributes
if (typeof window !== 'undefined') {
    window.saveExpense = saveExpense;
    window.editExpense = editExpense;
    window.deleteExpense = deleteExpense;
    window.renderExpenses = renderExpenses;
    window.resetExpenseForm = resetExpenseForm;
    window.viewExpense = viewExpense;
}
