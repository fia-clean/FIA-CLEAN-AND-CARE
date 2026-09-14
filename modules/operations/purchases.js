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
    todayDDMMYYYY,
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
                    <button type="button" onclick="viewPurchase('${p.id || p._originalIndex}')" class="bg-blue-900 text-blue-200 px-2.5 py-1.5 rounded-lg font-semibold hover:bg-blue-800 transition">View</button>
                    <button type="button" onclick="editPurchase('${p.id || p._originalIndex}')" class="bg-slate-800 text-amber-400 px-2.5 py-1.5 rounded-lg font-semibold hover:bg-slate-700 transition">✎ Edit</button>
                    <button type="button" onclick="openPurchaseReturn('${p.id || p._originalIndex}', 'cleaning')" class="bg-rose-900/80 text-rose-200 px-2.5 py-1.5 rounded-lg font-semibold hover:bg-rose-800 transition">↩️ Return</button>
                    <button type="button" onclick="deletePurchase('${p.id || p._originalIndex}')" class="bg-red-900 text-red-200 px-2.5 py-1.5 rounded-lg font-semibold hover:bg-red-800 transition">Delete</button>
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
    const currentVal = el.value;
    const sorted = [...(state.purchases || [])].map((p, i) => ({ ...p, _idx: i })).sort((a, b) => dateSortValue(b.date) - dateSortValue(a.date) || (Number(b.savedAt) || 0) - (Number(a.savedAt) || 0));
    
    let html = '<option value="">-- Select Purchase to Return --</option>';
    sorted.forEach(p => {
        const origQty = Number(p.rawQty || 0);
        const retQty = Number(p.returnedQty || 0);
        const availQty = Math.max(0, origQty - retQty);
        const idVal = String(p.id || p._idx);
        const statusText = availQty > 0 ? `(Avail: ${availQty} ${p.rawUnit || ''})` : `(Fully Returned)`;
        html += `<option value="${idVal}">${formatDateDDMMYYYY(p.date)} • ${p.supplierName} • ${p.rawMaterial} ${statusText}</option>`;
    });
    el.innerHTML = html;
    if (currentVal && sorted.some(p => String(p.id || p._idx) === currentVal)) {
        el.value = currentVal;
    }
    const d = document.getElementById('purchaseReturnDate');
    if (d && !d.value) d.value = getTodayPurchaseDate();
}

export function fillPurchaseReturnDetails() {
    const sel = document.getElementById('purchaseReturnSelect');
    const val = sel?.value;
    const p = state.purchases.find(x => x && (String(x.id) === val || String(state.purchases.indexOf(x)) === val));
    const info = document.getElementById('purchaseReturnInfo');
    const qtyInput = document.getElementById('purchaseReturnQty');
    if (!p) {
        if (info) info.innerHTML = '<span class="text-slate-400">Select a purchase to return.</span>';
        if (qtyInput) { qtyInput.value = ''; qtyInput.removeAttribute('max'); }
        updatePurchaseReturnLiveCalc('cleaning');
        return;
    }
    const origQty = Number(p.rawQty || 0);
    const retQty = Number(p.returnedQty || 0);
    const availQty = Math.max(0, origQty - retQty);
    const unitPrice = Number(p.rawUnitPrice || ((Number(p.rawCost) || 0) / (origQty || 1))) || 0;
    
    if (qtyInput) {
        qtyInput.max = availQty;
        qtyInput.placeholder = `Return Qty (Max: ${availQty} ${p.rawUnit || ''})`;
        if (parseFloat(qtyInput.value) > availQty) qtyInput.value = availQty;
    }
    const d = document.getElementById('purchaseReturnDate');
    if (d && !d.value) d.value = getTodayPurchaseDate();
    
    if (info) {
        info.innerHTML = `
            <div class="bg-slate-900/90 border border-slate-800 rounded-xl p-3 text-xs space-y-1.5 mt-1">
                <div class="flex justify-between items-start">
                    <div>
                        <strong class="text-blue-300 text-sm">${p.supplierName}</strong>
                        <span class="text-slate-400 text-[11px] block">📞 ${p.supplierMobile || 'No mobile'}</span>
                    </div>
                    <span class="text-[11px] px-2 py-0.5 rounded bg-blue-950 text-blue-300 font-bold border border-blue-800/60">${formatDateDDMMYYYY(p.date)}</span>
                </div>
                <div class="pt-1 text-[11px] text-slate-300 grid grid-cols-2 gap-2 border-t border-slate-800/80">
                    <div>Product: <b class="text-white">${p.rawMaterial}</b></div>
                    <div class="text-right">Rate: <b class="text-amber-400">₹${unitPrice.toFixed(2)}</b> / ${p.rawUnit || 'unit'}</div>
                    <div>Original Qty: <b class="text-slate-200">${origQty} ${p.rawUnit || ''}</b></div>
                    <div class="text-right">Available Return: <strong class="${availQty > 0 ? 'text-emerald-400' : 'text-rose-400'}">${availQty} ${p.rawUnit || ''}</strong></div>
                    <div>Net Cost: <b class="text-slate-200">₹${Number(p.netPurchaseAmount ?? p.rawCost ?? 0).toFixed(2)}</b></div>
                    <div class="text-right">Balance Due: <b class="text-rose-400">₹${Number(p.netBalance ?? p.balance ?? 0).toFixed(2)}</b></div>
                </div>
                <div id="purchaseReturnLiveCalc" class="text-[11px] font-bold text-amber-300 pt-1 border-t border-slate-800/80"></div>
            </div>`;
    }
    updatePurchaseReturnLiveCalc('cleaning');
}

export function updatePurchaseReturnLiveCalc(type) {
    const isCos = type === 'cosmetics';
    const sel = document.getElementById(isCos ? 'cosPurchaseReturnSelect' : 'purchaseReturnSelect');
    const val = sel?.value;
    const arr = isCos ? state.cosPurchases : state.purchases;
    const p = arr.find(x => x && (String(x.id) === val || String(arr.indexOf(x)) === val));
    const qtyInput = document.getElementById(isCos ? 'cosPurchaseReturnQty' : 'purchaseReturnQty');
    const calcEl = document.getElementById(isCos ? 'cosPurchaseReturnLiveCalc' : 'purchaseReturnLiveCalc');
    if (!calcEl) return;
    if (!p) {
        calcEl.innerHTML = '';
        return;
    }
    const q = parseFloat(qtyInput?.value) || 0;
    const origQty = Number(isCos ? p.qty : p.rawQty) || 0;
    const unitPrice = Number(isCos ? (p.unitPrice || (p.amount / (origQty || 1))) : (p.rawUnitPrice || ((Number(p.rawCost) || 0) / (origQty || 1)))) || 0;
    const refundAmount = Number((q * unitPrice).toFixed(2));
    const currentNet = Number(p.netPurchaseAmount ?? (isCos ? p.amount : p.rawCost) ?? 0);
    const newNet = Math.max(0, currentNet - refundAmount);
    const currentPaid = Number(p.paid || 0);
    const newBalance = Math.max(0, newNet - currentPaid);
    
    if (q > 0) {
        calcEl.innerHTML = `↩️ Return Value: <span class="text-rose-300">₹${refundAmount.toFixed(2)}</span> | New Net Total: <span class="text-white">₹${newNet.toFixed(2)}</span> | New Bal: <span class="text-emerald-300">₹${newBalance.toFixed(2)}</span>`;
    } else {
        calcEl.innerHTML = `<span class="text-slate-400 font-normal">Enter return quantity to calculate refund value.</span>`;
    }
}

