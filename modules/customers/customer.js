/**
 * FIA CLEAN & CARE - Customer Management & Directory Module
 */

import {
    state,
    markIdDeleted,
    unmarkIdDeleted,
    getTodayDateString,
    formatDateDDMMYYYY,
    dateSortValue,
    money,
    toTitleCase
} from '../core/state.js';
import { syncToFirebase } from '../core/db.js';
import { normalizeCosSale } from '../billing/billing-history.js';
import { previewBill, previewCosSaleBill } from '../billing/invoice-preview.js';

export function switchCustomerSubTab(tab) {
    const listContent = document.getElementById('customerListSubContent');
    const reportContent = document.getElementById('customerReportSubContent');
    const btnList = document.getElementById('subTabCustList');
    const btnReport = document.getElementById('subTabCustReport');

    const isReport = (tab === 'report' || tab === 'consolidation');

    if (listContent) listContent.classList.toggle('hidden', isReport);
    if (reportContent) reportContent.classList.toggle('hidden', !isReport);

    if (btnList) {
        if (!isReport) {
            btnList.className = "flex-1 py-2 text-center text-xs font-bold bg-indigo-600 text-white rounded-xl shadow-md transition";
        } else {
            btnList.className = "flex-1 py-2 text-center text-xs font-bold text-slate-400 rounded-xl transition hover:text-slate-200";
        }
    }
    if (btnReport) {
        if (isReport) {
            btnReport.className = "flex-1 py-2 text-center text-xs font-bold bg-indigo-600 text-white rounded-xl shadow-md transition";
        } else {
            btnReport.className = "flex-1 py-2 text-center text-xs font-bold text-slate-400 rounded-xl transition hover:text-slate-200";
        }
    }

    if (isReport) {
        switchCustomerConsolidationView('report');
    } else {
        renderDirectCustomerList();
    }
}

export function saveDirectCustomerProfile(e) {
    if (e && e.preventDefault) e.preventDefault();
    const nameInput = document.getElementById('directCustName');
    const phoneInput = document.getElementById('directCustPhone');
    const originalIndex = parseInt(document.getElementById('directCustOriginalIndex')?.value || "-1", 10);

    const name = (nameInput?.value || '').trim().toUpperCase();
    const phone = (phoneInput?.value || '').trim();

    if (!name) {
        alert("Please enter customer name.");
        return;
    }

    const cleanNameKey = name.toLowerCase();

    if (originalIndex === -1) {
        const existingIdx = (state.customers || []).findIndex(c => c && !c.billNo && String(c.name || '').trim().toLowerCase() === cleanNameKey);
        if (existingIdx !== -1) {
            state.customers[existingIdx].name = name;
            state.customers[existingIdx].phone = phone;
            state.customers[existingIdx].savedAt = Date.now();
            if (state.customers[existingIdx].id) unmarkIdDeleted(state.customers[existingIdx].id);
        } else {
            const custId = 'cust_' + Date.now().toString() + '_' + Math.random().toString(36).slice(2, 7);
            unmarkIdDeleted(custId);
            state.customers.push({
                id: custId,
                name: name,
                phone: phone,
                items: [],
                grandTotal: 0,
                paidAmount: 0,
                pendingAmount: 0,
                date: getTodayDateString(),
                savedAt: Date.now()
            });
        }
    } else {
        const oldCustomer = state.customers[originalIndex];
        if (oldCustomer) {
            const oldName = oldCustomer.name;
            if (oldCustomer.id) unmarkIdDeleted(oldCustomer.id);
            state.customers.forEach(c => {
                if (c && String(c.name || '').trim().toLowerCase() === String(oldName || '').trim().toLowerCase()) {
                    c.name = name;
                    c.phone = phone;
                    c.savedAt = Date.now();
                    if (c.id) unmarkIdDeleted(c.id);
                }
            });
        }
    }

    syncToFirebase();
    resetDirectCustomerForm();
    renderCustomers();
    updateCustomerDropdown();
    updateCosCustomerDropdown();
    alert(`Customer "${name}" saved successfully!`);
}

