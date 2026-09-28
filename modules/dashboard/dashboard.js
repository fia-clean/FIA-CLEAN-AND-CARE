/**
 * FIA CLEAN & CARE - Dashboard & Analytics Module
 */

import {
    state,
    money,
    formatDateDDMMYYYY,
    getTodayDateString,
    normalizeToDateKey,
    dateSortValue,
    isCustItemDeleted
} from '../core/state.js';

export function pushDashboardModalState(modalName) {
    if (state.isLoggedIn && (!history.state || history.state.modal !== modalName)) {
        history.pushState({ loggedIn: true, tab: 'home', modal: modalName }, '', '#home-' + modalName);
    }
}

export function toggleRecentTransactionsFolder(forceState) {
    const content = document.getElementById('recentTransactionsFolderContent');
    const btnText = document.getElementById('recentTransactionsBtnText');
    const btnIcon = document.getElementById('recentTransactionsBtnIcon');
    const statusText = document.getElementById('recentTransactionsFolderStatusText');
    if (!content) return;

    const isCurrentlyHidden = content.classList.contains('hidden');
    const shouldOpen = (forceState !== undefined) ? !!forceState : isCurrentlyHidden;

    if (shouldOpen) {
        content.classList.remove('hidden');
        if (btnText) btnText.textContent = 'Hide';
        if (btnIcon) btnIcon.textContent = '▲';
        if (statusText) statusText.textContent = 'Showing recent business transactions';
    } else {
        content.classList.add('hidden');
        if (btnText) btnText.textContent = 'View';
        if (btnIcon) btnIcon.textContent = '👁️';
        if (statusText) statusText.textContent = 'Tap to view recent transactions';
    }
}

export function updateRecentTransactions() {
    const el = document.getElementById('recentTransactionsList');
    if (!el) return;
    const rows = [];
    (state.customers || []).forEach(c => {
        if (!c) return;
        rows.push({
            date: c.date,
            type: 'Sale',
            title: c.name || 'Customer Sale',
            amount: Number(c.grandTotal || 0),
            icon: '🧾',
            color: 'text-emerald-300'
        });
    });
    (state.cosSales || []).forEach(c => {
        if (!c) return;
        const total = Number(c.grandTotal !== undefined ? c.grandTotal : (c.netTotal || c.total || 0));
        rows.push({
            date: c.date,
            type: 'Cosmetics Sale',
            title: c.customer || 'Cosmetics Sale',
            amount: total,
            icon: '💄',
            color: 'text-pink-300'
        });
    });
    (state.purchases || []).forEach(c => {
        if (!c) return;
        rows.push({
            date: c.date,
            type: 'Purchase',
            title: c.supplierName || c.rawMaterial || 'Purchase',
            amount: Number(c.rawCost || c.amount || 0),
            icon: '🛒',
            color: 'text-blue-300'
        });
    });
    (state.cosPurchases || []).forEach(c => {
        if (!c) return;
        rows.push({
            date: c.date,
            type: 'Cosmetics Purchase',
            title: c.supplier || c.item || 'Cosmetics Purchase',
            amount: Number(c.amount || 0),
            icon: '💄',
            color: 'text-purple-300'
        });
    });
    (state.expenses || []).forEach(c => {
        if (!c || c._deleted) return;
        const isInc = c.type === 'Income';
        rows.push({
            date: c.date,
            type: isInc ? 'Other Income' : 'Expense',
            title: c.title || (isInc ? 'Other Income' : 'Expense'),
            amount: Number(c.amount || 0),
            icon: isInc ? '🟢' : '💸',
            color: isInc ? 'text-emerald-300' : 'text-rose-300'
        });
    });

    rows.sort((a, b) => dateSortValue(b.date) - dateSortValue(a.date));

    const badge = document.getElementById('recentTransactionsCountBadge');
    if (badge) {
        badge.textContent = `${rows.length} ${rows.length === 1 ? 'Activity' : 'Activities'}`;
    }

    el.innerHTML = rows.slice(0, 50).map(r => `
        <div class="flex items-center justify-between gap-3 bg-slate-950/50 border border-slate-800 rounded-xl px-3 py-2 hover:bg-slate-900/60 transition">
            <div class="flex items-center gap-2 min-w-0">
                <span class="text-base">${r.icon}</span>
                <div class="min-w-0">
                    <div class="text-[11px] font-bold ${r.color} truncate">${r.type}</div>
                    <div class="text-[10px] text-slate-400 truncate">${r.title} • ${formatDateDDMMYYYY(r.date)}</div>
                </div>
            </div>
            <div class="text-[11px] font-bold text-slate-200 shrink-0">${money(r.amount)}</div>
        </div>
    `).join('') || '<div class="text-xs text-slate-500 text-center py-3">No transactions yet.</div>';
}

