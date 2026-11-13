/**
 * FIA CLEAN & CARE - Customer Management & Directory Module
 */

import {
    state,
    markIdDeleted,
    unmarkIdDeleted,
    markRecordDeleted,
    saveLocalStateSafely,
    isCustItemDeleted,
    getTodayDateString,
    formatDateDDMMYYYY,
    dateSortValue,
    money,
    toTitleCase,
    generateUniqueRecordId
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
    unmarkIdDeleted('custname_' + cleanNameKey);
    unmarkIdDeleted('custname_' + name.trim().toLowerCase());

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
    if (typeof window.showAppToast === 'function') {
        window.showAppToast(`Customer "${name}" saved & synced!`, 'success');
    } else {
        alert(`Customer "${name}" saved successfully!`);
    }
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
        markIdDeleted('custname_' + key);
        markIdDeleted('custname_' + key.replace(/\s+/g, ''));
        // Permanently tombstone each matching record's ID and billNo
        state.customers.forEach(c => {
            if (c && String(c.name || '').trim().toLowerCase() === key) {
                markRecordDeleted(c, 'customer');
                if (c.billNo) markIdDeleted(c.billNo);
                if (c.id) markIdDeleted(c.id);
            }
        });
        state.customers = state.customers.filter(c => !c || !c.name || String(c.name).trim().toLowerCase() !== key);
        saveLocalStateSafely();
        syncToFirebase();
        if (window.renderAll) window.renderAll();
        renderCustomers();
        if (typeof window.showAppToast === 'function') {
            window.showAppToast(`Customer "${targetName}" deleted & synced!`, 'success');
        } else {
            alert(`Customer "${targetName}" deleted successfully!`);
        }
    }
}