export function editCustomerProfile(name, phone) {
    const nEl = document.getElementById('directCustName');
    const pEl = document.getElementById('directCustPhone');
    if (nEl) nEl.value = (name || '').toUpperCase();
    if (pEl) pEl.value = (phone !== 'undefined' && phone !== 'No Phone') ? phone : '';
    const idx = (state.customers || []).findIndex(c => c && c.name === name);
    const origEl = document.getElementById('directCustOriginalIndex');
    if (origEl) origEl.value = idx;
    const titleEl = document.getElementById('custMgrTitle');
    if (titleEl) titleEl.innerText = "Edit Customer";
    const submitBtn = document.getElementById('directCustSubmitBtn');
    if (submitBtn) submitBtn.innerText = "Update Customer";

    switchCustomerSubTab('list');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

export function deleteDirectCustomer(name) {
    if (!name) return;
    const targetName = String(name).trim();
    if (confirm(`Are you sure you want to delete customer "${targetName}"?`)) {
        const key = targetName.toLowerCase();
        // Permanently tombstone each matching record's ID and billNo
        state.customers.forEach(c => {
            if (c && String(c.name || '').trim().toLowerCase() === key) {
                if (c.billNo) markIdDeleted(c.billNo);
                if (c.id) markIdDeleted(c.id);
            }
        });
        state.customers = state.customers.filter(c => !c || !c.name || String(c.name).trim().toLowerCase() !== key);
        syncToFirebase();
        if (window.renderAll) window.renderAll();
        alert(`Customer "${targetName}" deleted successfully!`);
    }
}

export function renderDirectCustomerList() {
    const container = document.getElementById('directCustomerListContainer');
    if (!container) return;
    let uniqueNames = [];
    (state.customers || []).forEach(c => {
        if (c && c.name && !uniqueNames.includes(c.name)) uniqueNames.push(c.name);
    });
    const badge = document.getElementById('customerCountBadge');
    if (badge) badge.innerText = `${uniqueNames.length} Customers`;
    
    const q = (document.getElementById('customerDirectorySearch')?.value || '').trim().toLowerCase();
    const filteredNames = uniqueNames.filter(name => {
        const cObj = state.customers.find(c => c && c.name === name && c.phone) || state.customers.find(c => c && c.name === name);
        const phone = cObj ? String(cObj.phone || '') : '';
        return !q || String(name).toLowerCase().includes(q) || phone.toLowerCase().includes(q);
    });
    if (badge) badge.innerText = `${filteredNames.length} Customers`;
    container.innerHTML = filteredNames.length === 0 ? '<p class="text-xs text-slate-500 text-center py-2">No customers found.</p>' : '';

    filteredNames.sort().forEach(name => {
        let cObj = state.customers.find(c => c && c.name === name && c.phone) || state.customers.find(c => c && c.name === name);
        let phone = cObj ? cObj.phone : '';
        const safeName = String(name).replace(/'/g, "\\'");
        const safePhone = String(phone || '').replace(/'/g, "\\'");
        container.innerHTML += `
            <div class="flex flex-col sm:flex-row sm:justify-between sm:items-center bg-slate-900/80 p-3.5 rounded-xl border border-slate-800 text-xs gap-2.5">
                <div class="min-w-0 flex-1">
                    <strong class="text-slate-100 font-bold text-sm block leading-snug break-words">${name.toUpperCase()}</strong>
                    <p class="text-slate-400 text-[11px] mt-1">📞 Phone: ${phone || 'No Phone'}</p>
                </div>
                <div class="flex items-center gap-1.5 justify-end shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800/80 w-full sm:w-auto">
                    <button type="button" onclick="window.viewCustomerProfile('${safeName}')" class="flex-1 sm:flex-initial bg-slate-800 hover:bg-slate-700 text-sky-300 px-3 py-1.5 rounded-lg border border-slate-700 font-semibold text-center transition">View</button>
                    <button type="button" onclick="window.editCustomerProfile('${safeName}', '${safePhone}')" class="flex-1 sm:flex-initial bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-lg border border-slate-700 font-semibold text-center transition">Edit</button>
                    <button type="button" onclick="window.deleteDirectCustomer('${safeName}')" class="flex-1 sm:flex-initial bg-slate-800 hover:bg-rose-950/60 text-rose-300 hover:text-rose-200 px-3 py-1.5 rounded-lg border border-slate-700 hover:border-rose-800/60 font-semibold text-center transition">Delete</button>
                </div>
            </div>`;
    });
}

export function resetDirectCustomerForm() {
    const form = document.getElementById('directCustomerForm');
    if (form) form.reset();
    const idx = document.getElementById('directCustOriginalIndex');
    if (idx) idx.value = "-1";
    const title = document.getElementById('custMgrTitle');
    if (title) title.innerText = "Add Customer";
    const btn = document.getElementById('directCustSubmitBtn');
    if (btn) btn.innerText = "Save Customer";
}

export function updateCustomerDropdown() {
    const select = document.getElementById('existingCustomerSelect');
    if (!select) return;
    const current = document.getElementById('custName')?.value || '';
    select.innerHTML = '<option value="">-- Select Customer / Enter Manually Below --</option>';
    let uniqueCusts = {};
    (state.customers || []).forEach(c => {
        if (c && c.name) {
            uniqueCusts[c.name] = c.phone || '';
        }
    });
    Object.keys(uniqueCusts).sort((a, b) => String(a).localeCompare(String(b), undefined, { sensitivity: 'base', numeric: true })).forEach(name => {
        select.innerHTML += `<option value="${name}" data-phone="${uniqueCusts[name]}">${toTitleCase(name)}</option>`;
    });
    if (current && uniqueCusts[current] !== undefined) select.value = current;
}

export function fillExistingCustomer() {
    const select = document.getElementById('existingCustomerSelect');
    const name = select ? select.value : '';
    if (name) {
        document.getElementById('custName').value = toTitleCase(name);
        const selectedOpt = select.options[select.selectedIndex];
        document.getElementById('custPhone').value = selectedOpt?.getAttribute('data-phone') || '';
    } else {
        document.getElementById('custName').value = '';
        document.getElementById('custPhone').value = '';
    }
}

export function updateCosCustomerDropdown() {
    const select = document.getElementById('cosExistingCustomerSelect');
    if (!select) return;
    const current = document.getElementById('cosSCustomer')?.value || '';
    select.innerHTML = '<option value="">-- Select Customer / Enter Manually Below --</option>';
    let uniqueCusts = {};
    (state.customers || []).forEach(c => {
        if (c && c.name) uniqueCusts[c.name] = c.phone || '';
    });
    Object.keys(uniqueCusts).sort((a, b) => String(a).localeCompare(String(b), undefined, { sensitivity: 'base', numeric: true })).forEach(name => {
        select.innerHTML += `<option value="${name}">${toTitleCase(name)}</option>`;
    });
    if (current && uniqueCusts[current] !== undefined) select.value = current;
}

export function fillCosExistingCustomer() {
    const select = document.getElementById('cosExistingCustomerSelect');
    const name = select ? select.value : '';
    const found = (state.customers || []).find(c => c && c.name === name);
    if (name) {
        document.getElementById('cosSCustomer').value = toTitleCase(name);
        const phoneEl = document.getElementById('cosSPhone');
        if (phoneEl) phoneEl.value = found?.phone || '';
    } else {
        document.getElementById('cosSCustomer').value = '';
        const phoneEl = document.getElementById('cosSPhone');
        if (phoneEl) phoneEl.value = '';
    }
}

export function renderCustomerConsolidationReport() {
    const container = document.getElementById('customerConsolidationContainer') || document.getElementById('customerConsolidationList');
    if (!container) return;

    let customerMap = {};
    (state.customers || []).forEach(c => {
        if (c && c.name) {
            let key = c.name.trim();
            if (!customerMap[key]) {
                customerMap[key] = { name: key, phone: c.phone || '', totalPurchase: 0, totalPaid: 0, totalPending: 0, billCount: 0 };
            } else if (c.phone && !customerMap[key].phone) {
                customerMap[key].phone = c.phone;
            }
        }
    });

    (state.customers || []).forEach(c => {
        if (c && c.name && (c.items || c.grandTotal !== undefined)) {
            let key = c.name.trim();
            if (!customerMap[key]) {
                customerMap[key] = { name: key, phone: c.phone || '', totalPurchase: 0, totalPaid: 0, totalPending: 0, billCount: 0 };
            }
            let gTotal = Number(c.grandTotal || 0);
            let paid = c.paidAmount !== undefined ? Number(c.paidAmount) : gTotal;
            let pending = c.pendingAmount !== undefined ? Number(c.pendingAmount) : Math.max(0, gTotal - paid);

            customerMap[key].totalPurchase += gTotal;
            customerMap[key].totalPaid += paid;
            customerMap[key].totalPending += pending;
            if (c.billNo || (c.items && c.items.length > 0)) customerMap[key].billCount += 1;
        }
    });

    (state.cosSales || []).forEach(s => {
        if (s && s.customer) {
            let key = s.customer.trim();
            if (!customerMap[key]) {
                customerMap[key] = { name: key, phone: s.phone || '', totalPurchase: 0, totalPaid: 0, totalPending: 0, billCount: 0 };
            }
            const norm = normalizeCosSale(s);
            customerMap[key].totalPurchase += Number(norm.grandTotal || 0);
            customerMap[key].totalPaid += Number(norm.paidAmount || 0);
            customerMap[key].totalPending += Number(norm.pendingAmount || 0);
            customerMap[key].billCount += 1;
        }
    });

    let entries = Object.values(customerMap);
    const query = (document.getElementById('consolidationSearchInput')?.value || '').trim().toLowerCase();
    if (query) {
        entries = entries.filter(e => e.name.toLowerCase().includes(query) || (e.phone && e.phone.toLowerCase().includes(query)));
    }

    entries.sort((a, b) => b.totalPurchase - a.totalPurchase);

    if (entries.length === 0) {
        container.innerHTML = '<p class="text-xs text-slate-500 text-center py-6">No customer data found for consolidation.</p>';
        return;
    }

    container.innerHTML = entries.map(e => `
        <div class="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800 text-xs space-y-2 cursor-pointer active:scale-[0.99] transition" role="button" tabindex="0" title="Tap to view customer history" onclick="window.openCustomerConsolidationCustomer('${encodeURIComponent(e.name)}')" onkeydown="if(event.key==='Enter' || event.key===' ') { event.preventDefault(); window.openCustomerConsolidationCustomer('${encodeURIComponent(e.name)}'); }">
            <div class="flex justify-between items-start">
                <div>
                    <span class="font-bold text-slate-100 text-sm">${e.name.toUpperCase()}</span>
                    <p class="text-slate-400 text-[11px]">Phone: ${e.phone || 'No Phone'} • Bills: ${e.billCount}</p>
                </div>
                <div class="text-right">
                    <span class="text-[10px] text-slate-400 uppercase">Total Purchase</span>
                    <p class="font-extrabold text-white text-sm">₹${e.totalPurchase.toFixed(2)}</p>
                </div>
            </div>
            <div class="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800/80 text-[11px]">
                <div>
                    <span class="text-slate-400">Total Paid:</span> <strong class="text-emerald-400">₹${e.totalPaid.toFixed(2)}</strong>
                </div>
                <div class="text-right">
                    <span class="text-slate-400">Pending Due:</span> <strong class="${e.totalPending > 0 ? 'text-rose-400 font-bold' : 'text-slate-300'}">₹${e.totalPending.toFixed(2)}</strong>
                </div>
            </div>
        </div>
    `).join('');
}

export const renderCustomerConsolidationList = renderCustomerConsolidationReport;

export const saveDirectCustomer = saveDirectCustomerProfile;

export function switchCustomerConsolidationView(view) {
    const viewContent = document.getElementById('customerConsolidationViewContent');
    const reportContent = document.getElementById('customerConsolidationReportContent');
    const viewTab = document.getElementById('customerConsolidationViewTab');
    const reportTab = document.getElementById('customerConsolidationReportTab');

    [viewContent, reportContent].forEach(el => el && el.classList.add('hidden'));
    [viewTab, reportTab].forEach(btn => {
        if (btn) {
            btn.classList.remove('bg-indigo-600', 'text-white', 'shadow-md');
            btn.classList.add('text-slate-400');
        }
    });

    if (view === 'report') {
        reportContent?.classList.remove('hidden');
        reportTab?.classList.add('bg-indigo-600', 'text-white', 'shadow-md');
        reportTab?.classList.remove('text-slate-400');
        renderCustomerConsolidationReport();
    } else {
        viewContent?.classList.remove('hidden');
        viewTab?.classList.add('bg-indigo-600', 'text-white', 'shadow-md');
        viewTab?.classList.remove('text-slate-400');
        renderCustomerConsolidationView();
    }
}

export function renderCustomerConsolidationView() {
    const container = document.getElementById('customerConsolidationViewContainer');
    if (!container) return;

    const query = (document.getElementById('consolidationViewSearchInput')?.value || '').trim().toLowerCase();
    const grouped = {};

    (state.customers || []).forEach((c, index) => {
        if (!c || !c.name) return;
        const hasBill = Boolean(c.billNo || (Array.isArray(c.items) && c.items.length > 0) || Number(c.grandTotal || 0) > 0);
        if (!hasBill) return;
        const name = c.name.trim();
        if (!name) return;
        if (query && !name.toLowerCase().includes(query) && !String(c.phone || '').toLowerCase().includes(query)) return;

        if (!grouped[name]) grouped[name] = { name, phone: c.phone || '', rows: [] };
        if (c.phone && !grouped[name].phone) grouped[name].phone = c.phone;

        const total = Number(c.grandTotal || 0);
        const paid = c.paidAmount !== undefined ? Number(c.paidAmount) : total;
        const due = c.pendingAmount !== undefined ? Number(c.pendingAmount) : Math.max(0, total - paid);
        const ret = c.excessAmount !== undefined ? Number(c.excessAmount) : Math.max(0, paid - total);

        grouped[name].rows.push({
            index, billNo: c.billNo || '—', id: c.id, date: c.date, items: Array.isArray(c.items) ? c.items : [],
            total, paid, due, ret, saleType: c.saleType || 'Retail', paymentMode: c.paymentMode || 'Cash'
        });
    });

    (state.cosSales || []).forEach((s, index) => {
        if (!s || !s.customer) return;
        const name = String(s.customer).trim();
        if (!name) return;
        if (query && !name.toLowerCase().includes(query) && !String(s.phone || '').toLowerCase().includes(query)) return;

        const n = normalizeCosSale(s);
        if (!grouped[name]) grouped[name] = { name, phone: s.phone || '', rows: [] };
        if (s.phone && !grouped[name].phone) grouped[name].phone = s.phone;

        grouped[name].rows.push({
            index, billNo: s.billNo || '—', id: s.id, date: s.date, items: n.items || [],
            total: n.grandTotal, paid: n.paidAmount, due: n.pendingAmount,
            ret: n.excessAmount || Math.max(0, n.paidAmount - n.grandTotal),
            saleType: n.saleType || 'Retail', paymentMode: n.paymentMode || 'Cash', cosmetics: true
        });
    });

    const entries = Object.values(grouped).sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true }));

    if (!entries.length) {
        container.innerHTML = '<p class="text-xs text-slate-500 text-center py-6">No customer purchase history found.</p>';
        return;
    }

    container.innerHTML = entries.map(e => {
        e.rows.sort((a, b) => {
            const d = dateSortValue(b.date) - dateSortValue(a.date);
            return d !== 0 ? d : b.index - a.index;
        });

        return `<div class="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800 text-xs space-y-2">
            <div class="flex justify-between items-start gap-2">
                <div>
                    <span class="font-bold text-slate-100 text-sm">${e.name.toUpperCase()}</span>
                    <p class="text-slate-400 text-[11px]">Phone: ${e.phone || 'No Phone'} • ${e.rows.length} Bills</p>
                </div>
            </div>
            <div class="space-y-2 pt-1">
                ${e.rows.map((r, ri) => {
                    const itemText = r.items.map(i => i && (i.productName || i.item || 'Item')).join(', ');
                    const billTarget = (r.billNo && r.billNo !== '—') ? r.billNo : (r.id || r.index);
                    const viewFn = r.cosmetics ? `window.previewCosSaleBill('${billTarget}')` : `window.previewBill('${billTarget}')`;
                    const editFn = r.cosmetics ? `window.editCosSale('${billTarget}')` : `window.editCustomerBill('${billTarget}')`;
                    const deleteFn = r.cosmetics ? `window.deleteCosSale('${billTarget}')` : `window.deleteCustomerBill('${billTarget}')`;
                    const detailParts = [
                        `Bill ${r.billNo}`,
                        formatDateDDMMYYYY(r.date),
                        itemText || 'No item details',
                        `Total ₹${r.total.toFixed(2)}`,
                        `Paid ₹${r.paid.toFixed(2)}`
                    ];
                    if (r.due > 0) detailParts.push(`Due ₹${r.due.toFixed(2)}`);
                    if (r.ret > 0) detailParts.push(`Return ₹${r.ret.toFixed(2)}`);
                    return `<div class="bg-slate-900/80 border border-slate-800 rounded-xl p-3 flex flex-col sm:flex-row sm:justify-between gap-2.5 sm:items-center">
                        <div class="min-w-0 flex-1">
                            <div class="font-bold text-slate-100">#${ri + 1} • ${detailParts[0]} ${r.cosmetics ? '<span class="text-[10px] text-pink-300 font-semibold ml-1">💄 Cosmetics</span>' : ''}</div>
                            <div class="text-[10px] text-slate-400 mt-1">${detailParts.slice(1).join(' | ')}</div>
                            <div class="text-[10px] text-slate-500 mt-0.5">${r.saleType} • ${r.paymentMode}</div>
                        </div>
                        <div class="flex items-center gap-1.5 justify-end shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800/80 w-full sm:w-auto">
                            <button type="button" onclick="${viewFn}" class="flex-1 sm:flex-initial bg-slate-800 hover:bg-slate-700 text-sky-300 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition border border-slate-700">View</button>
                            <button type="button" onclick="${editFn}" class="flex-1 sm:flex-initial bg-slate-800 hover:bg-slate-700 text-slate-200 px-2.5 py-1.5 rounded-lg border border-slate-700 text-xs font-semibold transition">Edit</button>
                            <button type="button" onclick="${deleteFn}" class="flex-1 sm:flex-initial bg-slate-800 hover:bg-rose-950/60 text-rose-300 hover:text-rose-200 px-2.5 py-1.5 rounded-lg border border-slate-700 hover:border-rose-800/60 text-xs font-semibold transition">Delete</button>
                        </div>
                    </div>`;
                }).join('')}
            </div>
        </div>`;
    }).join('');
}