export function openPurchaseReturn(purchaseId, type) {
    const isCos = type === 'cosmetics';
    if (typeof window.switchTab === 'function') window.switchTab('purchase', false);
    if (typeof window.switchPurchaseSubTab === 'function') window.switchPurchaseSubTab(isCos ? 'cosmetics' : 'cleaning');
    switchPurchaseActionTab(isCos ? 'cosmetics' : 'cleaning', 'return');
    
    setTimeout(() => {
        const selId = isCos ? 'cosPurchaseReturnSelect' : 'purchaseReturnSelect';
        const sel = document.getElementById(selId);
        if (sel) {
            sel.value = String(purchaseId);
            if (isCos) fillCosPurchaseReturnDetails(); else fillPurchaseReturnDetails();
        }
        const qtyId = isCos ? 'cosPurchaseReturnQty' : 'purchaseReturnQty';
        const qtyEl = document.getElementById(qtyId);
        if (qtyEl) {
            qtyEl.focus();
            qtyEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, 60);
}

export function savePurchaseReturn(type) {
    const isCos = type === 'cosmetics';
    const sel = document.getElementById(isCos ? 'cosPurchaseReturnSelect' : 'purchaseReturnSelect');
    const val = sel?.value;
    const arr = isCos ? state.cosPurchases : state.purchases;
    const p = arr.find(x => x && (String(x.id) === val || String(arr.indexOf(x)) === val));
    if (!p) { alert('Select a purchase to return.'); return; }
    
    const qtyEl = document.getElementById(isCos ? 'cosPurchaseReturnQty' : 'purchaseReturnQty');
    const qty = parseFloat(qtyEl?.value) || 0;
    const already = Number(p.returnedQty) || 0;
    const originalQty = Number(isCos ? p.qty : p.rawQty) || 0;
    const max = Math.max(0, originalQty - already);
    if (qty <= 0 || qty > max) {
        alert(`Enter a valid return quantity (1 to ${max} ${isCos ? (p.unit || '') : (p.rawUnit || '')}).`);
        return;
    }
    
    const unit = isCos ? p.unit : p.rawUnit;
    const unitPrice = Number(isCos ? (p.unitPrice || (p.amount / (originalQty || 1))) : (p.rawUnitPrice || ((Number(p.rawCost) || 0) / (originalQty || 1)))) || 0;
    const retAmount = Number((qty * unitPrice).toFixed(2));
    const retDate = document.getElementById(isCos ? 'cosPurchaseReturnDate' : 'purchaseReturnDate')?.value || getTodayPurchaseDate();
    const retReason = document.getElementById(isCos ? 'cosPurchaseReturnReason' : 'purchaseReturnReason')?.value.trim() || 'Purchased Stock Return';
    
    const ret = {
        qty,
        date: retDate,
        reason: retReason,
        amount: retAmount,
        savedAt: Date.now()
    };
    
    p.returns = [...(Array.isArray(p.returns) ? p.returns : []), ret];
    p.returnedQty = Number((already + qty).toFixed(2));
    p.returnedAmount = Number(((Number(p.returnedAmount) || 0) + retAmount).toFixed(2));
    
    const grossCost = Number(isCos ? p.amount : p.rawCost) || 0;
    p.netPurchaseAmount = Math.max(0, grossCost - p.returnedAmount);
    p.balance = Math.max(0, p.netPurchaseAmount - (Number(p.paid) || 0));
    p.netBalance = p.balance;
    
    // Deduct stock: 1) stockId, 2) barcode, 3) product name
    const prodList = isCos ? state.cosProducts : state.products;
    let prod = null;
    if (p.stockId) {
        prod = prodList.find(x => x && x.id === p.stockId);
    }
    if (!prod) {
        const bc = String(isCos ? (p.barcode || '') : (p.rawBarcode || '')).trim();
        if (bc) prod = prodList.find(x => x && x.barcode && String(x.barcode).trim() === bc);
    }
    if (!prod) {
        const nm = String(isCos ? (p.item || '') : (p.rawMaterial || '')).trim().toLowerCase();
        if (nm) prod = prodList.find(x => x && x.name && x.name.trim().toLowerCase() === nm);
    }
    if (prod) {
        const before = Number(prod.stock) || 0;
        prod.stock = Math.max(0, parseFloat((before - qty).toFixed(2)));
        prod.lastPurchaseReturn = { qty, date: ret.date, updatedAt: Date.now() };
    }
    
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
    if (typeof renderPurchaseConsolidationView === 'function') renderPurchaseConsolidationView();
    if (typeof renderPurchaseConsolidationReport === 'function') renderPurchaseConsolidationReport();
    
    if (qtyEl) qtyEl.value = '';
    const reasonEl = document.getElementById(isCos ? 'cosPurchaseReturnReason' : 'purchaseReturnReason');
    if (reasonEl) reasonEl.value = '';
    
    alert(`✅ പർച്ചേസ് റിട്ടേൺ വിജയകരമായി സേവ് ചെയ്തു! ${qty} ${unit || ''} സ്റ്റോക്കിൽ നിന്ന് കുറയ്ക്കുകയും, ബാക്കി തുക റീ-കാൽക്കുലേറ്റ് ചെയ്യുകയും ചെയ്തു.`);
}

export function deletePurchaseReturn(type, purchaseId, returnIndex) {
    if (!confirm('Are you sure you want to delete this return record and restore stock?')) return;
    const isCos = type === 'cosmetics';
    const arr = isCos ? state.cosPurchases : state.purchases;
    const p = arr.find(x => x && (String(x.id) === String(purchaseId) || String(arr.indexOf(x)) === String(purchaseId)));
    if (!p || !Array.isArray(p.returns) || !p.returns[returnIndex]) {
        alert('Return record not found.');
        return;
    }
    const ret = p.returns[returnIndex];
    const retQty = Number(ret.qty || 0);
    const retAmount = Number(ret.amount || 0);
    
    // Restore stock to product
    const prodList = isCos ? state.cosProducts : state.products;
    let prod = null;
    if (p.stockId) prod = prodList.find(x => x && x.id === p.stockId);
    if (!prod) {
        const bc = String(isCos ? (p.barcode || '') : (p.rawBarcode || '')).trim();
        if (bc) prod = prodList.find(x => x && x.barcode && String(x.barcode).trim() === bc);
    }
    if (!prod) {
        const nm = String(isCos ? (p.item || '') : (p.rawMaterial || '')).trim().toLowerCase();
        if (nm) prod = prodList.find(x => x && x.name && x.name.trim().toLowerCase() === nm);
    }
    if (prod) {
        const before = Number(prod.stock) || 0;
        prod.stock = parseFloat((before + retQty).toFixed(2));
    }
    
    // Remove return record
    p.returns.splice(returnIndex, 1);
    p.returnedQty = Math.max(0, Number(((Number(p.returnedQty) || 0) - retQty).toFixed(2)));
    p.returnedAmount = Math.max(0, Number(((Number(p.returnedAmount) || 0) - retAmount).toFixed(2)));
    
    const grossCost = Number(isCos ? p.amount : p.rawCost) || 0;
    p.netPurchaseAmount = Math.max(0, grossCost - p.returnedAmount);
    p.balance = Math.max(0, p.netPurchaseAmount - (Number(p.paid) || 0));
    p.netBalance = p.balance;
    
    syncToFirebase();
    renderPurchases();
    renderCosPurchases();
    if (typeof window.renderProducts === 'function') window.renderProducts();
    if (typeof window.renderCosProductStock === 'function') window.renderCosProductStock();
    renderPurchaseReturnSelectors();
    renderCosPurchaseReturnSelectors();
    renderPurchaseReturnHistory();
    renderCosPurchaseReturnHistory();
    renderPurchaseHistory(type);
    if (typeof window.renderAccounts === 'function') window.renderAccounts();
    if (typeof renderPurchaseConsolidationView === 'function') renderPurchaseConsolidationView();
    if (typeof renderPurchaseConsolidationReport === 'function') renderPurchaseConsolidationReport();
    
    alert('✅ പർച്ചേസ് റിട്ടേൺ നീക്കം ചെയ്യുകയും സ്റ്റോക്ക് തിരികെ ചേർക്കുകയും ചെയ്തു!');
}

export function renderPurchaseReturnHistory() {
    const el = document.getElementById('purchaseReturnHistoryContainer');
    if (!el) return;
    const rows = [];
    state.purchases.forEach((p, i) => (p.returns || []).forEach((r, j) => rows.push({ p, i, r, j })));
    rows.sort((a, b) => (Number(b.r.savedAt) || 0) - (Number(a.r.savedAt) || 0));
    el.innerHTML = rows.map(x => `
        <div class="bg-slate-950/60 border border-slate-800 rounded-xl p-3 text-xs flex justify-between items-center gap-2">
            <div>
                <b class="text-rose-300 font-bold">${x.p.supplierName} - ${x.p.rawMaterial}</b>
                <div class="text-[11px] text-slate-400 mt-0.5">${formatDateDDMMYYYY(x.r.date)} | Return: <b class="text-rose-400">${x.r.qty} ${x.p.rawUnit || ''}</b> | Value: <b class="text-emerald-400">₹${Number(x.r.amount || 0).toFixed(2)}</b> | ${x.r.reason || 'No reason'}</div>
            </div>
            <button type="button" onclick="deletePurchaseReturn('cleaning', '${x.p.id || x.i}', ${x.j})" class="bg-red-950 text-rose-300 border border-red-800/60 px-2 py-1.5 rounded-lg text-[10px] font-bold hover:bg-red-900 transition shrink-0">🗑️ Delete</button>
        </div>
    `).join('') || '<p class="text-xs text-slate-500 text-center py-3">No purchase returns recorded.</p>';
}

export function renderCosPurchaseReturnSelectors() {
    const el = document.getElementById('cosPurchaseReturnSelect');
    if (!el) return;
    const currentVal = el.value;
    const sorted = [...(state.cosPurchases || [])].map((p, i) => ({ ...p, _idx: i })).sort((a, b) => dateSortValue(b.date) - dateSortValue(a.date) || (Number(b.savedAt) || 0) - (Number(a.savedAt) || 0));
    
    let html = '<option value="">-- Select Purchase to Return --</option>';
    sorted.forEach(p => {
        const origQty = Number(p.qty || 0);
        const retQty = Number(p.returnedQty || 0);
        const availQty = Math.max(0, origQty - retQty);
        const idVal = String(p.id || p._idx);
        const statusText = availQty > 0 ? `(Avail: ${availQty} ${p.unit || ''})` : `(Fully Returned)`;
        html += `<option value="${idVal}">${formatDateDDMMYYYY(p.date)} • ${p.supplier} • ${p.item} ${statusText}</option>`;
    });
    el.innerHTML = html;
    if (currentVal && sorted.some(p => String(p.id || p._idx) === currentVal)) {
        el.value = currentVal;
    }
    const d = document.getElementById('cosPurchaseReturnDate');
    if (d && !d.value) d.value = getTodayPurchaseDate();
}

export function fillCosPurchaseReturnDetails() {
    const sel = document.getElementById('cosPurchaseReturnSelect');
    const val = sel?.value;
    const p = state.cosPurchases.find(x => x && (String(x.id) === val || String(state.cosPurchases.indexOf(x)) === val));
    const info = document.getElementById('cosPurchaseReturnInfo');
    const qtyInput = document.getElementById('cosPurchaseReturnQty');
    if (!p) {
        if (info) info.innerHTML = '<span class="text-slate-400">Select a purchase to return.</span>';
        if (qtyInput) { qtyInput.value = ''; qtyInput.removeAttribute('max'); }
        updatePurchaseReturnLiveCalc('cosmetics');
        return;
    }
    const origQty = Number(p.qty || 0);
    const retQty = Number(p.returnedQty || 0);
    const availQty = Math.max(0, origQty - retQty);
    const unitPrice = Number(p.unitPrice || (p.amount / (origQty || 1))) || 0;
    
    if (qtyInput) {
        qtyInput.max = availQty;
        qtyInput.placeholder = `Return Qty (Max: ${availQty} ${p.unit || ''})`;
        if (parseFloat(qtyInput.value) > availQty) qtyInput.value = availQty;
    }
    const d = document.getElementById('cosPurchaseReturnDate');
    if (d && !d.value) d.value = getTodayPurchaseDate();
    
    if (info) {
        info.innerHTML = `
            <div class="bg-slate-900/90 border border-slate-800 rounded-xl p-3 text-xs space-y-1.5 mt-1">
                <div class="flex justify-between items-start">
                    <div>
                        <strong class="text-pink-300 text-sm">${p.supplier}</strong>
                        <span class="text-slate-400 text-[11px] block">📞 ${p.supplierMobile || 'No mobile'}</span>
                    </div>
                    <span class="text-[11px] px-2 py-0.5 rounded bg-pink-950 text-pink-300 font-bold border border-pink-800/60">${formatDateDDMMYYYY(p.date)}</span>
                </div>
                <div class="pt-1 text-[11px] text-slate-300 grid grid-cols-2 gap-2 border-t border-slate-800/80">
                    <div>Product: <b class="text-white">${p.item}</b></div>
                    <div class="text-right">Rate: <b class="text-amber-400">₹${unitPrice.toFixed(2)}</b> / ${p.unit || 'unit'}</div>
                    <div>Original Qty: <b class="text-slate-200">${origQty} ${p.unit || ''}</b></div>
                    <div class="text-right">Available Return: <strong class="${availQty > 0 ? 'text-emerald-400' : 'text-rose-400'}">${availQty} ${p.unit || ''}</strong></div>
                    <div>Net Cost: <b class="text-slate-200">₹${Number(p.netPurchaseAmount ?? p.amount ?? 0).toFixed(2)}</b></div>
                    <div class="text-right">Balance Due: <b class="text-rose-400">₹${Number(p.netBalance ?? p.balance ?? 0).toFixed(2)}</b></div>
                </div>
                <div id="cosPurchaseReturnLiveCalc" class="text-[11px] font-bold text-amber-300 pt-1 border-t border-slate-800/80"></div>
            </div>`;
    }
    updatePurchaseReturnLiveCalc('cosmetics');
}

export function renderCosPurchaseReturnHistory() {
    const el = document.getElementById('cosPurchaseReturnHistoryContainer');
    if (!el) return;
    const rows = [];
    state.cosPurchases.forEach((p, i) => (p.returns || []).forEach((r, j) => rows.push({ p, i, r, j })));
    rows.sort((a, b) => (Number(b.r.savedAt) || 0) - (Number(a.r.savedAt) || 0));
    el.innerHTML = rows.map(x => `
        <div class="bg-slate-950/60 border border-slate-800 rounded-xl p-3 text-xs flex justify-between items-center gap-2">
            <div>
                <b class="text-rose-300 font-bold">${x.p.supplier} - ${x.p.item}</b>
                <div class="text-[11px] text-slate-400 mt-0.5">${formatDateDDMMYYYY(x.r.date)} | Return: <b class="text-rose-400">${x.r.qty} ${x.p.unit || ''}</b> | Value: <b class="text-emerald-400">₹${Number(x.r.amount || 0).toFixed(2)}</b> | ${x.r.reason || 'No reason'}</div>
            </div>
            <button type="button" onclick="deletePurchaseReturn('cosmetics', '${x.p.id || x.i}', ${x.j})" class="bg-red-950 text-rose-300 border border-red-800/60 px-2 py-1.5 rounded-lg text-[10px] font-bold hover:bg-red-900 transition shrink-0">🗑️ Delete</button>
        </div>
    `).join('') || '<p class="text-xs text-slate-500 text-center py-3">No purchase returns recorded.</p>';
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
        _netAmount: p.netPurchaseAmount !== undefined ? Number(p.netPurchaseAmount) : Number(isCos ? p.amount : p.rawCost),
        _paid: Number(p.paid || 0),
        _balance: Number(p.netBalance ?? p.balance ?? 0),
        _retQty: Number(p.returnedQty || 0)
    })).filter(p => !q || String(p._supplier || '').toLowerCase() === q).sort((a, b) => dateSortValue(b.date) - dateSortValue(a.date) || (Number(b.savedAt) || 0) - (Number(a.savedAt) || 0));
    
    container.innerHTML = rows.map(p => `
        <div class="bg-slate-950/60 p-3 rounded-xl border border-slate-800 text-xs flex flex-col sm:flex-row justify-between gap-2 items-start">
            <div>
                <div class="font-bold ${isCos ? 'text-pink-300' : 'text-blue-300'}">${p._supplier} — ${p._item}</div>
                <div class="text-slate-400 mt-1">${formatDateDDMMYYYY(p.date)} | Qty: ${p._qty} ${p._unit || ''} | Total: ₹${Number(p._amount || 0).toFixed(2)}${p._retQty > 0 ? ` | Return: ${p._retQty} ${p._unit || ''}` : ''} | Net: ₹${p._netAmount.toFixed(2)} | Paid: ₹${p._paid.toFixed(2)} | <span class="${p._balance > 0 ? 'text-rose-400 font-bold' : 'text-slate-300'}">Balance: ₹${p._balance.toFixed(2)}</span></div>
            </div>
            <div class="flex flex-wrap gap-1 shrink-0">
                <button type="button" onclick="${isCos ? 'viewCosPurchase' : 'viewPurchase'}('${p.id || p._i}')" class="bg-blue-900 text-blue-200 px-2.5 py-1.5 rounded-lg text-xs font-semibold hover:bg-blue-800 transition">View</button>
                <button type="button" onclick="${isCos ? 'editCosPurchase' : 'editPurchase'}('${p.id || p._i}')" class="bg-slate-800 text-amber-400 px-2.5 py-1.5 rounded-lg text-xs font-semibold hover:bg-slate-700 transition">✎ Edit</button>
                <button type="button" onclick="openPurchaseReturn('${p.id || p._i}', '${isCos ? 'cosmetics' : 'cleaning'}')" class="bg-rose-900/80 text-rose-200 px-2.5 py-1.5 rounded-lg text-xs font-semibold hover:bg-rose-800 transition">↩️ Return</button>
                <button type="button" onclick="${isCos ? 'deleteCosPurchase' : 'deletePurchase'}('${p.id || p._i}')" class="bg-red-900 text-red-200 px-2.5 py-1.5 rounded-lg text-xs font-semibold hover:bg-red-800 transition">Delete</button>
            </div>
        </div>`).join('') || '<p class="text-xs text-slate-500 text-center py-4">No purchase history found.</p>';
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
                    <button type="button" onclick="viewCosPurchase('${p.id || p._originalIndex}')" class="bg-blue-900 text-blue-200 px-2.5 py-1.5 rounded-lg font-semibold hover:bg-blue-800 transition">View</button>
                    <button type="button" onclick="editCosPurchase('${p.id || p._originalIndex}')" class="bg-slate-800 text-amber-400 px-2.5 py-1.5 rounded-lg font-semibold hover:bg-slate-700 transition">✎ Edit</button>
                    <button type="button" onclick="openPurchaseReturn('${p.id || p._originalIndex}', 'cosmetics')" class="bg-rose-900/80 text-rose-200 px-2.5 py-1.5 rounded-lg font-semibold hover:bg-rose-800 transition">↩️ Return</button>
                    <button type="button" onclick="deleteCosPurchase('${p.id || p._originalIndex}')" class="bg-red-900 text-red-200 px-2.5 py-1.5 rounded-lg font-semibold hover:bg-red-800 transition">Delete</button>
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

