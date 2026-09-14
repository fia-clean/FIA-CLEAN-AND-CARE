/**
 * FIA CLEAN & CARE - Operations: Purchases & Supplier Management Module
 * Handles Cleaning & Cosmetic purchases, suppliers, purchase returns, and supplier dues.
 */

import {
    state,
    sortByNameAsc,
    dateSortValue,
    formatDateDDMMYYYY,
    getTodayDateString,
    markIdDeleted,
    unmarkIdDeleted
} from '../core/state.js';
import { syncToFirebase } from '../core/db.js';

export function getTodayPurchaseDate() {
    return getTodayDateString();
}

export function loadPurchaseSuppliers() {
    try {
        state.purchaseSuppliers = JSON.parse(localStorage.getItem('fia_purchase_suppliers')) || [];
    } catch (e) {
        state.purchaseSuppliers = [];
    }
    renderPurchaseSupplierList();
}

export function renderPurchaseSupplierList() {
    const dl = document.getElementById('purchaseSupplierList');
    const map = new Map();
    [
        ...state.purchaseSuppliers,
        ...state.purchases.map(p => ({ name: p.supplierName, mobile: p.supplierMobile })),
        ...state.cosPurchases.map(p => ({ name: p.supplier, mobile: p.supplierMobile }))
    ].forEach(x => {
        if (x && x.name) map.set(String(x.name).toLowerCase(), { name: x.name, mobile: x.mobile || '' });
    });
    const vals = [...map.values()];
    if (dl) dl.innerHTML = vals.map(x => `<option value="${String(x.name).replace(/"/g, '&quot;')}" data-mobile="${String(x.mobile || '').replace(/"/g, '&quot;')}"></option>`).join('');
    ['purchaseSupplierSelect', 'cosPurchaseSupplierSelect'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            const current = el.value;
            el.innerHTML = '<option value="">-- Select Supplier from List --</option>' + vals.map(x => `<option value="${String(x.name).replace(/"/g, '&quot;')}">${String(x.name)}${x.mobile ? ' • ' + String(x.mobile) : ''}</option>`).join('');
            if (vals.some(x => x.name === current)) el.value = current;
        }
    });
    ['purchaseHistorySupplier', 'cosPurchaseHistorySupplier'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            const current = el.value;
            el.innerHTML = '<option value="">-- All Suppliers --</option>' + vals.map(x => `<option value="${String(x.name).replace(/"/g, '&quot;')}">${String(x.name)}</option>`).join('');
            if (vals.some(x => x.name === current)) el.value = current;
        }
    });
}

export function findPurchaseSupplier(name) {
    const q = String(name || '').trim().toLowerCase();
    const a = state.purchaseSuppliers.find(x => String(x.name || '').toLowerCase() === q);
    if (a) return a;
    const p = state.purchases.find(x => String(x.supplierName || '').toLowerCase() === q);
    return p ? { name: p.supplierName, mobile: p.supplierMobile || '' } : null;
}

export function fillPurchaseSupplierMobile() {
    const x = findPurchaseSupplier(document.getElementById('supplierName')?.value);
    if (x && document.getElementById('supplierMobile')) document.getElementById('supplierMobile').value = x.mobile || '';
}

export function fillCosPurchaseSupplierMobile() {
    const x = findPurchaseSupplier(document.getElementById('cosPSupplier')?.value);
    if (x && document.getElementById('cosPSupplierMobile')) document.getElementById('cosPSupplierMobile').value = x.mobile || '';
}

export function selectPurchaseSupplier(el, type) {
    const x = findPurchaseSupplier(el.value);
    if (!x) return;
    if (type === 'cosmetics') {
        document.getElementById('cosPSupplier').value = x.name || '';
        document.getElementById('cosPSupplierMobile').value = x.mobile || '';
    } else {
        document.getElementById('supplierName').value = x.name || '';
        document.getElementById('supplierMobile').value = x.mobile || '';
    }
}

export function addPurchaseSupplier() {
    const name = document.getElementById('newPurchaseSupplierName').value.trim();
    const mobile = document.getElementById('newPurchaseSupplierMobile').value.trim();
    if (!name) { alert('Enter supplier name.'); return; }
    const i = state.purchaseSuppliers.findIndex(x => String(x.name).toLowerCase() === name.toLowerCase());
    if (i >= 0) state.purchaseSuppliers[i] = { name, mobile };
    else state.purchaseSuppliers.push({ name, mobile });
    localStorage.setItem('fia_purchase_suppliers', JSON.stringify(state.purchaseSuppliers));
    document.getElementById('supplierName').value = name;
    document.getElementById('supplierMobile').value = mobile;
    if (document.getElementById('cosPSupplier')) document.getElementById('cosPSupplier').value = name;
    if (document.getElementById('cosPSupplierMobile')) document.getElementById('cosPSupplierMobile').value = mobile;
    document.getElementById('newPurchaseSupplierName').value = '';
    document.getElementById('newPurchaseSupplierMobile').value = '';
    renderPurchaseSupplierList();
    alert('Supplier added.');
}

export function updateCleaningPurchaseDropdown() {
    const sel = document.getElementById('purchaseStockSelect'); if (!sel) return;
    sel.innerHTML = '<option value="">-- Select Product --</option>';
    sortByNameAsc(state.products).forEach(p => {
        sel.innerHTML += `<option value="${p.id}" data-price="${p.retailPrice || 0}" data-unit="${p.unit || ''}" data-barcode="${p.barcode || ''}">${p.name} (Stock: ${p.stock} ${p.unit || ''})</option>`;
    });
}

export function togglePurchaseInputs() {
    const type = document.getElementById('purchaseEntryType')?.value;
    const sg = document.getElementById('purchaseStockGroup'), mg = document.getElementById('purchaseManualGroup');
    if (type === 'stock') { sg?.classList.remove('hidden'); mg?.classList.add('hidden'); }
    else { sg?.classList.add('hidden'); mg?.classList.remove('hidden'); }
    calculatePurchaseTotal();
}

export function fillPurchaseStockDetails() {
    const sel = document.getElementById('purchaseStockSelect');
    const opt = sel?.options[sel.selectedIndex];
    if (!opt) return;
    const p = state.products.find(x => x.id === sel.value);
    if (p) {
        document.getElementById('rawUnit').value = p.unit || '';
        document.getElementById('rawBarcode').value = p.barcode || '';
        document.getElementById('rawUnitPrice').value = p.wholesalePrice || p.retailPrice || '';
    }
    calculatePurchaseTotal();
}