let selectedCustomerConsolidatedName = '';

export function openCustomerConsolidationCustomer(encodedName) {
    const name = decodeURIComponent(encodedName || '');
    selectedCustomerConsolidatedName = name;
    const title = document.getElementById('customerConsolidatedDetailTitle');
    const content = document.getElementById('customerConsolidatedDetailContent');
    if (!content) return;
    if (title) title.textContent = name + ' - Consolidated Report';

    let purchaseCount = 0, total = 0, paid = 0, due = 0;
    (state.customers || []).forEach(c => {
        if (!c || String(c.name || '').trim() !== name) return;
        const hasBill = Boolean(c.billNo || (Array.isArray(c.items) && c.items.length > 0) || Number(c.grandTotal || 0) > 0);
        if (!hasBill) return;
        const g = Number(c.grandTotal || 0);
        const p = c.paidAmount !== undefined ? Number(c.paidAmount) : g;
        const d = c.pendingAmount !== undefined ? Number(c.pendingAmount) : Math.max(0, g - p);
        purchaseCount += 1; total += g; paid += p; due += d;
    });
    (state.cosSales || []).forEach(s => {
        if (!s || String(s.customer || '').trim() !== name) return;
        const n = normalizeCosSale(s);
        purchaseCount += 1; total += Number(n.grandTotal || 0); paid += Number(n.paidAmount || 0); due += Number(n.pendingAmount || 0);
    });

    const phone = ((state.customers || []).find(c => c && String(c.name || '').trim() === name && c.phone)?.phone) ||
        ((state.cosSales || []).find(s => s && String(s.customer || '').trim() === name && s.phone)?.phone || '');

    content.innerHTML = `
        <div class="space-y-3">
            <div class="bg-slate-950/70 rounded-xl p-3 border border-slate-800">
                <div class="font-bold text-slate-100 text-sm">${name}</div>
                <div class="text-slate-400 mt-1">Phone: ${phone || 'No Phone'}</div>
            </div>
            <div class="bg-slate-950/70 rounded-xl p-3 border border-slate-800">
                <div class="text-center text-slate-200 text-xs font-bold mb-3 tracking-wider">CUSTOMER CONSOLIDATED SUMMARY</div>
                <div class="grid grid-cols-2 gap-2 text-center">
                    <div class="bg-slate-900 rounded-lg p-3"><div class="text-slate-400 text-[10px]">Total Purchases</div><b class="text-white text-base">${purchaseCount}</b></div>
                    <div class="bg-slate-900 rounded-lg p-3"><div class="text-slate-400 text-[10px]">Total Purchase Amount</div><b class="text-white text-sm">₹${total.toFixed(2)}</b></div>
                    <div class="bg-slate-900 rounded-lg p-3"><div class="text-slate-400 text-[10px]">Total Paid</div><b class="text-emerald-400 text-sm">₹${paid.toFixed(2)}</b></div>
                    <div class="bg-slate-900 rounded-lg p-3"><div class="text-slate-400 text-[10px]">Balance Due</div><b class="text-rose-400 text-sm">₹${due.toFixed(2)}</b></div>
                </div>
            </div>
            <div class="bg-slate-950/60 rounded-xl p-3 border border-slate-800 text-[11px] text-slate-400 text-center">This is the customer's consolidated statement. Detailed bill-wise history remains available separately in the View section.</div>
        </div>`;
    document.getElementById('customerConsolidatedDetailModal')?.classList.remove('hidden');
}