let selectedSupplierConsolidatedName = '';

export function getConsolidatedPurchaseData() {
    const map = {};
    
    // 1. Cleaning Purchases
    (state.purchases || []).forEach((p, idx) => {
        if (!p) return;
        const name = String(p.supplierName || 'Unknown Dealer').trim();
        if (!name) return;
        const key = name.toLowerCase();
        if (!map[key]) {
            map[key] = {
                name,
                phone: p.supplierMobile || '',
                allPurchases: []
            };
        }
        if (p.supplierMobile && !map[key].phone) map[key].phone = p.supplierMobile;
        
        const grossCost = Number(p.rawCost || 0);
        const retAmount = Number(p.returnedAmount || 0);
        const netCost = p.netPurchaseAmount !== undefined ? Number(p.netPurchaseAmount) : Math.max(0, grossCost - retAmount);
        const paid = Number(p.paid || 0);
        const balance = p.netBalance !== undefined ? Number(p.netBalance) : Math.max(0, netCost - paid);
        
        map[key].allPurchases.push({
            id: p.id || ('clean_' + idx),
            type: 'cleaning',
            categoryBadge: '🧹 Cleaning',
            categoryColor: 'text-blue-300',
            date: p.date,
            item: p.rawMaterial || 'Cleaning Item',
            barcode: p.rawBarcode || '',
            qty: Number(p.rawQty || 0),
            unit: p.rawUnit || '',
            unitPrice: Number(p.rawUnitPrice || 0),
            grossCost,
            returnedQty: Number(p.returnedQty || 0),
            returnedAmount: retAmount,
            netCost,
            paid,
            balance,
            savedAt: Number(p.savedAt || 0)
        });
    });
    
    // 2. Cosmetics Purchases
    (state.cosPurchases || []).forEach((p, idx) => {
        if (!p) return;
        const name = String(p.supplier || 'Unknown Dealer').trim();
        if (!name) return;
        const key = name.toLowerCase();
        if (!map[key]) {
            map[key] = {
                name,
                phone: p.supplierMobile || '',
                allPurchases: []
            };
        }
        if (p.supplierMobile && !map[key].phone) map[key].phone = p.supplierMobile;
        
        const grossCost = Number(p.amount || 0);
        const retAmount = Number(p.returnedAmount || 0);
        const netCost = p.netPurchaseAmount !== undefined ? Number(p.netPurchaseAmount) : Math.max(0, grossCost - retAmount);
        const paid = Number(p.paid || 0);
        const balance = p.netBalance !== undefined ? Number(p.netBalance) : Math.max(0, netCost - paid);
        
        map[key].allPurchases.push({
            id: p.id || ('cos_' + idx),
            type: 'cosmetics',
            categoryBadge: '💄 Cosmetics',
            categoryColor: 'text-pink-300',
            date: p.date,
            item: p.item || 'Cosmetics Item',
            barcode: p.barcode || '',
            qty: Number(p.qty || 0),
            unit: p.unit || '',
            unitPrice: Number(p.unitPrice || 0),
            grossCost,
            returnedQty: Number(p.returnedQty || 0),
            returnedAmount: retAmount,
            netCost,
            paid,
            balance,
            savedAt: Number(p.savedAt || 0)
        });
    });
    
    // Enrich phone from state.purchaseSuppliers if missing
    (state.purchaseSuppliers || []).forEach(s => {
        if (s && s.name) {
            const key = s.name.trim().toLowerCase();
            if (map[key] && !map[key].phone && s.mobile) {
                map[key].phone = s.mobile;
            }
        }
    });
    
    const list = Object.values(map);
    list.forEach(dealer => {
        dealer.purchaseCount = dealer.allPurchases.length;
        dealer.totalGross = dealer.allPurchases.reduce((sum, r) => sum + r.grossCost, 0);
        dealer.totalReturned = dealer.allPurchases.reduce((sum, r) => sum + r.returnedAmount, 0);
        dealer.totalNet = dealer.allPurchases.reduce((sum, r) => sum + r.netCost, 0);
        dealer.totalPaid = dealer.allPurchases.reduce((sum, r) => sum + r.paid, 0);
        dealer.totalBalance = dealer.allPurchases.reduce((sum, r) => sum + r.balance, 0);
        
        dealer.allPurchases.sort((a, b) => {
            const d = dateSortValue(b.date) - dateSortValue(a.date);
            return d !== 0 ? d : b.savedAt - a.savedAt;
        });
    });
    
    return list;
}