export function openDueAmountList() {
    pushDashboardModalState('dueAmount');
    renderDueAmountList();
    const modal = document.getElementById('dueAmountListModal');
    if (modal) modal.classList.remove('hidden');
}

export function closeDueAmountList(skipHistory = false) {
    const modal = document.getElementById('dueAmountListModal');
    if (modal) modal.classList.add('hidden');
    if (!skipHistory && history.state && history.state.modal === 'dueAmount') history.back();
}

export function getDueCustomerName(c) {
    if (!c) return 'Customer';
    const isGeneric = (str) => !str || ['customer', 'walk-in', 'walk in', 'walk-in customer', 'cosmetics'].includes(String(str).trim().toLowerCase());

    // 1. Direct name from record
    if (!isGeneric(c.name)) {
        return String(c.name).trim().toUpperCase();
    }
    // 2. Alternate field names (customer, customerName, clientName)
    const alt = c.customer || c.customerName || c.clientName;
    if (!isGeneric(alt)) {
        return String(alt).trim().toUpperCase();
    }
    // 3. Lookup by phone in customer profiles / bills
    const cleanPhone = String(c.phone || '').replace(/\D/g, '');
    if (cleanPhone && Array.isArray(state.customers)) {
        const matched = state.customers.find(p => {
            if (!p) return false;
            const pPhone = String(p.phone || '').replace(/\D/g, '');
            if (pPhone !== cleanPhone) return false;
            const pName = p.name || p.customer || p.customerName;
            return !isGeneric(pName);
        });
        if (matched) {
            return String(matched.name || matched.customer || matched.customerName).trim().toUpperCase();
        }
    }
    // 4. Lookup by phone in cosSales
    if (cleanPhone && Array.isArray(state.cosSales)) {
        const matchedCos = state.cosSales.find(s => {
            if (!s) return false;
            const sPhone = String(s.phone || '').replace(/\D/g, '');
            if (sPhone !== cleanPhone) return false;
            const sName = s.customer || s.name;
            return !isGeneric(sName);
        });
        if (matchedCos) {
            return String(matchedCos.customer || matchedCos.name).trim().toUpperCase();
        }
    }
    // 5. Lookup by billNo if available
    if (c.billNo && Array.isArray(state.customers)) {
        const matchedBill = state.customers.find(p => {
            if (!p || p.billNo !== c.billNo) return false;
            const pName = p.name || p.customer;
            return !isGeneric(pName);
        });
        if (matchedBill) {
            return String(matchedBill.name || matchedBill.customer).trim().toUpperCase();
        }
    }
    return String(c.name || c.customer || 'Customer').trim().toUpperCase() || 'Customer';
}

let dueListViewMode = 'customer';

