/**
 * FIA CLEAN & CARE - Operations: Stock & Product Management Module
 * Handles Cleaning & Cosmetic products, packaging inventory, variants, stock returns, and consolidation.
 */

import {
    state,
    sortByNameAsc,
    todayDDMMYYYY,
    saveLocalStateSafely,
    markIdDeleted,
    unmarkIdDeleted
} from '../core/state.js';
import { syncToFirebase, pullFromFirebase } from '../core/db.js';
import { getProductWholesalePrice, getProductRetailPrice, updateProductDropdown, updateCombinedProductSelect, updateBillQuantityTypeDropdown } from '../billing/billing.js';

export function updatePackageSelectors() {
    const opts = '<option value="">No Package Mapping</option>' + sortByNameAsc(state.packages).map(x => `<option value="${String(x.id)}">${x.name}${x.size ? ' — ' + x.size : ''} (Stock: ${x.stock} ${x.unit || 'Pcs'})</option>`).join('');
    ['prodPackageId', 'cosProdPackageId'].forEach(id => {
        const el = document.getElementById(id); if (!el) return;
        const old = String(el.value || '');
        el.innerHTML = opts;
        el.value = (old && [...el.options].some(o => String(o.value) === old)) ? old : '';
    });
    // Update open variant row package dropdowns if any exist
    document.querySelectorAll('.var-pkg').forEach(sel => {
        const oldVal = sel.value;
        sel.innerHTML = '<option value="">-- Container Package --</option>' + sortByNameAsc(state.packages).map(p => `<option value="${p.id}">${p.name}${p.size ? ' (' + p.size + ')' : ''} (Stock: ${p.stock})</option>`).join('');
        if (oldVal && [...sel.options].some(o => o.value === oldVal)) sel.value = oldVal;
    });
    if (typeof updateBillQuantityTypeDropdown === 'function') updateBillQuantityTypeDropdown();
    if (typeof updateProductDropdown === 'function') updateProductDropdown();
    if (typeof updateCombinedProductSelect === 'function') updateCombinedProductSelect();
}

// ================= PACK SIZE & PRICING VARIANT HELPERS =================
export function addProductVariantRow(target = 'cleaning', data = null) {
    const containerId = target === 'cosmetics' ? 'cosProductVariantsContainer' : 'productVariantsContainer';
    const container = document.getElementById(containerId);
    if (!container) return;

    const v = data || {
        id: 'var_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        name: '',
        size: '',
        unit: target === 'cosmetics' ? 'ml' : 'Ltr',
        packageId: '',
        packageName: '',
        wholesalePrice: '',
        retailPrice: ''
    };

    const pkgOptions = '<option value="">-- Container Package --</option>' +
        sortByNameAsc(state.packages).map(p => `<option value="${p.id}" ${String(p.id) === String(v.packageId) ? 'selected' : ''}>${p.name}${p.size ? ' (' + p.size + ')' : ''} (Stock: ${p.stock})</option>`).join('');

    const row = document.createElement('div');
    row.className = 'prod-variant-row bg-slate-950 p-3 rounded-2xl border border-slate-700/90 space-y-2.5 shadow-sm';
    row.dataset.varId = v.id;
    row.innerHTML = `
        <div class="flex justify-between items-center gap-2">
            <span class="text-[11px] font-extrabold ${target === 'cosmetics' ? 'text-pink-300' : 'text-emerald-300'}">📦 Pack Variant</span>
            <button type="button" onclick="this.closest('.prod-variant-row').remove()" class="bg-red-950/80 hover:bg-red-900 text-red-300 px-2 py-0.5 rounded-lg text-[10px] font-bold border border-red-800" title="Delete Variant">✕ Remove</button>
        </div>
        <div>
            <label class="text-[10px] text-slate-400 block mb-0.5 font-semibold">Pack Name (e.g. 500 ml Bottle, 1 Ltr Can)</label>
            <input type="text" class="var-name w-full p-2 bg-slate-900 border border-slate-700 rounded-xl text-xs ${target === 'cosmetics' ? 'text-pink-300' : 'text-emerald-300'} font-bold focus:outline-none focus:border-emerald-500" placeholder="Pack Name (e.g. 500 ml Bottle)" value="${String(v.name || '').replace(/"/g, '&quot;')}">
        </div>
        <div class="grid grid-cols-2 gap-2">
            <div>
                <label class="text-[10px] text-slate-400 block mb-0.5 font-semibold">Volume / Size:</label>
                <div class="flex gap-1">
                    <input type="number" class="var-size w-3/5 p-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white font-bold focus:outline-none focus:border-emerald-500" placeholder="Size" value="${v.size || ''}" min="0" step="any">
                    <select class="var-unit w-2/5 p-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none">
                        <option value="ml" ${v.unit === 'ml' ? 'selected' : ''}>ml</option>
                        <option value="Ltr" ${v.unit === 'Ltr' ? 'selected' : ''}>Ltr</option>
                        <option value="g" ${v.unit === 'g' ? 'selected' : ''}>g</option>
                        <option value="Kg" ${v.unit === 'Kg' ? 'selected' : ''}>Kg</option>
                        <option value="Pcs" ${v.unit === 'Pcs' ? 'selected' : ''}>Pcs</option>
                        <option value="Bottle" ${v.unit === 'Bottle' ? 'selected' : ''}>Bottle</option>
                    </select>
                </div>
            </div>
            <div>
                <label class="text-[10px] text-cyan-300 block mb-0.5 font-semibold">🧴 Package Container:</label>
                <select class="var-pkg w-full p-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-cyan-200 focus:outline-none focus:border-cyan-500">
                    ${pkgOptions}
                </select>
            </div>
        </div>
        <div class="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800/80">
            <div>
                <label class="text-[10px] text-emerald-400 block mb-0.5 font-extrabold">Retail Price (₹):</label>
                <input type="number" class="var-retail w-full p-2 bg-slate-900 border border-emerald-600/70 rounded-xl text-xs text-emerald-300 font-black focus:outline-none focus:border-emerald-400" placeholder="Enter Retail Price" value="${v.retailPrice !== undefined && v.retailPrice !== '' ? v.retailPrice : ''}" min="0" step="any">
            </div>
            <div>
                <label class="text-[10px] text-amber-400 block mb-0.5 font-extrabold">Wholesale Price (₹):</label>
                <input type="number" class="var-wholesale w-full p-2 bg-slate-900 border border-amber-600/70 rounded-xl text-xs text-amber-300 font-black focus:outline-none focus:border-amber-400" placeholder="Enter Wholesale Price" value="${v.wholesalePrice !== undefined && v.wholesalePrice !== '' ? v.wholesalePrice : ''}" min="0" step="any">
            </div>
        </div>`;
    container.appendChild(row);
}

export function addPresetProductVariant(name, size, unit, target = 'cleaning') {
    let matchedPkg = null;
    const normName = name.toLowerCase();
    const normSize = String(size).toLowerCase();
    matchedPkg = state.packages.find(p => {
        const pn = (p.name || '').toLowerCase();
        const ps = (p.size || '').toLowerCase();
        const sizeMatch = pn.includes(normSize) || ps.includes(normSize);
        const isBottle = normName.includes('bottle') && pn.includes('bottle');
        const isPouch = normName.includes('pouch') && pn.includes('pouch');
        const isCan = normName.includes('can') && pn.includes('can');
        return sizeMatch && (isBottle || isPouch || isCan);
    }) || state.packages.find(p => {
        const pn = (p.name || '').toLowerCase();
        return pn.includes(normSize);
    });

    addProductVariantRow(target, {
        id: 'var_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        name,
        size,
        unit,
        packageId: matchedPkg ? matchedPkg.id : '',
        packageName: matchedPkg ? matchedPkg.name : '',
        wholesalePrice: '',
        retailPrice: ''
    });
}