export function switchPurchaseConsolidationView(view) {
    window.purchaseConsolidationActiveView = view;
    const viewContent = document.getElementById('purchaseConsolidationViewContent');
    const reportContent = document.getElementById('purchaseConsolidationReportContent');
    const viewTab = document.getElementById('purchaseConsolidationViewTab');
    const reportTab = document.getElementById('purchaseConsolidationReportTab');
    
    [viewContent, reportContent].forEach(el => el && el.classList.add('hidden'));
    [viewTab, reportTab].forEach(btn => {
        if (btn) {
            btn.classList.remove('bg-amber-600', 'text-white', 'shadow-md');
            btn.classList.add('text-slate-400');
        }
    });
    
    if (view === 'report') {
        reportContent?.classList.remove('hidden');
        reportTab?.classList.add('bg-amber-600', 'text-white', 'shadow-md');
        reportTab?.classList.remove('text-slate-400');
        renderPurchaseConsolidationReport();
    } else {
        viewContent?.classList.remove('hidden');
        viewTab?.classList.add('bg-amber-600', 'text-white', 'shadow-md');
        viewTab?.classList.remove('text-slate-400');
        renderPurchaseConsolidationView();
    }
}

export function renderPurchaseConsolidationView() {
    const container = document.getElementById('purchaseConsolidationViewContainer');
    if (!container) return;
    
    const dealers = getConsolidatedPurchaseData();
    const query = (document.getElementById('purchaseConsolidationViewSearchInput')?.value || '').trim().toLowerCase();
    
    let filtered = dealers;
    if (query) {
        filtered = filtered.filter(d => 
            d.name.toLowerCase().includes(query) || 
            d.phone.toLowerCase().includes(query) || 
            d.allPurchases.some(p => p.item.toLowerCase().includes(query) || p.barcode.toLowerCase().includes(query))
        );
    }
    
    filtered.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true }));
    
    if (!filtered.length) {
        container.innerHTML = '<p class="text-xs text-slate-500 text-center py-8">No consolidated dealer purchase records found.</p>';
        return;
    }
    
    container.innerHTML = filtered.map(d => {
        const encName = encodeURIComponent(d.name);
        return `
            <div class="bg-slate-950/70 p-4 rounded-2xl border border-slate-800 text-xs space-y-3 shadow-inner">
                <div class="flex flex-col sm:flex-row justify-between sm:items-center gap-2 border-b border-slate-800/80 pb-3">
                    <div>
                        <div class="flex items-center gap-2">
                            <span class="font-extrabold text-amber-300 text-base">🏢 ${d.name}</span>
                            <span class="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 font-bold">${d.purchaseCount} Bills</span>
                        </div>
                        <p class="text-slate-400 text-xs mt-0.5">📞 ${d.phone ? `<a href="tel:${d.phone}" class="hover:text-amber-400 underline">${d.phone}</a>` : 'No phone recorded'}</p>
                    </div>
                    <div class="flex flex-wrap gap-1.5 items-center">
                        <button type="button" onclick="shareSelectedSupplierConsolidatedDetail('${encName}')" class="bg-green-700 hover:bg-green-600 text-white px-2.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-md">💬 WhatsApp</button>
                        <button type="button" onclick="openSupplierConsolidatedDetail('${encName}')" class="bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 px-2.5 py-1.5 rounded-lg text-xs font-bold transition">📊 Statement</button>
                    </div>
                </div>

                <!-- Aggregate dealer metrics row -->
                <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                    <div class="bg-slate-900/90 rounded-xl p-2.5 border border-slate-800">
                        <div class="text-[10px] text-slate-400 uppercase font-semibold">Total Purchases</div>
                        <div class="font-extrabold text-white text-sm mt-0.5">₹${d.totalNet.toFixed(2)}</div>
                    </div>
                    <div class="bg-slate-900/90 rounded-xl p-2.5 border border-slate-800">
                        <div class="text-[10px] text-slate-400 uppercase font-semibold">Total Paid</div>
                        <div class="font-extrabold text-emerald-400 text-sm mt-0.5">₹${d.totalPaid.toFixed(2)}</div>
                    </div>
                    <div class="bg-slate-900/90 rounded-xl p-2.5 border border-slate-800">
                        <div class="text-[10px] text-slate-400 uppercase font-semibold">Balance Due</div>
                        <div class="font-extrabold ${d.totalBalance > 0 ? 'text-rose-400' : 'text-slate-400'} text-sm mt-0.5">₹${d.totalBalance.toFixed(2)}</div>
                    </div>
                    <div class="bg-slate-900/90 rounded-xl p-2.5 border border-slate-800">
                        <div class="text-[10px] text-slate-400 uppercase font-semibold">Total Returns</div>
                        <div class="font-bold text-amber-300 text-sm mt-0.5">₹${d.totalReturned.toFixed(2)}</div>
                    </div>
                </div>

                <!-- Itemized purchase history for this dealer -->
                <div class="space-y-2 pt-1">
                    <div class="text-[11px] font-bold text-slate-400 flex justify-between items-center px-1">
                        <span>Purchase Timeline (${d.allPurchases.length} items)</span>
                        <span class="text-[10px] text-slate-500">Latest First</span>
                    </div>
                    ${d.allPurchases.map((p, pIdx) => {
                        const isCos = p.type === 'cosmetics';
                        const viewFn = isCos ? `viewCosPurchase('${p.id}')` : `viewPurchase('${p.id}')`;
                        const editFn = isCos ? `editCosPurchase('${p.id}')` : `editPurchase('${p.id}')`;
                        const deleteFn = isCos ? `deleteCosPurchase('${p.id}')` : `deletePurchase('${p.id}')`;
                        const returnFn = `openPurchaseReturn('${p.id}', '${p.type}')`;
                        
                        return `
                            <div class="bg-slate-900/80 border border-slate-800/90 rounded-xl p-3 flex flex-col sm:flex-row justify-between gap-2 items-start hover:border-slate-700 transition">
                                <div class="min-w-0 flex-1">
                                    <div class="flex items-center gap-1.5 flex-wrap">
                                        <span class="font-bold ${p.categoryColor}">#${pIdx + 1} • ${p.item}</span>
                                        <span class="text-[9px] px-1.5 py-0.5 rounded font-bold ${isCos ? 'bg-pink-950/80 text-pink-300 border border-pink-800/50' : 'bg-blue-950/80 text-blue-300 border border-blue-800/50'}">${p.categoryBadge}</span>
                                        <span class="text-[10px] text-slate-400">📅 ${formatDateDDMMYYYY(p.date)}</span>
                                    </div>
                                    <div class="text-[11px] text-slate-300 mt-1 flex flex-wrap gap-x-2 gap-y-0.5">
                                        <span>Qty: <b class="text-white">${p.qty} ${p.unit}</b></span>
                                        <span>Rate: <b class="text-slate-200">₹${p.unitPrice.toFixed(2)}</b></span>
                                        <span>Total: <b class="text-white">₹${p.grossCost.toFixed(2)}</b></span>
                                        ${p.returnedQty > 0 ? `<span class="text-rose-400 font-bold">↩️ Return: ${p.returnedQty} ${p.unit} (₹${p.returnedAmount.toFixed(2)})</span>` : ''}
                                        <span>Net: <b class="text-white">₹${p.netCost.toFixed(2)}</b></span>
                                        <span>Paid: <b class="text-emerald-400">₹${p.paid.toFixed(2)}</b></span>
                                        <span class="${p.balance > 0 ? 'text-rose-400 font-bold' : 'text-slate-400'}">Bal: ₹${p.balance.toFixed(2)}</span>
                                    </div>
                                </div>
                                <div class="flex flex-wrap gap-1 shrink-0 self-end sm:self-center">
                                    <button type="button" onclick="${viewFn}" class="bg-blue-950 text-blue-300 border border-blue-800/60 px-2 py-1 rounded-lg text-[11px] font-semibold hover:bg-blue-900 transition">View</button>
                                    <button type="button" onclick="${editFn}" class="bg-slate-800 text-amber-400 border border-slate-700 px-2 py-1 rounded-lg text-[11px] font-semibold hover:bg-slate-700 transition">✎ Edit</button>
                                    <button type="button" onclick="${returnFn}" class="bg-rose-950 text-rose-300 border border-rose-800/60 px-2 py-1 rounded-lg text-[11px] font-semibold hover:bg-rose-900 transition">↩️ Return</button>
                                    <button type="button" onclick="${deleteFn}" class="bg-red-950 text-red-300 border border-red-800/60 px-2 py-1 rounded-lg text-[11px] font-semibold hover:bg-red-900 transition">Delete</button>
                                </div>
                            </div>`;
                    }).join('')}
                </div>
            </div>`;
    }).join('');
}