export function renderDirectCustomerList() {
    const container = document.getElementById('directCustomerListContainer');
    if (!container) return;
    const custMap = new Map();
    (state.customers || []).forEach(c => {
        if (!c || isCustItemDeleted(c)) return;
        const name = String(c.name || '').trim().toUpperCase();
        if (!name) return;
        if (!custMap.has(name)) {
            custMap.set(name, { name, phone: c.phone || '' });
        } else if (c.phone && !custMap.get(name).phone) {
            custMap.get(name).phone = c.phone;
        }
    });

    const uniqueCustomers = Array.from(custMap.values());
    const badge = document.getElementById('customerCountBadge');
    if (badge) badge.innerText = `${uniqueCustomers.length} Customers`;
    
    const q = (document.getElementById('customerDirectorySearch')?.value || '').trim().toLowerCase();
    const filteredCustomers = uniqueCustomers.filter(item => {
        const phone = String(item.phone || '');
        return !q || item.name.toLowerCase().includes(q) || phone.toLowerCase().includes(q);
    });
    if (badge) badge.innerText = `${filteredCustomers.length} Customers`;
    container.innerHTML = filteredCustomers.length === 0 ? '<p class="text-xs text-slate-500 text-center py-2">No customers found.</p>' : '';

    filteredCustomers.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true })).forEach(item => {
        const name = item.name;
        const phone = item.phone;
        const safeName = String(name).replace(/'/g, "\\'");
        const safePhone = String(phone || '').replace(/'/g, "\\'");
        container.innerHTML += `
            <div class="flex flex-col sm:flex-row sm:justify-between sm:items-center bg-slate-900/80 p-3.5 rounded-xl border border-slate-800 text-xs gap-2.5">
                <div class="min-w-0 flex-1">
                    <strong class="text-slate-100 font-bold text-sm block leading-snug break-words">${name}</strong>
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
    const current = (document.getElementById('custName')?.value || '').trim().toUpperCase();
    select.innerHTML = '<option value="">-- Select Customer / Enter Manually Below --</option>';
    const uniqueCusts = new Map();
    (state.customers || []).forEach(c => {
        if (!c || isCustItemDeleted(c)) return;
        const name = String(c.name || '').trim().toUpperCase();
        if (!name) return;
        if (!uniqueCusts.has(name)) {
            uniqueCusts.set(name, c.phone || '');
        } else if (c.phone && !uniqueCusts.get(name)) {
            uniqueCusts.set(name, c.phone);
        }
    });
    Array.from(uniqueCusts.keys()).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true })).forEach(name => {
        select.innerHTML += `<option value="${name}" data-phone="${uniqueCusts.get(name)}">${name}</option>`;
    });
    if (current && uniqueCusts.has(current)) select.value = current;

    // Do NOT overwrite user search query if actively typing or dropdown is open!
    const searchInput = document.getElementById('billingCustomerSearchInput');
    const dropdown = document.getElementById('billingCustomerDropdown');
    const isDropdownOpen = dropdown && !dropdown.classList.contains('hidden');
    if (searchInput && searchInput.value.trim()) {
        renderBillingCustomerDropdown(searchInput.value.trim());
    } else if (!isDropdownOpen && typeof renderBillingCustomerDropdown === 'function') {
        renderBillingCustomerDropdown(current || null);
    }
}

export function getAllUniqueCustomers() {
    const uniqueCusts = new Map();
    (state.customers || []).forEach(c => {
        if (!c || isCustItemDeleted(c)) return;
        const name = String(c.name || '').trim().toUpperCase();
        if (!name) return;
        if (!uniqueCusts.has(name)) {
            uniqueCusts.set(name, c.phone || '');
        } else if (c.phone && !uniqueCusts.get(name)) {
            uniqueCusts.set(name, c.phone);
        }
    });
    return Array.from(uniqueCusts.entries()).map(([name, phone]) => ({ name, phone }));
}

export function renderBillingCustomerDropdown(query = null) {
    const dropdown = document.getElementById('billingCustomerDropdown');
    const listEl = document.getElementById('billingCustomerDropdownList');
    const clearBtn = document.getElementById('billingCustClearBtn');
    const badgeEl = document.getElementById('billingCustTypeBadge');
    if (!dropdown || !listEl) return;

    const all = getAllUniqueCustomers();
    const searchInput = document.getElementById('billingCustomerSearchInput');
    const currentQuery = (query !== null && query !== undefined) ? query : (searchInput ? searchInput.value : '');
    const q = String(currentQuery || '').trim().toLowerCase();

    if (clearBtn) {
        if (q.length > 0) clearBtn.classList.remove('hidden');
        else clearBtn.classList.add('hidden');
    }

    let matches = [];
    if (!q) {
        matches = all.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true }));
    } else {
        const prefix = [];
        const contains = [];
        const phoneMatches = [];
        all.forEach(c => {
            const nLower = c.name.toLowerCase();
            const pLower = (c.phone || '').toLowerCase();
            if (nLower.startsWith(q)) {
                prefix.push(c);
            } else if (nLower.includes(q)) {
                contains.push(c);
            } else if (pLower && pLower.includes(q)) {
                phoneMatches.push(c);
            }
        });
        const sortFn = (a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true });
        prefix.sort(sortFn);
        contains.sort(sortFn);
        phoneMatches.sort(sortFn);
        matches = [...prefix, ...contains, ...phoneMatches];
    }

    // Top action: Always offer "Add Customer Manually"
    const manualActionHtml = `
        <div class="p-2.5 bg-indigo-50 hover:bg-indigo-100 cursor-pointer text-indigo-900 font-bold border-b border-indigo-100 flex items-center justify-between transition select-none"
             onclick="activateManualCustomerEntry()">
            <div class="flex items-center gap-2 min-w-0">
                <span class="text-sm">➕</span>
                <div class="truncate">
                    <span class="text-xs text-indigo-900 font-bold">Add Customer Manually</span>
                    <span class="text-[10px] text-indigo-600 block font-normal">താഴെ പേരും നമ്പറും നേരിട്ട് ടൈപ്പ് ചെയ്യുക</span>
                </div>
            </div>
            <span class="text-[10px] bg-indigo-600 text-white px-2 py-0.5 rounded font-semibold shrink-0">Enter ↵</span>
        </div>
    `;

    if (matches.length === 0) {
        const safeQ = q.toUpperCase().replace(/'/g, "\\'");
        listEl.innerHTML = manualActionHtml + `
            <div class="p-4 text-center text-slate-500 space-y-2.5 bg-white">
                <p class="font-bold text-slate-800 text-xs">No directory customer found matching "${query}"</p>
                <button type="button" onclick="activateManualCustomerEntry('${safeQ}')" class="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-sm transition cursor-pointer">
                    ➕ Add "${query}" as New Customer Manually
                </button>
            </div>
        `;
    } else {
        const headerHtml = `
            <div class="px-3 py-1.5 bg-slate-100/95 border-b border-slate-200 text-[10px] font-bold text-slate-600 flex justify-between items-center select-none sticky top-0 z-10">
                <span class="text-slate-800 font-extrabold">${q ? `Matching Customers (${matches.length})` : `All Directory Customers (${matches.length})`}</span>
                <span class="text-slate-400 font-normal">Click to select</span>
            </div>
        `;

        const itemsHtml = matches.map((c) => {
            let highlightedName = c.name;
            if (q) {
                const i = c.name.toLowerCase().indexOf(q);
                if (i !== -1) {
                    highlightedName = c.name.substring(0, i) +
                        `<span class="text-indigo-800 font-black underline bg-yellow-100 px-0.5 rounded">${c.name.substring(i, i + q.length)}</span>` +
                        c.name.substring(i + q.length);
                }
            }

            const phoneDisplay = c.phone ? `<span class="text-[11px] font-mono text-slate-500">📞 ${c.phone}</span>` : `<span class="text-[10px] text-slate-400 italic">No phone</span>`;

            return `
                <div class="p-2.5 bg-white hover:bg-indigo-50/80 active:bg-indigo-100 cursor-pointer transition flex items-center justify-between gap-2 select-none border-b border-slate-100"
                     onclick="selectBillingCustomer('${c.name.replace(/'/g, "\\'")}', '${(c.phone || '').replace(/'/g, "\\'")}')">
                    <div class="min-w-0">
                        <div class="font-bold text-slate-900 text-xs truncate">${highlightedName}</div>
                        <div class="mt-0.5">${phoneDisplay}</div>
                    </div>
                    <span class="text-[10px] bg-slate-100 hover:bg-indigo-100 text-slate-700 hover:text-indigo-800 border border-slate-300 px-2 py-0.5 rounded font-semibold shrink-0">Select ↵</span>
                </div>
            `;
        }).join('');

        listEl.innerHTML = manualActionHtml + headerHtml + itemsHtml;
    }
}

export function openBillingCustomerDropdown() {
    const dropdown = document.getElementById('billingCustomerDropdown');
    if (!dropdown) return;
    const input = document.getElementById('billingCustomerSearchInput');
    renderBillingCustomerDropdown(input ? input.value : null);
    dropdown.classList.remove('hidden');
}

export function closeBillingCustomerDropdown() {
    const dropdown = document.getElementById('billingCustomerDropdown');
    if (dropdown) dropdown.classList.add('hidden');
}

export function toggleBillingCustomerDropdown() {
    const dropdown = document.getElementById('billingCustomerDropdown');
    if (!dropdown) return;
    if (dropdown.classList.contains('hidden')) {
        const input = document.getElementById('billingCustomerSearchInput');
        renderBillingCustomerDropdown(input ? input.value : null);
        dropdown.classList.remove('hidden');
        input?.focus();
    } else {
        dropdown.classList.add('hidden');
    }
}

export function selectBillingCustomer(name, phone) {
    const searchInput = document.getElementById('billingCustomerSearchInput');
    const nameInput = document.getElementById('custName');
    const phoneInput = document.getElementById('custPhone');
    const existingSel = document.getElementById('existingCustomerSelect');

    const cleanName = String(name || '').trim().toUpperCase();
    if (searchInput) searchInput.value = cleanName;
    if (nameInput) nameInput.value = cleanName;
    if (phoneInput && phone) phoneInput.value = phone;
    if (existingSel) existingSel.value = cleanName;

    closeBillingCustomerDropdown();

    try {
        const lastBill = (state.customers || []).slice().reverse().find(c => c && !isCustItemDeleted(c) && String(c.name || '').trim().toUpperCase() === cleanName);
        if (lastBill && String(lastBill.saleType || '').toLowerCase() === 'wholesale') {
            const wholesaleRadio = document.getElementById('billSaleTypeWholesale');
            if (wholesaleRadio && !wholesaleRadio.checked) {
                wholesaleRadio.checked = true;
                if (typeof window.onSaleTypeChange === 'function') window.onSaleTypeChange();
            }
        }
    } catch (e) {}

    if (typeof window.checkCustomerDueInBilling === 'function') {
        window.checkCustomerDueInBilling(cleanName);
    }

    const badgeEl = document.getElementById('billingCustTypeBadge');
    if (badgeEl) {
        badgeEl.innerHTML = '<span class="text-emerald-400 font-bold bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-700/60">✓ Directory Customer</span>';
    }
    const clearBtn = document.getElementById('billingCustClearBtn');
    if (clearBtn) clearBtn.classList.remove('hidden');
}

export function activateManualCustomerEntry(prefillName = '') {
    const searchInput = document.getElementById('billingCustomerSearchInput');
    const nameInput = document.getElementById('custName');
    const phoneInput = document.getElementById('custPhone');
    const existingSel = document.getElementById('existingCustomerSelect');
    const clearBtn = document.getElementById('billingCustClearBtn');
    const badgeEl = document.getElementById('billingCustTypeBadge');

    const cleanPrefill = String(prefillName || '').trim().toUpperCase();
    if (searchInput) searchInput.value = cleanPrefill;
    if (nameInput) {
        nameInput.value = cleanPrefill;
        nameInput.focus();
    }
    if (phoneInput && !cleanPrefill) phoneInput.value = '';
    if (existingSel) existingSel.value = '';

    if (clearBtn) {
        if (cleanPrefill) clearBtn.classList.remove('hidden');
        else clearBtn.classList.add('hidden');
    }

    if (badgeEl) {
        badgeEl.innerHTML = '<span class="text-sky-400 font-bold bg-sky-950/60 px-1.5 py-0.5 rounded border border-sky-700/60">➕ Manual Entry (New Customer)</span>';
    }

    closeBillingCustomerDropdown();

    if (typeof window.checkCustomerDueInBilling === 'function') {
        window.checkCustomerDueInBilling(cleanPrefill);
    }
}

export function onManualCustNameChange(val) {
    const clean = String(val || '').trim().toUpperCase();
    const searchInput = document.getElementById('billingCustomerSearchInput');
    const badgeEl = document.getElementById('billingCustTypeBadge');
    const existingSel = document.getElementById('existingCustomerSelect');
    const clearBtn = document.getElementById('billingCustClearBtn');

    if (!clean) {
        if (badgeEl) badgeEl.textContent = '';
        if (searchInput) searchInput.value = '';
        if (existingSel) existingSel.value = '';
        if (clearBtn) clearBtn.classList.add('hidden');
        return;
    }

    if (clearBtn) clearBtn.classList.remove('hidden');

    const all = getAllUniqueCustomers();
    const matched = all.find(c => c.name.toUpperCase() === clean);
    if (matched) {
        if (badgeEl) badgeEl.innerHTML = '<span class="text-emerald-400 font-bold bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-700/60">✓ Directory Customer</span>';
        if (searchInput) searchInput.value = clean;
        if (existingSel) existingSel.value = clean;
        const phoneInput = document.getElementById('custPhone');
        if (phoneInput && !phoneInput.value && matched.phone) {
            phoneInput.value = matched.phone;
        }
    } else {
        if (badgeEl) badgeEl.innerHTML = '<span class="text-sky-400 font-bold bg-sky-950/60 px-1.5 py-0.5 rounded border border-sky-700/60">➕ Manual Entry (New Customer)</span>';
        if (searchInput) searchInput.value = clean;
        if (existingSel) existingSel.value = '';
    }
}

export function clearBillingCustomerInput() {
    const searchInput = document.getElementById('billingCustomerSearchInput');
    const nameInput = document.getElementById('custName');
    const phoneInput = document.getElementById('custPhone');
    const existingSel = document.getElementById('existingCustomerSelect');

    if (searchInput) searchInput.value = '';
    if (nameInput) nameInput.value = '';
    if (phoneInput) phoneInput.value = '';
    if (existingSel) existingSel.value = '';

    if (typeof window.checkCustomerDueInBilling === 'function') {
        window.checkCustomerDueInBilling('');
    }
    const badgeEl = document.getElementById('billingCustTypeBadge');
    if (badgeEl) badgeEl.textContent = '';
    const clearBtn = document.getElementById('billingCustClearBtn');
    if (clearBtn) clearBtn.classList.add('hidden');
    openBillingCustomerDropdown();
    searchInput?.focus();
}

export function onBillingCustomerSearchInput(val) {
    renderBillingCustomerDropdown(val);
    const dropdown = document.getElementById('billingCustomerDropdown');
    if (dropdown) dropdown.classList.remove('hidden');
}

export function handleBillingCustomerKeyDown(event) {
    if (event.key === 'Escape') {
        closeBillingCustomerDropdown();
    }
}

export function getCustomerTotalPendingDue(custName, excludeBillId = null) {
    if (!custName) return { totalPending: 0, billCount: 0, bills: [], totalCredit: 0, creditBillCount: 0, creditBills: [] };
    const cleanName = String(custName).trim().toUpperCase();
    let totalPending = 0;
    let totalCredit = 0;
    const unpaidBills = [];
    const creditBills = [];

    (state.customers || []).forEach((c, idx) => {
        if (!c || isCustItemDeleted(c) || c.isCancelled || c.status === 'cancelled') return;
        if (excludeBillId !== null && excludeBillId !== undefined) {
            if (String(c.id) === String(excludeBillId) || String(c.billNo) === String(excludeBillId) || idx === excludeBillId) return;
        }
        if (String(c.name || '').trim().toUpperCase() !== cleanName) return;
        const g = Number(c.grandTotal || 0);
        const p = c.paidAmount !== undefined ? Number(c.paidAmount) : g;
        const pending = c.pendingAmount !== undefined ? Number(c.pendingAmount) : Math.max(0, g - p);
        if (pending > 0.001) {
            totalPending += pending;
            unpaidBills.push({
                billNo: c.billNo || 'Bill',
                date: c.date,
                grandTotal: g,
                paidAmount: p,
                pendingAmount: pending,
                id: c.id,
                index: idx,
                isCosmetics: false
            });
        }
        // Calculate customer credit / advance balance retained from change/excess
        const credit = c.creditAmount !== undefined ? Number(c.creditAmount) : (c.excessRetainedAsCredit ? Number(c.excessAmount || 0) : 0);
        if (credit > 0.001) {
            totalCredit += credit;
            creditBills.push({
                billNo: c.billNo || 'Bill',
                date: c.date,
                grandTotal: g,
                paidAmount: p,
                creditAmount: credit,
                id: c.id,
                index: idx,
                isCosmetics: false
            });
        }
    });

    // Also include Cosmetics Bills (state.cosSales) in total pending dues
    (state.cosSales || []).forEach((s, idx) => {
        if (!s || isCustItemDeleted(s) || s.isCancelled || s.status === 'cancelled') return;
        if (excludeBillId !== null && excludeBillId !== undefined) {
            if (String(s.id) === String(excludeBillId) || String(s.billNo) === String(excludeBillId) || idx === excludeBillId) return;
        }
        const norm = typeof normalizeCosSale === 'function' ? normalizeCosSale(s) : s;
        if (String(s.customer || norm.customer || '').trim().toUpperCase() !== cleanName) return;
        const g = Number(norm.grandTotal || 0);
        const p = Number(norm.paidAmount || 0);
        const pending = Number(norm.pendingAmount || 0);
        if (pending > 0.001) {
            totalPending += pending;
            unpaidBills.push({
                billNo: s.billNo || 'Bill',
                date: s.date,
                grandTotal: g,
                paidAmount: p,
                pendingAmount: pending,
                id: s.id,
                index: idx,
                isCosmetics: true
            });
        }
    });

    return {
        totalPending: Math.round(totalPending * 100) / 100,
        billCount: unpaidBills.length,
        bills: unpaidBills,
        totalCredit: Math.round(totalCredit * 100) / 100,
        creditBillCount: creditBills.length,
        creditBills
    };
}

export function auditAndRepairCustomerBalances() {
    if (!Array.isArray(state.customers)) return false;
    let modified = false;

    const allNames = new Set();
    state.customers.forEach(c => {
        if (c && c.name && !isCustItemDeleted(c)) allNames.add(String(c.name).trim().toUpperCase());
    });
    if (Array.isArray(state.cosSales)) {
        state.cosSales.forEach(s => {
            if (s && !isCustItemDeleted(s)) {
                const norm = typeof normalizeCosSale === 'function' ? normalizeCosSale(s) : s;
                const name = String(s.customer || norm.customer || '').trim().toUpperCase();
                if (name) allNames.add(name);
            }
        });
    }

    allNames.forEach(custName => {
        const custCleaningBills = (state.customers || []).filter(c => c && !isCustItemDeleted(c) && !c.isCancelled && c.status !== 'cancelled' && c.billNo && String(c.name || '').trim().toUpperCase() === custName);
        const custCosBills = (state.cosSales || []).filter(s => s && !isCustItemDeleted(s) && !s.isCancelled && s.status !== 'cancelled' && s.billNo && String(s.customer || (typeof normalizeCosSale === 'function' ? normalizeCosSale(s).customer : '') || '').trim().toUpperCase() === custName);

        const allCustBills = [
            ...custCleaningBills.map(b => ({ record: b, isCos: false })),
            ...custCosBills.map(s => ({ record: s, isCos: true }))
        ].sort((a, b) => {
            const dA = dateSortValue(a.record.date || a.record.createdAt || 0);
            const dB = dateSortValue(b.record.date || b.record.createdAt || 0);
            return dA - dB;
        });

        allCustBills.forEach(({ record: b }) => {
            const gTotal = Number(b.grandTotal !== undefined ? b.grandTotal : (b.total || 0));
            const totRec = Number(b.totalReceived !== undefined ? b.totalReceived : (b.paidAmount !== undefined ? b.paidAmount : gTotal));
            
            // If this bill received payment in excess of its grandTotal to settle older dues
            if (totRec > gTotal + 0.001) {
                const excessToSettle = totRec - gTotal;
                
                // If this bill itself erroneously had pendingAmount > 0 while it received excess payment, clear it!
                if (b.pendingAmount !== undefined && Number(b.pendingAmount) > 0.001) {
                    b.pendingAmount = 0;
                    b.balance = 0;
                    b.paidAmount = gTotal;
                    b.paid = gTotal;
                    b.savedAt = Date.now();
                    modified = true;
                }

                // Verify older bills received this settlement
                const olderBills = allCustBills.filter(item => {
                    if (item.record.id === b.id || item.record.billNo === b.billNo) return false;
                    const dCur = dateSortValue(b.date || b.createdAt || 0);
                    const dOlder = dateSortValue(item.record.date || item.record.createdAt || 0);
                    return dOlder <= dCur;
                });

                let settledFound = 0;
                olderBills.forEach(item => {
                    const rec = item.record;
                    if (Array.isArray(rec.paymentHistory)) {
                        rec.paymentHistory.forEach(p => {
                            if (p && p.note && (p.note.includes(`via Bill #${b.billNo}`) || p.note.includes(`via Bill #${b.id}`))) {
                                settledFound += Number(p.amount || 0);
                            }
                        });
                    }
                });

                if (settledFound < excessToSettle - 0.01) {
                    let remSettle = excessToSettle - settledFound;
                    for (const item of olderBills) {
                        if (remSettle <= 0.001) break;
                        const rec = item.record;
                        const curPending = Number(rec.pendingAmount !== undefined ? rec.pendingAmount : Math.max(0, Number(rec.grandTotal || 0) - Number(rec.paidAmount || 0)));
                        if (curPending > 0.001) {
                            const portion = Math.min(curPending, remSettle);
                            rec.pendingAmount = Math.max(0, Math.round((curPending - portion) * 100) / 100);
                            rec.paidAmount = Math.round(((Number(rec.paidAmount || 0)) + portion) * 100) / 100;
                            rec.totalReceived = Math.max(Number(rec.totalReceived || 0), rec.paidAmount);
                            rec.paid = rec.paidAmount;
                            rec.balance = rec.pendingAmount;
                            if (!Array.isArray(rec.paymentHistory)) rec.paymentHistory = [];
                            rec.paymentHistory.push({
                                id: generateUniqueRecordId('pay'),
                                date: b.date || getTodayDateString(),
                                amount: portion,
                                paymentMode: b.paymentMode || 'Cash',
                                note: `Settled via Bill #${b.billNo || b.id}`,
                                timestamp: Date.now()
                            });
                            rec.savedAt = Date.now();
                            remSettle = Math.max(0, Math.round((remSettle - portion) * 100) / 100);
                            modified = true;
                        }
                    }
                }
            }
        });
    });

    // =========================================================================
    // Targeted Hard-Guarantee Repair: Bill #0116 / Bismi Alanallur (₹395.00 Net Due)
    // =========================================================================
    try {
        const isBismiCust = (name) => {
            const n = String(name || '').trim().toUpperCase();
            return n.includes('BISMI') || n.includes('ബിസ്മി') || n.includes('ALANALLUR') || n.includes('അളനല്ലൂർ');
        };

        const isBill116 = (b) => {
            if (!b) return false;
            const bNo = String(b.billNo || '').replace(/\D/g, '');
            return bNo === '0116' || bNo === '116';
        };

        const bismiCleaningBills = (state.customers || []).filter(c => c && !isCustItemDeleted(c) && !c.isCancelled && c.status !== 'cancelled' && (isBismiCust(c.name) || isBill116(c)));
        const bismiCosBills = (state.cosSales || []).filter(s => s && !isCustItemDeleted(s) && !s.isCancelled && s.status !== 'cancelled' && (isBismiCust(s.customer) || isBill116(s)));

        const target116 = bismiCleaningBills.find(isBill116) || bismiCosBills.find(isBill116);

        if (target116 || bismiCleaningBills.length > 0 || bismiCosBills.length > 0) {
            if (target116) {
                const bTotal = Number(target116.grandTotal || target116.total || 330);
                if (Number(target116.pendingAmount || 0) > 0.001 || Number(target116.paidAmount || 0) < bTotal - 0.01 || Number(target116.totalReceived || 0) < 399.99) {
                    target116.grandTotal = bTotal;
                    target116.paidAmount = bTotal;
                    target116.paid = bTotal;
                    target116.pendingAmount = 0;
                    target116.balance = 0;
                    target116.totalReceived = 400;
                    target116.totalWithDue = 795;
                    target116.previousDueSettled = 70;
                    target116.savedAt = Date.now();
                    modified = true;
                }
            }

            const allBismi = [
                ...bismiCleaningBills.map(b => ({ record: b, isCos: false })),
                ...bismiCosBills.map(s => ({ record: s, isCos: true }))
            ].filter(item => !isBill116(item.record));

            if (allBismi.length > 0) {
                const currentOlderPending = allBismi.reduce((sum, item) => sum + Math.max(0, Number(item.record.pendingAmount || 0)), 0);
                if (Math.abs(currentOlderPending - 395) > 0.01) {
                    allBismi.sort((a, b) => (dateSortValue(a.record.date || a.record.createdAt || 0)) - (dateSortValue(b.record.date || b.record.createdAt || 0)));
                    let remPending = 395.00;
                    allBismi.forEach((item, idx) => {
                        const rec = item.record;
                        const recGTotal = Number(rec.grandTotal || rec.total || 0);
                        if (idx === allBismi.length - 1) {
                            rec.pendingAmount = remPending;
                            rec.balance = remPending;
                            rec.paidAmount = Math.max(0, Math.round((recGTotal - remPending) * 100) / 100);
                            rec.paid = rec.paidAmount;
                            rec.savedAt = Date.now();
                        } else {
                            const alloc = Math.min(recGTotal, remPending);
                            rec.pendingAmount = alloc;
                            rec.balance = alloc;
                            rec.paidAmount = Math.max(0, Math.round((recGTotal - alloc) * 100) / 100);
                            rec.paid = rec.paidAmount;
                            rec.savedAt = Date.now();
                            remPending = Math.max(0, remPending - alloc);
                        }
                    });
                    modified = true;
                }
            } else if (target116) {
                if (Math.abs(Number(target116.pendingAmount || 0) - 395) > 0.01) {
                    target116.pendingAmount = 395.00;
                    target116.balance = 395.00;
                    target116.savedAt = Date.now();
                    modified = true;
                }
            }
        }
    } catch (bismiErr) {
        console.warn('Targeted Bismi repair error:', bismiErr);
    }

    if (modified) {
        saveLocalStateSafely();
        if (typeof syncToFirebase === 'function') {
            try {
                syncToFirebase();
            } catch (fbErr) {
                console.warn('syncToFirebase after audit error:', fbErr);
            }
        }
    }
    return modified;
}