export function getProductFormVariants(target = 'cleaning') {
    const containerId = target === 'cosmetics' ? 'cosProductVariantsContainer' : 'productVariantsContainer';
    const container = document.getElementById(containerId);
    if (!container) return [];
    const rows = container.querySelectorAll('.prod-variant-row');
    const list = [];
    rows.forEach(r => {
        const name = r.querySelector('.var-name')?.value.trim();
        const size = parseFloat(r.querySelector('.var-size')?.value) || 0;
        const unit = r.querySelector('.var-unit')?.value || 'ml';
        const pkgSelect = r.querySelector('.var-pkg');
        const packageId = pkgSelect?.value || '';
        const pkgOpt = pkgSelect?.selectedOptions?.[0];
        const packageName = pkgOpt && packageId ? pkgOpt.text.split(' (Stock:')[0].trim() : '';
        const wholesalePrice = parseFloat(r.querySelector('.var-wholesale')?.value) || 0;
        const retailPrice = parseFloat(r.querySelector('.var-retail')?.value) || 0;
        const varId = r.dataset.varId || ('var_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6));
        if (name && size > 0) {
            list.push({ id: varId, name, size, unit, packageId, packageName, wholesalePrice, retailPrice });
        }
    });
    return list;
}

export function renderProductVariants(variants, target = 'cleaning') {
    clearProductVariants(target);
    if (!Array.isArray(variants)) return;
    variants.forEach(v => addProductVariantRow(target, v));
}

export function clearProductVariants(target = 'cleaning') {
    const containerId = target === 'cosmetics' ? 'cosProductVariantsContainer' : 'productVariantsContainer';
    const container = document.getElementById(containerId);
    if (container) container.innerHTML = '';
}

export function normalizePackageMapping(packageId, packageQty, packageName) {
    const id = String(packageId || '').trim(), qty = Number(packageQty) || 0;
    let pkg = id ? state.packages.find(x => String(x.id) === id) : null;
    if (!pkg && packageName) {
        const nm = String(packageName).trim().toLowerCase();
        pkg = state.packages.find(x => String(x.name || '').trim().toLowerCase() === nm) || null;
    }
    return pkg && qty > 0 ? { packageId: String(pkg.id), packageQty: qty, packageName: String(pkg.name || '') } : { packageId: '', packageQty: 0, packageName: '' };
}

export function switchPackageActionTab(tab) {
    const addContent = document.getElementById('pkgStockAddContent');
    const viewContent = document.getElementById('pkgStockViewContent');
    const consContent = document.getElementById('pkgStockConsolidatedContent');
    const addTab = document.getElementById('pkgStockAddTab');
    const viewTab = document.getElementById('pkgStockViewTab');
    const consTab = document.getElementById('pkgStockConsolidatedTab');

    [addContent, viewContent, consContent].forEach(el => el && el.classList.add('hidden'));
    [addTab, viewTab, consTab].forEach(btn => {
        if (btn) {
            btn.classList.remove('bg-cyan-700', 'text-white', 'shadow-md');
            btn.classList.add('text-slate-400');
        }
    });

    if (tab === 'view') {
        if (viewContent) viewContent.classList.remove('hidden');
        if (viewTab) {
            viewTab.classList.add('bg-cyan-700', 'text-white', 'shadow-md');
            viewTab.classList.remove('text-slate-400');
        }
        renderPackages();
    } else if (tab === 'consolidated') {
        if (consContent) consContent.classList.remove('hidden');
        if (consTab) {
            consTab.classList.add('bg-cyan-700', 'text-white', 'shadow-md');
            consTab.classList.remove('text-slate-400');
        }
        renderPackageConsolidationReport();
    } else {
        if (addContent) addContent.classList.remove('hidden');
        if (addTab) {
            addTab.classList.add('bg-cyan-700', 'text-white', 'shadow-md');
            addTab.classList.remove('text-slate-400');
        }
    }
}

export function switchStockTopTab(tab) {
    if (typeof pullFromFirebase === 'function') pullFromFirebase();
    const productArea = document.getElementById('stockProductArea');
    const packageArea = document.getElementById('stockPackageArea');
    const p = document.getElementById('stockTopProduct');
    const q = document.getElementById('stockTopPackage');
    if (tab === 'package') {
        productArea?.classList.add('hidden');
        packageArea?.classList.remove('hidden');
        p?.classList.remove('bg-emerald-700', 'text-white', 'shadow-md');
        p?.classList.add('text-slate-400');
        q?.classList.add('bg-cyan-700', 'text-white', 'shadow-md');
        q?.classList.remove('text-slate-400');
        renderPackages();
        updatePackageSelectors();
        switchPackageActionTab(state.packages && state.packages.length > 0 ? 'view' : 'add');
    } else {
        packageArea?.classList.add('hidden');
        productArea?.classList.remove('hidden');
        q?.classList.remove('bg-cyan-700', 'text-white', 'shadow-md');
        q?.classList.add('text-slate-400');
        p?.classList.add('bg-emerald-700', 'text-white', 'shadow-md');
        p?.classList.remove('text-slate-400');
    }
}

export function switchStockSubTab(tab) {
    if (typeof pullFromFirebase === 'function') pullFromFirebase();
    const cleaning = document.getElementById('stockCleaningContent');
    const cosmetics = document.getElementById('stockCosmeticsContent');
    const b1 = document.getElementById('subTabStockCleaning');
    const b2 = document.getElementById('subTabStockCosmetics');
    [cleaning, cosmetics].forEach(el => el && el.classList.add('hidden'));
    [b1, b2].forEach(btn => {
        if (btn) {
            btn.classList.remove('bg-emerald-700', 'bg-pink-700', 'text-white', 'shadow-md');
            btn.classList.add('text-slate-400');
        }
    });
    if (tab === 'cosmetics') {
        cosmetics?.classList.remove('hidden');
        b2?.classList.add('bg-pink-700', 'text-white', 'shadow-md');
        b2?.classList.remove('text-slate-400');
        renderCosProductStock();
        updateCosProductDropdowns();
        updateStockReturnDropdowns();
        renderStockReturnHistory();
        switchStockActionTab('cosmetics', 'add');
    } else {
        cleaning?.classList.remove('hidden');
        b1?.classList.add('bg-emerald-700', 'text-white', 'shadow-md');
        b1?.classList.remove('text-slate-400');
        renderProducts();
        updateStockReturnDropdowns();
        renderStockReturnHistory();
        switchStockActionTab('cleaning', 'add');
    }
}

export function switchStockActionTab(type, tab) {
    if (tab === 'view' || tab === 'consolidated') {
        if (typeof pullFromFirebase === 'function') pullFromFirebase();
    }
    const prefix = type === 'cosmetics' ? 'cos' : 'clean';
    const ids = ['add', 'view', 'return', 'consolidated'];
    ids.forEach(t => {
        const content = document.getElementById(prefix + 'Stock' + t.charAt(0).toUpperCase() + t.slice(1) + 'Content');
        const button = document.getElementById(prefix + 'Stock' + t.charAt(0).toUpperCase() + t.slice(1) + 'Tab');
        if (content) content.classList.toggle('hidden', t !== tab);
        if (button) {
            button.classList.remove('bg-emerald-700', 'bg-pink-700', 'text-white', 'shadow-md');
            button.classList.add('text-slate-400');
            if (t === tab) {
                button.classList.add(type === 'cosmetics' ? 'bg-pink-700' : 'bg-emerald-700', 'text-white', 'shadow-md');
                button.classList.remove('text-slate-400');
            }
        }
    });
    if (tab === 'view') {
        if (type === 'cosmetics') renderCosProductStock(); else renderProducts();
    } else if (tab === 'return') {
        updateStockReturnDropdowns();
        renderStockReturnHistory();
    } else if (tab === 'consolidated') {
        renderConsolidatedStockReport();
    }
}

export function savePackage(e) {
    e.preventDefault();
    const id = document.getElementById('packageId').value;
    const name = document.getElementById('packageName').value.trim();
    const size = document.getElementById('packageSize').value.trim();
    const unit = document.getElementById('packageUnit').value;
    const stock = parseFloat(document.getElementById('packageStock').value) || 0;
    if (!name) return;
    const pkgId = id || ('pkg_' + Date.now());
    unmarkIdDeleted(pkgId);
    const stamp = Date.now();
    const data = { id: pkgId, name, size, unit, stock, savedAt: stamp };
    if (id) {
        const i = state.packages.findIndex(x => String(x.id) === String(id));
        if (i >= 0) state.packages[i] = { ...state.packages[i], ...data };
        else state.packages.push(data);
    } else {
        state.packages.push(data);
    }
    syncToFirebase();
    resetPackageForm();
    renderPackages();
    updatePackageSelectors();
    if (typeof updateProductDropdown === 'function') updateProductDropdown();
    if (typeof updateCombinedProductSelect === 'function') updateCombinedProductSelect();
    switchPackageActionTab('view');
}

export function resetPackageForm() {
    const f = document.getElementById('packageForm');
    if (f) f.reset();
    document.getElementById('packageId').value = '';
    const btn = document.getElementById('packageSubmitBtn');
    if (btn) btn.textContent = '💾 Save Package';
    const title = document.querySelector('#pkgStockAddContent h2');
    if (title) title.textContent = '🧴 Add Package Item';
    const unitEl = document.getElementById('packageUnit');
    if (unitEl) unitEl.value = 'Pcs';
}

export function editPackage(id) {
    const pkg = state.packages.find(x => String(x.id) === String(id));
    if (!pkg) return;
    if (typeof window.switchTab === 'function') window.switchTab('stock', false);
    if (typeof window.switchStockTopTab === 'function') window.switchStockTopTab('package');
    switchPackageActionTab('add');
    document.getElementById('packageId').value = pkg.id;
    document.getElementById('packageName').value = pkg.name || '';
    document.getElementById('packageSize').value = pkg.size || '';
    document.getElementById('packageUnit').value = pkg.unit || 'Pcs';
    document.getElementById('packageStock').value = pkg.stock ?? 0;
    const btn = document.getElementById('packageSubmitBtn');
    if (btn) btn.textContent = '💾 Update Package';
    setTimeout(() => {
        const title = document.querySelector('#pkgStockAddContent h2');
        if (title) title.textContent = '✏️ Edit Package Item';
        document.getElementById('packageForm')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        document.getElementById('packageName')?.focus();
    }, 50);
}

export function deletePackage(id) {
    if (!id) return;
    const pkg = state.packages.find(x => String(x.id) === String(id));
    const name = pkg ? pkg.name : 'package item';
    if (!confirm(`Delete package item "${name}"?`)) return;
    markIdDeleted(id);
    state.packages = state.packages.filter(x => String(x.id) !== String(id));
    const stamp = Date.now();
    state.products.forEach(p => { if (String(p.packageId) === String(id)) { p.packageId = ''; p.packageQty = 0; p.savedAt = stamp; } });
    state.cosProducts.forEach(p => { if (String(p.packageId) === String(id)) { p.packageId = ''; p.packageQty = 0; p.savedAt = stamp; } });
    syncToFirebase();
    if (typeof window.renderAll === 'function') window.renderAll();
    renderPackages();
    switchPackageActionTab('view');
}

export function addPackageStock(id, qty) {
    const x = state.packages.find(p => String(p.id) === String(id));
    if (!x || !(qty > 0)) return;
    x.stock = (Number(x.stock) || 0) + qty;
    x.savedAt = Date.now();
    syncToFirebase();
    renderPackages();
    updatePackageSelectors();
}

export function renderPackages() {
    const c = document.getElementById('packageListContainer');
    if (!c) return;
    c.innerHTML = sortByNameAsc(state.packages).map(x => `
        <div class="bg-slate-900/70 border border-slate-800 rounded-xl p-3.5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 text-xs">
            <div class="min-w-0 flex-1 pr-2 break-words">
                <p class="font-bold text-cyan-300 text-sm">${x.name}</p>
                <p class="text-slate-400 mt-1">Size: <span class="text-slate-200">${x.size || '—'}</span> | Unit: <span class="text-slate-200">${x.unit || 'Pcs'}</span> | Stock: <span class="${(Number(x.stock) || 0) <= 5 ? 'text-rose-400 font-bold' : 'text-emerald-300 font-bold'}">${x.stock ?? 0}</span></p>
            </div>
            <div class="flex flex-wrap gap-1.5 items-center justify-end shrink-0 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800/80">
                <div class="flex items-center gap-1 mr-1">
                    <input id="pkgAdd_${x.id}" type="number" min="0" step="any" placeholder="+Qty" class="w-14 px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-cyan-500">
                    <button type="button" onclick="addPackageStock('${x.id}',parseFloat(document.getElementById('pkgAdd_${x.id}').value)||0);document.getElementById('pkgAdd_${x.id}').value=''" class="bg-cyan-900/80 hover:bg-cyan-800 text-cyan-200 px-2 py-1.5 rounded-lg border border-cyan-700 text-xs font-semibold">+Stock</button>
                </div>
                <button type="button" onclick="viewPackage('${x.id}')" class="bg-blue-900 hover:bg-blue-800 text-blue-200 px-2.5 py-1.5 rounded-lg border border-blue-800 font-bold text-xs">👁️ View</button>
                <button type="button" onclick="editPackage('${x.id}')" class="bg-slate-800 hover:bg-slate-700 text-amber-300 px-2.5 py-1.5 rounded-lg border border-slate-700 font-bold text-xs">✏️ Edit</button>
                <button type="button" onclick="deletePackage('${x.id}')" class="bg-slate-800 hover:bg-slate-700 text-red-400 px-2.5 py-1.5 rounded-lg border border-slate-700 font-bold text-xs">🗑️ Delete</button>
            </div>
        </div>`).join('') || '<p class="text-xs text-slate-500 text-center py-6">No package items added yet.</p>';
    renderPackageConsolidationReport();
    if (typeof window.checkLowStockAlerts === 'function') window.checkLowStockAlerts();
    if (typeof window.updateDashboard === 'function') window.updateDashboard();
}

export function switchPackageView(view) {
    if (view === 'report') {
        switchPackageActionTab('consolidated');
    } else {
        switchPackageActionTab('view');
    }
}

export function renderPackageConsolidationReport() {
    const rows = sortByNameAsc(state.packages || []).map(p => ({ name: p.name || '', size: p.size || '', stock: Number(p.stock) || 0, unit: p.unit || 'Pcs' }));
    const summary = [['Total Items', rows.length], ['Total Stock', rows.reduce((s, r) => s + r.stock, 0)], ['Low Stock', rows.filter(r => r.stock <= 5).length], ['Units Used', new Set(rows.map(r => r.unit).filter(Boolean)).size]];
    const sh = document.getElementById('packageReportSummary');
    if (sh) sh.innerHTML = summary.map(([l, v]) => `<div class="bg-slate-900 rounded-lg p-3"><div class="text-[10px] text-slate-400">${l}</div><b class="text-sm text-white">${v}</b></div>`).join('');
    const tb = document.getElementById('packageReportTableBody');
    if (tb) tb.innerHTML = rows.length ? rows.map((r, i) => `<tr class="border-t border-slate-800"><td class="p-2 text-slate-500">${i + 1}</td><td class="p-2 text-cyan-300 font-semibold">${r.name || '—'}</td><td class="p-2 text-slate-400">${r.size || '—'}</td><td class="p-2 text-right font-bold ${r.stock <= 5 ? 'text-rose-300' : 'text-white'}">${r.stock}</td><td class="p-2 text-slate-300">${r.unit}</td><td class="p-2 ${r.stock <= 5 ? 'text-rose-300' : 'text-emerald-300'}">${r.stock <= 5 ? 'LOW STOCK' : 'OK'}</td></tr>`).join('') : '<tr><td colspan="6" class="p-5 text-center text-slate-500">No package items found.</td></tr>';
    const um = {};
    rows.forEach(r => um[r.unit] = (um[r.unit] || 0) + r.stock);
    const uh = document.getElementById('packageReportUnitTotals');
    if (uh) uh.innerHTML = Object.entries(um).sort((a, b) => a[0].localeCompare(b[0])).map(([u, t]) => `<div class="flex justify-between bg-slate-900/70 border border-slate-800 rounded-lg px-3 py-2 text-[11px]"><span class="text-slate-400">Total ${u}</span><b class="text-slate-200">${t}</b></div>`).join('') || '<div class="text-[10px] text-slate-500">No stock data.</div>';
}

export function getProductPackageInfo(product) {
    if (!product) return null;
    const packageId = String(product.packageId || '');
    const pkg = packageId ? state.packages.find(x => String(x.id) === packageId) : null;
    const qty = Number(product.packageQty) || 0;
    return pkg && qty > 0 ? { id: pkg.id, qty, pkg } : null;
}

export function getPackageSellingUnits(item) {
    return Math.max(1, Number(item?.numberOfUnits) || 1);
}

export function resolvePackageInfoForItem(item) {
    if (!item) return null;
    if (item.isPackage) {
        const pkg = state.packages.find(x => String(x.id) === String(item.packageId) || x.name === item.productName);
        if (pkg) return { id: pkg.id, qty: 1, pkg, product: null };
    }
    let product = null;
    const category = String(item.combinedCategory || item.category || 'Cleaning');
    if (item.stockId) {
        product = (category === 'Cosmetics' ? state.cosProducts.find(x => String(x.id) === String(item.stockId)) : state.products.find(x => String(x.id) === String(item.stockId))) || null;
        if (!product) product = state.cosProducts.find(x => String(x.id) === String(item.stockId)) || state.products.find(x => String(x.id) === String(item.stockId)) || null;
    }
    if (!product && item.productName) {
        const nm = String(item.productName).trim().toLowerCase();
        const list = category === 'Cosmetics' ? [...state.cosProducts, ...state.products] : [...state.products, ...state.cosProducts];
        product = list.find(x => String(x.name || '').trim().toLowerCase() === nm) || null;
    }

    let packageId = String(item.packageId || product?.packageId || '');
    let packageQty = Number(item.packageQty) > 0 ? Number(item.packageQty) : Number(product?.packageQty) || 0;
    const packageName = String(item.packageName || product?.packageName || '').trim().toLowerCase();
    let pkg = packageId ? state.packages.find(x => String(x.id) === packageId) : null;
    if (!pkg && packageName) pkg = state.packages.find(x => String(x.name || '').trim().toLowerCase() === packageName) || null;
    if (pkg && packageQty > 0) return { id: pkg.id, qty: packageQty, pkg, product };

    const sellingType = String(item.quantityType || '').trim().toLowerCase();
    if (sellingType) {
        const directPkg = state.packages.find(x => String(x.name || '').trim().toLowerCase() === sellingType);
        if (directPkg) return { id: directPkg.id, qty: 1, pkg: directPkg, product };
    }

    const qty = Number(item.qty) || 0;
    const unitType = String(item.unitType || '').trim().toLowerCase();
    const productName = String(item.productName || product?.name || '').trim().toLowerCase();
    if (!sellingType || !state.packages.length) return null;

    function normUnit(u) {
        u = String(u || '').toLowerCase().trim();
        if (['millilitre', 'millilitres', 'milliliter', 'milliliters', 'ml'].includes(u)) return 'ml';
        if (['litre', 'litres', 'liter', 'liters', 'ltr', 'l'].includes(u)) return 'l';
        if (['kilogram', 'kilograms', 'kilogramme', 'kg'].includes(u)) return 'kg';
        if (['gram', 'grams', 'g'].includes(u)) return 'g';
        return u;
    }
    function extSize(v) {
        const m = String(v || '').toLowerCase().replace(/,/g, '').match(/(\d+(?:\.\d+)?)\s*(ml|millilitres?|l|ltr|litres?|liters?|kg|kilograms?|g|grams?)/i);
        return m ? { n: Number(m[1]), u: normUnit(m[2]) } : null;
    }
    const billSize = { n: qty, u: normUnit(unitType) };
    const typeWord = sellingType === 'bottle' ? 'bottle' : sellingType === 'pack' ? 'pack' : sellingType;

    const candidates = state.packages.map(x => {
        const pu = String(x.unit || 'Pcs').trim().toLowerCase();
        const pn = String(x.name || '').trim().toLowerCase();
        const ps = extSize(x.size);
        const pnSize = extSize(x.name);
        let score = -1;

        const typeOk = sellingType === 'bottle'
            ? (pu === 'bottle' || pu === 'bottles' || pn.includes('bottle'))
            : sellingType === 'pack'
                ? (pu === 'pack' || pu === 'packs' || pn.includes('pack'))
                : (pu === sellingType || pn.includes(typeWord));
        const pcsFallback = (pu === 'pcs' || pu === 'piece' || pu === 'pieces') && (pn.includes(typeWord));
        if (typeOk || pcsFallback) score = 40;
        else return { ...x, score: -1 };

        if (pn === sellingType || pn === typeWord) score += 200;
        if (ps && ps.n === billSize.n && ps.u === billSize.u) score += 300;
        if (pnSize && pnSize.n === billSize.n && pnSize.u === billSize.u) score += 260;
        if (productName && pn.includes(productName)) score += 120;
        const productWords = productName.split(/\s+/).filter(w => w.length >= 3);
        productWords.forEach(w => { if (pn.includes(w)) score += 8; });

        const billSizeText = (qty + ' ' + billSize.u).replace(/\s+/g, '').toLowerCase();
        if (String(x.size || '').toLowerCase().replace(/\s+/g, '').includes(billSizeText)) score += 180;
        if (pn.replace(/\s+/g, '').includes(billSizeText)) score += 160;

        return { ...x, score };
    }).filter(x => x.score > 40).sort((a, b) => b.score - a.score);

    if (!candidates.length) return null;
    const best = candidates[0];
    return { id: best.id, qty: 1, pkg: state.packages.find(x => String(x.id) === String(best.id)) || best, product };
}

export function restorePackageStock(items) {
    (items || []).forEach(item => {
        const info = resolvePackageInfoForItem(item);
        if (info && info.pkg) info.pkg.stock = (Number(info.pkg.stock) || 0) + info.qty * getPackageSellingUnits(item);
    });
}

export function checkAndDeductPackageStock(items) {
    const need = {};
    const missing = [];
    (items || []).forEach(item => {
        const info = resolvePackageInfoForItem(item);
        if (info) {
            need[info.id] = (need[info.id] || 0) + info.qty * getPackageSellingUnits(item);
        } else {
            const hasPackageIntent = item?.packageId || item?.isPackage || (item?.quantityType && item.quantityType !== 'General' && item.quantityType !== 'Other');
            if (hasPackageIntent && state.packages.length > 0) {
                missing.push(item?.productName || 'Unknown Product');
            }
        }
    });
    if (missing.length) {
        return { ok: false, missing: true, products: [...new Set(missing)] };
    }
    for (const id in need) {
        const pkg = state.packages.find(x => String(x.id) === String(id));
        if (!pkg) return { ok: false, missing: true, products: ['Package mapping not found'] };
        if (need[id] > Number(pkg.stock || 0)) return { ok: false, pkg, need: need[id] };
    }
    for (const id in need) {
        const pkg = state.packages.find(x => String(x.id) === String(id));
        if (pkg) pkg.stock = (Number(pkg.stock) || 0) - need[id];
    }
    saveLocalStateSafely();
    return { ok: true, need };
}

export function saveProduct(e) {
    e.preventDefault();
    const id = document.getElementById('prodId').value;
    const name = document.getElementById('prodName').value.trim();
    const barcode = document.getElementById('prodBarcode').value.trim();
    const stock = parseFloat(document.getElementById('prodStock').value) || 0;
    const unit = document.getElementById('prodUnit').value;
    const wholesalePrice = parseFloat(document.getElementById('prodWholesalePrice').value) || 0;
    const retailPrice = parseFloat(document.getElementById('prodRetailPrice').value) || 0;
    const rawPackageId = document.getElementById('prodPackageId')?.value || '';
    const rawPackageQty = parseFloat(document.getElementById('prodPackageQty')?.value) || 0;
    const selectedText = document.getElementById('prodPackageId')?.selectedOptions?.[0]?.textContent || '';
    const mapped = normalizePackageMapping(rawPackageId, rawPackageQty, selectedText.split(' (Stock:')[0]);
    const packageId = mapped.packageId, packageQty = mapped.packageQty, packageName = mapped.packageName;
    if (rawPackageId && !packageId) { alert('Selected package was not found. Please refresh the package list and select the package again.'); return; }
    const variants = getProductFormVariants('cleaning');
    const finalProdId = id === "" ? ('prod_' + Date.now().toString()) : id;
    unmarkIdDeleted(finalProdId);
    const stamp = Date.now();
    const prodData = { id: finalProdId, name, barcode, stock, unit, wholesalePrice, retailPrice, packageId, packageQty, packageName, variants, savedAt: stamp };
    if (id === "") { state.products.push(prodData); }
    else { const idx = state.products.findIndex(p => String(p.id) === String(id)); if (idx !== -1) state.products[idx] = { ...state.products[idx], ...prodData }; }
    syncToFirebase();
    resetProductForm();
    renderProducts();
    if (typeof updateProductDropdown === 'function') updateProductDropdown();
    if (typeof updateCosProductDropdowns === 'function') updateCosProductDropdowns();
    if (typeof updateCleaningAddStockDropdown === 'function') updateCleaningAddStockDropdown();
    if (typeof window.checkLowStockAlerts === 'function') window.checkLowStockAlerts();
    updateStockReturnDropdowns();
}

export function addCleaningStock() {
    const id = document.getElementById('cleanAddStockProduct')?.value;
    const qty = parseFloat(document.getElementById('cleanAddStockQty')?.value);
    if (!id || !(qty > 0)) { alert('Product and valid stock quantity are required.'); return; }
    const p = state.products.find(x => x.id === id); if (!p) return;
    p.stock = (parseFloat(p.stock) || 0) + qty;
    p.savedAt = Date.now();
    syncToFirebase();
    document.getElementById('cleanAddStockQty').value = ''; renderProducts();
    if (typeof updateProductDropdown === 'function') updateProductDropdown();
    updateCleaningAddStockDropdown();
    updateStockReturnDropdowns();
}

export function updateCleaningAddStockDropdown() {
    const sel = document.getElementById('cleanAddStockProduct');
    if (!sel) return;
    sel.innerHTML = '<option value="">Product</option>';
    sortByNameAsc(state.products).forEach(p => {
        sel.innerHTML += `<option value="${p.id}">${p.name} (Current: ${p.stock} ${p.unit})</option>`;
    });
}


export function saveStockReturn(event, type) {
    event.preventDefault();
    const isCos = type === 'cosmetics';
    const productSelect = document.getElementById(isCos ? 'cosReturnProduct' : 'cleanReturnProduct');
    const customerEl = document.getElementById(isCos ? 'cosReturnCustomer' : 'cleanReturnCustomer');
    const qtyEl = document.getElementById(isCos ? 'cosReturnQty' : 'cleanReturnQty');
    const conditionEl = document.getElementById(isCos ? 'cosReturnCondition' : 'cleanReturnCondition');
    const reasonEl = document.getElementById(isCos ? 'cosReturnReason' : 'cleanReturnReason');
    const remarksEl = document.getElementById(isCos ? 'cosReturnRemarks' : 'cleanReturnRemarks');
    const id = productSelect?.value;
    const qty = parseFloat(qtyEl?.value);
    const condition = conditionEl?.value;
    const list = isCos ? state.cosProducts : state.products;
    const product = list.find(p => p.id === id);

    if (!id || !product || !(qty > 0) || !condition) {
        alert('Product, valid return quantity and condition are required.');
        return;
    }

    if (condition === 'Usable') {
        product.stock = (parseFloat(product.stock) || 0) + qty;
        product.savedAt = Date.now();
    }

    state.stockReturns.push({
        id: 'ret_' + Date.now().toString() + '_' + Math.random().toString(36).slice(2, 7),
        type,
        productId: product.id,
        productName: product.name,
        unit: product.unit,
        customer: (customerEl?.value || '').trim(),
        qty,
        condition,
        reason: (reasonEl?.value || '').trim(),
        remarks: (remarksEl?.value || '').trim(),
        date: todayDDMMYYYY(),
        savedAt: Date.now()
    });

    syncToFirebase();

    const form = document.getElementById(isCos ? 'cosReturnStockForm' : 'cleanReturnStockForm');
    if (form) form.reset();

    renderProducts();
    renderCosProductStock();
    if (typeof updateProductDropdown === 'function') updateProductDropdown();
    updateCosProductDropdowns();
    if (typeof updateCleaningAddStockDropdown === 'function') updateCleaningAddStockDropdown();
    updateStockReturnDropdowns();
    renderStockReturnHistory();

    alert(condition === 'Usable'
        ? `${qty} ${product.unit} returned to usable stock successfully.`
        : `${qty} ${product.unit} recorded as damaged. It was NOT added to usable stock.`);
}

export function updateStockReturnDropdowns() {
    const clean = document.getElementById('cleanReturnProduct');
    const cos = document.getElementById('cosReturnProduct');

    if (clean) {
        clean.innerHTML = '<option value="">-- Select Cleaning Product --</option>';
        sortByNameAsc(state.products).forEach(p => {
            clean.innerHTML += `<option value="${p.id}">${p.name} (Stock: ${p.stock} ${p.unit})</option>`;
        });
    }

    if (cos) {
        cos.innerHTML = '<option value="">-- Select Cosmetic Product --</option>';
        sortByNameAsc(state.cosProducts).forEach(p => {
            cos.innerHTML += `<option value="${p.id}">${p.name} (Stock: ${p.stock} ${p.unit})</option>`;
        });
    }
}

export function renderStockReturnHistory() {
    const clean = document.getElementById('cleanReturnHistoryContainer');
    const cos = document.getElementById('cosReturnHistoryContainer');
    const render = (container, type) => {
        if (!container) return;
        const rows = state.stockReturns.filter(r => r.type === type).slice().reverse();
        if (!rows.length) {
            container.innerHTML = '<p class="text-[10px] text-slate-500 text-center py-2">No return records yet.</p>';
            return;
        }
        container.innerHTML = rows.slice(0, 30).map(r => `
            <div class="bg-slate-900/70 border border-slate-800 rounded-xl p-2.5 text-[10px]">
                <div class="flex justify-between gap-2">
                    <span class="font-bold text-slate-200">${r.productName}</span>
                    <span class="${r.condition === 'Usable' ? 'text-emerald-300' : 'text-rose-300'} font-bold">${r.condition}</span>
                </div>
                <div class="text-slate-400 mt-1">${r.qty} ${r.unit} • ${r.date}${r.customer ? ' • ' + r.customer : ''}</div>
                ${r.reason ? `<div class="text-slate-500 mt-1">Reason: ${r.reason}</div>` : ''}
                ${r.remarks ? `<div class="text-slate-500">Remarks: ${r.remarks}</div>` : ''}
            </div>`).join('');
    };
    render(clean, 'cleaning');
    render(cos, 'cosmetics');
}

export function renderProducts() {
    const container = document.getElementById('productListContainer');
    if (!container) return;
    container.innerHTML = state.products.length === 0 ? '<p class="text-xs text-slate-500 text-center py-2">No products added yet.</p>' : '';
    sortByNameAsc(state.products).forEach((p) => {
        const variantsBadgeHtml = (p.variants && p.variants.length > 0)
            ? `<div class="flex flex-wrap gap-1 mt-1.5">${p.variants.map(v => `<span class="bg-slate-900 border border-slate-700 text-[10px] px-2 py-0.5 rounded-md text-cyan-300 font-semibold">📦 ${v.name}: ₹${v.retailPrice}</span>`).join('')}</div>`
            : '';
        const wPrice = getProductWholesalePrice(p);
        const rPrice = getProductRetailPrice(p);
        const hasCustomWholesale = (p.wholesalePrice !== undefined && p.wholesalePrice !== null && p.wholesalePrice !== '' && !isNaN(Number(p.wholesalePrice)));
        const wBadge = hasCustomWholesale
            ? `<span class="text-amber-300 font-semibold">W: ₹${Number(p.wholesalePrice).toFixed(2)}</span>`
            : `<span class="text-amber-400/80 italic text-[10px]" title="Wholesale rate not explicitly set, defaulting to Retail rate">W: Not set (₹${wPrice.toFixed(2)})</span>`;
        const rBadge = `<span class="text-emerald-400 font-semibold">R: ₹${rPrice.toFixed(2)}</span>`;
        container.innerHTML += `
            <div class="bg-slate-950/60 p-3 rounded-xl border border-slate-800 flex justify-between items-center text-xs">
                <div class="min-w-0 flex-1 pr-2 break-words">
                    <p class="font-bold text-emerald-300">${p.name} ${p.barcode ? '<span class="text-[10px] text-slate-400">[' + p.barcode + ']</span>' : ''}</p>
                    <p class="text-slate-400">Stock: <span class="${p.stock <= 5 ? 'text-rose-400 font-bold' : ''}">${p.stock} ${p.unit}</span> | ${wBadge} | ${rBadge}</p>
                    ${variantsBadgeHtml}
                </div>
                <div class="flex flex-wrap gap-1 justify-end shrink-0">
                    <button type="button" onclick="viewProduct('${p.id}')" class="bg-blue-900 text-blue-200 px-2 py-1.5 rounded-lg border border-blue-800">View</button>
                    <button type="button" onclick="editProduct('${p.id}')" class="bg-slate-800 text-emerald-400 px-2 py-1.5 rounded-lg border border-slate-700 hover:bg-slate-700">Edit</button>
                    <button type="button" onclick="deleteProduct('${p.id}')" class="bg-slate-800 text-red-400 px-2 py-1.5 rounded-lg border border-slate-700 hover:bg-slate-700">Delete</button>
                </div>
            </div>`;
    });
    if (typeof window.checkLowStockAlerts === 'function') window.checkLowStockAlerts();
}

export function editProduct(id) {
    const p = state.products.find(item => item.id === id);
    if (p) {
        if (typeof window.switchTab === 'function') window.switchTab('stock', false);
        if (typeof window.switchStockSubTab === 'function') window.switchStockSubTab('cleaning');
        if (typeof window.switchStockActionTab === 'function') window.switchStockActionTab('cleaning', 'add');
        document.getElementById('prodId').value = p.id;
        document.getElementById('prodName').value = p.name || '';
        document.getElementById('prodBarcode').value = p.barcode || '';
        document.getElementById('prodStock').value = p.stock ?? 0;
        document.getElementById('prodUnit').value = p.unit || '';
        const wp = (p.wholesalePrice !== undefined && p.wholesalePrice !== null && p.wholesalePrice !== '') ? p.wholesalePrice : (p.costPrice || p.price1 || '');
        const rp = (p.retailPrice !== undefined && p.retailPrice !== null && p.retailPrice !== '') ? p.retailPrice : (p.salePrice || p.price || '');
        document.getElementById('prodWholesalePrice').value = wp !== '' ? wp : '';
        document.getElementById('prodRetailPrice').value = rp !== '' ? rp : '';
        updatePackageSelectors();
        document.getElementById('prodPackageId').value = p.packageId || '';
        document.getElementById('prodPackageQty').value = p.packageQty ?? 1;
        renderProductVariants(p.variants || [], 'cleaning');
        document.getElementById('stockFormTitle').innerText = "Edit Product";
        document.getElementById('prodSubmitBtn').innerText = "Update Product";
        setTimeout(() => document.getElementById('stockFormTitle')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
    }
}

export function deleteProduct(id) {
    if (!id) return;
    const p = state.products.find(x => String(x.id) === String(id));
    const name = p ? p.name : 'product';
    if (confirm(`Are you sure you want to delete "${name}"?`)) {
        markIdDeleted(id);
        state.products = state.products.filter(p => String(p.id) !== String(id));
        syncToFirebase();
        if (typeof window.renderAll === 'function') window.renderAll();
    }
}

export function resetProductForm() {
    document.getElementById('productForm').reset();
    document.getElementById('prodId').value = "";
    document.getElementById('stockFormTitle').innerText = "Add New Product";
    document.getElementById('prodSubmitBtn').innerText = "Add Product";
    if (document.getElementById('prodPackageId')) document.getElementById('prodPackageId').value = '';
    if (document.getElementById('prodPackageQty')) document.getElementById('prodPackageQty').value = '1';
    clearProductVariants('cleaning');
}

export function saveCosProduct(e) {
    e.preventDefault();
    const id = document.getElementById('cosProdId').value;
    const name = document.getElementById('cosProdName').value.trim();
    const barcode = document.getElementById('cosProdBarcode').value.trim();
    const stock = parseFloat(document.getElementById('cosProdStock').value) || 0;
    const unit = document.getElementById('cosProdUnit').value;
    const costPrice = parseFloat(document.getElementById('cosProdCostPrice').value) || 0;
    const salePrice = parseFloat(document.getElementById('cosProdSalePrice').value) || 0;
    const rawPackageId = document.getElementById('cosProdPackageId')?.value || '';
    const rawPackageQty = parseFloat(document.getElementById('cosProdPackageQty')?.value) || 0;
    const selectedText = document.getElementById('cosProdPackageId')?.selectedOptions?.[0]?.textContent || '';
    const mapped = normalizePackageMapping(rawPackageId, rawPackageQty, selectedText.split(' (Stock:')[0]);
    const packageId = mapped.packageId, packageQty = mapped.packageQty, packageName = mapped.packageName;

    if (!name || !unit) return;
    if (rawPackageId && !packageId) { alert('Selected package was not found. Please refresh the package list and select the package again.'); return; }
    const variants = getProductFormVariants('cosmetics');
    const finalCosId = id === '' ? ('cp_' + Date.now().toString()) : id;
    unmarkIdDeleted(finalCosId);
    const stamp = Date.now();
    const cosData = {
        id: finalCosId,
        name, barcode, stock, unit, costPrice, salePrice,
        wholesalePrice: costPrice, retailPrice: salePrice,
        packageId, packageQty, packageName, variants,
        savedAt: stamp
    };
    if (id === '') {
        state.cosProducts.push(cosData);
    } else {
        const idx = state.cosProducts.findIndex(p => p.id === id);
        if (idx !== -1) {
            state.cosProducts[idx] = { ...state.cosProducts[idx], ...cosData };
        }
    }
    syncToFirebase();
    resetCosProductForm();
    renderCosProductStock();
    updateCosProductDropdowns();
    if (typeof updateCleaningAddStockDropdown === 'function') updateCleaningAddStockDropdown();
    updateStockReturnDropdowns();
}

export function addCosmeticStock() {
    const id = document.getElementById('cosAddStockProduct').value;
    const qty = parseFloat(document.getElementById('cosAddStockQty').value);
    if (!id || !(qty > 0)) {
        alert('Product and valid stock quantity are required.');
        return;
    }
    const p = state.cosProducts.find(x => x.id === id);
    if (!p) return;
    p.stock = (parseFloat(p.stock) || 0) + qty;
    p.savedAt = Date.now();
    syncToFirebase();
    document.getElementById('cosAddStockQty').value = '';
    renderCosProductStock();
    updateCosProductDropdowns();
    updateStockReturnDropdowns();
}

export function editCosProduct(id) {
    const p = state.cosProducts.find(x => x.id === id);
    if (!p) return;
    if (typeof window.switchTab === 'function') window.switchTab('stock', false);
    if (typeof window.switchStockSubTab === 'function') window.switchStockSubTab('cosmetics');
    if (typeof window.switchStockActionTab === 'function') window.switchStockActionTab('cosmetics', 'add');
    document.getElementById('cosProdId').value = p.id;
    document.getElementById('cosProdName').value = p.name || '';
    document.getElementById('cosProdBarcode').value = p.barcode || '';
    document.getElementById('cosProdStock').value = p.stock ?? 0;
    document.getElementById('cosProdUnit').value = p.unit || '';
    const wp = (p.wholesalePrice !== undefined && p.wholesalePrice !== null && p.wholesalePrice !== '') ? p.wholesalePrice : (p.costPrice ?? '');
    const rp = (p.retailPrice !== undefined && p.retailPrice !== null && p.retailPrice !== '') ? p.retailPrice : (p.salePrice ?? '');
    document.getElementById('cosProdCostPrice').value = wp;
    document.getElementById('cosProdSalePrice').value = rp;
    updatePackageSelectors();
    document.getElementById('cosProdPackageId').value = p.packageId || '';
    document.getElementById('cosProdPackageQty').value = p.packageQty ?? 1;
    renderProductVariants(p.variants || [], 'cosmetics');
    document.getElementById('cosStockFormTitle').innerText = 'Edit Cosmetic Product';
    document.getElementById('cosProdSubmitBtn').innerText = 'Update Product';
    setTimeout(() => document.getElementById('cosStockFormTitle')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
}

export function deleteCosProduct(id) {
    if (!id) return;
    const p = state.cosProducts.find(x => String(x.id) === String(id));
    const name = p ? p.name : 'product';
    if (!confirm(`Delete "${name}" from cosmetic product stock?`)) return;
    markIdDeleted(id);
    state.cosProducts = state.cosProducts.filter(x => String(x.id) !== String(id));
    syncToFirebase();
    if (typeof window.renderAll === 'function') window.renderAll();
}

export function renderCosProductStock() {
    const container = document.getElementById('cosProductListContainer');
    if (!container) return;

    if (state.cosProducts.length === 0) {
        container.innerHTML = '<p class="text-xs text-slate-500 text-center py-3">No cosmetic products added yet.</p>';
        return;
    }

    container.innerHTML = sortByNameAsc(state.cosProducts).map(p => {
        const variantsBadgeHtml = (p.variants && p.variants.length > 0)
            ? `<div class="flex flex-wrap gap-1 mt-1.5">${p.variants.map(v => `<span class="bg-slate-900 border border-slate-700 text-[10px] px-2 py-0.5 rounded-md text-pink-300 font-semibold">📦 ${v.name}: ₹${v.retailPrice}</span>`).join('')}</div>`
            : '';
        return `
        <div class="bg-slate-950/60 p-3 rounded-xl border border-slate-800 flex justify-between items-center text-xs">
            <div class="min-w-0 flex-1 pr-2 break-words">
                <strong class="text-pink-400 font-bold">${p.name} ${p.barcode ? '<span class="text-[10px] text-slate-400">[' + p.barcode + ']</span>' : ''}</strong>
                <p class="text-slate-400">Stock:
                    <span class="${(parseFloat(p.stock) || 0) <= 5 ? 'text-rose-400 font-bold' : 'text-emerald-300 font-bold'}">${p.stock} ${p.unit}</span>
                    | <span class="text-amber-300 font-semibold">W: ₹${getProductWholesalePrice(p).toFixed(2)}</span>
                    | <span class="text-pink-300 font-semibold">R: ₹${getProductRetailPrice(p).toFixed(2)}</span>
                </p>
                ${variantsBadgeHtml}
            </div>
            <div class="flex flex-wrap gap-1 justify-end shrink-0">
                <button type="button" onclick="viewCosProduct('${p.id}')" class="bg-blue-900 text-blue-200 px-2 py-1.5 rounded-lg border border-blue-800">View</button>
                <button type="button" onclick="editCosProduct('${p.id}')" class="bg-slate-800 text-pink-300 px-2 py-1.5 rounded-lg border border-slate-700">Edit</button>
                <button type="button" onclick="deleteCosProduct('${p.id}')" class="bg-slate-800 text-red-400 px-2 py-1.5 rounded-lg border border-slate-700">Delete</button>
            </div>
        </div>`;
    }).join('');
}

export function resetCosProductForm() {
    const form = document.getElementById('cosProductForm');
    if (form) form.reset();
    document.getElementById('cosProdId').value = '';
    document.getElementById('cosStockFormTitle').innerText = 'Add Cosmetic Product';
    document.getElementById('cosProdSubmitBtn').innerText = 'Add Product';
    if (document.getElementById('cosProdPackageId')) document.getElementById('cosProdPackageId').value = '';
    if (document.getElementById('cosProdPackageQty')) document.getElementById('cosProdPackageQty').value = '1';
    clearProductVariants('cosmetics');
}

export function showCosmeticStockList() {
    renderCosProductStock();
}

export function updateCosProductDropdowns() {
    const pSelect = document.getElementById('cosPurchaseStockSelect');
    const sSelect = document.getElementById('cosSalesStockSelect');
    const addSelect = document.getElementById('cosAddStockProduct');

    if (pSelect) {
        pSelect.innerHTML = '<option value="">-- Select Product --</option>';
        sortByNameAsc(state.cosProducts).forEach(p => {
            pSelect.innerHTML += `<option value="${p.id}" data-price="${p.costPrice}" data-saleprice="${p.salePrice}" data-unit="${p.unit}" data-stock="${p.stock}" data-barcode="${p.barcode || ''}">${p.name} (Stock: ${p.stock} ${p.unit})</option>`;
        });
    }
    if (sSelect) {
        sSelect.innerHTML = '<option value="">-- Select Product --</option>';
        sortByNameAsc(state.cosProducts).forEach(p => {
            sSelect.innerHTML += `<option value="${p.id}" data-price="${p.salePrice}" data-unit="${p.unit}" data-stock="${p.stock}" data-barcode="${p.barcode || ''}">${p.name} (Stock: ${p.stock} ${p.unit})</option>`;
        });
    }
    if (addSelect) {
        addSelect.innerHTML = '<option value="">Product</option>';
        sortByNameAsc(state.cosProducts).forEach(p => {
            addSelect.innerHTML += `<option value="${p.id}">${p.name} (Current: ${p.stock} ${p.unit})</option>`;
        });
    }
}

export function renderConsolidatedStockReport() {
    const cleaning = Array.isArray(state.products) ? state.products : [];
    const cosmetics = Array.isArray(state.cosProducts) ? state.cosProducts : [];
    const rows = [
        ...cleaning.map(p => ({ category: 'Cleaning', name: p.name || '', stock: Number(p.stock) || 0, unit: p.unit || '', barcode: p.barcode || '' })),
        ...cosmetics.map(p => ({ category: 'Cosmetics', name: p.name || '', stock: Number(p.stock) || 0, unit: p.unit || '', barcode: p.barcode || '' }))
    ].sort((a, b) => String(a.category).localeCompare(String(b.category)) || String(a.name).localeCompare(String(b.name)));

    const summaryHtml = [
        ['Total Products', rows.length],
        ['Cleaning', cleaning.length],
        ['Cosmetics', cosmetics.length],
        ['Units Used', new Set(rows.map(r => r.unit).filter(Boolean)).size]
    ].map(([label, value]) => `<div class="bg-slate-900 rounded-lg p-3"><div class="text-[10px] text-slate-400">${label}</div><b class="text-sm text-white">${value}</b></div>`).join('');
    ['consolidatedStockSummary', 'consolidatedStockSummaryCos'].forEach(id => { const el = document.getElementById(id); if (el) el.innerHTML = summaryHtml; });

    const bodyHtml = rows.length ? rows.map((r, i) => `<tr class="border-t border-slate-800"><td class="p-2 text-slate-500">${i + 1}</td><td class="p-2 ${r.category === 'Cosmetics' ? 'text-pink-300' : 'text-emerald-300'} font-semibold">${r.category}</td><td class="p-2 text-slate-200 font-semibold">${r.name || '—'}</td><td class="p-2 text-right font-bold ${r.stock <= 5 ? 'text-rose-300' : 'text-white'}">${r.stock}</td><td class="p-2 text-slate-300">${r.unit || '—'}</td><td class="p-2 text-slate-500">${r.barcode || '—'}</td></tr>`).join('') : '<tr><td colspan="6" class="p-5 text-center text-slate-500">No products found.</td></tr>';
    ['consolidatedStockTableBody', 'consolidatedStockTableBodyCos'].forEach(id => { const el = document.getElementById(id); if (el) el.innerHTML = bodyHtml; });

    const unitMap = {};
    rows.forEach(r => { const u = r.unit || 'No Unit'; unitMap[u] = (unitMap[u] || 0) + r.stock; });
    const unitHtml = Object.entries(unitMap).sort((a, b) => a[0].localeCompare(b[0])).map(([u, total]) => `<div class="flex justify-between bg-slate-900/70 border border-slate-800 rounded-lg px-3 py-2 text-[11px]"><span class="text-slate-400">Total ${u}</span><b class="text-slate-200">${total}</b></div>`).join('') || '<div class="text-[10px] text-slate-500">No stock data.</div>';
    ['consolidatedStockUnitTotals', 'consolidatedStockUnitTotalsCos'].forEach(id => { const el = document.getElementById(id); if (el) el.innerHTML = unitHtml; });
}

export function viewProduct(id) {
    const p = state.products.find(x => x.id === id);
    if (!p) return;
    const variantsHtml = (p.variants && p.variants.length > 0)
        ? `<div class="mt-3 pt-2 border-t border-slate-800"><p class="font-bold text-amber-300 text-xs mb-1.5">📦 Configured Pack Sizes & Rates:</p><div class="space-y-1.5">` +
        p.variants.map(v => `<div class="bg-slate-900/80 p-2 rounded-lg text-xs flex justify-between items-center border border-slate-800"><div><span class="font-bold text-white">${v.name}</span> <span class="text-slate-400">(${v.size} ${v.unit}${v.packageName ? ' • ' + v.packageName : ''})</span></div><div class="text-right">W: <span class="text-amber-300 font-bold">₹${v.wholesalePrice}</span> | R: <span class="text-emerald-400 font-bold">₹${v.retailPrice}</span></div></div>`).join('') +
        `</div></div>`
        : '';
    if (typeof window.showRecordView === 'function') {
        window.showRecordView('Product Details', `<div class="space-y-2"><p><b>Product:</b> ${p.name}</p><p><b>Barcode:</b> ${p.barcode || '—'}</p><p><b>Stock:</b> ${p.stock} ${p.unit}</p><p><b>Base Wholesale:</b> ₹${p.wholesalePrice}</p><p><b>Base Retail:</b> ₹${p.retailPrice}</p>${p.packageName ? `<p><b>Default Package:</b> ${p.packageName}</p>` : ''}${variantsHtml}</div><div class="flex gap-2 pt-4 border-t border-slate-800 mt-4 justify-end"><button type="button" onclick="closeRecordView(); editProduct('${p.id}');" class="bg-slate-800 text-emerald-400 px-3 py-1.5 rounded-lg border border-slate-700 hover:bg-slate-700 font-bold">Edit</button><button type="button" onclick="closeRecordView(); deleteProduct('${p.id}');" class="bg-red-900 text-red-200 px-3 py-1.5 rounded-lg font-bold">Delete</button></div>`);
    }
}

export function viewCosProduct(id) {
    const p = state.cosProducts.find(x => x.id === id);
    if (!p) return;
    const variantsHtml = (p.variants && p.variants.length > 0)
        ? `<div class="mt-3 pt-2 border-t border-slate-800"><p class="font-bold text-pink-300 text-xs mb-1.5">📦 Configured Pack Sizes & Rates:</p><div class="space-y-1.5">` +
        p.variants.map(v => `<div class="bg-slate-900/80 p-2 rounded-lg text-xs flex justify-between items-center border border-slate-800"><div><span class="font-bold text-white">${v.name}</span> <span class="text-slate-400">(${v.size} ${v.unit}${v.packageName ? ' • ' + v.packageName : ''})</span></div><div class="text-right">W: <span class="text-pink-300 font-bold">₹${v.wholesalePrice !== undefined ? v.wholesalePrice : v.costPrice}</span> | R: <span class="text-emerald-400 font-bold">₹${v.retailPrice !== undefined ? v.retailPrice : v.salePrice}</span></div></div>`).join('') +
        `</div></div>`
        : '';
    if (typeof window.showRecordView === 'function') {
        window.showRecordView('Cosmetic Product Details', `<div class="space-y-2"><p><b>Product:</b> ${p.name}</p><p><b>Barcode:</b> ${p.barcode || '—'}</p><p><b>Stock:</b> ${p.stock} ${p.unit}</p><p><b>Base Wholesale:</b> ₹${p.costPrice}</p><p><b>Base Retail:</b> ₹${p.salePrice}</p>${p.packageName ? `<p><b>Default Package:</b> ${p.packageName}</p>` : ''}${variantsHtml}</div><div class="flex gap-2 pt-4 border-t border-slate-800 mt-4 justify-end"><button type="button" onclick="closeRecordView(); editCosProduct('${p.id}');" class="bg-slate-800 text-pink-300 px-3 py-1.5 rounded-lg border border-slate-700 font-bold">Edit</button><button type="button" onclick="closeRecordView(); deleteCosProduct('${p.id}');" class="bg-red-900 text-red-200 px-3 py-1.5 rounded-lg font-bold">Delete</button></div>`);
    }
}

export function viewPackage(id) {
    const x = state.packages.find(p => String(p.id) === String(id));
    if (!x) return;
    if (typeof window.showRecordView === 'function') {
        window.showRecordView('Package Item Details', `<div class="space-y-2"><p><b>Package Name:</b> ${x.name}</p><p><b>Size / Volume:</b> ${x.size || '—'}</p><p><b>Unit:</b> ${x.unit || 'Pcs'}</p><p><b>Available Stock:</b> <span class="${(Number(x.stock) || 0) <= 5 ? 'text-rose-400 font-bold' : 'text-emerald-300 font-bold'}">${x.stock ?? 0}</span></p></div><div class="flex gap-2 pt-4 border-t border-slate-800 mt-4 justify-end"><button type="button" onclick="closeRecordView(); editPackage('${x.id}');" class="bg-slate-800 text-amber-300 px-3 py-1.5 rounded-lg border border-slate-700 font-bold">Edit</button><button type="button" onclick="closeRecordView(); deletePackage('${x.id}');" class="bg-red-900 text-red-200 px-3 py-1.5 rounded-lg font-bold">Delete</button></div>`);
    }
}

// Global window bindings for HTML inline onclick attributes
if (typeof window !== 'undefined') {
    window.updatePackageSelectors = updatePackageSelectors;
    window.addProductVariantRow = addProductVariantRow;
    window.addPresetProductVariant = addPresetProductVariant;
    window.getProductFormVariants = getProductFormVariants;
    window.renderProductVariants = renderProductVariants;
    window.clearProductVariants = clearProductVariants;
    window.normalizePackageMapping = normalizePackageMapping;
    window.switchPackageActionTab = switchPackageActionTab;
    window.switchStockTopTab = switchStockTopTab;
    window.switchStockSubTab = switchStockSubTab;
    window.switchStockActionTab = switchStockActionTab;
    window.savePackage = savePackage;
    window.resetPackageForm = resetPackageForm;
    window.editPackage = editPackage;
    window.deletePackage = deletePackage;
    window.addPackageStock = addPackageStock;
    window.renderPackages = renderPackages;
    window.switchPackageView = switchPackageView;
    window.renderPackageConsolidationReport = renderPackageConsolidationReport;
    window.getProductPackageInfo = getProductPackageInfo;
    window.getPackageSellingUnits = getPackageSellingUnits;
    window.resolvePackageInfoForItem = resolvePackageInfoForItem;
    window.restorePackageStock = restorePackageStock;
    window.checkAndDeductPackageStock = checkAndDeductPackageStock;
    window.saveProduct = saveProduct;
    window.addCleaningStock = addCleaningStock;
    window.saveStockReturn = saveStockReturn;
    window.updateStockReturnDropdowns = updateStockReturnDropdowns;
    window.renderStockReturnHistory = renderStockReturnHistory;
    window.renderProducts = renderProducts;
    window.editProduct = editProduct;
    window.deleteProduct = deleteProduct;
    window.resetProductForm = resetProductForm;
    window.saveCosProduct = saveCosProduct;
    window.addCosmeticStock = addCosmeticStock;
    window.editCosProduct = editCosProduct;
    window.deleteCosProduct = deleteCosProduct;
    window.renderCosProductStock = renderCosProductStock;
    window.resetCosProductForm = resetCosProductForm;
    window.updateCosProductDropdowns = updateCosProductDropdowns;
    window.updateCleaningAddStockDropdown = updateCleaningAddStockDropdown;
    window.renderConsolidatedStockReport = renderConsolidatedStockReport;
    window.switchStockTopTab = switchStockTopTab;
    window.switchStockSubTab = switchStockSubTab;
    window.switchStockActionTab = switchStockActionTab;
    window.viewProduct = viewProduct;
    window.viewCosProduct = viewCosProduct;
    window.viewPackage = viewPackage;
}