export function renderPurchaseConsolidationReport() {
    const container = document.getElementById('purchaseConsolidationContainer');
    const summaryCardsEl = document.getElementById('purchaseConsolidationSummaryCards');
    if (!container) return;
    
    const dealers = getConsolidatedPurchaseData();
    const query = (document.getElementById('purchaseConsolidationSearchInput')?.value || '').trim().toLowerCase();
    
    let filtered = dealers;
    if (query) {
        filtered = filtered.filter(d => 
            d.name.toLowerCase().includes(query) || 
            d.phone.toLowerCase().includes(query)
        );
    }
    
    filtered.sort((a, b) => b.totalNet - a.totalNet);
    
    const totalPurchasesCount = filtered.reduce((s, d) => s + d.purchaseCount, 0);
    const totalNet = filtered.reduce((s, d) => s + d.totalNet, 0);
    const totalPaid = filtered.reduce((s, d) => s + d.totalPaid, 0);
    const totalBalance = filtered.reduce((s, d) => s + d.totalBalance, 0);
    
    if (summaryCardsEl) {
        summaryCardsEl.innerHTML = `
            <div class="bg-slate-900/90 rounded-xl p-2.5 border border-slate-800 text-center">
                <div class="text-[10px] text-slate-400 uppercase font-semibold">Dealers</div>
                <div class="font-extrabold text-white text-base mt-0.5">${filtered.length}</div>
            </div>
            <div class="bg-slate-900/90 rounded-xl p-2.5 border border-slate-800 text-center">
                <div class="text-[10px] text-slate-400 uppercase font-semibold">Total Purchases</div>
                <div class="font-extrabold text-amber-300 text-sm mt-0.5">₹${totalNet.toFixed(2)}</div>
            </div>
            <div class="bg-slate-900/90 rounded-xl p-2.5 border border-slate-800 text-center">
                <div class="text-[10px] text-slate-400 uppercase font-semibold">Total Paid</div>
                <div class="font-extrabold text-emerald-400 text-sm mt-0.5">₹${totalPaid.toFixed(2)}</div>
            </div>
            <div class="bg-slate-900/90 rounded-xl p-2.5 border border-slate-800 text-center">
                <div class="text-[10px] text-slate-400 uppercase font-semibold">Balance Due</div>
                <div class="font-extrabold ${totalBalance > 0 ? 'text-rose-400' : 'text-slate-400'} text-sm mt-0.5">₹${totalBalance.toFixed(2)}</div>
            </div>`;
    }
    
    if (!filtered.length) {
        container.innerHTML = '<p class="text-xs text-slate-500 text-center py-8">No dealer consolidation summary found.</p>';
        return;
    }
    
    container.innerHTML = filtered.map(d => `
        <div class="bg-slate-950/70 p-3.5 rounded-2xl border border-slate-800 text-xs space-y-2 cursor-pointer active:scale-[0.99] transition hover:border-amber-700/60" role="button" tabindex="0" title="Tap to inspect full dealer statement" onclick="openSupplierConsolidatedDetail('${encodeURIComponent(d.name)}')">
            <div class="flex justify-between items-start">
                <div>
                    <span class="font-extrabold text-amber-300 text-sm">${d.name}</span>
                    <p class="text-slate-400 text-[11px] mt-0.5">📞 ${d.phone || 'No Mobile'} • Bills: <b class="text-white">${d.purchaseCount}</b></p>
                </div>
                <div class="text-right">
                    <span class="text-[10px] text-slate-400 uppercase">Total Purchased</span>
                    <p class="font-extrabold text-white text-sm">₹${d.totalNet.toFixed(2)}</p>
                </div>
            </div>
            <div class="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800/80 text-[11px]">
                <div>
                    <span class="text-slate-400">Total Paid:</span> <strong class="text-emerald-400">₹${d.totalPaid.toFixed(2)}</strong>
                </div>
                <div class="text-right">
                    <span class="text-slate-400">Balance Due:</span> <strong class="${d.totalBalance > 0 ? 'text-rose-400 font-bold' : 'text-slate-300'}">₹${d.totalBalance.toFixed(2)}</strong>
                </div>
            </div>
        </div>
    `).join('');
}