export function closeCustomerConsolidatedDetail() {
    document.getElementById('customerConsolidatedDetailModal')?.classList.add('hidden');
}

export function shareSelectedCustomerConsolidatedDetail() {
    const name = selectedCustomerConsolidatedName;
    if (!name) return;
    let purchaseCount = 0, total = 0, paid = 0, due = 0;
    (state.customers || []).forEach(c => {
        if (!c || String(c.name || '').trim() !== name) return;
        const hasBill = Boolean(c.billNo || (Array.isArray(c.items) && c.items.length > 0) || Number(c.grandTotal || 0) > 0);
        if (!hasBill) return;
        const g = Number(c.grandTotal || 0);
        const p = c.paidAmount !== undefined ? Number(c.paidAmount) : g;
        const d = c.pendingAmount !== undefined ? Number(c.pendingAmount) : Math.max(0, g - p);
        purchaseCount += 1; total += g; paid += p; due += d;
    });
    (state.cosSales || []).forEach(s => {
        if (!s || String(s.customer || '').trim() !== name) return;
        const n = normalizeCosSale(s);
        purchaseCount += 1; total += Number(n.grandTotal || 0); paid += Number(n.paidAmount || 0); due += Number(n.pendingAmount || 0);
    });
    const msg = `*FIA CLEAN & CARE*\n*CUSTOMER CONSOLIDATED STATEMENT*\n\n*Customer:* ${name}\n\n*Total Purchases:* ${purchaseCount}\n*Total Purchase Amount:* ₹${total.toFixed(2)}\n*Total Paid:* ₹${paid.toFixed(2)}\n*Balance Due:* ₹${due.toFixed(2)}\n\n_Thank you for your business!_`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`, '_blank');
}


export function viewCustomerProfile(name) {
    const custBills = (state.customers || []).filter(c => c && c.name === name);
    const phone = custBills.find(c => c.phone)?.phone || 'No mobile';
    const totalPurchase = custBills.reduce((sum, c) => sum + Number(c.grandTotal || 0), 0);
    const totalPaid = custBills.reduce((sum, c) => sum + Number(c.paidAmount || (c.grandTotal || 0)), 0);
    const totalPending = custBills.reduce((sum, c) => sum + Math.max(0, Number(c.pendingAmount || 0)), 0);
    
    const html = `
        <div class="space-y-3 text-xs">
            <div class="bg-slate-950/80 p-3 rounded-xl border border-slate-800">
                <h4 class="font-bold text-slate-100 text-sm">${name}</h4>
                <p class="text-slate-400 mt-0.5">📞 ${phone}</p>
                <div class="grid grid-cols-3 gap-2 mt-2 pt-2 border-t border-slate-800 text-[10px]">
                    <div><span>Purchased:</span> <b class="text-white">₹${totalPurchase.toFixed(2)}</b></div>
                    <div><span>Paid:</span> <b class="text-emerald-400">₹${totalPaid.toFixed(2)}</b></div>
                    <div><span>Due:</span> <b class="${totalPending > 0 ? 'text-rose-400 font-bold' : 'text-slate-300'}">₹${totalPending.toFixed(2)}</b></div>
                </div>
            </div>
            <div class="space-y-1.5 max-h-60 overflow-y-auto">
                <p class="text-[10px] font-bold text-slate-400 uppercase">Recent Invoices</p>
                ${custBills.map(b => `
                    <div class="bg-slate-900/80 p-2 rounded-lg border border-slate-800 flex justify-between items-center text-[11px]">
                        <div>
                            <span class="font-bold text-cyan-300">#${b.billNo || 'Bill'}</span>
                            <span class="text-slate-400 ml-1.5">${formatDateDDMMYYYY(b.date)}</span>
                        </div>
                        <div class="font-bold text-white">₹${Number(b.grandTotal || 0).toFixed(2)}</div>
                    </div>
                `).join('') || '<p class="text-slate-500 text-[11px]">No invoices recorded.</p>'}
            </div>
        </div>
    `;
    if (window.showRecordView) window.showRecordView('Customer Profile: ' + name, html);
}

export function renderCustomers() {
    renderDirectCustomerList();
    renderCustomerConsolidationView();
    renderCustomerConsolidationReport();
}

export async function downloadCustomerConsolidationReportPDF() {
    const container = document.getElementById('customerConsolidationContainer');
    if (!container || !container.children.length) { alert('No customer report available to download.'); return; }
    const query = (document.getElementById('consolidationSearchInput')?.value || '').trim();
    const report = document.createElement('div');
    report.innerHTML = `<div style="font-family:Arial,sans-serif;background:#fff;color:#000;padding:10px"><div style="text-align:center;border-bottom:2px solid #333;padding-bottom:8px;margin-bottom:12px"><div style="font-size:20px;font-weight:bold;color:#065f46">FIA CLEAN & CARE</div><div style="font-size:13px;font-weight:bold">Customer Consolidation Report</div>${query ? `<div style="font-size:11px;margin-top:4px">Customer: ${query}</div>` : ''}</div>${container.innerHTML}</div>`;
    const root = report.firstElementChild;
    root.querySelectorAll('button').forEach(b => b.remove());
    root.querySelectorAll('*').forEach(el => { el.style.color = '#000'; el.style.backgroundColor = '#fff'; el.style.borderColor = '#ddd'; });
    const safeName = query ? query.replace(/[^a-z0-9_-]+/gi, '_') : 'All_Customers';
    if (typeof window.html2pdf !== 'undefined') {
        await window.html2pdf().set({
            margin: [10, 10, 10, 10],
            filename: `FIA_CONSOLIDATED_REPORT_${safeName}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        }).from(root).save();
    } else {
        alert('PDF generator library is loading, please try again in a moment.');
    }
}