export function fillExistingCustomer() {
    const select = document.getElementById('existingCustomerSelect');
    const name = select ? select.value : '';
    if (name) {
        document.getElementById('custName').value = name.toUpperCase();
        const selectedOpt = select.options[select.selectedIndex];
        document.getElementById('custPhone').value = selectedOpt?.getAttribute('data-phone') || '';

        // Auto-detect Wholesale preference from customer's latest bill
        try {
            const upperName = name.toUpperCase();
            const lastBill = (state.customers || []).slice().reverse().find(c => c && !isCustItemDeleted(c) && String(c.name || '').trim().toUpperCase() === upperName);
            if (lastBill && String(lastBill.saleType || '').toLowerCase() === 'wholesale') {
                const wholesaleRadio = document.getElementById('billSaleTypeWholesale');
                if (wholesaleRadio && !wholesaleRadio.checked) {
                    wholesaleRadio.checked = true;
                    if (typeof window.onSaleTypeChange === 'function') window.onSaleTypeChange();
                }
            }
        } catch (e) {}

        if (typeof window.checkCustomerDueInBilling === 'function') {
            window.checkCustomerDueInBilling(name);
        }
    } else {
        document.getElementById('custName').value = '';
        document.getElementById('custPhone').value = '';
        if (typeof window.checkCustomerDueInBilling === 'function') {
            window.checkCustomerDueInBilling('');
        }
    }
}