export function openSupplierConsolidatedDetail(encodedName) {
    const name = decodeURIComponent(encodedName || '');
    selectedSupplierConsolidatedName = name;
    const title = document.getElementById('supplierConsolidatedDetailTitle');
    const content = document.getElementById('supplierConsolidatedDetailContent');
    if (!content) return;
    if (title) title.textContent = name + ' - Purchase Ledger';
    
    const dealers = getConsolidatedPurchaseData();
    const d = dealers.find(x => x.name.toLowerCase() === name.toLowerCase());
    if (!d) {
        content.innerHTML = '<p class="text-xs text-slate-500 text-center py-4">Dealer details not found.</p>';
        document.getElementById('supplierConsolidatedDetailModal')?.classList.remove('hidden');
        return;
    }
    
    content.innerHTML = `
        <div class="space-y-3">
            <div class="bg-slate-950/80 rounded-xl p-3 border border-slate-800 flex justify-between items-center">
                <div>
                    <div class="font-extrabold text-amber-300 text-sm">🏢 ${d.name}</div>
                    <div class="text-slate-400 text-xs mt-0.5">📞 ${d.phone || 'No phone recorded'}</div>
                </div>
                <span class="bg-amber-950/80 text-amber-300 border border-amber-800/60 font-bold px-2 py-1 rounded-lg text-xs">${d.purchaseCount} Purchases</span>
            </div>

            <div class="bg-slate-950/80 rounded-xl p-3 border border-slate-800 space-y-2">
                <div class="text-center text-amber-300 text-xs font-bold uppercase tracking-wider">Dealer Financial Summary</div>
                <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                    <div class="bg-slate-900 rounded-lg p-2.5">
                        <div class="text-slate-400 text-[10px]">Gross Total</div>
                        <b class="text-white text-xs">₹${d.totalGross.toFixed(2)}</b>
                    </div>
                    <div class="bg-slate-900 rounded-lg p-2.5">
                        <div class="text-slate-400 text-[10px]">Returns</div>
                        <b class="text-amber-400 text-xs">₹${d.totalReturned.toFixed(2)}</b>
                    </div>
                    <div class="bg-slate-900 rounded-lg p-2.5">
                        <div class="text-slate-400 text-[10px]">Total Paid</div>
                        <b class="text-emerald-400 text-xs">₹${d.totalPaid.toFixed(2)}</b>
                    </div>
                    <div class="bg-slate-900 rounded-lg p-2.5">
                        <div class="text-slate-400 text-[10px]">Balance Due</div>
                        <b class="${d.totalBalance > 0 ? 'text-rose-400' : 'text-slate-300'} text-xs">₹${d.totalBalance.toFixed(2)}</b>
                    </div>
                </div>
            </div>

            <div class="space-y-2">
                <div class="text-xs font-bold text-slate-300 px-1">Complete Purchase History</div>
                <div class="space-y-2 max-h-[40vh] overflow-y-auto pr-1">
                    ${d.allPurchases.map((p, idx) => `
                        <div class="bg-slate-900/90 border border-slate-800 rounded-xl p-2.5 text-xs">
                            <div class="flex justify-between items-start">
                                <div>
                                    <span class="font-bold ${p.categoryColor}">#${idx + 1} • ${p.item}</span>
                                    <span class="text-[9px] px-1 py-0.5 rounded font-bold ml-1 ${p.type === 'cosmetics' ? 'bg-pink-950 text-pink-300 border border-pink-800/40' : 'bg-blue-950 text-blue-300 border border-blue-800/40'}">${p.categoryBadge}</span>
                                </div>
                                <span class="text-slate-400 text-[10px]">📅 ${formatDateDDMMYYYY(p.date)}</span>
                            </div>
                            <div class="grid grid-cols-2 gap-1 text-[11px] text-slate-300 mt-1 pt-1 border-t border-slate-800/70">
                                <div>Qty: <b class="text-white">${p.qty} ${p.unit}</b> @ ₹${p.unitPrice.toFixed(2)}</div>
                                <div class="text-right">Net: <b class="text-white">₹${p.netCost.toFixed(2)}</b></div>
                                <div>Paid: <b class="text-emerald-400">₹${p.paid.toFixed(2)}</b></div>
                                <div class="text-right">Bal: <b class="${p.balance > 0 ? 'text-rose-400' : 'text-slate-400'}">₹${p.balance.toFixed(2)}</b></div>
                            </div>
                            ${p.returnedQty > 0 ? `<div class="text-[10px] text-rose-400 font-semibold mt-0.5">↩️ Returned: ${p.returnedQty} ${p.unit} (₹${p.returnedAmount.toFixed(2)})</div>` : ''}
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `;
    
    document.getElementById('supplierConsolidatedDetailModal')?.classList.remove('hidden');
}

export function closeSupplierConsolidatedDetail() {
    document.getElementById('supplierConsolidatedDetailModal')?.classList.add('hidden');
}

export function shareSelectedSupplierConsolidatedDetail(encodedSupplierName) {
    const name = decodeURIComponent(encodedSupplierName || selectedSupplierConsolidatedName || '');
    if (!name) return;
    const dealers = getConsolidatedPurchaseData();
    const d = dealers.find(x => x.name.toLowerCase() === name.toLowerCase());
    if (!d) {
        alert('Dealer data not found.');
        return;
    }
    
    const lines = [
        `*FIA CLEAN & CARE*`,
        `*DEALER PURCHASE STATEMENT*`,
        ``,
        `*Dealer / Supplier:* ${d.name}`,
        `*Mobile:* ${d.phone || 'No Mobile'}`,
        `*Date:* ${todayDDMMYYYY()}`,
        ``,
        `*📊 ACCOUNT SUMMARY:*`,
        `• Total Purchases: ${d.purchaseCount} bills`,
        `• Total Purchased Value: ₹${d.totalNet.toFixed(2)}`,
        `• Total Amount Paid: ₹${d.totalPaid.toFixed(2)}`,
        `• Balance Due to Dealer: ₹${d.totalBalance.toFixed(2)}`,
        ``,
        `*📋 ITEM-WISE PURCHASE BREAKDOWN:*`
    ];
    
    d.allPurchases.forEach((p, i) => {
        let retInfo = p.returnedQty > 0 ? ` (↩️ Ret: ${p.returnedQty} ${p.unit})` : '';
        lines.push(`${i + 1}. ${formatDateDDMMYYYY(p.date)} | [${p.type === 'cosmetics' ? 'Cosmetics' : 'Cleaning'}] ${p.item} (Qty: ${p.qty} ${p.unit}${retInfo}) - Total: ₹${p.netCost.toFixed(2)} | Paid: ₹${p.paid.toFixed(2)} | Bal: ₹${p.balance.toFixed(2)}`);
    });
    
    lines.push(``);
    lines.push(`_Generated automatically by FIA CLEAN & CARE System_`);
    
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(lines.join('\n'))}`, '_blank');
}