export function calculatePurchaseTotal() {
    const q = parseFloat(document.getElementById('rawQty')?.value) || 0;
    const up = parseFloat(document.getElementById('rawUnitPrice')?.value) || 0;
    if (up > 0) document.getElementById('rawCost').value = (q * up).toFixed(2);
    calculatePurchaseBalance();
}

export function calculatePurchaseBalance() {
    const t = parseFloat(document.getElementById('rawCost')?.value) || 0;
    const p = parseFloat(document.getElementById('purchasePaid')?.value) || 0;
    const b = Math.max(0, t - p);
    const el = document.getElementById('purchaseBalance');
    if (el) el.value = b.toFixed(2);
}

export function ensurePurchaseTimestamps(list) {
    let max = 0;
    (list || []).forEach(p => {
        const t = Number(p?.savedAt) || 0;
        if (t > max) max = t;
    });
    (list || []).forEach(p => {
        if (!(Number(p?.savedAt) > 0)) {
            max += 1;
            p.savedAt = max;
        }
        if (!p.id) {
            p.id = 'purch_' + p.savedAt;
        }
    });
    return list;
}

export function savePurchase(e) {
    e.preventDefault();
    const formPurchId = document.getElementById('purchaseForm')?.dataset.purchaseId || '';
    let idx = parseInt(document.getElementById('purchIndex')?.value);
    if (formPurchId) {
        const foundIdx = state.purchases.findIndex(p => p && String(p.id) === formPurchId);
        if (foundIdx >= 0) idx = foundIdx;
    }
    const isEdit = idx >= 0 && state.purchases[idx];

    const entryType = document.getElementById('purchaseEntryType').value;
    const stockId = entryType === 'stock' ? document.getElementById('purchaseStockSelect').value : '';
    const selectedProduct = stockId ? state.products.find(p => p.id === stockId) : null;
    const rawMaterial = selectedProduct ? selectedProduct.name : document.getElementById('rawMaterial').value.trim();
    const rawQty = parseFloat(document.getElementById('rawQty').value) || 0;
    const rawUnit = document.getElementById('rawUnit').value;
    const rawBarcode = document.getElementById('rawBarcode').value.trim() || (selectedProduct?.barcode || '');
    const rawCost = parseFloat(document.getElementById('rawCost').value) || 0;
    const paid = parseFloat(document.getElementById('purchasePaid').value) || 0;
    const balance = Math.max(0, rawCost - paid);
    const supplierName = document.getElementById('supplierName').value.trim();
    const supplierMobile = document.getElementById('supplierMobile').value.trim();
    const date = document.getElementById('purchaseDate').value || getTodayPurchaseDate();

    const purchaseId = (isEdit && state.purchases[idx]?.id) || ('purch_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7));
    unmarkIdDeleted(purchaseId);
    const data = {
        id: purchaseId,
        supplierName,
        supplierMobile,
        rawMaterial,
        rawBarcode,
        stockId,
        rawQty,
        rawUnit,
        rawUnitPrice: parseFloat(document.getElementById('rawUnitPrice').value) || 0,
        rawCost,
        paid,
        balance,
        date,
        savedAt: (isEdit && state.purchases[idx]?.savedAt) ? state.purchases[idx].savedAt : Date.now()
    };

    if (isEdit) {
        const old = state.purchases[idx];
        if (old.stockId) {
            const op = state.products.find(p => p.id === old.stockId);
            if (op) op.stock = Math.max(0, (parseFloat(op.stock) || 0) - (parseFloat(old.rawQty) || 0) + (Number(old.returnedQty) || 0));
        }
        if (selectedProduct && rawQty > 0) selectedProduct.stock = (parseFloat(selectedProduct.stock) || 0) + rawQty;
        state.purchases[idx] = { ...old, ...data, returns: Array.isArray(old.returns) ? old.returns : [] };
    } else {
        if (selectedProduct && rawQty > 0) selectedProduct.stock = (parseFloat(selectedProduct.stock) || 0) + rawQty;
        state.purchases.push({ ...data, returns: [] });
    }

    syncToFirebase();
    renderPurchaseSupplierList();
    resetPurchaseForm();
    renderPurchases();
    if (typeof window.renderProducts === 'function') window.renderProducts();
    updateCleaningPurchaseDropdown();
    if (typeof window.renderAccounts === 'function') window.renderAccounts();
    renderPurchaseHistory('cleaning');

    alert(isEdit ? '✅ പർച്ചേസ് വിവരങ്ങൾ വിജയകരമായി അപ്‌ഡേറ്റ് ചെയ്തു!' : '✅ പുതിയ പർച്ചേസ് വിജയകരമായി സേവ് ചെയ്തു!');
    switchPurchaseActionTab('cleaning', 'view');
}

export function editPurchase(identifier) {
    let index = -1;
    if (typeof identifier === 'number') {
        index = identifier;
    } else if (identifier !== undefined && identifier !== null) {
        const idStr = String(identifier).trim();
        index = state.purchases.findIndex(p => p && String(p.id) === idStr);
        if (index === -1 && /^\d+$/.test(idStr)) {
            index = parseInt(idStr, 10);
        }
    }
    if (index < 0 || !state.purchases[index]) {
        alert('Purchase record not found.');
        return;
    }
    const p = state.purchases[index];

    const form = document.getElementById('purchaseForm');
    if (form) form.dataset.purchaseId = p.id || '';
    document.getElementById('purchIndex').value = index;

    document.getElementById('supplierName').value = p.supplierName || '';
    document.getElementById('supplierMobile').value = p.supplierMobile || '';
    document.getElementById('purchaseDate').value = p.date || getTodayPurchaseDate();

    if (p.stockId && state.products.some(x => x && x.id === p.stockId)) {
        document.getElementById('purchaseEntryType').value = 'stock';
        togglePurchaseInputs();
        const sel = document.getElementById('purchaseStockSelect');
        if (sel) sel.value = p.stockId;
    } else {
        document.getElementById('purchaseEntryType').value = 'manual';
        togglePurchaseInputs();
        document.getElementById('rawMaterial').value = p.rawMaterial || '';
    }

    document.getElementById('rawBarcode').value = p.rawBarcode || '';
    document.getElementById('rawQty').value = p.rawQty ?? '';
    document.getElementById('rawUnit').value = p.rawUnit || '';
    document.getElementById('rawUnitPrice').value = p.rawUnitPrice ?? '';
    document.getElementById('rawCost').value = p.rawCost ?? '';
    document.getElementById('purchasePaid').value = p.paid ?? '';
    document.getElementById('purchaseBalance').value = p.balance ?? '';

    document.getElementById('purchaseFormTitle').innerText = '✏️ Edit Cleaning Products Purchase';
    document.getElementById('purchSubmitBtn').innerText = 'Update Purchase';

    if (typeof window.switchTab === 'function') window.switchTab('purchase', false);
    if (typeof window.switchPurchaseSubTab === 'function') window.switchPurchaseSubTab('cleaning');
    switchPurchaseActionTab('cleaning', 'add');

    const formCard = document.getElementById('purchaseAddContent');
    if (formCard) formCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export function deletePurchase(identifier) {
    let index = -1;
    if (typeof identifier === 'number') {
        index = identifier;
    } else if (identifier !== undefined && identifier !== null) {
        const idStr = String(identifier).trim();
        index = state.purchases.findIndex(p => p && String(p.id) === idStr);
        if (index === -1 && /^\d+$/.test(idStr)) {
            index = parseInt(idStr, 10);
        }
    }
    if (index < 0 || !state.purchases[index]) return;
    if (!confirm('Delete this purchase?')) return;
    const old = state.purchases[index];
    if (old.id) markIdDeleted(old.id);
    if (old.stockId) {
        const op = state.products.find(p => p.id === old.stockId);
        if (op) op.stock = Math.max(0, (parseFloat(op.stock) || 0) - (parseFloat(old.rawQty) || 0) + (Number(old.returnedQty) || 0));
    }
    state.purchases.splice(index, 1);
    syncToFirebase();
    if (typeof window.renderAll === 'function') window.renderAll();
}

export function renderPurchases() {
    ensurePurchaseTimestamps(state.purchases);
    const q = (document.getElementById('purchaseSearch')?.value || '').trim().toLowerCase();
    const sorted = state.purchases.map((p, i) => ({ ...p, _originalIndex: i })).filter(p => !q || [p.supplierName, p.supplierMobile, p.rawMaterial, p.rawBarcode].some(v => String(v || '').toLowerCase().includes(q))).sort((a, b) => dateSortValue(b.date) - dateSortValue(a.date) || (Number(b.savedAt) || 0) - (Number(a.savedAt) || 0) || b._originalIndex - a._originalIndex);
    const container = document.getElementById('purchaseListContainer');
    if (container) {
        container.innerHTML = '<div class="text-[10px] text-slate-500 text-right mb-1">Latest Purchase First</div>' + sorted.map(p => `
            <div class="bg-slate-950/60 p-3 rounded-xl border border-slate-800 flex flex-col sm:flex-row justify-between gap-2 text-xs">
                <div>
                    <span class="font-bold text-blue-300">${p.supplierName} - ${p.rawMaterial}</span>
                    <p class="text-slate-400">📞 ${p.supplierMobile || 'No mobile'} | ${formatDateDDMMYYYY(p.date)} | Qty: ${p.rawQty} ${p.rawUnit || ''} | Total: ₹${p.rawCost} | Return: ${p.returnedQty || 0} ${p.rawUnit || ''} | Net: ₹${Number(p.netPurchaseAmount ?? p.rawCost ?? 0).toFixed(2)} | <span class="text-rose-400">Bal: ₹${Number(p.netBalance ?? p.balance ?? 0).toFixed(2)}</span></p>
                </div>
                <div class="flex flex-wrap gap-1 shrink-0">
                    <button type="button" onclick="viewPurchase('${p.id || p._originalIndex}')" class="bg-blue-900 text-blue-200 px-2.5 py-1.5 rounded-lg font-semibold">View</button>
                    <button type="button" onclick="editPurchase('${p.id || p._originalIndex}')" class="bg-slate-800 text-amber-400 px-2.5 py-1.5 rounded-lg font-semibold hover:bg-slate-700">✎ Edit</button>
                    <button type="button" onclick="deletePurchase('${p.id || p._originalIndex}')" class="bg-red-900 text-red-200 px-2.5 py-1.5 rounded-lg font-semibold hover:bg-red-800">Delete</button>
                </div>
            </div>`).join('') || '<p class="text-xs text-slate-500 text-center">No purchases found.</p>';
    }
    renderPurchaseReturnSelectors();
    renderPurchaseReturnHistory();
}

export function resetPurchaseForm() {
    const f = document.getElementById('purchaseForm');
    if (f) {
        f.reset();
        delete f.dataset.purchaseId;
    }
    document.getElementById('purchIndex').value = '-1';
    document.getElementById('purchaseFormTitle').innerText = 'Cleaning Products Purchase';
    document.getElementById('purchSubmitBtn').innerText = 'Save Purchase';
    document.getElementById('purchaseDate').value = getTodayPurchaseDate();
    document.getElementById('purchaseEntryType').value = 'stock';
    togglePurchaseInputs();
    calculatePurchaseBalance();
    updateCleaningPurchaseDropdown();
}

export function renderPurchaseReturnSelectors() {
    const el = document.getElementById('purchaseReturnSelect');
    if (!el) return;
    el.innerHTML = '<option value="">-- Select Purchase --</option>' + state.purchases.map((p, i) => `<option value="${i}">${formatDateDDMMYYYY(p.date)} • ${p.supplierName} • ${p.rawMaterial} • Qty ${p.rawQty}</option>`).join('');
    const d = document.getElementById('purchaseReturnDate');
    if (d && !d.value) d.value = getTodayPurchaseDate();
}

export function fillPurchaseReturnDetails() {
    const i = parseInt(document.getElementById('purchaseReturnSelect').value);
    const p = state.purchases[i];
    const info = document.getElementById('purchaseReturnInfo');
    if (info) {
        info.textContent = p ? `Supplier: ${p.supplierName} | Mobile: ${p.supplierMobile || '—'} | Available return: ${Math.max(0, Number(p.rawQty || 0) - Number(p.returnedQty || 0))} ${p.rawUnit || ''}` : 'Select a purchase to return.';
    }
}

export function savePurchaseReturn(type) {
    const isCos = type === 'cosmetics';
    const sel = document.getElementById(isCos ? 'cosPurchaseReturnSelect' : 'purchaseReturnSelect');
    const i = parseInt(sel?.value);
    const arr = isCos ? state.cosPurchases : state.purchases;
    const p = arr[i];
    if (!p) { alert('Select a purchase.'); return; }
    const qtyEl = document.getElementById(isCos ? 'cosPurchaseReturnQty' : 'purchaseReturnQty');
    const qty = parseFloat(qtyEl?.value) || 0;
    const already = Number(p.returnedQty) || 0;
    const originalQty = Number(isCos ? p.qty : p.rawQty) || 0;
    const max = Math.max(0, originalQty - already);
    if (qty <= 0 || qty > max) { alert(`Enter a return quantity up to ${max}.`); return; }
    const productId = p.stockId;
    const unit = isCos ? p.unit : p.rawUnit;
    const unitPrice = Number(isCos ? (p.amount / (Number(p.qty) || 1)) : (p.rawUnitPrice || ((Number(p.rawCost) || 0) / (Number(p.rawQty) || 1)))) || 0;
    const ret = {
        qty,
        date: document.getElementById(isCos ? 'cosPurchaseReturnDate' : 'purchaseReturnDate').value || getTodayPurchaseDate(),
        reason: document.getElementById(isCos ? 'cosPurchaseReturnReason' : 'purchaseReturnReason').value.trim(),
        amount: Number((qty * unitPrice).toFixed(2)),
        savedAt: Date.now()
    };
    p.returns = [...(Array.isArray(p.returns) ? p.returns : []), ret];
    p.returnedQty = already + qty;
    if (productId) {
        const prod = (isCos ? state.cosProducts : state.products).find(x => x.id === productId);
        if (prod) {
            const before = Number(prod.stock) || 0;
            prod.stock = Math.max(0, before - qty);
            prod.lastPurchaseReturn = { qty, date: ret.date, updatedAt: Date.now() };
        }
    }
    p.returnedAmount = Number(((Number(p.returnedAmount) || 0) + ret.amount).toFixed(2));
    p.netPurchaseAmount = Math.max(0, (Number(isCos ? p.amount : p.rawCost) || 0) - p.returnedAmount);
    p.netBalance = Math.max(0, p.netPurchaseAmount - (Number(p.paid) || 0));
    syncToFirebase();
    renderPurchases();
    renderCosPurchases();
    if (typeof window.renderProducts === 'function') window.renderProducts();
    if (typeof window.renderCosProductStock === 'function') window.renderCosProductStock();
    updateCleaningPurchaseDropdown();
    if (typeof window.updateCosProductDropdowns === 'function') window.updateCosProductDropdowns();
    renderPurchaseReturnSelectors();
    renderCosPurchaseReturnSelectors();
    renderPurchaseReturnHistory();
    renderCosPurchaseReturnHistory();
    renderPurchaseHistory(type);
    if (typeof window.renderAccounts === 'function') window.renderAccounts();
    qtyEl.value = '';
    document.getElementById(isCos ? 'cosPurchaseReturnReason' : 'purchaseReturnReason').value = '';
    alert(`Purchase return saved. ${qty} ${unit || ''} removed from stock.`);
}

export function renderPurchaseReturnHistory() {
    const el = document.getElementById('purchaseReturnHistoryContainer');
    if (!el) return;
    const rows = [];
    state.purchases.forEach((p, i) => (p.returns || []).forEach((r, j) => rows.push({ p, i, r, j })));
    rows.sort((a, b) => (Number(b.r.savedAt) || 0) - (Number(a.r.savedAt) || 0));
    el.innerHTML = rows.map(x => `<div class="bg-slate-950/60 border border-slate-800 rounded-xl p-2 text-[10px]"><b class="text-rose-300">${x.p.supplierName} - ${x.p.rawMaterial}</b><div>${formatDateDDMMYYYY(x.r.date)} | Return: ${x.r.qty} ${x.p.rawUnit || ''} | ${x.r.reason || 'No reason'}</div></div>`).join('') || '<p class="text-xs text-slate-500 text-center">No purchase returns.</p>';
}

export function renderCosPurchaseReturnSelectors() {
    const el = document.getElementById('cosPurchaseReturnSelect');
    if (!el) return;
    el.innerHTML = '<option value="">-- Select Purchase --</option>' + state.cosPurchases.map((p, i) => `<option value="${i}">${formatDateDDMMYYYY(p.date)} • ${p.supplier} • ${p.item} • Qty ${p.qty}</option>`).join('');
    const d = document.getElementById('cosPurchaseReturnDate');
    if (d && !d.value) d.value = getTodayPurchaseDate();
}

export function fillCosPurchaseReturnDetails() {
    const i = parseInt(document.getElementById('cosPurchaseReturnSelect').value);
    const p = state.cosPurchases[i];
    const info = document.getElementById('cosPurchaseReturnInfo');
    if (info) {
        info.textContent = p ? `Supplier: ${p.supplier} | Mobile: ${p.supplierMobile || '—'} | Available return: ${Math.max(0, Number(p.qty || 0) - Number(p.returnedQty || 0))} ${p.unit || ''}` : 'Select a purchase to return.';
    }
}

export function renderCosPurchaseReturnHistory() {
    const el = document.getElementById('cosPurchaseReturnHistoryContainer');
    if (!el) return;
    const rows = [];
    state.cosPurchases.forEach((p, i) => (p.returns || []).forEach((r, j) => rows.push({ p, i, r, j })));
    rows.sort((a, b) => (Number(b.r.savedAt) || 0) - (Number(a.r.savedAt) || 0));
    el.innerHTML = rows.map(x => `<div class="bg-slate-950/60 border border-slate-800 rounded-xl p-2 text-[10px]"><b class="text-rose-300">${x.p.supplier} - ${x.p.item}</b><div>${formatDateDDMMYYYY(x.r.date)} | Return: ${x.r.qty} ${x.p.unit || ''} | ${x.r.reason || 'No reason'}</div></div>`).join('') || '<p class="text-xs text-slate-500 text-center">No purchase returns.</p>';
}

export function renderPurchaseHistory(type) {
    const isCos = type === 'cosmetics';
    const arr = isCos ? state.cosPurchases : state.purchases;
    const sel = document.getElementById(isCos ? 'cosPurchaseHistorySupplier' : 'purchaseHistorySupplier');
    const container = document.getElementById(isCos ? 'cosPurchaseHistoryContainer' : 'purchaseHistoryContainer');
    if (!container) return;
    const q = (sel?.value || '').toLowerCase();
    const rows = arr.map((p, i) => ({
        ...p,
        _i: i,
        _supplier: isCos ? p.supplier : p.supplierName,
        _item: isCos ? p.item : p.rawMaterial,
        _qty: isCos ? p.qty : p.rawQty,
        _unit: isCos ? p.unit : p.rawUnit,
        _amount: isCos ? p.amount : p.rawCost,
        _paid: p.paid,
        _balance: p.balance
    })).filter(p => !q || String(p._supplier || '').toLowerCase() === q).sort((a, b) => dateSortValue(b.date) - dateSortValue(a.date) || (Number(b.savedAt) || 0) - (Number(a.savedAt) || 0));
    container.innerHTML = rows.map(p => `
        <div class="bg-slate-950/60 p-3 rounded-xl border border-slate-800 text-xs flex flex-col sm:flex-row justify-between gap-2 items-start">
            <div>
                <div class="font-bold ${isCos ? 'text-pink-300' : 'text-blue-300'}">${p._supplier} — ${p._item}</div>
                <div class="text-slate-400 mt-1">${formatDateDDMMYYYY(p.date)} | Qty: ${p._qty} ${p._unit || ''} | Total: ₹${Number(p._amount || 0).toFixed(2)} | Paid: ₹${Number(p._paid || 0).toFixed(2)} | Balance: ₹${Number(p._balance || 0).toFixed(2)}</div>
            </div>
            <div class="flex gap-1 shrink-0">
                <button type="button" onclick="${isCos ? 'editCosPurchase' : 'editPurchase'}('${p.id || p._i}')" class="bg-slate-800 text-amber-400 px-2.5 py-1.5 rounded-lg text-xs font-semibold hover:bg-slate-700">✎ Edit</button>
                <button type="button" onclick="${isCos ? 'deleteCosPurchase' : 'deletePurchase'}('${p.id || p._i}')" class="bg-red-900 text-red-200 px-2.5 py-1.5 rounded-lg text-xs font-semibold hover:bg-red-800">Delete</button>
            </div>
        </div>`).join('') || '<p class="text-xs text-slate-500 text-center">No purchase history found.</p>';
}

export function toggleCosPurchaseInputs() {
    const type = document.getElementById('cosPurchaseEntryType')?.value;
    const stockGroup = document.getElementById('cosPurchaseStockGroup');
    const manualGroup = document.getElementById('cosPurchaseManualGroup');
    if (type === 'stock') {
        if (stockGroup) stockGroup.style.display = 'block';
        if (manualGroup) manualGroup.style.display = 'none';
    } else {
        if (stockGroup) stockGroup.style.display = 'none';
        if (manualGroup) manualGroup.style.display = 'block';
        const upEl = document.getElementById('cosPUnitPrice');
        if (upEl) upEl.value = '';
    }
    calculateCosPurchaseTotal();
}

export function fillCosPurchaseStockDetails() {
    const select = document.getElementById('cosPurchaseStockSelect');
    if (!select) return;
    const opt = select.options[select.selectedIndex];
    const price = opt?.getAttribute('data-price');
    const unit = opt?.getAttribute('data-unit');
    if (price && document.getElementById('cosPUnitPrice')) document.getElementById('cosPUnitPrice').value = price;
    if (unit && document.getElementById('cosPUnit')) document.getElementById('cosPUnit').value = unit;
    calculateCosPurchaseTotal();
}

export function calculateCosPurchaseTotal() {
    const qty = parseFloat(document.getElementById('cosPQty')?.value) || 0;
    const unitPrice = parseFloat(document.getElementById('cosPUnitPrice')?.value) || 0;
    const total = qty * unitPrice;
    if (unitPrice > 0 && document.getElementById('cosPAmount')) document.getElementById('cosPAmount').value = total.toFixed(2);
    calculateCosPurchaseBalance();
}

export function calculateCosPurchaseBalance() {
    const total = parseFloat(document.getElementById('cosPAmount')?.value) || 0;
    const paid = parseFloat(document.getElementById('cosPPaid')?.value) || 0;
    const balance = total - paid;
    const bEl = document.getElementById('cosPBalance');
    if (bEl) bEl.value = balance > 0 ? balance.toFixed(2) : 0;
}

export function saveCosPurchase(e) {
    e.preventDefault();
    const formCosId = document.getElementById('cosPurchaseForm')?.dataset.purchaseId || '';
    let idx = parseInt(document.getElementById('cosPIndex')?.value);
    if (formCosId) {
        const foundIdx = state.cosPurchases.findIndex(p => p && String(p.id) === formCosId);
        if (foundIdx >= 0) idx = foundIdx;
    }
    const isEdit = idx >= 0 && state.cosPurchases[idx];

    const barcode = document.getElementById('cosPBarcode')?.value.trim() || '';
    const entryType = document.getElementById('cosPurchaseEntryType').value;
    const stockId = entryType === 'stock' ? document.getElementById('cosPurchaseStockSelect').value : '';
    const selectedProduct = stockId ? state.cosProducts.find(p => p.id === stockId) : null;
    const item = selectedProduct ? selectedProduct.name : document.getElementById('cosPItem').value.trim();
    const supplier = document.getElementById('cosPSupplier').value.trim();
    const supplierMobile = document.getElementById('cosPSupplierMobile').value.trim();
    const finalBarcode = barcode || (selectedProduct?.barcode || '');
    const qty = parseFloat(document.getElementById('cosPQty').value) || 0;
    const unit = document.getElementById('cosPUnit').value;
    const amount = parseFloat(document.getElementById('cosPAmount').value) || 0;
    const unitPrice = parseFloat(document.getElementById('cosPUnitPrice')?.value) || (qty > 0 ? Number((amount / qty).toFixed(2)) : 0);
    const paid = parseFloat(document.getElementById('cosPPaid').value) || 0;
    const balance = Math.max(0, amount - paid);
    const date = document.getElementById('cosPurchaseDate').value || getTodayPurchaseDate();

    const cosPId = (isEdit && state.cosPurchases[idx]?.id) || ('cospurch_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7));
    unmarkIdDeleted(cosPId);

    const data = {
        id: cosPId,
        supplier,
        supplierMobile,
        item,
        stockId,
        barcode: finalBarcode,
        qty,
        unit,
        unitPrice,
        amount,
        paid,
        balance,
        date,
        savedAt: (isEdit && state.cosPurchases[idx]?.savedAt) ? state.cosPurchases[idx].savedAt : Date.now()
    };

    if (isEdit) {
        const old = state.cosPurchases[idx];
        if (old.stockId) {
            const op = state.cosProducts.find(p => p.id === old.stockId);
            if (op) op.stock = Math.max(0, (parseFloat(op.stock) || 0) - (parseFloat(old.qty) || 0) + (Number(old.returnedQty) || 0));
        }
        if (selectedProduct && qty > 0) selectedProduct.stock = (parseFloat(selectedProduct.stock) || 0) + qty;
        state.cosPurchases[idx] = { ...old, ...data, returns: Array.isArray(old.returns) ? old.returns : [] };
    } else {
        if (selectedProduct && qty > 0) selectedProduct.stock = (parseFloat(selectedProduct.stock) || 0) + qty;
        state.cosPurchases.push({ ...data, returns: [] });
    }

    syncToFirebase();
    renderPurchaseSupplierList();
    resetCosPurchaseForm();
    renderCosPurchases();
    if (typeof window.renderCosProductStock === 'function') window.renderCosProductStock();
    if (typeof window.updateCosProductDropdowns === 'function') window.updateCosProductDropdowns();
    if (typeof window.renderCosmeticsSummary === 'function') window.renderCosmeticsSummary();
    if (typeof window.renderAccounts === 'function') window.renderAccounts();
    renderPurchaseHistory('cosmetics');

    alert(isEdit ? '✅ കോസ്മെറ്റിക്സ് പർച്ചേസ് വിവരങ്ങൾ വിജയകരമായി അപ്‌ഡേറ്റ് ചെയ്തു!' : '✅ പുതിയ കോസ്മെറ്റിക്സ് പർച്ചേസ് വിജയകരമായി സേവ് ചെയ്തു!');
    switchPurchaseActionTab('cosmetics', 'view');
}

export function viewPurchase(identifier) {
    let index = -1;
    if (typeof identifier === 'number') {
        index = identifier;
    } else if (identifier !== undefined && identifier !== null) {
        const idStr = String(identifier).trim();
        index = state.purchases.findIndex(p => p && String(p.id) === idStr);
        if (index === -1 && /^\d+$/.test(idStr)) {
            index = parseInt(idStr, 10);
        }
    }
    if (index < 0 || !state.purchases[index]) return;
    const p = state.purchases[index];
    const safeId = String(p.id || index).replace(/'/g, "\\'");
    if (typeof window.showRecordView === 'function') {
        window.showRecordView('Cleaning Purchase Details', `
            <div class="space-y-2">
                <p><b>Supplier:</b> ${p.supplierName}</p>
                <p><b>Mobile:</b> ${p.supplierMobile || '—'}</p>
                <p><b>Product:</b> ${p.rawMaterial}</p>
                <p><b>Barcode:</b> ${p.rawBarcode || '—'}</p>
                <p><b>Quantity:</b> ${p.rawQty} ${p.rawUnit || ''}</p>
                <p><b>Unit Price:</b> ₹${Number(p.rawUnitPrice || 0).toFixed(2)}</p>
                <p><b>Total:</b> ₹${Number(p.rawCost || 0).toFixed(2)}</p>
                <p><b>Paid:</b> ₹${Number(p.paid || 0).toFixed(2)}</p>
                <p><b>Balance:</b> ₹${Number(p.balance || 0).toFixed(2)}</p>
                <p><b>Date:</b> ${formatDateDDMMYYYY(p.date)}</p>
            </div>
            <div class="flex gap-2 pt-4 border-t border-slate-800 mt-4 justify-end">
                <button type="button" onclick="closeRecordView(); editPurchase('${safeId}');" class="bg-slate-800 text-amber-400 px-3 py-1.5 rounded-lg border border-slate-700 font-bold hover:bg-slate-700">✎ Edit</button>
                <button type="button" onclick="closeRecordView(); deletePurchase('${safeId}');" class="bg-red-900 text-red-200 px-3 py-1.5 rounded-lg font-bold hover:bg-red-800">Delete</button>
            </div>
        `);
    }
}

export function viewCosPurchase(identifier) {
    let index = -1;
    if (typeof identifier === 'number') {
        index = identifier;
    } else if (identifier !== undefined && identifier !== null) {
        const idStr = String(identifier).trim();
        index = state.cosPurchases.findIndex(p => p && String(p.id) === idStr);
        if (index === -1 && /^\d+$/.test(idStr)) {
            index = parseInt(idStr, 10);
        }
    }
    if (index < 0 || !state.cosPurchases[index]) return;
    const p = state.cosPurchases[index];
    const safeId = String(p.id || index).replace(/'/g, "\\'");
    if (typeof window.showRecordView === 'function') {
        window.showRecordView('Cosmetics Purchase Details', `
            <div class="space-y-2">
                <p><b>Supplier:</b> ${p.supplier}</p>
                <p><b>Mobile:</b> ${p.supplierMobile || '—'}</p>
                <p><b>Item:</b> ${p.item}</p>
                <p><b>Barcode:</b> ${p.barcode || '—'}</p>
                <p><b>Qty:</b> ${p.qty} ${p.unit || ''}</p>
                <p><b>Unit Price:</b> ₹${Number(p.unitPrice || (p.qty ? p.amount / p.qty : 0)).toFixed(2)}</p>
                <p><b>Total:</b> ₹${Number(p.amount || 0).toFixed(2)}</p>
                <p><b>Paid:</b> ₹${Number(p.paid || 0).toFixed(2)}</p>
                <p><b>Balance:</b> ₹${Number(p.balance || 0).toFixed(2)}</p>
                <p><b>Date:</b> ${formatDateDDMMYYYY(p.date)}</p>
            </div>
            <div class="flex gap-2 pt-4 border-t border-slate-800 mt-4 justify-end">
                <button type="button" onclick="closeRecordView(); editCosPurchase('${safeId}');" class="bg-slate-800 text-amber-400 px-3 py-1.5 rounded-lg border border-slate-700 font-bold hover:bg-slate-700">✎ Edit</button>
                <button type="button" onclick="closeRecordView(); deleteCosPurchase('${safeId}');" class="bg-red-900 text-red-200 px-3 py-1.5 rounded-lg font-bold hover:bg-red-800">Delete</button>
            </div>
        `);
    }
}

export function editCosPurchase(identifier) {
    let index = -1;
    if (typeof identifier === 'number') {
        index = identifier;
    } else if (identifier !== undefined && identifier !== null) {
        const idStr = String(identifier).trim();
        index = state.cosPurchases.findIndex(p => p && String(p.id) === idStr);
        if (index === -1 && /^\d+$/.test(idStr)) {
            index = parseInt(idStr, 10);
        }
    }
    if (index < 0 || !state.cosPurchases[index]) {
        alert('Cosmetics purchase record not found.');
        return;
    }
    const p = state.cosPurchases[index];

    const form = document.getElementById('cosPurchaseForm');
    if (form) form.dataset.purchaseId = p.id || '';
    document.getElementById('cosPIndex').value = index;

    document.getElementById('cosPSupplier').value = p.supplier || '';
    document.getElementById('cosPSupplierMobile').value = p.supplierMobile || '';
    document.getElementById('cosPurchaseDate').value = p.date || getTodayPurchaseDate();

    if (p.stockId && state.cosProducts.some(x => x && x.id === p.stockId)) {
        document.getElementById('cosPurchaseEntryType').value = 'stock';
        toggleCosPurchaseInputs();
        const sel = document.getElementById('cosPurchaseStockSelect');
        if (sel) sel.value = p.stockId;
    } else {
        document.getElementById('cosPurchaseEntryType').value = 'manual';
        toggleCosPurchaseInputs();
        document.getElementById('cosPItem').value = p.item || '';
    }

    document.getElementById('cosPBarcode').value = p.barcode || '';
    document.getElementById('cosPQty').value = p.qty ?? '';
    document.getElementById('cosPUnit').value = p.unit || '';
    const unitPrice = p.unitPrice ?? (p.qty ? (Number(p.amount || 0) / Number(p.qty)).toFixed(2) : '');
    const upEl = document.getElementById('cosPUnitPrice');
    if (upEl) upEl.value = unitPrice;
    document.getElementById('cosPAmount').value = p.amount ?? '';
    document.getElementById('cosPPaid').value = p.paid ?? '';
    document.getElementById('cosPBalance').value = p.balance ?? '';

    document.getElementById('cosPFormTitle').innerText = '✏️ Edit Cosmetics Purchase';
    document.getElementById('cosPSubmitBtn').innerText = 'Update Purchase';

    if (typeof window.switchTab === 'function') window.switchTab('purchase', false);
    if (typeof window.switchPurchaseSubTab === 'function') window.switchPurchaseSubTab('cosmetics');
    switchPurchaseActionTab('cosmetics', 'add');

    const formCard = document.getElementById('cosPurchaseAddContent');
    if (formCard) formCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export function deleteCosPurchase(identifier) {
    let index = -1;
    if (typeof identifier === 'number') {
        index = identifier;
    } else if (identifier !== undefined && identifier !== null) {
        const idStr = String(identifier).trim();
        index = state.cosPurchases.findIndex(p => p && String(p.id) === idStr);
        if (index === -1 && /^\d+$/.test(idStr)) {
            index = parseInt(idStr, 10);
        }
    }
    if (index < 0 || !state.cosPurchases[index]) return;
    if (!confirm('Delete this cosmetics purchase?')) return;
    const old = state.cosPurchases[index];
    if (old.id) markIdDeleted(old.id);
    if (old.stockId) {
        const op = state.cosProducts.find(p => p.id === old.stockId);
        if (op) op.stock = Math.max(0, (parseFloat(op.stock) || 0) - (parseFloat(old.qty) || 0) + (Number(old.returnedQty) || 0));
    }
    state.cosPurchases.splice(index, 1);
    syncToFirebase();
    if (typeof window.renderAll === 'function') window.renderAll();
}

export function renderCosPurchases() {
    ensurePurchaseTimestamps(state.cosPurchases);
    const q = (document.getElementById('cosPurchaseSearch')?.value || '').trim().toLowerCase();
    const sorted = state.cosPurchases.map((p, i) => ({ ...p, _originalIndex: i })).filter(p => !q || [p.supplier, p.supplierMobile, p.item, p.barcode].some(v => String(v || '').toLowerCase().includes(q))).sort((a, b) => dateSortValue(b.date) - dateSortValue(a.date) || (Number(b.savedAt) || 0) - (Number(a.savedAt) || 0) || b._originalIndex - a._originalIndex);
    const container = document.getElementById('cosPurchaseListContainer');
    if (container) {
        container.innerHTML = '<div class="text-[10px] text-slate-500 text-right mb-1">Latest Purchase First</div>' + sorted.map(p => `
            <div class="bg-slate-950/60 p-3 rounded-xl border border-slate-800 flex flex-col sm:flex-row justify-between gap-2 items-start text-xs">
                <div>
                    <span class="font-bold text-pink-300">${p.supplier} - ${p.item}</span>
                    <p class="text-slate-400">📞 ${p.supplierMobile || 'No mobile'} | ${formatDateDDMMYYYY(p.date)} | Qty: ${p.qty} ${p.unit || ''} | Total: ₹${p.amount} | Return: ${p.returnedQty || 0} ${p.unit || ''} | Net: ₹${Number(p.netPurchaseAmount ?? p.amount ?? 0).toFixed(2)} | <span class="text-rose-400">Bal: ₹${Number(p.netBalance ?? p.balance ?? 0).toFixed(2)}</span></p>
                </div>
                <div class="flex flex-wrap gap-1 shrink-0">
                    <button type="button" onclick="viewCosPurchase('${p.id || p._originalIndex}')" class="bg-blue-900 text-blue-200 px-2.5 py-1.5 rounded-lg font-semibold">View</button>
                    <button type="button" onclick="editCosPurchase('${p.id || p._originalIndex}')" class="bg-slate-800 text-amber-400 px-2.5 py-1.5 rounded-lg font-semibold hover:bg-slate-700">✎ Edit</button>
                    <button type="button" onclick="deleteCosPurchase('${p.id || p._originalIndex}')" class="bg-red-900 text-red-200 px-2.5 py-1.5 rounded-lg font-semibold hover:bg-red-800">Delete</button>
                </div>
            </div>`).join('') || '<p class="text-xs text-slate-500 text-center">No cosmetics purchases found.</p>';
    }
    renderCosPurchaseReturnSelectors();
    renderCosPurchaseReturnHistory();
}

export function resetCosPurchaseForm() {
    const f = document.getElementById('cosPurchaseForm');
    if (f) {
        f.reset();
        delete f.dataset.purchaseId;
    }
    document.getElementById('cosPIndex').value = '-1';
    document.getElementById('cosPFormTitle').innerText = 'Cosmetics Purchase Entry';
    document.getElementById('cosPSubmitBtn').innerText = 'Save Purchase';
    document.getElementById('cosPurchaseDate').value = getTodayPurchaseDate();
    document.getElementById('cosPurchaseEntryType').value = 'stock';
    toggleCosPurchaseInputs();
}

export function switchPurchaseSubTab(tab) {
    const cleaning = document.getElementById('purchaseCleaningContent');
    const cosmetics = document.getElementById('purchaseCosmeticsContent');
    const b1 = document.getElementById('subTabPurchaseCleaning');
    const b2 = document.getElementById('subTabPurchaseCosmetics');
    const ct = document.getElementById('purchaseActionTabsCleaning');
    const xt = document.getElementById('purchaseActionTabsCosmetics');
    [cleaning, cosmetics].forEach(el => el && el.classList.add('hidden'));
    [ct, xt].forEach(el => el && el.classList.add('hidden'));
    [b1, b2].forEach(btn => {
        if (btn) {
            btn.classList.remove('bg-blue-700', 'bg-pink-700', 'text-white', 'shadow-md');
            btn.classList.add('text-slate-400');
        }
    });
    if (tab === 'cosmetics') {
        cosmetics?.classList.remove('hidden');
        xt?.classList.remove('hidden');
        b2?.classList.add('bg-pink-700', 'text-white', 'shadow-md');
        b2?.classList.remove('text-slate-400');
        renderCosPurchases();
        if (typeof window.updateCosProductDropdowns === 'function') window.updateCosProductDropdowns();
        switchPurchaseActionTab('cosmetics', window.purchaseActionCosmetics || 'add');
    } else {
        cleaning?.classList.remove('hidden');
        ct?.classList.remove('hidden');
        b1?.classList.add('bg-blue-700', 'text-white', 'shadow-md');
        b1?.classList.remove('text-slate-400');
        renderPurchases();
        switchPurchaseActionTab('cleaning', window.purchaseActionCleaning || 'add');
    }
    renderPurchaseSupplierList();
}

export function switchPurchaseActionTab(type, tab) {
    window['purchaseAction' + (type === 'cosmetics' ? 'Cosmetics' : 'Cleaning')] = tab;
    const prefix = type === 'cosmetics' ? 'Cosmetics' : 'Cleaning';
    const ids = ['add', 'view', 'return', 'history'];
    ids.forEach(t => {
        const b = document.getElementById('purchaseAction' + prefix + t.charAt(0).toUpperCase() + t.slice(1));
        if (b) {
            b.classList.remove('bg-blue-700', 'bg-pink-700', 'text-white', 'shadow-md');
            b.classList.add('text-slate-400');
        }
    });
    const active = document.getElementById('purchaseAction' + prefix + tab.charAt(0).toUpperCase() + tab.slice(1));
    if (active) {
        active.classList.add(type === 'cosmetics' ? 'bg-pink-700' : 'bg-blue-700', 'text-white', 'shadow-md');
        active.classList.remove('text-slate-400');
    }
    const blocks = type === 'cosmetics' ?
        { add: 'cosPurchaseAddContent', view: 'cosPurchaseViewContent', return: 'cosPurchaseReturnContent', history: 'cosPurchaseHistoryContent' } :
        { add: 'purchaseAddContent', view: 'purchaseViewContent', return: 'purchaseReturnContent', history: 'purchaseHistoryContent' };
    Object.values(blocks).forEach(id => document.getElementById(id)?.classList.add('hidden'));
    document.getElementById(blocks[tab])?.classList.remove('hidden');
    const supplierCard = document.querySelector('#sectionPurchase > div:nth-of-type(2)');
    if (supplierCard) supplierCard.classList.toggle('hidden', tab !== 'add');
    if (tab === 'view') {
        if (type === 'cosmetics') renderCosPurchases(); else renderPurchases();
    } else if (tab === 'return') {
        if (type === 'cosmetics') {
            if (typeof renderCosPurchaseReturnSelectors === 'function') renderCosPurchaseReturnSelectors();
        } else {
            if (typeof renderPurchaseReturnSelectors === 'function') renderPurchaseReturnSelectors();
        }
    } else if (tab === 'history') {
        if (typeof renderPurchaseHistory === 'function') renderPurchaseHistory(type);
    }
}

// Global window bindings for HTML inline onclick attributes
if (typeof window !== 'undefined') {
    window.switchPurchaseSubTab = switchPurchaseSubTab;
    window.switchPurchaseActionTab = switchPurchaseActionTab;
    window.getTodayPurchaseDate = getTodayPurchaseDate;
    window.loadPurchaseSuppliers = loadPurchaseSuppliers;
    window.renderPurchaseSupplierList = renderPurchaseSupplierList;
    window.findPurchaseSupplier = findPurchaseSupplier;
    window.fillPurchaseSupplierMobile = fillPurchaseSupplierMobile;
    window.fillCosPurchaseSupplierMobile = fillCosPurchaseSupplierMobile;
    window.selectPurchaseSupplier = selectPurchaseSupplier;
    window.addPurchaseSupplier = addPurchaseSupplier;
    window.updateCleaningPurchaseDropdown = updateCleaningPurchaseDropdown;
    window.togglePurchaseInputs = togglePurchaseInputs;
    window.fillPurchaseStockDetails = fillPurchaseStockDetails;
    window.calculatePurchaseTotal = calculatePurchaseTotal;
    window.calculatePurchaseBalance = calculatePurchaseBalance;
    window.ensurePurchaseTimestamps = ensurePurchaseTimestamps;
    window.savePurchase = savePurchase;
    window.editPurchase = editPurchase;
    window.deletePurchase = deletePurchase;
    window.renderPurchases = renderPurchases;
    window.resetPurchaseForm = resetPurchaseForm;
    window.renderPurchaseReturnSelectors = renderPurchaseReturnSelectors;
    window.fillPurchaseReturnDetails = fillPurchaseReturnDetails;
    window.savePurchaseReturn = savePurchaseReturn;
    window.renderPurchaseReturnHistory = renderPurchaseReturnHistory;
    window.renderCosPurchaseReturnSelectors = renderCosPurchaseReturnSelectors;
    window.fillCosPurchaseReturnDetails = fillCosPurchaseReturnDetails;
    window.renderCosPurchaseReturnHistory = renderCosPurchaseReturnHistory;
    window.renderPurchaseHistory = renderPurchaseHistory;
    window.toggleCosPurchaseInputs = toggleCosPurchaseInputs;
    window.fillCosPurchaseStockDetails = fillCosPurchaseStockDetails;
    window.calculateCosPurchaseTotal = calculateCosPurchaseTotal;
    window.calculateCosPurchaseBalance = calculateCosPurchaseBalance;
    window.saveCosPurchase = saveCosPurchase;
    window.viewPurchase = viewPurchase;
    window.viewCosPurchase = viewCosPurchase;
    window.editCosPurchase = editCosPurchase;
    window.deleteCosPurchase = deleteCosPurchase;
    window.renderCosPurchases = renderCosPurchases;
    window.resetCosPurchaseForm = resetCosPurchaseForm;
    window.switchPurchaseSubTab = switchPurchaseSubTab;
    window.switchPurchaseActionTab = switchPurchaseActionTab;
}