export function shareCustomerConsolidationReport() {
    const container = document.getElementById('customerConsolidationContainer');
    if (!container || !container.children.length) { alert('No customer report available to share.'); return; }
    const query = (document.getElementById('consolidationSearchInput')?.value || '').trim();
    const lines = [];
    lines.push('*FIA CLEAN & CARE*');
    lines.push('*Customer Consolidation Report*');
    if (query) lines.push(`*Customer:* ${query}`);
    lines.push('');
    Array.from(container.children).forEach(card => {
        const text = card.innerText.replace(/\n+/g, '\n').trim();
        if (text) lines.push(text);
    });
    lines.push('');
    lines.push('_Thank you for your business!_');
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(lines.join('\n'))}`;
    window.open(url, '_blank');
}

// Window attachments for inline HTML onclick handlers
if (typeof window !== 'undefined') {
    window.switchCustomerSubTab = switchCustomerSubTab;
    window.saveDirectCustomer = saveDirectCustomerProfile;
    window.saveDirectCustomerProfile = saveDirectCustomerProfile;
    window.editCustomerProfile = editCustomerProfile;
    window.deleteDirectCustomer = deleteDirectCustomer;
    window.renderDirectCustomerList = renderDirectCustomerList;
    window.resetDirectCustomerForm = resetDirectCustomerForm;
    window.updateCustomerDropdown = updateCustomerDropdown;
    window.fillExistingCustomer = fillExistingCustomer;
    window.updateCosCustomerDropdown = updateCosCustomerDropdown;
    window.fillCosExistingCustomer = fillCosExistingCustomer;
    window.switchCustomerSubTab = switchCustomerSubTab;
    window.renderCustomerConsolidationList = renderCustomerConsolidationList;
    window.renderCustomerConsolidationReport = renderCustomerConsolidationReport;
    window.downloadCustomerConsolidationReportPDF = downloadCustomerConsolidationReportPDF;
    window.shareCustomerConsolidationReport = shareCustomerConsolidationReport;
    window.switchCustomerConsolidationView = switchCustomerConsolidationView;
    window.renderCustomerConsolidationView = renderCustomerConsolidationView;
    window.openCustomerConsolidationCustomer = openCustomerConsolidationCustomer;
    window.closeCustomerConsolidatedDetail = closeCustomerConsolidatedDetail;
    window.shareSelectedCustomerConsolidatedDetail = shareSelectedCustomerConsolidatedDetail;
    window.viewCustomerProfile = viewCustomerProfile;
    window.renderCustomers = renderCustomers;
}