export function sharePurchaseConsolidationReport() {
    const dealers = getConsolidatedPurchaseData();
    if (!dealers.length) {
        alert('No purchase data to share.');
        return;
    }
    const q = (document.getElementById('purchaseConsolidationSearchInput')?.value || '').trim().toLowerCase();
    let filtered = dealers;
    if (q) {
        filtered = filtered.filter(d => d.name.toLowerCase().includes(query) || d.phone.toLowerCase().includes(query));
    }
    
    const totalPurchasesCount = filtered.reduce((s, d) => s + d.purchaseCount, 0);
    const totalNet = filtered.reduce((s, d) => s + d.totalNet, 0);
    const totalPaid = filtered.reduce((s, d) => s + d.totalPaid, 0);
    const totalBalance = filtered.reduce((s, d) => s + d.totalBalance, 0);
    
    const lines = [
        `*FIA CLEAN & CARE*`,
        `*CONSOLIDATED PURCHASE REPORT*`,
        `*Date:* ${todayDDMMYYYY()}`,
        ``,
        `*📊 OVERALL SUMMARY:*`,
        `• Total Dealers: ${filtered.length}`,
        `• Total Purchases Count: ${totalPurchasesCount}`,
        `• Total Purchase Value: ₹${totalNet.toFixed(2)}`,
        `• Total Amount Paid: ₹${totalPaid.toFixed(2)}`,
        `• Balance Due to Dealers: ₹${totalBalance.toFixed(2)}`,
        ``,
        `*📋 DEALER-WISE SUMMARY:*`
    ];
    
    filtered.sort((a, b) => b.totalNet - a.totalNet);
    filtered.forEach((d, i) => {
        lines.push(`${i + 1}. *${d.name}* (📞 ${d.phone || '—'})`);
        lines.push(`   Orders: ${d.purchaseCount} | Total: ₹${d.totalNet.toFixed(2)} | Paid: ₹${d.totalPaid.toFixed(2)} | Due: ₹${d.totalBalance.toFixed(2)}`);
    });
    
    lines.push(``);
    lines.push(`_Generated automatically by FIA CLEAN & CARE System_`);
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(lines.join('\n'))}`, '_blank');
}

export async function downloadPurchaseConsolidationReportPDF() {
    const container = document.getElementById('purchaseConsolidationContainer');
    if (!container || !container.children.length) { alert('No purchase report available to download.'); return; }
    const query = (document.getElementById('purchaseConsolidationSearchInput')?.value || '').trim();
    const report = document.createElement('div');
    report.innerHTML = `<div style="font-family:Arial,sans-serif;background:#fff;color:#000;padding:10px"><div style="text-align:center;border-bottom:2px solid #333;padding-bottom:8px;margin-bottom:12px"><div style="font-size:20px;font-weight:bold;color:#065f46">FIA CLEAN & CARE</div><div style="font-size:13px;font-weight:bold">Consolidated Purchase & Supplier Report</div>${query ? `<div style="font-size:11px;margin-top:4px">Dealer Search: ${query}</div>` : ''}</div>${container.innerHTML}</div>`;
    const root = report.firstElementChild;
    root.querySelectorAll('button').forEach(b => b.remove());
    root.querySelectorAll('*').forEach(el => { el.style.color = '#000'; el.style.backgroundColor = '#fff'; el.style.borderColor = '#ddd'; });
    const safeName = query ? query.replace(/[^a-z0-9_-]+/gi, '_') : 'All_Dealers';
    if (typeof window.html2pdf !== 'undefined') {
        await window.html2pdf().set({
            margin: [10, 10, 10, 10],
            filename: `FIA_PURCHASE_CONSOLIDATED_${safeName}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        }).from(root).save();
    } else {
        alert('PDF generator library is loading, please try again in a moment.');
    }
}