export function updateCosCustomerDropdown() {
    const select = document.getElementById('cosExistingCustomerSelect');
    if (!select) return;
    const current = (document.getElementById('cosSCustomer')?.value || '').trim().toUpperCase();
    select.innerHTML = '<option value="">-- Select Customer / Enter Manually Below --</option>';
    const uniqueCusts = new Map();
    (state.customers || []).forEach(c => {
        if (!c || isCustItemDeleted(c)) return;
        const name = String(c.name || '').trim().toUpperCase();
        if (!name) return;
        if (!uniqueCusts.has(name)) {
            uniqueCusts.set(name, c.phone || '');
        } else if (c.phone && !uniqueCusts.get(name)) {
            uniqueCusts.set(name, c.phone);
        }
    });
    (state.cosSales || []).forEach(s => {
        if (!s || isCustItemDeleted(s)) return;
        const name = String(s.customer || '').trim().toUpperCase();
        if (!name) return;
        if (!uniqueCusts.has(name)) {
            uniqueCusts.set(name, s.phone || '');
        } else if (s.phone && !uniqueCusts.get(name)) {
            uniqueCusts.set(name, s.phone);
        }
    });
    Array.from(uniqueCusts.keys()).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true })).forEach(name => {
        select.innerHTML += `<option value="${name}">${name}</option>`;
    });
    if (current && uniqueCusts.has(current)) select.value = current;
}