export function switchDueListViewMode(mode) {
    dueListViewMode = mode;
    const btnCust = document.getElementById('btnDueModeCustomer');
    const btnBill = document.getElementById('btnDueModeBill');
    if (btnCust && btnBill) {
        if (mode === 'customer') {
            btnCust.className = "flex-1 py-1.5 px-3 text-xs font-bold rounded-lg bg-rose-600 text-white shadow transition cursor-pointer";
            btnBill.className = "flex-1 py-1.5 px-3 text-xs font-bold rounded-lg bg-slate-800 text-slate-400 hover:text-slate-200 transition cursor-pointer";
        } else {
            btnBill.className = "flex-1 py-1.5 px-3 text-xs font-bold rounded-lg bg-rose-600 text-white shadow transition cursor-pointer";
            btnCust.className = "flex-1 py-1.5 px-3 text-xs font-bold rounded-lg bg-slate-800 text-slate-400 hover:text-slate-200 transition cursor-pointer";
        }
    }
    renderDueAmountList();
}

export function shareCustomerDueWhatsApp(name, phone, totalDue, billCount) {
    const cleanPhone = String(phone || '').replace(/\D/g, '');
    const msg = `*FIA CLEAN & CARE*\n*EDATHANATTUKARA • MOB: 8086452106*\n\nDear *${name}*,\nThis is a friendly reminder that you have a pending balance due of *₹${Number(totalDue).toFixed(2)}* (${billCount} unpaid bill${billCount > 1 ? 's' : ''}).\n\nPlease arrange for the payment at your earliest convenience.\n\n_Thank you for your business!_`;
    const url = cleanPhone ? `https://api.whatsapp.com/send?phone=91${cleanPhone}&text=${encodeURIComponent(msg)}` : `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
}

export function renderDueAmountList() {
    const container = document.getElementById('dueAmountListContainer');
    const totalEl = document.getElementById('dueAmountListTotal');
    if (!container) return;

    const dueRows = (state.customers || []).map((c, index) => ({
        c,
        index,
        due: Math.max(0, Number(c && c.pendingAmount || 0))
    }))
    .filter(row => row.c && row.due > 0 && !row.c.isCancelled && row.c.status !== 'cancelled' && !isCustItemDeleted(row.c))
    .sort((a, b) => b.due - a.due);

    const totalDue = dueRows.reduce((sum, row) => sum + row.due, 0);
    if (totalEl) totalEl.textContent = 'Total Due: ' + money(totalDue);
    if (!dueRows.length) {
        container.innerHTML = '<div class="text-center text-slate-500 text-xs py-8">No pending due amounts.</div>';
        return;
    }

    if (dueListViewMode === 'customer') {
        const custGroups = new Map();
        dueRows.forEach(({ c, index, due }) => {
            const rawName = getDueCustomerName(c);
            const key = rawName.toUpperCase();
            if (!custGroups.has(key)) {
                custGroups.set(key, {
                    name: rawName,
                    phone: c.phone || '',
                    totalDue: 0,
                    billCount: 0,
                    bills: [],
                    lastDate: c.date
                });
            }
            const group = custGroups.get(key);
            group.totalDue += due;
            group.billCount += 1;
            group.bills.push({ c, index, due });
            if (dateSortValue(c.date) > dateSortValue(group.lastDate)) {
                group.lastDate = c.date;
            }
            if (!group.phone && c.phone) group.phone = c.phone;
        });

        const sortedCusts = Array.from(custGroups.values()).sort((a, b) => b.totalDue - a.totalDue);
        
        container.innerHTML = sortedCusts.map(cg => {
            const safeName = String(cg.name).replace(/'/g, "\\'");
            const phoneText = cg.phone && String(cg.phone).trim() ? String(cg.phone).trim() : 'No mobile';
            const dateText = formatDateDDMMYYYY(cg.lastDate) || 'No date';

            const billsHtml = (cg.bills || []).map(b => {
                const bCustName = getDueCustomerName(b.c);
                const bPhone = b.c.phone && String(b.c.phone).trim() ? String(b.c.phone).trim() : phoneText;
                const bDate = formatDateDDMMYYYY(b.c.date) || 'No date';
                const bTarget = b.c.billNo || b.c.id || b.index;
                return `
                <div class="bg-slate-900/90 border border-slate-800 rounded-lg p-2 flex items-start justify-between gap-2 text-xs">
                    <div class="min-w-0 flex-1">
                        <div class="flex items-center gap-1.5 flex-wrap">
                            <span class="font-bold text-white text-xs truncate">${bCustName}</span>
                            ${b.c.billNo ? `<span class="text-[10px] font-mono text-sky-400 bg-sky-950/80 px-1.5 py-0.5 rounded border border-sky-800/60">#${b.c.billNo}</span>` : ''}
                        </div>
                        <p class="text-[10.5px] text-slate-300 mt-0.5 leading-snug break-words">
                            <span class="font-bold text-slate-100">${bCustName}</span> • <span class="text-slate-300 font-mono">📞 ${bPhone}</span> • <span class="text-slate-400 font-mono">📅 ${bDate}</span>
                        </p>
                    </div>
                    <div class="text-right shrink-0 flex flex-col items-end gap-1">
                        <div>
                            <span class="font-bold text-rose-300 text-xs">${money(b.due)}</span>
                            <span class="text-[8px] text-slate-500 block">Due</span>
                        </div>
                        <div class="flex items-center gap-1">
                            <button type="button" onclick="window.closeDueAmountList(true); window.previewBill('${bTarget}');" class="bg-blue-900 hover:bg-blue-800 text-blue-200 px-2 py-0.5 rounded text-[10px] font-bold border border-blue-800 cursor-pointer">View</button>
                            <button type="button" onclick="window.closeDueAmountList(true); if(history.state) history.replaceState({ loggedIn: true, tab: 'billing' }, '', '#billing'); window.editCustomerBill('${bTarget}');" class="bg-slate-800 hover:bg-slate-700 text-emerald-400 px-2 py-0.5 rounded text-[10px] font-bold border border-slate-700 cursor-pointer">Edit</button>
                        </div>
                    </div>
                </div>`;
            }).join('');

            return `
            <div class="bg-slate-950/70 border border-slate-800 hover:border-slate-700 rounded-xl p-3 transition space-y-2.5">
                <div class="flex items-start justify-between gap-2">
                    <div class="min-w-0 flex-1">
                        <div class="flex items-center gap-1.5 flex-wrap">
                            <p class="font-bold text-white text-sm truncate">${cg.name}</p>
                            <span class="text-[10px] font-bold text-rose-400 bg-rose-950/80 px-2 py-0.5 rounded border border-rose-800/60">${cg.billCount} Bill${cg.billCount > 1 ? 's' : ''}</span>
                        </div>
                        <p class="text-[11px] text-slate-300 mt-1 leading-snug break-words">
                            <span class="font-bold text-slate-100">${cg.name}</span> • <span class="text-slate-300 font-mono">📞 ${phoneText}</span> • <span class="text-slate-400 font-mono">📅 Last: ${dateText}</span>
                        </p>
                    </div>
                    <div class="text-right shrink-0">
                        <p class="font-black text-rose-400 text-base">${money(cg.totalDue)}</p>
                        <p class="text-[9px] text-slate-400">Total Due</p>
                    </div>
                </div>

                <!-- Customer's Individual Bills List with Customer Name -->
                <div class="space-y-1.5 pt-0.5">
                    ${billsHtml}
                </div>

                <div class="flex flex-wrap gap-1.5 pt-2 border-t border-slate-800/80">
                    <button type="button" onclick="window.closeDueAmountList(true); window.openCustomerConsolidationCustomer('${encodeURIComponent(cg.name)}');" class="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white px-2.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer">
                        👁️ Full Statement & History
                    </button>
                    ${cg.phone && cg.phone !== 'No mobile' ? `
                    <button type="button" onclick="window.shareCustomerDueWhatsApp('${safeName}', '${cg.phone}', ${cg.totalDue}, ${cg.billCount})" class="bg-emerald-700 hover:bg-emerald-600 text-white px-2.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer">
                        💬 WhatsApp
                    </button>` : ''}
                </div>
            </div>`;
        }).join('');
    } else {
        container.innerHTML = dueRows.map(({ c, index, due }) => {
            const custName = getDueCustomerName(c);
            const phoneText = c.phone && String(c.phone).trim() ? String(c.phone).trim() : 'No mobile';
            const dateText = formatDateDDMMYYYY(c.date) || 'No date';

            return `
            <div class="bg-slate-950/70 border border-slate-800 rounded-xl p-3">
                <div class="flex items-start justify-between gap-2">
                    <div class="min-w-0 flex-1">
                        <div class="flex items-center gap-1.5 flex-wrap">
                            <p class="font-bold text-white text-sm truncate">${custName}</p>
                            ${c.billNo ? `<span class="text-[10px] font-mono text-sky-400 bg-sky-950/80 px-1.5 py-0.5 rounded border border-sky-800/60">#${c.billNo}</span>` : ''}
                        </div>
                        <p class="text-[11px] text-slate-300 mt-1 leading-snug break-words">
                            <span class="font-bold text-slate-100">${custName}</span> • <span class="text-slate-300 font-mono">📞 ${phoneText}</span> • <span class="text-slate-400 font-mono">📅 ${dateText}</span>
                        </p>
                    </div>
                    <div class="text-right shrink-0">
                        <p class="font-extrabold text-rose-300 text-sm">${money(due)}</p>
                        <p class="text-[9px] text-slate-500">Pending</p>
                    </div>
                </div>
                <div class="flex flex-wrap gap-1.5 mt-2.5">
                    <button type="button" onclick="window.closeDueAmountList(true); window.previewBill('${c.billNo || c.id || index}');" class="bg-blue-900 text-blue-200 px-2.5 py-1.5 rounded-lg border border-blue-800 text-[10px] font-bold">View</button>
                    <button type="button" onclick="window.closeDueAmountList(true); if(history.state) history.replaceState({ loggedIn: true, tab: 'billing' }, '', '#billing'); window.editCustomerBill('${c.billNo || c.id || index}');" class="bg-slate-800 text-emerald-400 px-2.5 py-1.5 rounded-lg border border-slate-700 text-[10px] font-bold">Edit</button>
                    <button type="button" onclick="window.deleteDueBillFromList('${c.billNo || c.id || index}')" class="bg-slate-800 text-red-400 px-2.5 py-1.5 rounded-lg border border-slate-700 text-[10px] font-bold">Delete</button>
                </div>
            </div>`;
        }).join('');
    }
}

export function deleteDueBillFromList(identifier) {
    if (confirm('Are you sure you want to delete this due bill?')) {
        if (window.deleteCustomerBill) {
            window.deleteCustomerBill(identifier, false);
        }
        setTimeout(() => {
            renderDueAmountList();
            updateDashboard();
        }, 0);
    }
}

export function openLowStockList() {
    pushDashboardModalState('lowStock');
    const container = document.getElementById('lowStockListContainer');
    if (!container) return;
    const rows = [
        ...(state.products || []).filter(p => Number(p.stock || 0) <= 5).map(p => ({ ...p, category: 'Cleaning' })),
        ...(state.cosProducts || []).filter(p => Number(p.stock || 0) <= 5).map(p => ({ ...p, category: 'Cosmetics' })),
        ...(state.packages || []).filter(p => Number(p.stock || 0) <= 5).map(p => ({ ...p, category: 'Packaging' }))
    ].sort((a, b) => Number(a.stock || 0) - Number(b.stock || 0));
    
    container.innerHTML = rows.length ? rows.map(p => `
        <div onclick="window.goToAddStockFromLowStock('${p.category}', '${p.id}')" class="bg-slate-50 hover:bg-emerald-50/50 border border-slate-200 hover:border-emerald-300 rounded-2xl p-3 text-xs transition cursor-pointer group shadow-xs">
            <div class="flex items-center justify-between gap-2">
                <div class="min-w-0 flex-1">
                    <div class="font-extrabold ${p.category === 'Cosmetics' ? 'text-purple-900' : p.category === 'Packaging' ? 'text-sky-900' : 'text-emerald-900'} truncate group-hover:text-emerald-700">
                        ${p.name || 'Product'}
                    </div>
                    <div class="text-[10px] text-slate-500 mt-1 flex flex-wrap items-center gap-1.5">
                        <span class="px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 font-bold">${p.category}</span>
                        <span>Stock: <b class="text-rose-600 font-black">${p.stock || 0} ${p.unit || ''}</b></span>
                    </div>
                </div>
                <div class="shrink-0">
                    <button type="button" onclick="event.stopPropagation(); window.goToAddStockFromLowStock('${p.category}', '${p.id}')" class="bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold px-3 py-1.5 rounded-xl transition shadow-xs flex items-center gap-1 cursor-pointer">
                        <span>➕</span> <span>Add Stock</span>
                    </button>
                </div>
            </div>
        </div>
    `).join('') : '<p class="text-xs text-slate-500 text-center py-8">No low stock products.</p>';
    
    document.getElementById('lowStockListModal')?.classList.remove('hidden');
}

export function closeLowStockList(skipHistory = false) {
    document.getElementById('lowStockListModal')?.classList.add('hidden');
    if (!skipHistory && history.state && history.state.modal === 'lowStock') history.back();
}

export function goToAddStockFromLowStock(category, id) {
    closeLowStockList(true);
    if (history.state) {
        history.replaceState({ loggedIn: true, tab: 'stock' }, '', '#stock');
    }
    if (window.switchTab) {
        window.switchTab('stock', false);
    }
}

export function checkLowStockAlerts() {
    const banner = document.getElementById('lowStockAlertBanner');
    const preview = document.getElementById('lowStockListPreview');
    const mainLow = (state.products || []).filter(p => Number(p.stock || 0) <= 5);
    const cosLow = (state.cosProducts || []).filter(p => Number(p.stock || 0) <= 5);
    const packageLow = (state.packages || []).filter(p => Number(p.stock || 0) <= 5);
    const totalCount = mainLow.length + cosLow.length + packageLow.length;

    if (banner) {
        if (totalCount > 0) {
            banner.classList.remove('hidden');
            const cntEl = document.getElementById('lowStockTotalCount');
            if (cntEl) cntEl.textContent = totalCount;
        } else {
            banner.classList.add('hidden');
        }
    }
    if (preview && totalCount > 0) {
        const sample = [...mainLow, ...cosLow, ...packageLow].slice(0, 3);
        preview.innerHTML = sample.map(p => `<span class="px-2 py-0.5 rounded bg-rose-950/60 text-rose-300 border border-rose-800/60 text-[10px] font-bold">${p.name || 'Item'} (${p.stock || 0})</span>`).join(' ');
    }
}

export function updateDashboard() {
    const productCount = document.getElementById('dashProductCount');
    const customerCount = document.getElementById('dashCustomerCount');
    const dueAmount = document.getElementById('dashDueAmount');
    const mainLowCount = document.getElementById('dashLowStockMainCount');
    const dateEl = document.getElementById('dashboardDate');
    
    const totalDue = (state.customers || []).reduce((sum, c) => (c && !c.isCancelled && c.status !== 'cancelled' && !c._deleted && !isCustItemDeleted(c)) ? sum + Math.max(0, Number(c.pendingAmount || 0)) : sum, 0);
    const mainLow = (state.products || []).filter(p => Number(p.stock || 0) <= 5);
    const cosLow = (state.cosProducts || []).filter(p => Number(p.stock || 0) <= 5);
    const today = getTodayDateString();

    let salesToday = 0;
    let collectionToday = 0;
    let expenseToday = 0;

    if (window.getAllMasterEntries) {
        const todayEntries = window.getAllMasterEntries().filter(e => {
            if ((state.clearedDayBookEntries || []).includes(e.id) || (e.originalId && (state.clearedDayBookEntries || []).includes(e.originalId))) return false;
            return normalizeToDateKey(e.date) === today;
        });
        salesToday = todayEntries.filter(e => e.type === 'Income').reduce((s, e) => s + Number(e.amount || 0), 0);
        collectionToday = todayEntries.filter(e => e.type === 'Income').reduce((s, e) => s + Number(e.paidAmount !== undefined ? e.paidAmount : (e.amount || 0)), 0);
        expenseToday = todayEntries.filter(e => e.type === 'Expense').reduce((s, e) => s + Number(e.amount || 0), 0);
    } else {
        (state.customers || []).forEach(c => {
            if (normalizeToDateKey(c.date) === today) {
                salesToday += Number(c.grandTotal || 0);
                collectionToday += Number(c.paidAmount || 0);
            }
        });
        (state.cosSales || []).forEach(s => {
            if (normalizeToDateKey(s.date) === today) {
                salesToday += Number(s.grandTotal || s.total || 0);
                collectionToday += Number(s.paidAmount || 0);
            }
        });
        (state.expenses || []).forEach(ex => {
            if (!ex || ex._deleted) return;
            if (normalizeToDateKey(ex.date) === today && ex.type !== 'Income') {
                expenseToday += Number(ex.amount || 0);
            }
        });
    }

    const purchaseToday = (state.purchases || []).filter(c => normalizeToDateKey(c.date) === today).reduce((s, c) => s + Number(c.netPurchaseAmount !== undefined ? c.netPurchaseAmount : (c.rawCost || 0)), 0) +
        (state.cosPurchases || []).filter(c => normalizeToDateKey(c.date) === today).reduce((s, c) => s + Number(c.netPurchaseAmount !== undefined ? c.netPurchaseAmount : (c.amount || 0)), 0);
    
    let uniqueCustNames = [];
    (state.customers || []).forEach(c => {
        if (c && c.name && !uniqueCustNames.includes(c.name.trim().toLowerCase())) {
            uniqueCustNames.push(c.name.trim().toLowerCase());
        }
    });

    if (productCount) productCount.textContent = (state.products || []).length;
    if (customerCount) customerCount.textContent = uniqueCustNames.length;
    if (dueAmount) dueAmount.textContent = money(totalDue);
    if (mainLowCount) mainLowCount.textContent = mainLow.length + cosLow.length;
    if (document.getElementById('dashTodaySales')) document.getElementById('dashTodaySales').textContent = money(salesToday);
    if (document.getElementById('dashTodayPurchase')) document.getElementById('dashTodayPurchase').textContent = money(purchaseToday);
    if (document.getElementById('dashTodayExpense')) document.getElementById('dashTodayExpense').textContent = money(expenseToday);
    if (document.getElementById('dashTodayCollection')) document.getElementById('dashTodayCollection').textContent = money(collectionToday);
    if (dateEl) dateEl.textContent = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    
    updateRecentTransactions();
    checkLowStockAlerts();
    if (typeof window.updateDnoBadge === 'function') {
        try { window.updateDnoBadge(); } catch (e) {}
    }
    if (document.getElementById('dueAmountListModal') && !document.getElementById('dueAmountListModal').classList.contains('hidden')) {
        renderDueAmountList();
    }
}

// Window attachments for inline HTML onclick handlers
if (typeof window !== 'undefined') {
    window.updateDashboard = updateDashboard;
    window.updateRecentTransactions = updateRecentTransactions;
    window.toggleRecentTransactionsFolder = toggleRecentTransactionsFolder;
    window.openDueAmountList = openDueAmountList;
    window.closeDueAmountList = closeDueAmountList;
    window.renderDueAmountList = renderDueAmountList;
    window.deleteDueBillFromList = deleteDueBillFromList;
    window.openLowStockList = openLowStockList;
    window.closeLowStockList = closeLowStockList;
    window.goToAddStockFromLowStock = goToAddStockFromLowStock;
    window.checkLowStockAlerts = checkLowStockAlerts;
    window.getDueCustomerName = getDueCustomerName;
}