export function switchPurchaseSubTab(tab) {
    const cleaning = document.getElementById('purchaseCleaningContent');
    const cosmetics = document.getElementById('purchaseCosmeticsContent');
    const consolidated = document.getElementById('purchaseConsolidatedContent');
    const b1 = document.getElementById('subTabPurchaseCleaning');
    const b2 = document.getElementById('subTabPurchaseCosmetics');
    const b3 = document.getElementById('subTabPurchaseConsolidated');
    const ct = document.getElementById('purchaseActionTabsCleaning');
    const xt = document.getElementById('purchaseActionTabsCosmetics');
    const addSupplierCard = document.getElementById('purchaseAddSupplierCard') || document.querySelector('#sectionPurchase > div:nth-of-type(2)');

    [cleaning, cosmetics, consolidated].forEach(el => el && el.classList.add('hidden'));
    [ct, xt].forEach(el => el && el.classList.add('hidden'));
    [b1, b2, b3].forEach(btn => {
        if (btn) {
            btn.classList.remove('bg-blue-700', 'bg-pink-700', 'bg-amber-600', 'text-white', 'shadow-md');
            btn.classList.add('text-slate-400');
        }
    });

    if (tab === 'consolidated') {
        consolidated?.classList.remove('hidden');
        b3?.classList.add('bg-amber-600', 'text-white', 'shadow-md');
        b3?.classList.remove('text-slate-400');
        if (addSupplierCard) addSupplierCard.classList.add('hidden');
        switchPurchaseConsolidationView(window.purchaseConsolidationActiveView || 'view');
    } else if (tab === 'cosmetics') {
        if (addSupplierCard) addSupplierCard.classList.remove('hidden');
        cosmetics?.classList.remove('hidden');
        xt?.classList.remove('hidden');
        b2?.classList.add('bg-pink-700', 'text-white', 'shadow-md');
        b2?.classList.remove('text-slate-400');
        renderCosPurchases();
        if (typeof window.updateCosProductDropdowns === 'function') window.updateCosProductDropdowns();
        switchPurchaseActionTab('cosmetics', window.purchaseActionCosmetics || 'add');
    } else {
        if (addSupplierCard) addSupplierCard.classList.remove('hidden');
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
    const supplierCard = document.getElementById('purchaseAddSupplierCard') || document.querySelector('#sectionPurchase > div:nth-of-type(2)');
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
    window.updatePurchaseReturnLiveCalc = updatePurchaseReturnLiveCalc;
    window.openPurchaseReturn = openPurchaseReturn;
    window.savePurchaseReturn = savePurchaseReturn;
    window.deletePurchaseReturn = deletePurchaseReturn;
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
    window.getConsolidatedPurchaseData = getConsolidatedPurchaseData;
    window.switchPurchaseConsolidationView = switchPurchaseConsolidationView;
    window.renderPurchaseConsolidationView = renderPurchaseConsolidationView;
    window.renderPurchaseConsolidationReport = renderPurchaseConsolidationReport;
    window.openSupplierConsolidatedDetail = openSupplierConsolidatedDetail;
    window.closeSupplierConsolidatedDetail = closeSupplierConsolidatedDetail;
    window.shareSelectedSupplierConsolidatedDetail = shareSelectedSupplierConsolidatedDetail;
    window.sharePurchaseConsolidationReport = sharePurchaseConsolidationReport;
    window.downloadPurchaseConsolidationReportPDF = downloadPurchaseConsolidationReportPDF;
}