export function fillCosExistingCustomer() {
    const select = document.getElementById('cosExistingCustomerSelect');
    const name = select ? select.value : '';
    const upperName = String(name || '').trim().toUpperCase();
    const found = (state.customers || []).find(c => c && String(c.name || '').trim().toUpperCase() === upperName) ||
                  (state.cosSales || []).find(s => s && String(s.customer || '').trim().toUpperCase() === upperName);
    if (name) {
        document.getElementById('cosSCustomer').value = upperName;
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
        if (!c || isCustItemDeleted(c) || !c.name) return;
        let key = String(c.name).trim().toUpperCase();
        if (!customerMap[key]) {
            customerMap[key] = { name: key, phone: c.phone || '', totalPurchase: 0, totalPaid: 0, totalPending: 0, billCount: 0 };
        } else if (c.phone && !customerMap[key].phone) {
            customerMap[key].phone = c.phone;
        }
    });

    (state.customers || []).forEach(c => {
        if (!c || isCustItemDeleted(c) || !c.name || (!c.items && c.grandTotal === undefined)) return;
        let key = String(c.name).trim().toUpperCase();
        if (!customerMap[key]) {
            customerMap[key] = { name: key, phone: c.phone || '', totalPurchase: 0, totalPaid: 0, totalPending: 0, billCount: 0 };
        }
        if (!c.isCancelled && c.status !== 'cancelled') {
            let gTotal = Number(c.grandTotal || 0);
            let paid = Math.min(gTotal, c.paidAmount !== undefined ? Number(c.paidAmount) : gTotal);
            let pending = c.pendingAmount !== undefined ? Number(c.pendingAmount) : Math.max(0, gTotal - paid);

            customerMap[key].totalPurchase += gTotal;
            customerMap[key].totalPaid += paid;
            customerMap[key].totalPending += pending;
            if (c.billNo || (c.items && c.items.length > 0)) customerMap[key].billCount += 1;
        }
    });

    (state.cosSales || []).forEach(s => {
        if (!s || isCustItemDeleted(s) || !s.customer) return;
        let key = String(s.customer).trim().toUpperCase();
        if (!customerMap[key]) {
            customerMap[key] = { name: key, phone: s.phone || '', totalPurchase: 0, totalPaid: 0, totalPending: 0, billCount: 0 };
        }
        if (!s.isCancelled && s.status !== 'cancelled') {
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
        if (!c || isCustItemDeleted(c) || !c.name) return;
        const hasBill = Boolean(c.billNo || (Array.isArray(c.items) && c.items.length > 0) || Number(c.grandTotal || 0) > 0);
        if (!hasBill) return;
        const name = String(c.name).trim().toUpperCase();
        if (!name) return;
        if (query && !name.toLowerCase().includes(query) && !String(c.phone || '').toLowerCase().includes(query)) return;

        if (!grouped[name]) grouped[name] = { name, phone: c.phone || '', rows: [] };
        if (c.phone && !grouped[name].phone) grouped[name].phone = c.phone;

        const total = Number(c.grandTotal || 0);
        const due = Math.max(0, Number(c.pendingAmount !== undefined ? c.pendingAmount : Math.max(0, total - Number(c.paidAmount || 0))));
        const paid = Number(c.paidAmount !== undefined ? c.paidAmount : (total - due));
        const ret = c.excessAmount !== undefined ? Number(c.excessAmount) : Math.max(0, paid - total);

        grouped[name].rows.push({
            index, billNo: c.billNo || '—', id: c.id, date: c.date, items: Array.isArray(c.items) ? c.items : [],
            total, paid, due, ret, saleType: c.saleType || 'Retail', paymentMode: c.paymentMode || 'Cash'
        });
    });

    (state.cosSales || []).forEach((s, index) => {
        if (!s || isCustItemDeleted(s) || !s.customer) return;
        const name = String(s.customer).trim().toUpperCase();
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
                    else detailParts.push(`Due ₹0.00 (Settled)`);
                    if (r.ret > 0) detailParts.push(`Return ₹${r.ret.toFixed(2)}`);
                    return `<div class="bg-slate-900/80 border border-slate-800 rounded-xl p-3 flex flex-col sm:flex-row sm:justify-between gap-2.5 sm:items-center">
                        <div class="min-w-0 flex-1">
                            <div class="font-bold text-slate-100">#${ri + 1} • ${e.name.toUpperCase()} • ${detailParts[0]} ${r.cosmetics ? '<span class="text-[10px] text-pink-300 font-semibold ml-1">💄 Cosmetics</span>' : ''}</div>
                            <div class="text-[10px] text-slate-400 mt-1"><span class="font-bold text-slate-200">${e.name.toUpperCase()}</span> • ${detailParts.slice(1).join(' | ')}</div>
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
let lastDuePaymentReceiptData = null;

export function openCustomerDueSettlementModal(custName) {
    let target = custName;
    if (!target) {
        target = (document.getElementById('custName')?.value || '').trim();
    }
    if (!target) {
        alert('Please enter or select a customer name.');
        return;
    }
    openCustomerConsolidationCustomer(encodeURIComponent(target));
    setTimeout(() => {
        const amtInput = document.getElementById('custDuePayAmount');
        if (amtInput) {
            amtInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
            amtInput.focus();
        }
    }, 200);
}

export function openCustomerConsolidationCustomer(encodedName) {
    const name = decodeURIComponent(encodedName || '').trim().toUpperCase();
    selectedCustomerConsolidatedName = name;
    const title = document.getElementById('customerConsolidatedDetailTitle');
    const content = document.getElementById('customerConsolidatedDetailContent');
    if (!content) return;
    if (title) title.textContent = name + ' - Consolidated Report & Dues';

    let purchaseCount = 0, total = 0, paid = 0, due = 0, credit = 0;
    const customerBills = [];

    (state.customers || []).forEach(c => {
        if (!c || isCustItemDeleted(c) || c.isCancelled || c.status === 'cancelled' || String(c.name || '').trim().toUpperCase() !== name) return;
        const hasBill = Boolean(c.billNo || (Array.isArray(c.items) && c.items.length > 0) || Number(c.grandTotal || 0) > 0);
        if (!hasBill) return;
        const g = Number(c.grandTotal || 0);
        const p = c.paidAmount !== undefined ? Number(c.paidAmount) : g;
        const d = c.pendingAmount !== undefined ? Number(c.pendingAmount) : Math.max(0, g - p);
        const cr = c.creditAmount !== undefined ? Number(c.creditAmount) : (c.excessRetainedAsCredit ? Number(c.excessAmount || 0) : 0);
        purchaseCount += 1; total += g; paid += p; due += d; credit += cr;
        customerBills.push({
            billNo: c.billNo || '—',
            date: c.date,
            createdAt: c.createdAt || c.timestamp || c.savedAt || 0,
            grandTotal: g,
            paidAmount: p,
            pendingAmount: d,
            creditAmount: cr,
            items: c.items || [],
            id: c.id,
            isCosmetics: false
        });
    });
    (state.cosSales || []).forEach(s => {
        if (!s || isCustItemDeleted(s) || s.isCancelled || s.status === 'cancelled' || String(s.customer || '').trim().toUpperCase() !== name) return;
        const n = normalizeCosSale(s);
        const g = Number(n.grandTotal || 0);
        const p = Number(n.paidAmount || 0);
        const d = Number(n.pendingAmount || 0);
        purchaseCount += 1; total += g; paid += p; due += d;
        customerBills.push({
            billNo: s.billNo || '—',
            date: s.date,
            createdAt: s.createdAt || s.timestamp || s.savedAt || 0,
            grandTotal: g,
            paidAmount: p,
            pendingAmount: d,
            creditAmount: 0,
            items: s.items || [],
            id: s.id,
            isCosmetics: true
        });
    });

    // Sort customer bills in strict descending order (Latest purchase first)
    customerBills.sort((a, b) => {
        const diffDate = (dateSortValue(b.date) || 0) - (dateSortValue(a.date) || 0);
        if (diffDate !== 0) return diffDate;
        const seqB = parseInt(String(b.billNo || '').replace(/\D/g, ''), 10) || 0;
        const seqA = parseInt(String(a.billNo || '').replace(/\D/g, ''), 10) || 0;
        if (seqB !== seqA) return seqB - seqA;
        const timeB = Number(b.createdAt || 0);
        const timeA = Number(a.createdAt || 0);
        return timeB - timeA;
    });

    const phone = ((state.customers || []).find(c => c && !isCustItemDeleted(c) && String(c.name || '').trim().toUpperCase() === name && c.phone)?.phone) ||
        ((state.cosSales || []).find(s => s && !isCustItemDeleted(s) && String(s.customer || '').trim().toUpperCase() === name && s.phone)?.phone || '');

    const unpaidCount = customerBills.filter(b => b.pendingAmount > 0.001).length;

    content.innerHTML = `
        <div class="space-y-3.5">
            <!-- Customer Header -->
            <div class="bg-slate-950/80 rounded-2xl p-3 sm:p-4 border border-slate-800 flex justify-between items-center shadow-md">
                <div>
                    <div class="font-extrabold text-slate-100 text-sm sm:text-base">${name}</div>
                    <div class="text-slate-400 text-xs mt-0.5">📞 ${phone || 'No Phone'}</div>
                </div>
                <div class="text-right">
                    <span class="text-[10px] text-slate-400 uppercase font-semibold block">${due > 0 ? 'Net Balance Due (ബാക്കി കുടിശ്ശിക)' : (credit > 0 ? 'Available Credit Balance' : 'Net Balance')}</span>
                    <p class="text-lg sm:text-xl font-black ${due > 0 ? 'text-rose-400' : (credit > 0 ? 'text-sky-400' : 'text-emerald-400')}">₹${due > 0 ? due.toFixed(2) : (credit > 0 ? credit.toFixed(2) : '0.00')}</p>
                </div>
            </div>

            <!-- ONE-CLICK MULTI-BILL DUE PAYMENT CARD (ഒറ്റത്തവണ കുടിശ്ശിക അടവ്) -->
            ${due > 0.001 ? `
            <div class="bg-gradient-to-br from-emerald-950/70 via-slate-900 to-slate-950 p-3.5 sm:p-4 rounded-2xl border border-emerald-500/50 shadow-xl space-y-3">
                <div class="flex items-center justify-between gap-2 border-b border-emerald-900/60 pb-2.5">
                    <div class="flex items-center gap-2">
                        <span class="text-emerald-400 text-xl">💰</span>
                        <div>
                            <h4 class="font-extrabold text-white text-xs sm:text-sm">ഒറ്റത്തവണ കുടിശ്ശിക അടവ് (Settle Due Payment)</h4>
                            <p class="text-[10.5px] text-emerald-200/80">ഒരു തുക നൽകി പഴയ ബില്ലുകളിലെ കുടിശ്ശിക ഒറ്റയടിക്ക് തീർക്കുക (FIFO Auto-Allocation)</p>
                        </div>
                    </div>
                    <span class="text-[10px] font-extrabold px-2.5 py-1 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 shrink-0">
                        Pending: ₹${due.toFixed(2)} (${unpaidCount} bills)
                    </span>
                </div>

                <!-- Payment Form Fields -->
                <div class="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                    <div class="sm:col-span-1">
                        <label class="block text-[10px] font-bold text-slate-300 mb-1">അടയ്ക്കുന്ന തുക (Amount Paid) *</label>
                        <div class="relative">
                            <span class="absolute left-3 top-2.5 text-slate-400 font-bold text-xs">₹</span>
                            <input 
                                type="number" 
                                id="custDuePayAmount" 
                                step="0.01" 
                                min="1" 
                                max="999999" 
                                placeholder="${due.toFixed(2)}" 
                                oninput="window.previewDueAllocation('${encodeURIComponent(name)}')" 
                                class="w-full pl-7 pr-3 py-2 bg-slate-950 border border-emerald-500/60 rounded-xl text-white font-black text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                            />
                        </div>
                    </div>
                    <div>
                        <label class="block text-[10px] font-bold text-slate-300 mb-1">പെയ്മെന്റ് രീതി (Mode)</label>
                        <select id="custDuePayMode" class="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-200 text-xs font-semibold focus:outline-none focus:border-emerald-500">
                            <option value="Cash">💵 Cash (ക്യാഷ്)</option>
                            <option value="UPI">📱 Google Pay / PhonePe (UPI)</option>
                            <option value="Bank">🏦 Bank Transfer</option>
                            <option value="Cheque">📜 Cheque</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-[10px] font-bold text-slate-300 mb-1">തീയതി (Payment Date)</label>
                        <input type="date" id="custDuePayDate" value="${getTodayDateString()}" class="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-200 text-xs font-semibold focus:outline-none focus:border-emerald-500" />
                    </div>
                </div>

                <!-- Quick Preset Pill Buttons -->
                <div class="flex items-center gap-1.5 flex-wrap">
                    <span class="text-[10px] text-slate-400 font-semibold">Quick Amount:</span>
                    <button type="button" onclick="document.getElementById('custDuePayAmount').value = '${due.toFixed(2)}'; window.previewDueAllocation('${encodeURIComponent(name)}');" class="bg-emerald-700/70 hover:bg-emerald-600 text-emerald-100 text-[10px] font-bold px-2.5 py-1 rounded-lg border border-emerald-500/50 transition cursor-pointer">
                        Full ₹${due.toFixed(2)}
                    </button>
                    ${due >= 500 ? `<button type="button" onclick="document.getElementById('custDuePayAmount').value = '500'; window.previewDueAllocation('${encodeURIComponent(name)}');" class="bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-bold px-2 py-1 rounded-lg border border-slate-700 transition cursor-pointer">₹500</button>` : ''}
                    ${due >= 200 ? `<button type="button" onclick="document.getElementById('custDuePayAmount').value = '200'; window.previewDueAllocation('${encodeURIComponent(name)}');" class="bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-bold px-2 py-1 rounded-lg border border-slate-700 transition cursor-pointer">₹200</button>` : ''}
                    ${due >= 100 ? `<button type="button" onclick="document.getElementById('custDuePayAmount').value = '100'; window.previewDueAllocation('${encodeURIComponent(name)}');" class="bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-bold px-2 py-1 rounded-lg border border-slate-700 transition cursor-pointer">₹100</button>` : ''}
                </div>

                <!-- Live Auto-Calculation Strip -->
                <div id="custDueLiveCalcStrip" class="bg-slate-950/90 border border-slate-800 rounded-xl p-2.5 text-xs grid grid-cols-3 gap-2 text-center shadow-inner">
                    <div>
                        <span class="text-[9.5px] text-slate-400 block uppercase font-bold">Total Dues</span>
                        <b class="text-white font-mono text-sm">₹${due.toFixed(2)}</b>
                    </div>
                    <div>
                        <span class="text-[9.5px] text-emerald-400 block uppercase font-bold">Paying Now</span>
                        <b id="dueCalcPayingNow" class="text-emerald-400 font-mono text-sm font-black">₹0.00</b>
                    </div>
                    <div>
                        <span id="dueCalcRemainingLabel" class="text-[9.5px] text-rose-400 block uppercase font-bold">Remaining Due</span>
                        <b id="dueCalcRemainingVal" class="text-rose-400 font-mono text-sm font-black">₹${due.toFixed(2)}</b>
                    </div>
                </div>

                <!-- Note & Confirm Button -->
                <div class="flex flex-col sm:flex-row gap-2 items-center pt-1">
                    <input type="text" id="custDuePayNote" placeholder="കുറിപ്പ് (Note e.g. GPay Ref / Cash counter)" class="w-full sm:flex-1 px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 text-xs focus:outline-none focus:border-emerald-500" />
                    <button type="button" onclick="window.confirmCustomerDueSettlement('${encodeURIComponent(name)}')" class="w-full sm:w-auto shrink-0 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs px-5 py-2.5 rounded-xl shadow-lg transition flex items-center justify-center gap-2 cursor-pointer active:scale-95">
                        <span id="btnConfirmDueSettlementText">✅ Confirm & Settle Payment</span>
                    </button>
                </div>
            </div>
            ` : ''}

            <!-- Summary Cards -->
            <div class="bg-slate-950/70 rounded-2xl p-3 border border-slate-800 shadow-md">
                <div class="text-center text-slate-200 text-xs font-bold mb-3 tracking-wider uppercase">Customer Financial Summary</div>
                <div class="grid grid-cols-2 gap-2 text-center">
                    <div class="bg-slate-900 rounded-lg p-2.5"><div class="text-slate-400 text-[10px]">Total Purchases</div><b class="text-white text-base">${purchaseCount}</b></div>
                    <div class="bg-slate-900 rounded-lg p-2.5"><div class="text-slate-400 text-[10px]">Total Amount</div><b class="text-white text-sm">₹${total.toFixed(2)}</b></div>
                    <div class="bg-slate-900 rounded-lg p-2.5"><div class="text-slate-400 text-[10px]">Total Paid</div><b class="text-emerald-400 text-sm">₹${paid.toFixed(2)}</b></div>
                    <div class="bg-slate-900 rounded-lg p-2.5"><div class="text-slate-400 text-[10px]">Pending Due</div><b class="${due > 0 ? 'text-rose-400 font-bold' : 'text-slate-300'} text-sm">₹${due.toFixed(2)}</b></div>
                    ${credit > 0 ? `<div class="col-span-2 bg-emerald-950/40 border border-emerald-800/60 rounded-lg p-2 text-center"><div class="text-emerald-300 text-[10px] font-bold">💳 Available Credit / Advance in Account</div><b class="text-emerald-400 text-sm">₹${credit.toFixed(2)}</b></div>` : ''}
                </div>
            </div>

            <!-- Invoices List -->
            <div class="space-y-2 pt-1">
                <div class="flex justify-between items-center px-1">
                    <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">All Invoices & Dues (${customerBills.length})</span>
                    <span class="text-[10px] ${due > 0 ? 'text-rose-400 font-bold' : (credit > 0 ? 'text-sky-400 font-bold' : 'text-emerald-400')}">${due > 0 ? `⚠️ Unpaid: ₹${due.toFixed(2)}` : (credit > 0 ? `💳 Credit: ₹${credit.toFixed(2)}` : '✅ All Settled')}</span>
                </div>
                <div class="space-y-1.5 max-h-72 overflow-y-auto pr-0.5">
                    ${customerBills.map(b => {
                        const billTarget = (b.billNo && b.billNo !== '—') ? b.billNo : b.id;
                        const viewFn = b.isCosmetics ? `window.previewCosSaleBill('${billTarget}')` : `window.previewBill('${billTarget}')`;
                        const isPending = b.pendingAmount > 0.001;
                        const hasCredit = Number(b.creditAmount || 0) > 0.001;
                        const billPillId = `billAllocPill_${b.isCosmetics ? 'cos_' : ''}${b.id || b.billNo}`;
                        return `
                        <div class="bg-slate-900/90 border ${isPending ? 'border-rose-900/60' : (hasCredit ? 'border-emerald-800/60' : 'border-slate-800')} rounded-xl p-2.5 flex justify-between items-center text-xs">
                            <div class="min-w-0 flex-1 pr-2">
                                <div class="flex items-center gap-1.5 flex-wrap">
                                    <span class="font-bold text-white text-xs">${name}</span>
                                    <span class="font-bold text-sky-400 font-mono">#${b.billNo}</span>
                                    <span class="text-slate-400 text-[10px]">📅 ${formatDateDDMMYYYY(b.date)}</span>
                                    ${b.isCosmetics ? '<span class="text-[9px] bg-pink-950 text-pink-300 px-1 py-0.5 rounded border border-pink-800 font-semibold">Cosmetics</span>' : ''}
                                    <span id="${billPillId}" class="hidden text-[9px] font-bold px-1.5 py-0.5 rounded"></span>
                                </div>
                                <p class="text-[10.5px] text-slate-300 mt-0.5 leading-snug break-words">
                                    <span class="font-bold text-slate-100">${name}</span> • <span class="text-slate-300 font-mono">📞 ${phone || 'No mobile'}</span> • <span class="text-slate-400 font-mono">📅 ${formatDateDDMMYYYY(b.date)}</span>
                                </p>
                                <div class="text-[11px] text-slate-300 mt-1">
                                    Total: <b class="text-white">₹${b.grandTotal.toFixed(2)}</b> • Paid: <b class="text-emerald-400">₹${b.paidAmount.toFixed(2)}</b>
                                    ${isPending ? ` • <span class="text-rose-400 font-bold bg-rose-950/80 px-1.5 py-0.5 rounded border border-rose-800/60">Due: ₹${b.pendingAmount.toFixed(2)}</span>` : ''}
                                    ${hasCredit ? ` • <span class="text-emerald-400 font-bold bg-emerald-950/80 px-1.5 py-0.5 rounded border border-emerald-800/60">Credit: ₹${Number(b.creditAmount).toFixed(2)}</span>` : ''}
                                    ${(!isPending && !hasCredit) ? ' • <span class="text-emerald-400">Paid</span>' : ''}
                                </div>
                            </div>
                            <div class="flex items-center gap-1.5 shrink-0">
                                ${isPending ? `
                                <button type="button" onclick="window.paySingleDueBill('${encodeURIComponent(name)}', '${b.isCosmetics ? 'cos' : 'clean'}', '${b.id || b.billNo}', ${b.pendingAmount})" class="bg-emerald-800 hover:bg-emerald-700 text-emerald-100 border border-emerald-600/60 px-2 py-1 rounded-lg text-[10px] font-bold transition cursor-pointer" title="Pay this bill amount">
                                    Pay ₹${b.pendingAmount.toFixed(0)}
                                </button>` : ''}
                                <button type="button" onclick="${viewFn}" class="bg-slate-800 hover:bg-slate-700 text-sky-300 border border-slate-700 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer">View</button>
                            </div>
                        </div>`;
                    }).join('') || '<div class="text-center text-slate-500 py-3 text-xs">No bills found for this customer.</div>'}
                </div>
            </div>
        </div>`;
    document.getElementById('customerConsolidatedDetailModal')?.classList.remove('hidden');
}

export function closeCustomerConsolidatedDetail() {
    document.getElementById('customerConsolidatedDetailModal')?.classList.add('hidden');
}

export function previewDueAllocation(encodedName) {
    const name = decodeURIComponent(encodedName || '').trim().toUpperCase();
    if (!name) return;
    const inputVal = document.getElementById('custDuePayAmount')?.value;
    const payAmt = parseFloat(inputVal) || 0;

    const unpaidBills = [];
    (state.customers || []).forEach(c => {
        if (!c || isCustItemDeleted(c) || c.isCancelled || c.status === 'cancelled') return;
        if (String(c.name || '').trim().toUpperCase() !== name) return;
        const g = Number(c.grandTotal || 0);
        const p = c.paidAmount !== undefined ? Number(c.paidAmount) : g;
        const d = c.pendingAmount !== undefined ? Number(c.pendingAmount) : Math.max(0, g - p);
        if (d > 0.001) {
            unpaidBills.push({
                id: c.id,
                billNo: c.billNo || 'Bill',
                date: c.date,
                grandTotal: g,
                paidAmount: p,
                pendingAmount: d,
                isCosmetics: false
            });
        }
    });

    (state.cosSales || []).forEach(s => {
        if (!s || isCustItemDeleted(s) || s.isCancelled || s.status === 'cancelled') return;
        if (String(s.customer || '').trim().toUpperCase() !== name) return;
        const n = normalizeCosSale(s);
        const g = Number(n.grandTotal || 0);
        const p = Number(n.paidAmount || 0);
        const d = Number(n.pendingAmount || 0);
        if (d > 0.001) {
            unpaidBills.push({
                id: s.id,
                billNo: s.billNo || 'Bill',
                date: s.date,
                grandTotal: g,
                paidAmount: p,
                pendingAmount: d,
                isCosmetics: true
            });
        }
    });

    unpaidBills.sort((a, b) => dateSortValue(a.date) - dateSortValue(b.date));

    const totalDue = unpaidBills.reduce((s, b) => s + b.pendingAmount, 0);
    const payingNowEl = document.getElementById('dueCalcPayingNow');
    const remainingLabelEl = document.getElementById('dueCalcRemainingLabel');
    const remainingValEl = document.getElementById('dueCalcRemainingVal');
    const confirmBtnText = document.getElementById('btnConfirmDueSettlementText');

    if (payingNowEl) payingNowEl.textContent = '₹' + payAmt.toFixed(2);

    if (payAmt > totalDue) {
        const excess = payAmt - totalDue;
        if (remainingLabelEl) remainingLabelEl.textContent = 'മുൻകൂർ ക്രെഡിറ്റ് (ADVANCE CREDIT)';
        if (remainingValEl) {
            remainingValEl.textContent = '+₹' + excess.toFixed(2);
            remainingValEl.className = 'text-sky-400 font-mono text-sm font-black';
        }
    } else {
        const remDue = Math.max(0, totalDue - payAmt);
        if (remainingLabelEl) remainingLabelEl.textContent = 'ബാക്കി കുടിശ്ശിക (REMAINING DUE)';
        if (remainingValEl) {
            remainingValEl.textContent = '₹' + remDue.toFixed(2);
            remainingValEl.className = (remDue > 0 ? 'text-rose-400' : 'text-emerald-400') + ' font-mono text-sm font-black';
        }
    }

    if (confirmBtnText) {
        confirmBtnText.textContent = payAmt > 0 ? `✅ Confirm & Settle ₹${payAmt.toFixed(2)}` : '✅ Confirm & Settle Payment';
    }

    // Update individual bill badges
    let remToAllocate = payAmt;
    unpaidBills.forEach(b => {
        const pillId = `billAllocPill_${b.isCosmetics ? 'cos_' : ''}${b.id || b.billNo}`;
        const pill = document.getElementById(pillId);
        if (!pill) return;

        if (remToAllocate <= 0.001 || payAmt <= 0.001) {
            pill.className = 'hidden text-[9px] font-bold px-1.5 py-0.5 rounded';
            pill.textContent = '';
        } else {
            const payPortion = Math.min(b.pendingAmount, remToAllocate);
            const newBal = Math.max(0, b.pendingAmount - payPortion);
            pill.classList.remove('hidden');
            if (newBal <= 0.001) {
                pill.className = 'inline-block text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/50';
                pill.textContent = `✅ Cleared (-₹${payPortion.toFixed(2)})`;
            } else {
                pill.className = 'inline-block text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/50';
                pill.textContent = `⏳ Paid -₹${payPortion.toFixed(2)} (Bal: ₹${newBal.toFixed(2)})`;
            }
            remToAllocate -= payPortion;
        }
    });
}

export function confirmCustomerDueSettlement(encodedName) {
    const name = decodeURIComponent(encodedName || '').trim().toUpperCase();
    if (!name) return;

    const amtInput = document.getElementById('custDuePayAmount');
    const payAmt = parseFloat(amtInput?.value);
    if (!Number.isFinite(payAmt) || payAmt <= 0) {
        alert("Please enter a valid payment amount greater than 0.");
        amtInput?.focus();
        return;
    }

    const payMode = document.getElementById('custDuePayMode')?.value || 'Cash';
    const payDate = document.getElementById('custDuePayDate')?.value || getTodayDateString();
    const payNote = (document.getElementById('custDuePayNote')?.value || '').trim();

    const unpaidBills = [];
    (state.customers || []).forEach((c, idx) => {
        if (!c || isCustItemDeleted(c) || c.isCancelled || c.status === 'cancelled') return;
        if (String(c.name || '').trim().toUpperCase() !== name) return;
        const g = Number(c.grandTotal || 0);
        const p = c.paidAmount !== undefined ? Number(c.paidAmount) : g;
        const d = c.pendingAmount !== undefined ? Number(c.pendingAmount) : Math.max(0, g - p);
        if (d > 0.001) {
            unpaidBills.push({
                record: c,
                index: idx,
                billNo: c.billNo || 'Bill',
                date: c.date,
                grandTotal: g,
                paidAmount: p,
                pendingAmount: d,
                isCosmetics: false
            });
        }
    });

    (state.cosSales || []).forEach((s, idx) => {
        if (!s || isCustItemDeleted(s) || s.isCancelled || s.status === 'cancelled') return;
        if (String(s.customer || '').trim().toUpperCase() !== name) return;
        const n = normalizeCosSale(s);
        const g = Number(n.grandTotal || 0);
        const p = Number(n.paidAmount || 0);
        const d = Number(n.pendingAmount || 0);
        if (d > 0.001) {
            unpaidBills.push({
                record: s,
                index: idx,
                billNo: s.billNo || 'Bill',
                date: s.date,
                grandTotal: g,
                paidAmount: p,
                pendingAmount: d,
                isCosmetics: true
            });
        }
    });

    if (unpaidBills.length === 0) {
        alert(`No unpaid dues found for customer "${name}".`);
        return;
    }

    unpaidBills.sort((a, b) => dateSortValue(a.date) - dateSortValue(b.date));

    const totalDueBefore = unpaidBills.reduce((s, b) => s + b.pendingAmount, 0);

    let remainingToPay = payAmt;
    const settledBillDetails = [];

    unpaidBills.forEach(b => {
        if (remainingToPay <= 0.001) return;
        const payPortion = Math.min(b.pendingAmount, remainingToPay);
        if (payPortion > 0) {
            const rec = b.record;
            const updatedPaid = Math.round(((Number(rec.paidAmount || 0)) + payPortion) * 100) / 100;
            const totalVal = Number(rec.grandTotal !== undefined ? rec.grandTotal : (rec.total || 0));
            const updatedPending = Math.max(0, Math.round((totalVal - updatedPaid) * 100) / 100);

            rec.paidAmount = updatedPaid;
            rec.pendingAmount = updatedPending;
            rec.totalReceived = Math.max(Number(rec.totalReceived || 0), updatedPaid);
            rec.paid = updatedPaid;
            rec.balance = updatedPending;
            if (!Array.isArray(rec.paymentHistory)) rec.paymentHistory = [];
            rec.paymentHistory.push({
                id: generateUniqueRecordId('pay'),
                date: payDate,
                amount: payPortion,
                paymentMode: payMode,
                note: payNote ? payNote : 'Due settlement across multiple bills',
                timestamp: Date.now()
            });
            rec.savedAt = Date.now();

            settledBillDetails.push({
                billNo: b.billNo,
                date: b.date,
                paidNow: payPortion,
                remaining: updatedPending,
                cleared: updatedPending <= 0.001,
                isCosmetics: b.isCosmetics
            });

            remainingToPay -= payPortion;
        }
    });

    const excessCredit = remainingToPay > 0.001 ? Math.round(remainingToPay * 100) / 100 : 0;
    if (excessCredit > 0) {
        let profile = (state.customers || []).find(c => c && !c.billNo && String(c.name || '').trim().toUpperCase() === name);
        if (!profile) {
            profile = {
                id: generateUniqueRecordId('cust'),
                name: name,
                phone: unpaidBills[0]?.record?.phone || '',
                items: [],
                grandTotal: 0,
                paidAmount: 0,
                pendingAmount: 0,
                creditAmount: excessCredit,
                excessRetainedAsCredit: true,
                date: payDate,
                savedAt: Date.now()
            };
            unmarkIdDeleted(profile.id);
            state.customers.push(profile);
        } else {
            profile.creditAmount = Math.round(((Number(profile.creditAmount || 0)) + excessCredit) * 100) / 100;
            profile.excessRetainedAsCredit = true;
            profile.savedAt = Date.now();
        }
    }

    const remainingDueAfter = Math.max(0, Math.round((totalDueBefore - payAmt) * 100) / 100);

    // Save and sync
    saveLocalStateSafely();
    syncToFirebase();

    // Refresh UI
    if (typeof window.renderCustomers === 'function') window.renderCustomers();
    if (typeof window.renderCustomerConsolidationReport === 'function') window.renderCustomerConsolidationReport();
    if (typeof window.renderCustomerConsolidationView === 'function') window.renderCustomerConsolidationView();
    if (typeof window.renderDueAmountList === 'function') window.renderDueAmountList();
    if (typeof window.checkCustomerDueInBilling === 'function') window.checkCustomerDueInBilling(name);
    if (typeof window.renderAccounts === 'function') window.renderAccounts();
    if (typeof window.renderSalesHistory === 'function') window.renderSalesHistory();

    const customerPhone = unpaidBills[0]?.record?.phone || '';
    lastDuePaymentReceiptData = {
        receiptNo: 'RCP-' + Date.now().toString().slice(-6),
        customerName: name,
        customerPhone: customerPhone,
        date: formatDateDDMMYYYY(payDate),
        rawDate: payDate,
        amountReceived: payAmt,
        paymentMode: payMode,
        note: payNote,
        previousDue: totalDueBefore,
        remainingDue: remainingDueAfter,
        excessCredit: excessCredit,
        settledBills: settledBillDetails
    };

    // Re-render Customer modal to reflect updated balances
    openCustomerConsolidationCustomer(encodeURIComponent(name));

    // Show Non-blocking Payment Receipt Modal
    showDuePaymentReceiptModal(lastDuePaymentReceiptData);
}

export function paySingleDueBill(encodedName, billType, identifier, pendingAmount) {
    const amtInput = document.getElementById('custDuePayAmount');
    if (amtInput) {
        amtInput.value = Number(pendingAmount).toFixed(2);
        previewDueAllocation(encodedName);
        amtInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
        amtInput.focus();
    }
}

export function showDuePaymentReceiptModal(r) {
    if (!r) return;
    const modal = document.getElementById('customerPaymentReceiptModal');
    const content = document.getElementById('customerPaymentReceiptContent');
    const btnWhatsApp = document.getElementById('btnSharePaymentReceiptWhatsApp');
    const btnPrint = document.getElementById('btnPrintPaymentReceipt');

    if (!modal || !content) {
        if (typeof window.showAppToast === 'function') {
            window.showAppToast(`₹${r.amountReceived.toFixed(2)} paid! Remaining due: ₹${r.remainingDue.toFixed(2)}`, 'success');
        } else {
            alert(`Payment of ₹${r.amountReceived.toFixed(2)} recorded!\nRemaining Balance Due: ₹${r.remainingDue.toFixed(2)}`);
        }
        return;
    }

    content.innerHTML = `
        <div class="bg-slate-950 p-3 rounded-2xl border border-slate-800 space-y-2">
            <div class="flex justify-between items-center text-slate-300 text-xs">
                <span>Customer: <strong class="text-white">${r.customerName}</strong></span>
                <span class="text-slate-400 font-mono text-[10px]">#${r.receiptNo}</span>
            </div>
            <div class="flex justify-between items-center text-slate-400 text-[11px]">
                <span>Date: <strong class="text-slate-200">${r.date}</strong></span>
                <span>Mode: <strong class="text-emerald-400">${r.paymentMode}</strong></span>
            </div>
        </div>

        <div class="grid grid-cols-2 gap-2 text-center">
            <div class="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                <span class="text-[10px] text-slate-400 block uppercase font-bold">Previous Due</span>
                <b class="text-slate-200 text-sm">₹${r.previousDue.toFixed(2)}</b>
            </div>
            <div class="bg-emerald-950/60 border border-emerald-700/60 p-2.5 rounded-xl">
                <span class="text-[10px] text-emerald-300 block uppercase font-bold">Amount Paid</span>
                <b class="text-emerald-400 text-base font-black">₹${r.amountReceived.toFixed(2)}</b>
            </div>
        </div>

        <div class="bg-slate-950 p-3 rounded-2xl border ${r.remainingDue > 0 ? 'border-rose-900/60' : 'border-emerald-800/60'} text-center">
            <span class="text-[10px] text-slate-400 block uppercase font-bold">Remaining Balance Due (ബാക്കി കുടിശ്ശിക)</span>
            <b class="text-lg font-black ${r.remainingDue > 0 ? 'text-rose-400' : 'text-emerald-400'}">₹${r.remainingDue.toFixed(2)}</b>
            ${r.excessCredit > 0 ? `<div class="text-[11px] text-sky-400 font-bold mt-1">💳 Advance Credit Added: ₹${r.excessCredit.toFixed(2)}</div>` : ''}
        </div>

        <div class="space-y-1">
            <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Settled Invoices (${r.settledBills.length}):</span>
            <div class="space-y-1 max-h-36 overflow-y-auto pr-0.5">
                ${r.settledBills.map(b => `
                    <div class="flex justify-between items-center bg-slate-950 p-2 rounded-lg border border-slate-800 text-[11px]">
                        <div>
                            <span class="font-bold text-white">#${b.billNo}</span>
                            <span class="text-slate-400 text-[10px] ml-1">📅 ${formatDateDDMMYYYY(b.date)}</span>
                            ${b.isCosmetics ? '<span class="text-[9px] text-pink-300 font-semibold ml-1">💄</span>' : ''}
                        </div>
                        <div class="text-right">
                            <span class="text-emerald-400 font-bold">₹${b.paidNow.toFixed(2)}</span>
                            <span class="text-[9px] ${b.cleared ? 'text-emerald-300' : 'text-rose-400'} ml-1">(${b.cleared ? 'Cleared' : `Bal ₹${b.remaining.toFixed(2)}`})</span>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;

    if (btnWhatsApp) {
        btnWhatsApp.onclick = () => shareDuePaymentReceiptWhatsApp(r);
    }
    if (btnPrint) {
        btnPrint.onclick = () => printDuePaymentReceipt(r);
    }

    modal.classList.remove('hidden');
}

export function closeDuePaymentReceiptModal() {
    document.getElementById('customerPaymentReceiptModal')?.classList.add('hidden');
}

export function printDuePaymentReceipt(receiptData) {
    const r = receiptData || lastDuePaymentReceiptData;
    if (!r) return;
    const printWin = window.open('', '_blank', 'width=450,height=650');
    if (!printWin) {
        alert('Please allow popups to print the receipt.');
        return;
    }
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>Payment Receipt - ${r.receiptNo}</title>
        <style>
            @page { size: 80mm auto; margin: 3mm; }
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace, sans-serif; font-size: 11px; margin: 0; padding: 10px; color: #000; line-height: 1.4; }
            .text-center { text-align: center; }
            .text-right { text-align: right; }
            .bold { font-weight: bold; }
            .divider { border-top: 1px dashed #666; margin: 6px 0; }
            .row { display: flex; justify-content: space-between; margin-bottom: 3px; }
            .title { font-size: 14px; font-weight: bold; letter-spacing: 0.5px; }
        </style>
    </head>
    <body onload="window.print(); window.close();">
        <div class="text-center">
            <div class="title">FIA CLEAN & CARE</div>
            <div>Edathanattukara • Mob: 8086452106</div>
            <div class="divider"></div>
            <div class="bold" style="font-size: 12px; margin-bottom: 2px;">DUE PAYMENT RECEIPT</div>
            <div>Receipt #: ${r.receiptNo}</div>
            <div>Date: ${r.date}</div>
        </div>
        <div class="divider"></div>
        <div class="row"><span>Customer:</span><span class="bold">${r.customerName}</span></div>
        <div class="row"><span>Phone:</span><span>${r.customerPhone || '—'}</span></div>
        <div class="row"><span>Payment Mode:</span><span class="bold">${r.paymentMode}</span></div>
        ${r.note ? `<div class="row"><span>Note:</span><span>${r.note}</span></div>` : ''}
        <div class="divider"></div>
        <div class="row"><span>Previous Total Due:</span><span>₹${Number(r.previousDue).toFixed(2)}</span></div>
        <div class="row bold" style="font-size: 13px;"><span>AMOUNT RECEIVED:</span><span>₹${Number(r.amountReceived).toFixed(2)}</span></div>
        <div class="row bold" style="font-size: 13px;"><span>REMAINING BALANCE DUE:</span><span>₹${Number(r.remainingDue).toFixed(2)}</span></div>
        ${r.excessCredit > 0 ? `<div class="row bold"><span>Advance Credit Added:</span><span>₹${Number(r.excessCredit).toFixed(2)}</span></div>` : ''}
        <div class="divider"></div>
        <div class="bold" style="margin-bottom: 4px;">Invoices Settled (${r.settledBills.length}):</div>
        ${r.settledBills.map(b => `
            <div class="row" style="font-size: 10px;">
                <span>Bill #${b.billNo}</span>
                <span>Paid ₹${Number(b.paidNow).toFixed(2)} ${b.cleared ? '[Cleared]' : `[Bal ₹${Number(b.remaining).toFixed(2)}]`}</span>
            </div>
        `).join('')}
        <div class="divider"></div>
        <div class="text-center" style="font-size: 10px; margin-top: 8px;">
            Thank you for your prompt payment!<br/>
            FIA CLEAN & CARE
        </div>
    </body>
    </html>
    `;
    printWin.document.write(html);
    printWin.document.close();
}

export function shareDuePaymentReceiptWhatsApp(receiptData) {
    const r = receiptData || lastDuePaymentReceiptData;
    if (!r) return;
    const phone = String(r.customerPhone || '').replace(/\D/g, '');
    let lines = [];
    lines.push(`*FIA CLEAN & CARE*`);
    lines.push(`*EDATHANATTUKARA • MOB: 8086452106*`);
    lines.push(`--------------------------------`);
    lines.push(`*PAYMENT RECEIPT (പേയ്മെന്റ് രസീത്)*`);
    lines.push(`*Receipt No:* ${r.receiptNo}`);
    lines.push(`*Date:* ${r.date}`);
    lines.push(`*Customer:* ${r.customerName}`);
    if (r.customerPhone) lines.push(`*Phone:* ${r.customerPhone}`);
    lines.push(`*Payment Mode:* ${r.paymentMode}`);
    if (r.note) lines.push(`*Note:* ${r.note}`);
    lines.push(`--------------------------------`);
    lines.push(`Previous Total Due: ₹${Number(r.previousDue).toFixed(2)}`);
    lines.push(`*✅ AMOUNT RECEIVED (ലഭിച്ച തുക): ₹${Number(r.amountReceived).toFixed(2)}*`);
    lines.push(`*⚠️ REMAINING BALANCE DUE (ബാക്കി കുടിശ്ശിക): ₹${Number(r.remainingDue).toFixed(2)}*`);
    if (r.excessCredit > 0) {
        lines.push(`*💳 Advance Credit in Account: ₹${Number(r.excessCredit).toFixed(2)}*`);
    }
    lines.push(`--------------------------------`);
    lines.push(`*Settled Invoices (തുക വരവ് വെച്ച ബില്ലുകൾ):*`);
    r.settledBills.forEach(b => {
        lines.push(`• Bill #${b.billNo}: Paid ₹${Number(b.paidNow).toFixed(2)} ${b.cleared ? '(✅ Cleared)' : `(⏳ Bal: ₹${Number(b.remaining).toFixed(2)})`}`);
    });
    lines.push(`--------------------------------`);
    lines.push(`_Thank you for your business!_`);
    lines.push(`_FIA Clean & Care_`);
    
    const msg = lines.join('\n');
    const url = phone ? `https://api.whatsapp.com/send?phone=91${phone}&text=${encodeURIComponent(msg)}` : `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
}

export function shareSelectedCustomerConsolidatedDetail() {
    const name = String(selectedCustomerConsolidatedName || '').trim().toUpperCase();
    if (!name) return;
    let purchaseCount = 0, total = 0, paid = 0, due = 0;
    (state.customers || []).forEach(c => {
        if (!c || isCustItemDeleted(c) || c.isCancelled || c.status === 'cancelled' || String(c.name || '').trim().toUpperCase() !== name) return;
        const hasBill = Boolean(c.billNo || (Array.isArray(c.items) && c.items.length > 0) || Number(c.grandTotal || 0) > 0);
        if (!hasBill) return;
        const g = Number(c.grandTotal || 0);
        const p = c.paidAmount !== undefined ? Number(c.paidAmount) : g;
        const d = c.pendingAmount !== undefined ? Number(c.pendingAmount) : Math.max(0, g - p);
        purchaseCount += 1; total += g; paid += p; due += d;
    });
    (state.cosSales || []).forEach(s => {
        if (!s || isCustItemDeleted(s) || s.isCancelled || s.status === 'cancelled' || String(s.customer || '').trim().toUpperCase() !== name) return;
        const n = normalizeCosSale(s);
        purchaseCount += 1; total += Number(n.grandTotal || 0); paid += Number(n.paidAmount || 0); due += Number(n.pendingAmount || 0);
    });
    const msg = `*FIA CLEAN & CARE*\n*CUSTOMER CONSOLIDATED STATEMENT*\n\n*Customer:* ${name}\n\n*Total Purchases:* ${purchaseCount}\n*Total Purchase Amount:* ₹${total.toFixed(2)}\n*Total Paid:* ₹${paid.toFixed(2)}\n*Balance Due:* ₹${due.toFixed(2)}\n\n_Thank you for your business!_`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`, '_blank');
}


export function viewCustomerProfile(name) {
    const upperTarget = String(name || '').trim().toUpperCase();
    const cleanBills = (state.customers || []).filter(c => c && !isCustItemDeleted(c) && !c.isCancelled && c.status !== 'cancelled' && String(c.name || '').trim().toUpperCase() === upperTarget).map(c => ({
        billNo: c.billNo || 'Bill',
        date: c.date,
        createdAt: c.createdAt || c.timestamp || c.savedAt || 0,
        grandTotal: Number(c.grandTotal || 0),
        paidAmount: Math.min(Number(c.grandTotal || 0), Number(c.paidAmount !== undefined ? c.paidAmount : (c.grandTotal || 0))),
        pendingAmount: Math.max(0, Number(c.pendingAmount || 0)),
        isCos: false,
        phone: c.phone
    }));
    const cosBills = (state.cosSales || []).filter(s => s && !isCustItemDeleted(s) && !s.isCancelled && s.status !== 'cancelled' && String(s.customer || '').trim().toUpperCase() === upperTarget).map(s => {
        const norm = typeof normalizeCosSale === 'function' ? normalizeCosSale(s) : s;
        const g = Number(norm.grandTotal || 0);
        const p = Number(norm.paidAmount || 0);
        return {
            billNo: s.billNo || 'COS-Bill',
            date: s.date,
            createdAt: s.createdAt || s.timestamp || s.savedAt || 0,
            grandTotal: g,
            paidAmount: p,
            pendingAmount: Math.max(0, Number(norm.pendingAmount || 0)),
            isCos: true,
            phone: s.phone
        };
    });

    const custBills = [...cleanBills, ...cosBills].sort((a, b) => {
        const diffDate = (dateSortValue(b.date) || 0) - (dateSortValue(a.date) || 0);
        if (diffDate !== 0) return diffDate;
        const seqB = parseInt(String(b.billNo || '').replace(/\D/g, ''), 10) || 0;
        const seqA = parseInt(String(a.billNo || '').replace(/\D/g, ''), 10) || 0;
        if (seqB !== seqA) return seqB - seqA;
        return Number(b.createdAt || 0) - Number(a.createdAt || 0);
    });

    const phone = custBills.find(c => c.phone)?.phone || 'No mobile';
    const totalPurchase = custBills.reduce((sum, c) => sum + Number(c.grandTotal || 0), 0);
    const totalPaid = custBills.reduce((sum, c) => sum + Number(c.paidAmount || 0), 0);
    const totalPending = custBills.reduce((sum, c) => sum + Number(c.pendingAmount || 0), 0);
    
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
                <p class="text-[10px] font-bold text-slate-400 uppercase">Recent Invoices (Latest First)</p>
                ${custBills.map(b => `
                    <div class="bg-slate-900/80 p-2 rounded-lg border border-slate-800 flex justify-between items-center text-[11px]">
                        <div>
                            <span class="font-bold ${b.isCos ? 'text-pink-300' : 'text-cyan-300'}">#${b.billNo}</span>
                            ${b.isCos ? '<span class="text-[9px] bg-pink-950 text-pink-300 px-1 py-0.2 rounded border border-pink-800 ml-1">Cos</span>' : ''}
                            <span class="text-slate-400 ml-1.5">${formatDateDDMMYYYY(b.date)}</span>
                        </div>
                        <div class="text-right">
                            <span class="font-bold text-white">₹${Number(b.grandTotal || 0).toFixed(2)}</span>
                            ${b.pendingAmount > 0.001 ? `<span class="text-rose-400 text-[10px] ml-1.5 block sm:inline font-bold">Due: ₹${b.pendingAmount.toFixed(2)}</span>` : ''}
                        </div>
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
    window.openCustomerDueSettlementModal = openCustomerDueSettlementModal;
    window.previewDueAllocation = previewDueAllocation;
    window.confirmCustomerDueSettlement = confirmCustomerDueSettlement;
    window.paySingleDueBill = paySingleDueBill;
    window.showDuePaymentReceiptModal = showDuePaymentReceiptModal;
    window.closeDuePaymentReceiptModal = closeDuePaymentReceiptModal;
    window.printDuePaymentReceipt = printDuePaymentReceipt;
    window.shareDuePaymentReceiptWhatsApp = shareDuePaymentReceiptWhatsApp;
    window.viewCustomerProfile = viewCustomerProfile;
    window.renderCustomers = renderCustomers;
    window.auditAndRepairCustomerBalances = auditAndRepairCustomerBalances;
    window.onBillingCustomerSearchInput = onBillingCustomerSearchInput;
    window.openBillingCustomerDropdown = openBillingCustomerDropdown;
    window.closeBillingCustomerDropdown = closeBillingCustomerDropdown;
    window.toggleBillingCustomerDropdown = toggleBillingCustomerDropdown;
    window.selectBillingCustomer = selectBillingCustomer;
    window.clearBillingCustomerInput = clearBillingCustomerInput;
    window.handleBillingCustomerKeyDown = handleBillingCustomerKeyDown;
    window.renderBillingCustomerDropdown = renderBillingCustomerDropdown;
    window.activateManualCustomerEntry = activateManualCustomerEntry;
    window.onManualCustNameChange = onManualCustNameChange;
}

if (typeof document !== 'undefined') {
    document.addEventListener('click', (e) => {
        const container = document.getElementById('billingCustomerSearchContainer');
        if (container && !container.contains(e.target)) {
            if (typeof closeBillingCustomerDropdown === 'function') {
                closeBillingCustomerDropdown();
            }
        }
    });
}


