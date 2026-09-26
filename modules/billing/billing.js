/**
 * FIA CLEAN & CARE - Billing Engine (Cleaning, Cosmetics & Combined Billing)
 */

import {
    state,
    unmarkIdDeleted,
    isCustItemDeleted,
    getTodayDateString,
    toTitleCase,
    generateUniqueRecordId
} from '../core/state.js';
import { syncToFirebase } from '../core/db.js';
import { previewBill, previewCosSaleBill, sortBillItemsAlphabetically, getCleanInvoiceProductName, formatInvoiceItemQty } from './invoice-preview.js';
import { normalizeCosSale } from './billing-history.js';
import { renderCustomers, renderCustomerConsolidationReport } from '../customers/customer.js';

export { renderCustomers };
export { sortBillItemsAlphabetically, formatInvoiceItemQty };

export function getProductWholesalePrice(p) {
    if (!p) return 0;
    const w = parseFloat(p.wholesalePrice);
    if (Number.isFinite(w) && w > 0) return w;
    const c = parseFloat(p.costPrice);
    if (Number.isFinite(c) && c > 0) return c;
    const p1 = parseFloat(p.price1 || p.purchasePrice);
    if (Number.isFinite(p1) && p1 > 0) return p1;
    if (Array.isArray(p.variants) && p.variants.length > 0) {
        const vW = p.variants.find(v => {
            const val = parseFloat(v.wholesalePrice || v.costPrice);
            return Number.isFinite(val) && val > 0;
        });
        if (vW) return parseFloat(vW.wholesalePrice || vW.costPrice);
    }
    // Look up last wholesale bill in history for this product
    try {
        const pastWholesaleBill = (state.customers || []).slice().reverse().find(cust => {
            if (!cust || cust._deleted) return false;
            const isW = String(cust.saleType || '').toLowerCase() === 'wholesale';
            if (!isW) return false;
            const items = Array.isArray(cust.items) ? cust.items : (cust.items && typeof cust.items === 'object' ? Object.values(cust.items) : []);
            return items.some(it => it && (it.productName === p.name || it.name === p.name) && Number(it.rate || it.price) > 0);
        });
        if (pastWholesaleBill) {
            const items = Array.isArray(pastWholesaleBill.items) ? pastWholesaleBill.items : Object.values(pastWholesaleBill.items || {});
            const matchedItem = items.find(it => it && (it.productName === p.name || it.name === p.name) && Number(it.rate || it.price) > 0);
            if (matchedItem) {
                const histRate = parseFloat(matchedItem.rate || matchedItem.price);
                if (Number.isFinite(histRate) && histRate > 0) return histRate;
            }
        }
    } catch (e) {}

    return getProductRetailPrice(p);
}

export function getProductRetailPrice(p) {
    if (!p) return 0;
    const r = parseFloat(p.retailPrice);
    if (Number.isFinite(r) && r > 0) return r;
    const s = parseFloat(p.salePrice);
    if (Number.isFinite(s) && s > 0) return s;
    const p2 = parseFloat(p.price2 || p.sellingPrice || p.price);
    if (Number.isFinite(p2) && p2 > 0) return p2;
    if (Array.isArray(p.variants) && p.variants.length > 0) {
        const vR = parseFloat(p.variants[0].retailPrice || p.variants[0].salePrice);
        if (Number.isFinite(vR) && vR > 0) return vR;
    }
    const w = parseFloat(p.wholesalePrice || p.costPrice);
    if (Number.isFinite(w) && w > 0) return w;
    return 0;
}

export function getVariantWholesalePrice(v, product) {
    if (!v) return 0;
    const w = parseFloat(v.wholesalePrice);
    if (Number.isFinite(w) && w > 0) return w;
    const c = parseFloat(v.costPrice);
    if (Number.isFinite(c) && c > 0) return c;
    if (product) {
        const baseWholesale = getProductWholesalePrice(product);
        const baseRetail = getProductRetailPrice(product);
        const vRetail = getVariantRetailPrice(v, null);
        const pUnit = String(product.unit || '').toLowerCase().trim();
        const vUnit = String(v.unit || '').toLowerCase().trim();
        const vSize = parseFloat(v.size) || 0;

        if (baseWholesale > 0 && vSize > 0) {
            if (['l', 'ltr', 'litre', 'liter'].includes(pUnit)) {
                if (['ml', 'millilitre'].includes(vUnit)) return Math.round((baseWholesale * (vSize / 1000)) * 100) / 100;
                if (['l', 'ltr', 'litre', 'liter'].includes(vUnit)) return Math.round((baseWholesale * vSize) * 100) / 100;
            }
            if (['kg', 'kilogram'].includes(pUnit)) {
                if (['g', 'gm', 'gram'].includes(vUnit)) return Math.round((baseWholesale * (vSize / 1000)) * 100) / 100;
                if (['kg', 'kilogram'].includes(vUnit)) return Math.round((baseWholesale * vSize) * 100) / 100;
            }
        }
        if (baseRetail > 0 && baseWholesale > 0 && baseWholesale < baseRetail && vRetail > 0) {
            return Math.round((vRetail * (baseWholesale / baseRetail)) * 100) / 100;
        }
        if (baseWholesale > 0) return baseWholesale;
    }
    return getVariantRetailPrice(v, product);
}

export function getVariantRetailPrice(v, product) {
    if (!v) return 0;
    const r = parseFloat(v.retailPrice);
    if (Number.isFinite(r) && r > 0) return r;
    const s = parseFloat(v.salePrice);
    if (Number.isFinite(s) && s > 0) return s;
    if (product) {
        const baseRetail = getProductRetailPrice(product);
        if (baseRetail > 0) return baseRetail;
    }
    return 0;
}

export function updateCurrentBillItemsSaleType(saleType) {
    if (!Array.isArray(state.currentBillItems) || state.currentBillItems.length === 0) return;
    const isWholesale = String(saleType || '').toLowerCase() === 'wholesale';
    let changed = false;
    state.currentBillItems.forEach(item => {
        if (item.isPackage) return;
        const prod = findUnifiedProduct(item.productName);
        if (!prod) return;
        let variantObj = null;
        if (item.variantId && Array.isArray(prod.variants)) {
            variantObj = prod.variants.find(v => String(v.id) === String(item.variantId));
        }
        const newRate = isWholesale
            ? (variantObj ? getVariantWholesalePrice(variantObj, prod) : getProductWholesalePrice(prod))
            : (variantObj ? getVariantRetailPrice(variantObj, prod) : getProductRetailPrice(prod));
        if (Number.isFinite(newRate) && newRate > 0 && Math.abs(item.rate - newRate) > 0.001) {
            item.rate = newRate;
            item.total = Number(item.numberOfUnits || 1) * newRate;
            changed = true;
        }
    });
    if (changed) {
        renderBillPreviewInput();
        calculateBalance();
    }
}

export function findUnifiedProduct(productName) {
    if (!productName) return null;
    const p = (state.products || []).find(x => x && x.name === productName);
    if (p) return { ...p, category: 'Cleaning' };
    const cp = (state.cosProducts || []).find(x => x && x.name === productName);
    if (cp) return { ...cp, category: 'Cosmetics' };
    const pkg = (state.packages || []).find(x => x && x.name === productName);
    if (pkg) return { ...pkg, category: 'Package' };
    return null;
}

export function updateBillTypeBadge(saleType) {
    const badge = document.getElementById('billTypeBadge');
    if (!badge) return;
    const isWholesale = String(saleType || '').toLowerCase() === 'wholesale';
    if (isWholesale) {
        badge.className = 'text-[10px] font-extrabold px-2 py-0.5 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/40 inline-flex items-center gap-1';
        badge.innerHTML = '🏷️ Wholesale Mode Active';
    } else {
        badge.className = 'text-[10px] font-extrabold px-2 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 inline-flex items-center gap-1';
        badge.innerHTML = '🛍️ Retail Mode Active';
    }
}

export function saveCurrentEnteredRateAsDefault() {
    const select = document.getElementById('billProductSelect');
    const opt = select ? select.options[select.selectedIndex] : null;
    if (!opt || !opt.value) {
        alert('⚠️ Please select a product first.');
        return;
    }
    const rateEl = document.getElementById('billRate');
    const enteredRate = parseFloat(rateEl?.value);
    if (!Number.isFinite(enteredRate) || enteredRate <= 0) {
        alert('⚠️ Please enter a valid price in the Price per Unit box.');
        rateEl?.focus();
        return;
    }
    const saleType = document.querySelector('input[name="saleType"]:checked')?.value || 'Retail';
    
    // Save to master product record
    quickSaveProductRate(opt.value, saleType, enteredRate);
    
    // Friendly instant feedback in the notice bar
    const notice = document.getElementById('billRateNotice');
    if (notice) {
        const product = findUnifiedProduct(opt.value);
        const variantSelect = document.getElementById('billPackVariantSelect');
        const vId = variantSelect?.value;
        const variantObj = (vId && vId !== 'default_pkg' && Array.isArray(product?.variants))
            ? product.variants.find(v => String(v.id) === String(vId))
            : null;
        const targetName = variantObj ? `${product?.name || opt.value} (${variantObj.name || variantObj.size})` : (product?.name || opt.value);
        notice.innerHTML = `
            <div class="flex items-center justify-between gap-2 p-1.5 rounded-lg bg-emerald-950/70 border border-emerald-500/60 text-emerald-300 font-bold text-[11px]">
                <span>✅ Saved ₹${enteredRate.toFixed(2)} as default wholesale rate for "${targetName}"!</span>
            </div>
        `;
        setTimeout(() => {
            const freshProd = findUnifiedProduct(opt.value);
            const freshVar = (vId && vId !== 'default_pkg' && Array.isArray(freshProd?.variants))
                ? freshProd.variants.find(v => String(v.id) === String(vId))
                : null;
            updateBillRateNotice(saleType, freshProd, enteredRate, freshVar);
        }, 2200);
    }
}

export function quickSaveProductRate(productName, targetSaleType = 'Wholesale', rateToSave = null) {
    const product = findUnifiedProduct(productName);
    if (!product) {
        alert(`Product "${productName}" not found.`);
        return;
    }
    const currentWholesale = getProductWholesalePrice(product);
    const currentRetail = getProductRetailPrice(product);
    const isWholesale = String(targetSaleType).toLowerCase() === 'wholesale';
    let enteredRate = rateToSave;

    if (enteredRate === null || enteredRate === undefined || isNaN(Number(enteredRate))) {
        const defaultVal = isWholesale ? (currentWholesale > 0 ? currentWholesale : currentRetail) : currentRetail;
        const promptMsg = isWholesale 
            ? `Set Wholesale Price for "${product.name}" (Current Retail is ₹${currentRetail.toFixed(2)}):`
            : `Set Retail Price for "${product.name}":`;
        const input = prompt(promptMsg, defaultVal > 0 ? String(defaultVal) : '');
        if (input === null) return;
        enteredRate = parseFloat(input);
    } else {
        enteredRate = parseFloat(enteredRate);
    }

    if (!Number.isFinite(enteredRate) || enteredRate < 0) {
        alert('Please enter a valid price amount.');
        return;
    }

    const variantSelect = document.getElementById('billPackVariantSelect');
    const vId = variantSelect?.value;

    let updated = false;
    let targetVariant = null;
    const updateItem = (item) => {
        let variantFound = false;
        if (vId && vId !== 'default_pkg' && Array.isArray(item.variants)) {
            const variant = item.variants.find(v => String(v.id) === String(vId));
            if (variant) {
                if (isWholesale) {
                    variant.wholesalePrice = enteredRate;
                    variant.costPrice = enteredRate;
                } else {
                    variant.retailPrice = enteredRate;
                    variant.salePrice = enteredRate;
                }
                variantFound = true;
                targetVariant = variant;
            }
        }
        if (!variantFound) {
            if (isWholesale) {
                item.wholesalePrice = enteredRate;
                if (item.category === 'Cosmetics') item.costPrice = enteredRate;
            } else {
                item.retailPrice = enteredRate;
                if (item.category === 'Cosmetics') item.salePrice = enteredRate;
                item.price = enteredRate;
            }
        }
        item.savedAt = Date.now();
        updated = true;
    };

    (state.products || []).forEach(p => {
        if (p.name === product.name || (product.id && String(p.id) === String(product.id))) updateItem(p);
    });
    (state.cosProducts || []).forEach(cp => {
        if (cp.name === product.name || (product.id && String(cp.id) === String(product.id))) updateItem(cp);
    });

    if (updated) {
        try {
            if (typeof window.saveLocalStateSafely === 'function') window.saveLocalStateSafely();
        } catch (e) {}
        syncToFirebase();
        if (window.renderProducts) window.renderProducts();
        if (window.renderCosProductStock) window.renderCosProductStock();
        updateProductDropdown();

        const rateEl = document.getElementById('billRate');
        if (rateEl) {
            rateEl.value = enteredRate.toFixed(2);
            rateEl.dataset.autoRate = rateEl.value;
        }
        calculateItemTotal();

        const freshProduct = findUnifiedProduct(product.name);
        updateBillRateNotice(targetSaleType, freshProduct, enteredRate, targetVariant);

        if (Array.isArray(state.currentBillItems) && state.currentBillItems.length > 0) {
            const currentSaleType = document.querySelector('input[name="saleType"]:checked')?.value || 'Retail';
            if (currentSaleType === targetSaleType) {
                state.currentBillItems.forEach(bi => {
                    if (bi.productName === product.name && (!vId || vId === 'default_pkg' || bi.variantId === vId)) {
                        bi.rate = enteredRate;
                        bi.total = (bi.numberOfUnits || 1) * enteredRate;
                    }
                });
                renderBillPreviewInput();
                calculateBalance();
            }
        }
    }
}

export function updateBillRateNotice(saleType, product, baseRate, variantObj = null) {
    updateBillTypeBadge(saleType);
    const notice = document.getElementById('billRateNotice');
    const isWholesale = String(saleType || '').toLowerCase() === 'wholesale';

    if (notice) {
        if (!product) {
            notice.innerHTML = '';
            return;
        }
        const wPrice = variantObj ? getVariantWholesalePrice(variantObj, product) : getProductWholesalePrice(product);
        const rPrice = variantObj ? getVariantRetailPrice(variantObj, product) : getProductRetailPrice(product);
        const safeName = (product.name || '').replace(/'/g, "\\'");
        const hasCustomWholesale = (product.wholesalePrice !== undefined && product.wholesalePrice !== null && product.wholesalePrice !== '' && !isNaN(Number(product.wholesalePrice))) || (variantObj && variantObj.wholesalePrice !== undefined && variantObj.wholesalePrice !== null && variantObj.wholesalePrice !== '');
        
        if (isWholesale) {
            if (!hasCustomWholesale && wPrice === rPrice && rPrice > 0) {
                notice.innerHTML = `
                    <div class="flex flex-wrap items-center justify-between gap-1.5 p-1.5 rounded-lg bg-amber-950/40 border border-amber-800/60 shadow-sm">
                        <div class="flex items-center gap-1.5">
                            <span class="text-amber-300 font-bold text-[11px]">⚠️ Wholesale not set</span>
                            <span class="text-slate-400 text-[10px] font-normal">(Using Retail ₹${rPrice.toFixed(2)})</span>
                        </div>
                        <div class="flex items-center gap-1">
                            <button type="button" onclick="saveCurrentEnteredRateAsDefault()" class="px-2 py-0.5 rounded-md bg-amber-600 hover:bg-amber-500 active:scale-95 text-white font-extrabold text-[10px] shadow transition flex items-center gap-1 cursor-pointer" title="Save price entered in box as permanent default wholesale rate">
                                💾 Save as Default
                            </button>
                            <button type="button" onclick="quickSaveProductRate('${safeName}', 'Wholesale')" class="px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/40 font-bold text-[10px] transition cursor-pointer" title="Set default wholesale rate via prompt">
                                ⚙️ Set Rate
                            </button>
                        </div>
                    </div>`;
            } else {
                notice.innerHTML = `
                    <div class="flex flex-wrap items-center justify-between gap-1.5 p-1.5 rounded-lg bg-sky-950/40 border border-sky-800/60 shadow-sm text-[11px]">
                        <div class="flex items-center gap-1.5">
                            <span class="text-sky-300 font-bold">🏷️ Wholesale: ₹${Number(baseRate||0).toFixed(2)}</span>
                            <span class="text-slate-400 text-[10px] font-normal">(Retail: ₹${rPrice.toFixed(2)})</span>
                        </div>
                        <div class="flex items-center gap-1">
                            <button type="button" onclick="saveCurrentEnteredRateAsDefault()" class="px-2 py-0.5 rounded-md bg-amber-600 hover:bg-amber-500 active:scale-95 text-white font-extrabold text-[10px] shadow transition flex items-center gap-1 cursor-pointer" title="Save price entered in box as new default wholesale rate">
                                💾 Save as Default
                            </button>
                            <button type="button" onclick="quickSaveProductRate('${safeName}', 'Wholesale')" class="px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/40 font-bold text-[10px] transition cursor-pointer" title="Change default wholesale rate via prompt">
                                ✏️ Change
                            </button>
                        </div>
                    </div>`;
            }
        } else {
            notice.innerHTML = `
                <div class="flex flex-wrap items-center justify-between gap-1 text-[11px] px-0.5">
                    <span class="text-emerald-300 font-bold">🛍️ Retail Rate Applied: ₹${Number(baseRate||0).toFixed(2)} <span class="text-slate-400 text-[10px] font-normal">(Wholesale: ₹${wPrice.toFixed(2)})</span></span>
                </div>`;
        }
    }
}

export function updateProductDropdown() {
    const select = document.getElementById('billProductSelect');
    if (!select) return;
    const currentVal = select.value;
    const saleType = document.querySelector('input[name="saleType"]:checked')?.value || 'Retail';
    let html = '<option value="">-- Select Product --</option>';

    const sortFn = list => [...(list || [])].sort((a, b) => String(a?.name || '').localeCompare(String(b?.name || '')));
    const cleanList = sortFn(state.products);
    const cosList = sortFn(state.cosProducts);

    if (cleanList.length > 0) {
        html += `<optgroup label="🧹 Cleaning Products">`;
        cleanList.forEach(p => {
            const wPrice = getProductWholesalePrice(p);
            const rPrice = getProductRetailPrice(p);
            const priceLabel = saleType === 'Wholesale' ? `W: ₹${wPrice.toFixed(2)}` : `R: ₹${rPrice.toFixed(2)}`;
            const displayName = toTitleCase(p.name);
            html += `<option value="${p.name.replace(/"/g, '&quot;')}" data-category="Cleaning" data-wholesale="${wPrice}" data-retail="${rPrice}" data-stock="${p.stock}" data-unit="${p.unit}" data-pkg-id="${p.packageId || ''}" data-pkg-name="${(p.packageName || '').replace(/"/g, '&quot;')}" data-pkg-qty="${p.packageQty || 1}">🧹 ${displayName} (Stock: ${p.stock} ${p.unit}) — ${priceLabel}</option>`;
        });
        html += `</optgroup>`;
    }

    if (cosList.length > 0) {
        html += `<optgroup label="💄 Cosmetic Products">`;
        cosList.forEach(p => {
            const wPrice = getProductWholesalePrice(p);
            const rPrice = getProductRetailPrice(p);
            const priceLabel = saleType === 'Wholesale' ? `W: ₹${wPrice.toFixed(2)}` : `R: ₹${rPrice.toFixed(2)}`;
            const displayName = toTitleCase(p.name);
            html += `<option value="${p.name.replace(/"/g, '&quot;')}" data-category="Cosmetics" data-wholesale="${wPrice}" data-retail="${rPrice}" data-stock="${p.stock}" data-unit="${p.unit}" data-pkg-id="${p.packageId || ''}" data-pkg-name="${(p.packageName || '').replace(/"/g, '&quot;')}" data-pkg-qty="${p.packageQty || 1}">💄 ${displayName} (Stock: ${p.stock} ${p.unit}) — ${priceLabel}</option>`;
        });
        html += `</optgroup>`;
    }

    select.innerHTML = html;
    if (currentVal && [...select.options].some(o => o.value === currentVal)) {
        select.value = currentVal;
    }
}

export function parsePackageVolume(sizeStr, nameStr) {
    const s = (String(sizeStr || '') + ' ' + String(nameStr || '')).trim();
    const m = s.match(/(\d+(?:\.\d+)?)\s*(ml|millilitre|l|ltr|litre|liter|kg|kilogram|g|gm|gram)/i);
    if (m) {
        const val = parseFloat(m[1]);
        const u = m[2].toLowerCase();
        if (['l','ltr','litre','liter'].includes(u)) return { size: val, unit: 'Litre' };
        if (['ml','millilitre'].includes(u)) return { size: val, unit: 'ml' };
        if (['kg','kilogram'].includes(u)) return { size: val, unit: 'Kg' };
        if (['g','gm','gram'].includes(u)) return { size: val, unit: 'Gram' };
    }
    return null;
}

export function onSaleTypeChange() {
    const saleType = document.querySelector('input[name="saleType"]:checked')?.value || 'Retail';
    updateBillTypeBadge(saleType);

    const prodSelect = document.getElementById('billProductSelect');
    const currentVal = prodSelect?.value || '';
    updateProductDropdown();
    if (currentVal && prodSelect) prodSelect.value = currentVal;

    fillProductPrice();
    updateCurrentBillItemsSaleType(saleType);
}

export function fillProductPrice() {
    const select = document.getElementById('billProductSelect');
    const opt = select ? select.options[select.selectedIndex] : null;
    const variantWrapper = document.getElementById('billPackVariantWrapper');
    const variantSelect = document.getElementById('billPackVariantSelect');
    const badgeEl = document.getElementById('billPackVariantBadge');
    const saleType = document.querySelector('input[name="saleType"]:checked')?.value || 'Retail';

    if (!opt || !opt.value) {
        if (variantWrapper) variantWrapper.classList.add('hidden');
        if (badgeEl) badgeEl.textContent = '';
        document.getElementById('billRate').value = '';
        document.getElementById('billCalculatedTotal').value = '';
        updateBillRateNotice(saleType, null, 0);
        return;
    }

    const product = findUnifiedProduct(opt.value);
    if (!product) return;

    const baseRate = saleType === 'Wholesale' ? getProductWholesalePrice(product) : getProductRetailPrice(product);

    if (Array.isArray(product.variants) && product.variants.length > 0) {
        if (variantWrapper && variantSelect) {
            const previousVariantId = variantSelect.value;
            variantWrapper.classList.remove('hidden');
            variantSelect.innerHTML = '<option value="">-- Select Pack Size (' + product.variants.length + ' options) --</option>' +
                product.variants.map(v => {
                    const rate = saleType === 'Wholesale' ? getVariantWholesalePrice(v, product) : getVariantRetailPrice(v, product);
                    return `<option value="${v.id}">${v.name} (${v.size} ${v.unit}) — ₹${Number(rate||0).toFixed(2)}${v.packageName ? ' [' + v.packageName + ']' : ''}</option>`;
                }).join('');
            
            if (previousVariantId && product.variants.some(v => String(v.id) === String(previousVariantId))) {
                variantSelect.value = previousVariantId;
            } else {
                const preferredIdx = product.variants.findIndex(v => (v.size == 500 && String(v.unit).toLowerCase() === 'ml') || (v.size == 1 && ['ltr','l'].includes(String(v.unit).toLowerCase())));
                variantSelect.selectedIndex = preferredIdx !== -1 ? (preferredIdx + 1) : 1;
            }
            onPackVariantSelected();
            return;
        }
    }

    let mappedPkg = null;
    if (product.packageId) mappedPkg = (state.packages || []).find(p => String(p.id) === String(product.packageId));
    if (!mappedPkg && product.packageName) mappedPkg = (state.packages || []).find(p => String(p.name).toLowerCase() === String(product.packageName).toLowerCase());

    if (mappedPkg) {
        if (variantWrapper && variantSelect) {
            variantWrapper.classList.remove('hidden');
            if (badgeEl) badgeEl.innerHTML = `📦 ${mappedPkg.name} (<span class="${Number(mappedPkg.stock)<=5?'text-rose-400 font-bold':'text-emerald-400 font-bold'}">Stock: ${mappedPkg.stock}</span>)`;
            variantSelect.innerHTML = `<option value="default_pkg">${mappedPkg.name}${mappedPkg.size ? ' (' + mappedPkg.size + ')' : ''} — ₹${baseRate.toFixed(2)} [Default Pack]</option>`;
            variantSelect.selectedIndex = 0;
        }

        const parsed = parsePackageVolume(mappedPkg.size, mappedPkg.name);
        if (parsed) {
            document.getElementById('billQty').value = parsed.size;
            const unitEl = document.getElementById('billUnitType');
            if (unitEl) unitEl.value = parsed.unit;
        }
        const rateEl = document.getElementById('billRate');
        rateEl.value = baseRate ? baseRate.toFixed(2) : '';
        rateEl.dataset.autoRate = rateEl.value;
        rateEl.dataset.defaultPkgId = mappedPkg.id;
        delete rateEl.dataset.variantId;
        updateBillRateNotice(saleType, product, baseRate, null);
        calculateItemTotal();
        return;
    }

    if (variantWrapper) variantWrapper.classList.add('hidden');
    if (badgeEl) badgeEl.textContent = '';
    const qtyEl = document.getElementById('billQty');
    if (qtyEl && (!qtyEl.value || parseFloat(qtyEl.value) <= 0)) {
        qtyEl.value = '1';
    }
    const unitEl = document.getElementById('billUnitType');
    if (unitEl && product?.unit) {
        const u = product.unit;
        if (![...unitEl.options].some(x => x.value.toLowerCase() === u.toLowerCase())) {
            unitEl.add(new Option(u, u));
        }
        unitEl.value = u;
    }
    const rateEl = document.getElementById('billRate');
    rateEl.value = baseRate ? baseRate.toFixed(2) : '';
    rateEl.dataset.autoRate = rateEl.value;
    delete rateEl.dataset.variantId;
    delete rateEl.dataset.defaultPkgId;
    updateBillRateNotice(saleType, product, baseRate, null);
    calculateItemTotal();
}

export function onPackVariantSelected() {
    const prodSelect = document.getElementById('billProductSelect');
    const product = findUnifiedProduct(prodSelect?.value);
    const variantSelect = document.getElementById('billPackVariantSelect');
    const vId = variantSelect?.value;
    const badgeEl = document.getElementById('billPackVariantBadge');
    const saleType = document.querySelector('input[name="saleType"]:checked')?.value || 'Retail';
    if (!product || !vId) {
        if (badgeEl) badgeEl.textContent = '';
        return;
    }

    if (vId === 'default_pkg') {
        fillProductPrice();
        return;
    }

    const variant = product.variants?.find(v => String(v.id) === String(vId));
    if (!variant) return;

    document.getElementById('billQty').value = variant.size;
    const unitEl = document.getElementById('billUnitType');
    if (unitEl) unitEl.value = variant.unit;

    const rate = Number(saleType === 'Wholesale' ? getVariantWholesalePrice(variant, product) : getVariantRetailPrice(variant, product)) || 0;
    const rateEl = document.getElementById('billRate');
    rateEl.value = rate ? rate.toFixed(2) : '0';
    rateEl.dataset.autoRate = rateEl.value;
    rateEl.dataset.variantId = variant.id;
    delete rateEl.dataset.defaultPkgId;

    let pkg = null;
    if (variant.packageId) pkg = (state.packages || []).find(p => String(p.id) === String(variant.packageId));
    if (!pkg && variant.packageName) pkg = (state.packages || []).find(p => String(p.name).toLowerCase() === String(variant.packageName).toLowerCase());

    if (pkg && badgeEl) {
        badgeEl.innerHTML = `📦 ${pkg.name} (<span class="${Number(pkg.stock)<=5?'text-rose-400 font-bold':'text-emerald-400 font-bold'}">Stock: ${pkg.stock}</span>)`;
    } else if (badgeEl) {
        badgeEl.textContent = variant.packageName ? `📦 ${variant.packageName}` : '';
    }

    updateBillRateNotice(saleType, product, rate, variant);
    calculateItemTotal();
}

export function onBillQtyOrUnitChange() {
    calculateItemTotal();
}

export function normalizeUnitCategory(unit) {
    let u = String(unit || '').toLowerCase().trim();
    u = u.replace(/^[\d.,\s]+/, '').trim();
    if (['l', 'ltr', 'litre', 'liter', 'litres', 'liters'].includes(u)) return 'l';
    if (['ml', 'millilitre', 'milliliter', 'millilitres', 'milliliters'].includes(u)) return 'ml';
    if (['kg', 'kilogram', 'kilograms'].includes(u)) return 'kg';
    if (['g', 'gm', 'gram', 'grams'].includes(u)) return 'g';
    if (['pcs', 'pc', 'piece', 'pieces', 'bottle', 'bottles', 'box', 'boxes', 'pack', 'packs', 'standard', 'unit', 'units'].includes(u)) return 'pcs';
    return u;
}

export function getBillingUnitFactor(selectedUnit, baseUnit) {
    const s = normalizeUnitCategory(selectedUnit);
    const b = normalizeUnitCategory(baseUnit);
    if (s === b) return 1;
    if (s === 'ml' && b === 'l') return 0.001;
    if (s === 'l' && b === 'ml') return 1000;
    if (s === 'g' && b === 'kg') return 0.001;
    if (s === 'kg' && b === 'g') return 1000;
    return 1;
}

export function calculateItemTotal() {
    let rate = parseFloat(document.getElementById('billRate')?.value) || 0;
    const numberOfUnits = Math.max(1, parseInt(document.getElementById('billNumberOfUnits')?.value, 10) || 1);
    const total = rate * numberOfUnits;
    const totalEl = document.getElementById('billCalculatedTotal');
    if (totalEl) {
        totalEl.value = total > 0 ? total.toFixed(2) : (rate > 0 ? '0.00' : '');
    }
}

export function stepStdBillUnits(delta) {
    const input = document.getElementById('billNumberOfUnits');
    if (!input) return;
    let val = parseInt(input.value, 10) || 1;
    input.value = Math.max(1, val + delta);
    calculateItemTotal();
}

export function getProductPackageInfo(product) {
    if (!product) return null;
    let pkg = null;
    if (product.packageId) pkg = (state.packages || []).find(p => String(p.id) === String(product.packageId));
    if (!pkg && product.packageName) pkg = (state.packages || []).find(p => String(p.name).toLowerCase() === String(product.packageName).toLowerCase());
    if (pkg) return { id: pkg.id, qty: Number(product.packageQty || 1), pkg, name: pkg.name };
    return null;
}

export function checkAndDeductPackageStock(items) {
    for (const item of items) {
        if (!item.packageId) continue;
        const pkg = (state.packages || []).find(p => String(p.id) === String(item.packageId));
        if (!pkg) continue;
        const deduction = Number(item.numberOfUnits || 1);
        if (deduction > Number(pkg.stock || 0)) {
            return { ok: false, pkg, available: pkg.stock, requested: deduction };
        }
    }
    items.forEach(item => {
        if (!item.packageId) return;
        const pkg = (state.packages || []).find(p => String(p.id) === String(item.packageId));
        if (pkg) {
            pkg.stock = Math.max(0, (parseFloat(pkg.stock) || 0) - Number(item.numberOfUnits || 1));
            pkg.savedAt = Date.now();
        }
    });
    return { ok: true };
}

export function restorePackageStock(items) {
    (items || []).forEach(item => {
        if (!item.packageId) return;
        const pkg = (state.packages || []).find(p => String(p.id) === String(item.packageId));
        if (pkg) {
            pkg.stock = (parseFloat(pkg.stock) || 0) + Number(item.numberOfUnits || 1);
            pkg.savedAt = Date.now();
        }
    });
}

export function getStockProductRecord(itemOrName) {
    const name = typeof itemOrName === 'string' ? itemOrName : (itemOrName?.productName || itemOrName?.name);
    if (!name) return null;
    const p = (state.products || []).find(x => x && x.name === name);
    if (p) return { product: p, category: 'Cleaning' };
    const cp = (state.cosProducts || []).find(x => x && x.name === name);
    if (cp) return { product: cp, category: 'Cosmetics' };
    return null;
}

export function addToBillItems() {
    const select = document.getElementById('billProductSelect');
    const productName = select ? select.value : '';
    const qty = parseFloat(document.getElementById('billQty').value);
    const rate = parseFloat(document.getElementById('billRate').value);
    const rawUnitType = document.getElementById('billUnitType')?.value || '';
    const quantityType = document.getElementById('billQuantityType')?.value || 'Bottle';
    const numberOfUnits = Math.max(1, parseInt(document.getElementById('billNumberOfUnits')?.value, 10) || 1);
    if (!productName || isNaN(qty) || qty <= 0 || isNaN(rate)) { alert("Please select product, quantity, and rate."); return; }

    const product = findUnifiedProduct(productName);
    const unitType = (rawUnitType && rawUnitType !== 'Standard' && rawUnitType !== 'General') ? rawUnitType : (product?.unit || 'Ltr');
    const variantId = document.getElementById('billPackVariantSelect')?.value || document.getElementById('billRate')?.dataset.variantId || '';
    const variant = product?.variants?.find(v => String(v.id) === String(variantId));

    let stockDeductionQty = 0;
    let packageInfo = null;
    let variantName = '';

    if (variant) {
        variantName = variant.name;
        const factor = getBillingUnitFactor(variant.unit, product?.unit);
        stockDeductionQty = variant.size * factor * numberOfUnits;
        if (variant.packageId) {
            const pkg = (state.packages || []).find(p => String(p.id) === String(variant.packageId));
            if (pkg) packageInfo = { id: pkg.id, qty: 1, pkg, name: pkg.name };
        }
    } else {
        const factor = getBillingUnitFactor(unitType, product?.unit);
        stockDeductionQty = (qty > 0 ? qty : 1) * factor * numberOfUnits;
        packageInfo = getProductPackageInfo(product);
    }

    // Strict Bulk Stock Check
    if (product) {
        const currentStock = Number(product.stock || 0);
        const alreadyAdded = state.currentBillItems
            .filter(i => (i.stockId && product.id && String(i.stockId) === String(product.id)) || i.productName === product.name)
            .reduce((sum, i) => sum + Number(i.stockDeductionQty || 0), 0);
        const totalNeeded = Number((alreadyAdded + stockDeductionQty).toFixed(3));
        if (totalNeeded > currentStock) {
            const avail = Math.max(0, currentStock - alreadyAdded);
            alert(`⚠️ Insufficient Stock!\n\nProduct: ${product.name}\nAvailable Stock: ${currentStock.toFixed(2)} ${product.unit || ''}\nAlready in bill: ${alreadyAdded.toFixed(2)} ${product.unit || ''}\nRequested Qty: ${stockDeductionQty.toFixed(2)} ${product.unit || ''}\nRemaining available: ${avail.toFixed(2)} ${product.unit || ''}`);
            return;
        }
    }

    // Strict Packaging Stock Check
    if (packageInfo && packageInfo.pkg) {
        const pkg = packageInfo.pkg;
        const currentPkgStock = Number(pkg.stock || 0);
        const alreadyAddedPkg = state.currentBillItems
            .filter(i => String(i.packageId) === String(pkg.id))
            .reduce((sum, i) => sum + Number(i.numberOfUnits || 1), 0);
        const totalNeededPkg = alreadyAddedPkg + numberOfUnits;
        if (totalNeededPkg > currentPkgStock) {
            alert(`⚠️ Container packaging stock not available!\n\nContainer: ${pkg.name}\nAvailable Stock: ${currentPkgStock} ${pkg.unit || 'Pcs'}\nRequired: ${totalNeededPkg} ${pkg.unit || 'Pcs'}`);
            return;
        }
    }

    const total = numberOfUnits * rate;

    state.currentBillItems.push({
        productName,
        variantId: variant?.id || '',
        variantName: variantName || '',
        qty,
        unitType,
        quantityType: packageInfo?.name || quantityType,
        numberOfUnits,
        rate,
        total,
        stockDeductionQty,
        packageId: packageInfo?.id || '',
        packageQty: 1,
        packageName: packageInfo?.name || '',
        combinedCategory: product?.category || 'Cleaning',
        stockId: product?.id || ''
    });

    state.currentBillItems = sortBillItemsAlphabetically(state.currentBillItems);
    document.getElementById('billQty').value = '';
    document.getElementById('billRate').value = '';
    document.getElementById('billCalculatedTotal').value = '';
    document.getElementById('billProductSelect').value = '';
    document.getElementById('billNumberOfUnits').value = '1';
    renderBillPreviewInput();
    calculateBalance();
}

export function editBillItem(index) {
    const item = state.currentBillItems[index];
    if (!item) return;
    const newUnitsRaw = prompt(`Edit number of units/bottles for ${item.productName}:`, String(item.numberOfUnits || 1));
    if (newUnitsRaw === null) return;
    const newUnits = Math.max(1, parseInt(newUnitsRaw, 10) || 1);
    const newRateRaw = prompt(`Edit rate for ${item.productName}:`, String(item.rate ?? ''));
    if (newRateRaw === null) return;
    const newRate = parseFloat(newRateRaw);
    if (!Number.isFinite(newRate) || newRate < 0) { alert('Please enter a valid rate.'); return; }
    
    const perUnitBulk = (Number(item.stockDeductionQty) || 0) / (Number(item.numberOfUnits) || 1);
    const newStockDeduction = perUnitBulk * newUnits;

    // Check product stock limit
    const product = findUnifiedProduct(item.productName);
    if (product) {
        const currentStock = Number(product.stock || 0);
        const otherItemsStock = state.currentBillItems
            .filter((_, idx) => idx !== index)
            .filter(i => (i.stockId && product.id && String(i.stockId) === String(product.id)) || i.productName === product.name)
            .reduce((sum, i) => sum + Number(i.stockDeductionQty || 0), 0);
        if (otherItemsStock + newStockDeduction > currentStock) {
            alert(`⚠️ Insufficient Stock!\n\nAvailable Stock: ${currentStock} ${product.unit || ''}\nRequired: ${(otherItemsStock + newStockDeduction).toFixed(2)} ${product.unit || ''}`);
            return;
        }
    }

    if (item.packageId) {
        const pkg = (state.packages || []).find(p => String(p.id) === String(item.packageId));
        if (pkg) {
            const currentPkgStock = Number(pkg.stock || 0);
            const otherPkgUnits = state.currentBillItems
                .filter((_, idx) => idx !== index)
                .filter(i => String(i.packageId) === String(pkg.id))
                .reduce((sum, i) => sum + Number(i.numberOfUnits || 1), 0);
            if (otherPkgUnits + newUnits > currentPkgStock) {
                alert(`⚠️ Container packaging stock not available!\n\nContainer: ${pkg.name}\nAvailable Stock: ${currentPkgStock} ${pkg.unit || 'Pcs'}\nRequired: ${otherPkgUnits + newUnits} ${pkg.unit || 'Pcs'}`);
                return;
            }
        }
    }

    state.currentBillItems[index] = {
        ...item,
        numberOfUnits: newUnits,
        rate: newRate,
        total: newUnits * newRate,
        stockDeductionQty: newStockDeduction
    };
    state.currentBillItems = sortBillItemsAlphabetically(state.currentBillItems);
    renderBillPreviewInput();
    calculateBalance();
}

export function renderBillPreviewInput() {
    const container = document.getElementById('currentBillItemsPreview');
    if (!container) return;
    container.innerHTML = "";
    let grandTotal = 0;
    state.currentBillItems = sortBillItemsAlphabetically(state.currentBillItems);
    state.currentBillItems.forEach((item, index) => {
        grandTotal += Number(item.total || 0);
        const cleanName = getCleanInvoiceProductName(item.productName);
        const unitDisplay = (item.unitType && item.unitType !== 'Standard' && item.unitType !== 'General') ? item.unitType : ((findUnifiedProduct(item.productName)?.unit) || 'Ltr');
        const qtyStr = `${item.qty} ${unitDisplay}`.trim();
        const units = Number(item.numberOfUnits || 1);
        container.innerHTML += `
            <div class="bg-slate-900 p-2.5 rounded-xl border border-slate-800 text-xs">
                <div class="hidden sm:grid sm:grid-cols-[1.4fr_0.8fr_0.8fr_0.8fr_0.9fr_auto_auto] gap-1 items-center">
                    <span class="font-semibold truncate">${cleanName}</span>
                    <span>${qtyStr}</span>
                    <span>${units}</span>
                    <span>₹${Number(item.rate).toFixed(2)}</span>
                    <strong class="text-emerald-400">₹${Number(item.total).toFixed(2)}</strong>
                    <button type="button" onclick="window.editBillItem(${index})" class="text-sky-300 font-bold px-1.5 py-1 hover:bg-slate-800 rounded" title="Edit item">✎</button>
                    <button type="button" onclick="window.removeBillItem(${index})" class="text-rose-400 font-bold px-1.5 py-1 hover:bg-slate-800 rounded" title="Delete item">✕</button>
                </div>
                <div class="sm:hidden flex flex-col gap-1.5">
                    <div class="flex justify-between items-start gap-2">
                        <span class="font-bold text-white leading-snug break-words flex-1">${cleanName}</span>
                        <strong class="text-emerald-400 text-sm whitespace-nowrap shrink-0">₹${Number(item.total).toFixed(2)}</strong>
                    </div>
                    <div class="flex justify-between items-center text-[11px] text-slate-400 border-t border-slate-800/60 pt-1">
                        <span>${qtyStr} × ${units} @ ₹${Number(item.rate).toFixed(2)}</span>
                        <div class="flex items-center gap-1.5 shrink-0">
                            <button type="button" onclick="window.editBillItem(${index})" class="px-2.5 py-1 rounded-lg bg-slate-800 text-sky-300 border border-sky-500/30 font-bold text-[10px]">✎ Edit</button>
                            <button type="button" onclick="window.removeBillItem(${index})" class="px-2.5 py-1 rounded-lg bg-rose-950/60 text-rose-300 border border-rose-800/60 font-bold text-[10px]">✕ Remove</button>
                        </div>
                    </div>
                </div>
            </div>`;
    });
    if (state.currentBillItems.length > 0) container.innerHTML += `<div class="text-right font-extrabold text-xs text-slate-300 pt-1">Items Subtotal: ₹${grandTotal.toFixed(2)}</div>`;
    calculateBalance();
}

export function removeBillItem(index) {
    if (!Array.isArray(state.currentBillItems) || index < 0 || index >= state.currentBillItems.length) return;
    state.currentBillItems.splice(index, 1);
    renderBillPreviewInput();
    calculateBalance();
}

export function calculateBalance() {
    const subTotal = (state.currentBillItems || []).reduce((sum, i) => sum + Number(i.total || 0), 0);
    const discountRaw = parseFloat(document.getElementById('billDiscountAmt')?.value);
    const discount = Number.isFinite(discountRaw) && discountRaw > 0 ? Math.min(subTotal, discountRaw) : 0;
    const netPayable = Math.max(0, subTotal - discount);

    const netPayableEl = document.getElementById('billNetPayable');
    if (netPayableEl) {
        netPayableEl.value = netPayable.toFixed(2);
    }

    const paidInputRaw = document.getElementById('billPaidAmt')?.value;
    const paidInput = parseFloat(paidInputRaw);
    const isPaidEmpty = paidInputRaw === '' || paidInputRaw === undefined;
    const effectivePaid = isPaidEmpty ? netPayable : (Number.isFinite(paidInput) ? paidInput : 0);
    const balance = netPayable - effectivePaid;
    const due = Math.max(0, balance);
    const excess = Math.max(0, -balance);
    const field = document.getElementById('billPendingAmt');
    const status = document.getElementById('billBalanceStatus');
    if (field) field.value = due.toFixed(2);
    if (status) {
        if (balance > 0.001) {
            status.textContent = 'BALANCE DUE: ₹' + due.toFixed(2);
            status.className = 'text-xs font-black mt-1 text-right text-rose-400 animate-pulse';
        } else if (balance < -0.001) {
            status.textContent = 'BALANCE RETURN / CHANGE: ₹' + excess.toFixed(2);
            status.className = 'text-xs font-black mt-1 text-right text-sky-300';
        } else {
            status.textContent = 'PAID IN FULL — BALANCE: ₹0.00';
            status.className = 'text-xs font-black mt-1 text-right text-emerald-400';
        }
    }
}

export function getNextBillNumber() {
    const maxNo = (state.customers || []).reduce((m, c) => {
        const match = String(c && c.billNo || '').match(/(\d+)$/);
        const n = match ? parseInt(match[1], 10) : 0;
        return Number.isFinite(n) ? Math.max(m, n) : m;
    }, 0);
    return 'CLN-' + String(maxNo + 1).padStart(4, '0');
}

export function getNextCosBillNumber() {
    const maxNo = (state.cosSales || []).reduce((m, s) => {
        const match = String(s && s.billNo || '').match(/(\d+)$/);
        const n = match ? parseInt(match[1], 10) : 0;
        return Number.isFinite(n) ? Math.max(m, n) : m;
    }, 0);
    return 'COS-' + String(maxNo + 1).padStart(4, '0');
}

export function saveCustomer(e) {
    if (e && e.preventDefault) e.preventDefault();
    const index = parseInt(document.getElementById('custIndex').value, 10);
    const name = (document.getElementById('custName')?.value || '').trim().toUpperCase();
    const phone = (document.getElementById('custPhone')?.value || '').trim();
    const saleType = document.querySelector('input[name="saleType"]:checked')?.value || 'Retail';

    if (state.currentBillItems.length === 0) { alert("Please add at least one item."); return; }

    const oldBill = index !== -1 ? state.customers[index] : null;
    if (oldBill) {
        restorePackageStock(oldBill.items || []);
        (oldBill.items || []).forEach(oldItem => {
            const rec = getStockProductRecord(oldItem);
            if (rec && rec.product) {
                rec.product.stock = (parseFloat(rec.product.stock) || 0) + (parseFloat(oldItem.stockDeductionQty || oldItem.qty) || 0);
                rec.product.savedAt = Date.now();
            }
        });
    }

    // Comprehensive Pre-Check: Validate bulk stock sufficiency for all bill items
    const stockDeficits = [];
    const bulkNeededByProd = new Map();
    state.currentBillItems.forEach(item => {
        const rec = getStockProductRecord(item);
        if (rec && rec.product) {
            const key = String(rec.product.id || rec.product.name);
            const cur = bulkNeededByProd.get(key) || { product: rec.product, needed: 0 };
            cur.needed += Number(item.stockDeductionQty || 0);
            bulkNeededByProd.set(key, cur);
        }
    });

    for (const [_, info] of bulkNeededByProd) {
        const avail = Number(info.product.stock || 0);
        if (info.needed > avail) {
            stockDeficits.push(`• ${info.product.name}: Needed ${info.needed.toFixed(2)} ${info.product.unit || ''}, Available ${avail.toFixed(2)} ${info.product.unit || ''}`);
        }
    }

    // Comprehensive Pre-Check: Validate container packaging stock
    const pkgNeededById = new Map();
    state.currentBillItems.forEach(item => {
        if (!item.packageId) return;
        const pkg = (state.packages || []).find(p => String(p.id) === String(item.packageId));
        if (pkg) {
            const key = String(pkg.id);
            const cur = pkgNeededById.get(key) || { pkg, needed: 0 };
            cur.needed += Number(item.numberOfUnits || 1);
            pkgNeededById.set(key, cur);
        }
    });

    for (const [_, info] of pkgNeededById) {
        const avail = Number(info.pkg.stock || 0);
        if (info.needed > avail) {
            stockDeficits.push(`• Container (${info.pkg.name}): Needed ${info.needed} ${info.pkg.unit || 'Pcs'}, Available ${avail} ${info.pkg.unit || 'Pcs'}`);
        }
    }

    if (stockDeficits.length > 0) {
        if (oldBill) {
            checkAndDeductPackageStock(oldBill.items || []);
            (oldBill.items || []).forEach(oldItem => {
                const rec = getStockProductRecord(oldItem);
                if (rec && rec.product) {
                    rec.product.stock = Math.max(0, (parseFloat(rec.product.stock) || 0) - (parseFloat(oldItem.stockDeductionQty || oldItem.qty) || 0));
                    rec.product.savedAt = Date.now();
                }
            });
        }
        alert(`⚠️ Cannot complete billing!\nInsufficient stock for the following items:\n\n${stockDeficits.join('\n')}\n\nPlease adjust quantities or add stock.`);
        return;
    }

    state.currentBillItems.forEach(item => {
        const rec = getStockProductRecord(item);
        if (rec && rec.product) {
            rec.product.stock = Math.max(0, (parseFloat(rec.product.stock) || 0) - (parseFloat(item.stockDeductionQty) || 0));
            rec.product.savedAt = Date.now();
        }
    });
    checkAndDeductPackageStock(state.currentBillItems);

    const subTotal = state.currentBillItems.reduce((sum, i) => sum + Number(i.total || 0), 0);
    const discountRaw = parseFloat(document.getElementById('billDiscountAmt')?.value);
    const discount = Number.isFinite(discountRaw) && discountRaw > 0 ? Math.min(subTotal, discountRaw) : 0;
    const grandTotal = Math.max(0, subTotal - discount);

    const paidAmount = parseFloat(document.getElementById('billPaidAmt')?.value);
    const safePaidAmount = Number.isFinite(paidAmount) ? Math.max(0, paidAmount) : grandTotal;
    const pendingAmount = Math.max(0, grandTotal - safePaidAmount);
    const excessAmount = Math.max(0, safePaidAmount - grandTotal);
    const paymentMode = document.getElementById('billPaymentMode')?.value || 'Cash';
    
    let billNo = (index >= 0 && state.customers[index]?.billNo) || getNextBillNumber();
    const billId = (index >= 0 && state.customers[index]?.id) || generateUniqueRecordId('bill');
    unmarkIdDeleted(billId);
    unmarkIdDeleted('custname_' + name.toLowerCase());

    const existingProfile = (state.customers || []).find(c => c && !c.billNo && String(c.name || '').trim().toLowerCase() === name.toLowerCase());
    const customerType = existingProfile?.customerType || saleType;
    if (existingProfile && (!existingProfile.customerType || existingProfile.customerType !== saleType)) {
        existingProfile.customerType = saleType;
        existingProfile.saleType = saleType;
        existingProfile.savedAt = Date.now();
    }

    const customerData = {
        id: billId,
        billNo,
        name,
        phone,
        saleType,
        customerType,
        paymentMode,
        items: sortBillItemsAlphabetically(state.currentBillItems).map(i => ({...i})),
        subTotal,
        discount,
        grandTotal,
        paidAmount: safePaidAmount,
        pendingAmount,
        excessAmount,
        date: (index >= 0 && state.customers[index]?.date) || getTodayDateString(),
        savedAt: Date.now()
    };

    let savedIndex = index === -1 ? state.customers.push(customerData) - 1 : (state.customers[index] = customerData, index);

    syncToFirebase();
    previewBill(savedIndex);
    resetCustomerForm();
    if (window.renderAll) window.renderAll();
}

export function resetCustomerForm() {
    const form = document.getElementById('billingForm') || document.getElementById('customerForm');
    if (form) form.reset();
    document.getElementById('custIndex').value = "-1";
    document.getElementById('billNumberDisplay').textContent = getNextBillNumber();
    const discountEl = document.getElementById('billDiscountAmt');
    if (discountEl) discountEl.value = '';
    const netPayableEl = document.getElementById('billNetPayable');
    if (netPayableEl) netPayableEl.value = '';
    state.currentBillItems = [];
    renderBillPreviewInput();
    const rRadio = document.getElementById('billSaleTypeRetail');
    if (rRadio) rRadio.checked = true;
    updateBillTypeBadge('Retail');
    const existingSel = document.getElementById('existingCustomerSelect');
    if (existingSel) existingSel.value = '';
    const notice = document.getElementById('billRateNotice');
    if (notice) notice.innerHTML = '';
    const btn = document.getElementById('custSubmitBtn');
    if (btn) btn.textContent = 'Save Bill & Folder';
    const delBtn = document.getElementById('custDeleteBtn');
    if (delBtn) delBtn.classList.add('hidden');
    const editModeCard = document.getElementById('billingEditMode');
    if (editModeCard) editModeCard.classList.add('hidden');
}

export function editCustomerBill(identifier) {
    let index = -1;
    if (typeof identifier === 'number') {
        index = identifier;
    } else if (identifier !== undefined && identifier !== null) {
        const idStr = String(identifier).trim().toLowerCase();
        index = (state.customers || []).findIndex(c => c && (String(c.billNo || '').trim().toLowerCase() === idStr || String(c.id || '').trim().toLowerCase() === idStr));
        if (index === -1 && /^\d+$/.test(idStr)) {
            index = parseInt(idStr, 10);
        }
    }
    const c = state.customers[index];
    if (!c) { alert('Bill not found.'); return; }
    if (window.switchTab) window.switchTab('billing', false);
    if (window.openBillingSection) window.openBillingSection('new');

    document.getElementById('custIndex').value = index;
    const billNoEl = document.getElementById('billNumberDisplay');
    if (billNoEl) billNoEl.textContent = c.billNo || 'OLD BILL';
    document.getElementById('custName').value = c.name ? String(c.name).toUpperCase() : '';
    document.getElementById('custPhone').value = c.phone || '';
    const saleRadio = document.querySelector(`input[name="saleType"][value="${c.saleType || 'Retail'}"]`);
    if (saleRadio) saleRadio.checked = true;
    updateBillTypeBadge(c.saleType || 'Retail');
    state.currentBillItems = sortBillItemsAlphabetically((c.items || []).map(item => ({...item})));
    renderBillPreviewInput();
    const discountEl = document.getElementById('billDiscountAmt');
    if (discountEl) discountEl.value = (c.discount !== undefined && Number(c.discount) > 0) ? Number(c.discount) : '';
    document.getElementById('billPaidAmt').value = c.paidAmount !== undefined ? Number(c.paidAmount) : Number(c.grandTotal || 0);
    const paymentModeEl = document.getElementById('billPaymentMode');
    if (paymentModeEl) paymentModeEl.value = c.paymentMode || 'Cash';
    calculateBalance();
    const btn = document.getElementById('custSubmitBtn');
    if (btn) btn.textContent = 'Update Bill & Payment';
    const delBtn = document.getElementById('custDeleteBtn');
    if (delBtn) delBtn.classList.remove('hidden');
    const editModeCard = document.getElementById('billingEditMode');
    if (editModeCard) editModeCard.classList.remove('hidden');
}

export function deleteCurrentEditedBill() {
    const idx = parseInt(document.getElementById('custIndex')?.value, 10);
    if (isNaN(idx) || idx < 0 || !state.customers[idx]) {
        alert('Please select an active bill to delete.');
        return;
    }
    const bill = state.customers[idx];
    if (typeof window.deleteCustomerBill === 'function') {
        window.deleteCustomerBill(bill.billNo || bill.id || idx, true);
    }
    resetCustomerForm();
}

export function updateBillQuantityTypeDropdown() {
    const qSelect = document.getElementById('billQuantityType');
    if (!qSelect) return;
    const currentVal = qSelect.value || 'Bottle';
    const standardTypes = ['Bottle', 'Pack', 'Can', 'Pouch', 'Box', 'Piece', 'Sticker', 'Roll', 'Other'];
    qSelect.innerHTML = '<optgroup label="Standard Packaging">' +
        standardTypes.map(t => `<option value="${t}">${t}</option>`).join('') +
        '</optgroup>';
    if (currentVal && [...qSelect.options].some(o => o.value === currentVal)) {
        qSelect.value = currentVal;
    }
}


export function stepCombinedBillUnits(delta) {
    const input = document.getElementById('combinedNumberOfUnits');
    if (!input) return;
    let val = parseInt(input.value, 10) || 1;
    val = Math.max(1, val + delta);
    input.value = val;
    calculateCombinedItemTotal();
}

export function stepCosBillUnits(delta) {
    const input = document.getElementById('cosSNumberOfUnits');
    if (!input) return;
    let val = parseInt(input.value, 10) || 1;
    val = Math.max(1, val + delta);
    input.value = val;
    calculateCosSalesTotal();
}

// ----------------------------------------------------
// Cosmetics Billing & Sales Functions
// ----------------------------------------------------

export function onCosSaleTypeChange() {
    fillCosSalesStockDetails();
}

export function fillCosSalesStockDetails() {
    const select = document.getElementById('cosSalesStockSelect');
    if (!select) return;
    const product = (state.cosProducts || []).find(p => p.id === select.value);
    if (!product) return;
    const saleType = document.querySelector('input[name="cosSaleType"]:checked')?.value || 'Retail';
    const price = saleType === 'Wholesale' ? Number(product.costPrice || 0) : Number(product.salePrice || 0);
    const unitPriceEl = document.getElementById('cosSUnitPrice');
    if (unitPriceEl) unitPriceEl.value = price || '';
    const unitEl = document.getElementById('cosSUnit');
    if (unitEl) unitEl.value = product.unit || 'Pcs';
    const barcodeEl = document.getElementById('cosSBarcode');
    if (barcodeEl) barcodeEl.value = product.barcode || '';
    calculateCosSalesTotal();
}

export function calculateCosSalesTotal() {
    const qty = parseFloat(document.getElementById('cosSQty')?.value) || 0;
    const rate = parseFloat(document.getElementById('cosSUnitPrice')?.value) || 0;
    const numberOfUnits = Math.max(1, parseInt(document.getElementById('cosSNumberOfUnits')?.value, 10) || 1);
    const total = numberOfUnits * rate;
    const amountEl = document.getElementById('cosSAmount');
    if (amountEl) amountEl.value = total ? total.toFixed(2) : '';
    calculateCosSalesBalance();
}

export function addToCosBillItems() {
    const productId = document.getElementById('cosSalesStockSelect')?.value;
    const product = (state.cosProducts || []).find(p => p.id === productId);
    const qty = parseFloat(document.getElementById('cosSQty')?.value);
    const rate = parseFloat(document.getElementById('cosSUnitPrice')?.value);
    const rawUnit = document.getElementById('cosSUnit')?.value;
    const unitType = (rawUnit && rawUnit !== 'Standard' && rawUnit !== 'General') ? rawUnit : (product?.unit || 'Pcs');
    const numberOfUnits = Math.max(1, parseInt(document.getElementById('cosSNumberOfUnits')?.value, 10) || 1);
    if (!productId || !product || !Number.isFinite(qty) || qty <= 0 || !Number.isFinite(rate)) {
        alert('Please select product, quantity, and rate.');
        return;
    }
    const factor = getBillingUnitFactor(unitType, product.unit);
    const stockDeductionQty = (qty > 0 ? qty : 1) * factor * numberOfUnits;
    const total = numberOfUnits * rate;
    const packageInfo = getProductPackageInfo(product);
    const already = (state.currentCosBillItems || []).filter(i => i.stockId === productId).reduce((s, i) => s + Number(i.stockDeductionQty || 0), 0);
    if (stockDeductionQty + already > Number(product.stock || 0)) {
        alert(`Insufficient stock. Available: ${product.stock} ${product.unit}`);
        return;
    }
    const quantityType = (product.unit || '').toLowerCase() === 'pack' ? 'Pack' : 'Bottle';
    if (!Array.isArray(state.currentCosBillItems)) state.currentCosBillItems = [];
    state.currentCosBillItems.push({
        productName: product.name,
        stockId: product.id,
        barcode: product.barcode || '',
        qty,
        unitType,
        quantityType,
        numberOfUnits,
        rate,
        total,
        stockDeductionQty,
        packageId: packageInfo?.id || '',
        packageQty: packageInfo?.qty || 0
    });
    state.currentCosBillItems = sortBillItemsAlphabetically(state.currentCosBillItems);
    const qEl = document.getElementById('cosSQty'); if (qEl) qEl.value = '';
    const uEl = document.getElementById('cosSUnitPrice'); if (uEl) uEl.value = '';
    const aEl = document.getElementById('cosSAmount'); if (aEl) aEl.value = '';
    const sEl = document.getElementById('cosSalesStockSelect'); if (sEl) sEl.value = '';
    const bEl = document.getElementById('cosSBarcode'); if (bEl) bEl.value = '';
    const nEl = document.getElementById('cosSNumberOfUnits'); if (nEl) nEl.value = '1';
    renderCosBillPreviewInput();
}

export function renderCosBillPreviewInput() {
    const container = document.getElementById('cosCurrentBillItemsPreview');
    if (!container) return;
    container.innerHTML = '';
    let grandTotal = 0;
    state.currentCosBillItems = sortBillItemsAlphabetically(state.currentCosBillItems || []);
    state.currentCosBillItems.forEach((item, index) => {
        grandTotal += Number(item.total || 0);
        const cleanName = getCleanInvoiceProductName(item.productName);
        const unitDisplay = (item.unitType && item.unitType !== 'Standard' && item.unitType !== 'General') ? item.unitType : ((state.cosProducts || []).find(p => p.id === item.stockId || p.name === item.productName)?.unit || 'Pcs');
        const qtyStr = `${item.qty} ${unitDisplay}`.trim();
        const units = Number(item.numberOfUnits || 1);
        container.innerHTML += `
            <div class="bg-slate-900 p-2.5 rounded-xl border border-slate-800 text-xs">
                <div class="hidden sm:grid sm:grid-cols-[1.4fr_0.8fr_0.8fr_0.8fr_0.9fr_auto_auto] gap-1 items-center">
                    <span class="font-semibold truncate">${cleanName}</span><span>${qtyStr}</span><span>${units}</span><span>₹${Number(item.rate).toFixed(2)}</span><strong class="text-emerald-400">₹${Number(item.total).toFixed(2)}</strong>
                    <button type="button" onclick="editCosBillItem(${index})" class="text-amber-300 font-bold px-1.5 py-1 hover:bg-slate-800 rounded" title="Edit item">✎</button>
                    <button type="button" onclick="state.currentCosBillItems.splice(${index},1);renderCosBillPreviewInput();calculateCosSalesBalance();" class="text-red-400 font-bold px-1.5 py-1 hover:bg-slate-800 rounded" title="Delete item">✕</button>
                </div>
                <div class="sm:hidden flex flex-col gap-1.5">
                    <div class="flex justify-between items-start gap-2">
                        <span class="font-bold text-white leading-snug break-words flex-1">${cleanName}</span>
                        <strong class="text-emerald-400 text-sm whitespace-nowrap shrink-0">₹${Number(item.total).toFixed(2)}</strong>
                    </div>
                    <div class="flex justify-between items-center text-[11px] text-slate-400 border-t border-slate-800/60 pt-1">
                        <span>${qtyStr} × ${units} @ ₹${Number(item.rate).toFixed(2)}</span>
                        <div class="flex items-center gap-1.5 shrink-0">
                            <button type="button" onclick="editCosBillItem(${index})" class="px-2.5 py-1 rounded-lg bg-amber-950/60 text-amber-300 border border-amber-800/60 font-bold text-[10px]">✎ Edit</button>
                            <button type="button" onclick="state.currentCosBillItems.splice(${index},1);renderCosBillPreviewInput();calculateCosSalesBalance();" class="px-2.5 py-1 rounded-lg bg-rose-950/60 text-rose-300 border border-rose-800/60 font-bold text-[10px]">✕ Remove</button>
                        </div>
                    </div>
                </div>
            </div>`;
    });
    if (state.currentCosBillItems.length > 0) {
        container.innerHTML += `<div class="text-right font-bold text-pink-300 pt-1">Grand Total: ₹${grandTotal.toFixed(2)}</div>`;
    }
    calculateCosSalesBalance();
}

export function editCosBillItem(index) {
    const item = (state.currentCosBillItems || [])[index];
    if (!item) return;
    const newUnitsRaw = prompt(`Edit number of units for ${item.productName}:`, String(item.numberOfUnits || 1));
    if (newUnitsRaw === null) return;
    const newUnits = Math.max(1, parseInt(newUnitsRaw, 10) || 1);
    const newRateRaw = prompt(`Edit rate for ${item.productName}:`, String(item.rate ?? ''));
    if (newRateRaw === null) return;
    const newRate = parseFloat(newRateRaw);
    if (!Number.isFinite(newRate) || newRate < 0) { alert('Please enter a valid rate.'); return; }

    const perUnitBulk = (Number(item.stockDeductionQty) || 0) / (Number(item.numberOfUnits) || 1);
    const newStockDeductionQty = perUnitBulk * newUnits;
    const newTotal = (item.qty > 0) ? (newStockDeductionQty * newRate) : (newRate * newUnits);

    const product = (state.cosProducts || []).find(p => p.id === item.stockId || p.name === item.productName);
    if (product) {
        const others = state.currentCosBillItems.filter((_, i) => i !== index && (_.stockId === item.stockId || _.productName === item.productName)).reduce((s, x) => s + Number(x.stockDeductionQty || 0), 0);
        if (newStockDeductionQty + others > Number(product.stock || 0)) {
            alert(`Insufficient stock for "${product.name}".\nAvailable: ${product.stock} ${product.unit}\nNeeded: ${(newStockDeductionQty + others).toFixed(2)} ${product.unit}`);
            return;
        }
    }

    state.currentCosBillItems[index] = { ...item, numberOfUnits: newUnits, rate: newRate, total: newTotal, stockDeductionQty: newStockDeductionQty };
    state.currentCosBillItems = sortBillItemsAlphabetically(state.currentCosBillItems);
    renderCosBillPreviewInput();
    calculateCosSalesBalance();
}

export function calculateCosSalesBalance() {
    const grandTotal = (state.currentCosBillItems || []).reduce((sum, i) => sum + Number(i.total || 0), 0);
    const paid = parseFloat(document.getElementById('cosSPaid')?.value) || 0;
    const difference = grandTotal - paid;
    const due = Math.max(0, difference);
    const excess = Math.max(0, -difference);
    const el = document.getElementById('cosSBalance');
    const status = document.getElementById('cosSBalanceStatus');
    if (el) el.value = due.toFixed(2);
    if (status) {
        if (difference > 0) { status.textContent = 'BALANCE DUE: ₹' + due.toFixed(2); status.className = 'text-[10px] font-bold mt-1 text-right text-rose-400'; }
        else if (difference < 0) { status.textContent = 'BALANCE RETURN: ₹' + excess.toFixed(2); status.className = 'text-[10px] font-bold mt-1 text-right text-amber-300'; }
        else { status.textContent = 'PAID IN FULL — BALANCE: ₹0.00'; status.className = 'text-[10px] font-bold mt-1 text-right text-emerald-400'; }
    }
}

export function restoreCosSaleStock(s) {
    const norm = normalizeCosSale(s);
    norm.items.forEach(item => {
        if (item.stockId) {
            const p = (state.cosProducts || []).find(x => x.id === item.stockId);
            if (p) {
                p.stock = (parseFloat(p.stock) || 0) + (parseFloat(item.stockDeductionQty ?? item.qty) || 0);
                p.savedAt = Date.now();
            }
        }
    });
}

export function deductCosSaleStock(items) {
    const totalDeductionByProduct = new Map();
    for (const item of items) {
        if (!item.stockId) continue;
        const p = (state.cosProducts || []).find(x => x.id === item.stockId);
        if (!p) continue;
        const deduction = parseFloat(item.stockDeductionQty ?? item.qty) || 0;
        const currentTotal = totalDeductionByProduct.get(p.id) || { product: p, totalNeeded: 0 };
        currentTotal.totalNeeded += deduction;
        totalDeductionByProduct.set(p.id, currentTotal);
    }
    for (const [_, info] of totalDeductionByProduct) {
        const current = parseFloat(info.product.stock) || 0;
        if (info.totalNeeded > current) {
            return { ok: false, product: info.product, available: current, requested: info.totalNeeded };
        }
    }
    items.forEach(item => {
        if (!item.stockId) return;
        const p = (state.cosProducts || []).find(x => x.id === item.stockId);
        if (p) {
            p.stock = Math.max(0, (parseFloat(p.stock) || 0) - (parseFloat(item.stockDeductionQty ?? item.qty) || 0));
            p.savedAt = Date.now();
        }
    });
    return { ok: true };
}

export function saveCosSales(e) {
    if (e && e.preventDefault) e.preventDefault();
    const customer = (document.getElementById('cosSCustomer')?.value.trim() || '').toUpperCase();
    const phone = document.getElementById('cosSPhone')?.value.trim() || '';
    const saleType = document.querySelector('input[name="cosSaleType"]:checked')?.value || 'Retail';
    const paymentMode = document.getElementById('cosSPaymentMode')?.value || 'Cash';
    const idx = parseInt(document.getElementById('cosSIndex')?.value, 10);

    if (!customer) { alert('Please enter customer name.'); return; }
    if (!state.currentCosBillItems || state.currentCosBillItems.length === 0) { alert('Please add at least one item.'); return; }

    if (idx >= 0 && state.cosSales[idx]) {
        restoreCosSaleStock(state.cosSales[idx]);
        restorePackageStock(normalizeCosSale(state.cosSales[idx]).items);
    }

    const packageDeduction = checkAndDeductPackageStock(state.currentCosBillItems);
    if (!packageDeduction.ok) {
        if (idx >= 0 && state.cosSales[idx]) {
            const oldItems = normalizeCosSale(state.cosSales[idx]).items;
            restorePackageStock(oldItems);
            checkAndDeductPackageStock(oldItems);
        }
        if (packageDeduction.missing) {
            alert(`Packaging item not found for: ${packageDeduction.products.join(', ')}. Please add the matching Bottle/Pack item in Stock → Package.`);
        } else {
            alert(`Insufficient package stock for ${packageDeduction.pkg?.name || 'packaging item'}. Available: ${packageDeduction.pkg?.stock || 0}`);
        }
        return;
    }
    const deduction = deductCosSaleStock(state.currentCosBillItems);
    if (!deduction.ok) {
        restorePackageStock(state.currentCosBillItems);
        if (idx >= 0 && state.cosSales[idx]) {
            const oldItems = normalizeCosSale(state.cosSales[idx]).items;
            deductCosSaleStock(oldItems);
            checkAndDeductPackageStock(oldItems);
        }
        alert(`Insufficient stock for ${deduction.product.name}. Available: ${deduction.available} ${deduction.product.unit}`);
        return;
    }

    const grandTotal = state.currentCosBillItems.reduce((sum, i) => sum + Number(i.total || 0), 0);
    const paidAmount = Math.max(0, parseFloat(document.getElementById('cosSPaid')?.value) || 0);
    const pendingAmount = Math.max(0, grandTotal - paidAmount);
    const excessAmount = Math.max(0, paidAmount - grandTotal);
    const billNo = (idx >= 0 && state.cosSales[idx]?.billNo) || getNextCosBillNumber();
    const cosBillId = (idx >= 0 && state.cosSales[idx]?.id) || generateUniqueRecordId('cossale');
    unmarkIdDeleted(cosBillId);
    unmarkIdDeleted('cust_' + customer.toLowerCase());
    unmarkIdDeleted('custname_' + customer.toLowerCase());
    const bill = {
        id: cosBillId,
        billNo,
        name: 'Cosmetics',
        customer, phone, saleType, paymentMode,
        items: sortBillItemsAlphabetically(state.currentCosBillItems).map(i => ({...i})),
        grandTotal, paidAmount, pendingAmount, excessAmount,
        date: (idx >= 0 && state.cosSales[idx]?.date) || getTodayDateString(),
        savedAt: Date.now()
    };

    const savedIndex = idx >= 0 ? (state.cosSales[idx] = {...(state.cosSales[idx] || {}), ...bill}, idx) : (state.cosSales.push(bill) - 1);

    syncToFirebase();
    previewCosSaleBill(state.cosSales[savedIndex]);
    resetCosSalesForm();
    renderCosSales();
    if (window.renderCosProductStock) window.renderCosProductStock();
    if (window.updateCosProductDropdowns) window.updateCosProductDropdowns();
    renderCosmeticsSummary();
    if (window.renderAccounts) window.renderAccounts();
    if (window.updateDashboard) window.updateDashboard();
}

export function renderCosSales() {
    renderCosmeticsSummary();
    renderCustomerConsolidationReport();
}

export function resetCosSalesForm() {
    const form = document.getElementById('cosSalesForm');
    if (form) form.reset();
    const idxEl = document.getElementById('cosSIndex');
    if (idxEl) idxEl.value = '-1';
    const cosBillNoEl = document.getElementById('cosBillNumberDisplay');
    if (cosBillNoEl) cosBillNoEl.textContent = getNextCosBillNumber();
    const titleEl = document.getElementById('cosSFormTitle');
    if (titleEl) titleEl.innerText = 'Cosmetics Billing (Wholesale / Retail)';
    const btnEl = document.getElementById('cosSSubmitBtn');
    if (btnEl) btnEl.innerText = 'Save Bill & Folder';
    state.currentCosBillItems = [];
    renderCosBillPreviewInput();
    const cosAdjBox = document.getElementById('cosmeticsPaymentEditMode');
    if (cosAdjBox) cosAdjBox.classList.add('hidden');
    const cosAdj = document.getElementById('cosmeticsPaymentAdjustmentAmt');
    if (cosAdj) cosAdj.value = '';
}

export function renderCosmeticsSummary() {
    let totalS = (state.cosSales || []).reduce((s, sale) => s + normalizeCosSale(sale).grandTotal, 0);
    let totalD = (state.cosSales || []).reduce((s, sale) => s + normalizeCosSale(sale).pendingAmount, 0);
    const sEl = document.getElementById('cosSumSales');
    const dEl = document.getElementById('cosSumDue');
    if (sEl) sEl.innerText = '₹' + totalS.toFixed(2);
    if (dEl) dEl.innerText = '₹' + totalD.toFixed(2);
}

// ----------------------------------------------------
// Combined Billing Functions
// ----------------------------------------------------

export function updateCombinedCustomerSelect() {
    const select = document.getElementById('combinedCustomerSelect');
    if (!select) return;
    const custMap = new Map();
    (state.customers || []).forEach(c => {
        if (!c || isCustItemDeleted(c)) return;
        const n = String(c.name || '').trim().toUpperCase();
        if (n && !custMap.has(n)) custMap.set(n, c.phone || '');
    });
    (state.cosSales || []).forEach(s => {
        if (!s || isCustItemDeleted(s)) return;
        const n = String(s.customer || '').trim().toUpperCase();
        if (n && !custMap.has(n)) custMap.set(n, s.phone || '');
    });
    const names = Array.from(custMap.keys()).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
    const current = (select.value || '').trim().toUpperCase();
    select.innerHTML = '<option value="">-- Select Customer / Enter Manually Below --</option>' + names.map(n => `<option value="${n.replace(/"/g, '&quot;')}" data-phone="${custMap.get(n)}">${n}</option>`).join('');
    if (current && custMap.has(current)) select.value = current;
}

export function fillCombinedCustomer() {
    const select = document.getElementById('combinedCustomerSelect');
    const name = (select?.value || '').trim().toUpperCase();
    if (!name) return;
    const selectedOpt = select.options[select.selectedIndex];
    const phone = selectedOpt?.getAttribute('data-phone') || '';
    const nameEl = document.getElementById('combinedCustomerName');
    if (nameEl) nameEl.value = name;
    const phoneEl = document.getElementById('combinedCustomerPhone');
    if (phoneEl) phoneEl.value = phone;
}

export function updateCombinedProductSelect() {
    const select = document.getElementById('combinedProductSelect');
    if (!select) return;
    const rows = [
        ...(state.products || []).map(p => ({ category: 'Cleaning', name: p.name || '', stock: Number(p.stock) || 0, unit: p.unit || '', wholesale: getProductWholesalePrice(p), retail: getProductRetailPrice(p) })),
        ...(state.cosProducts || []).map(p => ({ category: 'Cosmetics', name: p.name || '', stock: Number(p.stock) || 0, unit: p.unit || '', wholesale: getProductWholesalePrice(p), retail: getProductRetailPrice(p) }))
    ].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true }));
    const current = select.value;
    select.innerHTML = '<option value="">-- Select Product --</option>' + rows.map(r => `<option value="${r.category}::${String(r.name).replace(/"/g, '&quot;')}" data-category="${r.category}" data-name="${String(r.name).replace(/"/g, '&quot;')}" data-stock="${r.stock}" data-unit="${r.unit}" data-wholesale="${r.wholesale}" data-retail="${r.retail}">${toTitleCase(r.name)} — ${r.category} (Stock: ${r.stock} ${r.unit})</option>`).join('');
    if (current) select.value = current;
}

export function getCombinedSelected() {
    const v = document.getElementById('combinedProductSelect')?.value || '';
    const parts = v.split('::');
    if (parts.length < 2) return null;
    return { category: parts[0], name: parts.slice(1).join('::') };
}

export function fillCombinedProductPrice() {
    const o = document.getElementById('combinedProductSelect')?.selectedOptions?.[0];
    const variantWrapper = document.getElementById('combinedPackVariantWrapper');
    const variantSelect = document.getElementById('combinedPackVariantSelect');
    const badgeEl = document.getElementById('combinedPackVariantBadge');

    if (!o || !o.value) {
        if (variantWrapper) variantWrapper.classList.add('hidden');
        if (badgeEl) badgeEl.textContent = '';
        return;
    }

    const selected = getCombinedSelected();
    const product = selected ? combinedStockRecord({ category: selected.category, productName: selected.name }) : null;

    // 1. Check if product has pack size variants!
    if (product && Array.isArray(product.variants) && product.variants.length > 0) {
        if (variantWrapper && variantSelect) {
            variantWrapper.classList.remove('hidden');
            const saleType = document.querySelector('input[name="combinedSaleType"]:checked')?.value || 'Retail';
            variantSelect.innerHTML = '<option value="">-- Select Pack Size (' + product.variants.length + ' options) --</option>' +
                product.variants.map(v => {
                    const rate = saleType === 'Wholesale' ? v.wholesalePrice : v.retailPrice;
                    return `<option value="${v.id}">${v.name} (${v.size} ${v.unit}) — ₹${Number(rate || 0).toFixed(2)}${v.packageName ? ' [' + v.packageName + ']' : ''}</option>`;
                }).join('');

            // Auto-select first variant
            variantSelect.selectedIndex = 1;
            onCombinedPackVariantSelected();
            return;
        }
    }

    // 2. If NO multi-variants, check if product has mapped package
    let mappedPkg = null;
    if (product?.packageId) {
        mappedPkg = (state.packages || []).find(p => String(p.id) === String(product.packageId));
    }
    if (!mappedPkg && product?.packageName) {
        mappedPkg = (state.packages || []).find(p => String(p.name).toLowerCase() === String(product.packageName).toLowerCase());
    }

    const type = document.querySelector('input[name="combinedSaleType"]:checked')?.value || 'Retail';
    const baseRate = Number(type === 'Wholesale' ? o.dataset.wholesale : o.dataset.retail || 0);

    if (mappedPkg) {
        if (variantWrapper && variantSelect) {
            variantWrapper.classList.remove('hidden');
            if (badgeEl) badgeEl.innerHTML = `📦 ${mappedPkg.name} (<span class="${Number(mappedPkg.stock) <= 5 ? 'text-rose-400 font-bold' : 'text-emerald-400 font-bold'}">Stock: ${mappedPkg.stock}</span>)`;
            variantSelect.innerHTML = `<option value="default_pkg">${mappedPkg.name}${mappedPkg.size ? ' (' + mappedPkg.size + ')' : ''} — ₹${baseRate.toFixed(2)} [Default Pack]</option>`;
            variantSelect.selectedIndex = 0;
        }

        const parsed = parsePackageVolume(mappedPkg.size, mappedPkg.name);
        const qtyEl = document.getElementById('combinedQty');
        if (qtyEl) qtyEl.value = parsed ? parsed.size : 1;
        const unitEl = document.getElementById('combinedUnitType');
        if (unitEl) {
            const u = parsed ? parsed.unit : (o.dataset.unit || product?.unit || 'Bottle');
            if (![...unitEl.options].some(x => x.value.toLowerCase() === u.toLowerCase())) {
                unitEl.add(new Option(u, u));
            }
            unitEl.value = u;
        }

        const rateEl = document.getElementById('combinedRate');
        if (rateEl) {
            rateEl.value = baseRate ? baseRate.toFixed(2) : '0';
            rateEl.dataset.autoRate = rateEl.value;
            rateEl.dataset.defaultPkgId = mappedPkg.id;
            delete rateEl.dataset.variantId;
        }
        calculateCombinedItemTotal();
        return;
    }

    // 3. Fallback: neither variants nor mapped package
    if (variantWrapper) variantWrapper.classList.add('hidden');
    if (badgeEl) badgeEl.textContent = '';
    if (variantSelect) variantSelect.innerHTML = '<option value="">-- Select Pack Size --</option>';

    const unitEl = document.getElementById('combinedUnitType');
    if (unitEl) unitEl.value = o.dataset.unit || product?.unit || 'Pcs';
    const rateEl = document.getElementById('combinedRate');
    if (rateEl) {
        rateEl.value = baseRate ? baseRate.toFixed(2) : '0';
        rateEl.dataset.autoRate = rateEl.value;
        delete rateEl.dataset.variantId;
        delete rateEl.dataset.defaultPkgId;
    }
    calculateCombinedItemTotal();
}

export function onCombinedPackVariantSelected() {
    const selected = getCombinedSelected();
    const product = selected ? combinedStockRecord({ category: selected.category, productName: selected.name }) : null;
    const variantSelect = document.getElementById('combinedPackVariantSelect');
    const vId = variantSelect?.value;
    const badgeEl = document.getElementById('combinedPackVariantBadge');
    if (!product || !vId) {
        if (badgeEl) badgeEl.textContent = '';
        return;
    }

    if (vId === 'default_pkg') {
        let mappedPkg = null;
        if (product.packageId) mappedPkg = (state.packages || []).find(p => String(p.id) === String(product.packageId));
        if (!mappedPkg && product.packageName) mappedPkg = (state.packages || []).find(p => String(p.name).toLowerCase() === String(product.packageName).toLowerCase());

        const saleType = document.querySelector('input[name="combinedSaleType"]:checked')?.value || 'Retail';
        const rate = Number(saleType === 'Wholesale' ? (product.wholesalePrice || product.costPrice) : (product.retailPrice || product.salePrice)) || 0;
        const rateEl = document.getElementById('combinedRate');
        if (rateEl) {
            rateEl.value = rate ? rate.toFixed(2) : '0';
            rateEl.dataset.autoRate = rateEl.value;
            rateEl.dataset.defaultPkgId = mappedPkg?.id || '';
            delete rateEl.dataset.variantId;
        }

        const parsed = parsePackageVolume(mappedPkg?.size, mappedPkg?.name);
        const qtyEl = document.getElementById('combinedQty');
        if (qtyEl) qtyEl.value = parsed ? parsed.size : 1;
        const unitEl = document.getElementById('combinedUnitType');
        if (unitEl && parsed) unitEl.value = parsed.unit;
        if (mappedPkg && badgeEl) {
            badgeEl.innerHTML = `📦 ${mappedPkg.name} (<span class="${Number(mappedPkg.stock) <= 5 ? 'text-rose-400 font-bold' : 'text-emerald-400 font-bold'}">Stock: ${mappedPkg.stock}</span>)`;
        }
        calculateCombinedItemTotal();
        return;
    }

    const variant = product.variants?.find(v => String(v.id) === String(vId));
    if (!variant) return;

    const qtyEl = document.getElementById('combinedQty');
    if (qtyEl) qtyEl.value = variant.size;

    const unitEl = document.getElementById('combinedUnitType');
    if (unitEl) {
        if (![...unitEl.options].some(o => o.value.toLowerCase() === variant.unit.toLowerCase())) {
            unitEl.add(new Option(variant.unit, variant.unit));
        }
        unitEl.value = variant.unit;
    }

    const saleType = document.querySelector('input[name="combinedSaleType"]:checked')?.value || 'Retail';
    const rate = Number(saleType === 'Wholesale' ? variant.wholesalePrice : variant.retailPrice) || 0;
    const rateEl = document.getElementById('combinedRate');
    if (rateEl) {
        rateEl.value = rate ? rate.toFixed(2) : '0';
        rateEl.dataset.autoRate = rateEl.value;
        rateEl.dataset.variantId = variant.id;
        delete rateEl.dataset.defaultPkgId;
    }

    // Link package container
    let pkg = null;
    if (variant.packageId) pkg = (state.packages || []).find(p => String(p.id) === String(variant.packageId));
    if (!pkg && variant.packageName) pkg = (state.packages || []).find(p => String(p.name).toLowerCase() === String(variant.packageName).toLowerCase());

    if (pkg) {
        if (badgeEl) badgeEl.innerHTML = `📦 ${pkg.name} (<span class="${Number(pkg.stock) <= 5 ? 'text-rose-400 font-bold' : 'text-emerald-400 font-bold'}">Stock: ${pkg.stock}</span>)`;
    } else {
        if (badgeEl) badgeEl.textContent = variant.packageName ? `📦 ${variant.packageName}` : '';
    }

    calculateCombinedItemTotal();
}

export function onCombinedSaleTypeChange() {
    const variantWrapper = document.getElementById('combinedPackVariantWrapper');
    const variantSelect = document.getElementById('combinedPackVariantSelect');
    if (variantWrapper && !variantWrapper.classList.contains('hidden') && variantSelect && variantSelect.value) {
        const selected = getCombinedSelected();
        const product = selected ? combinedStockRecord({ category: selected.category, productName: selected.name }) : null;
        const variant = product?.variants?.find(v => String(v.id) === String(variantSelect.value));
        if (variant) {
            const saleType = document.querySelector('input[name="combinedSaleType"]:checked')?.value || 'Retail';
            const rate = Number(saleType === 'Wholesale' ? variant.wholesalePrice : variant.retailPrice) || 0;
            const rateEl = document.getElementById('combinedRate');
            if (rateEl) {
                rateEl.value = rate ? rate.toFixed(2) : '0';
                rateEl.dataset.autoRate = rateEl.value;
            }
            calculateCombinedItemTotal();
            return;
        }
    }
    fillCombinedProductPrice();
}

export function calculateCombinedItemTotal() {
    let rate = parseFloat(document.getElementById('combinedRate')?.value) || 0;
    const u = Math.max(1, parseInt(document.getElementById('combinedNumberOfUnits')?.value, 10) || 1);
    const selected = getCombinedSelected();
    const product = selected ? combinedStockRecord({ category: selected.category, productName: selected.name }) : null;

    const autoRate = parseFloat(document.getElementById('combinedRate')?.dataset.autoRate);
    const variantId = document.getElementById('combinedPackVariantSelect')?.value || document.getElementById('combinedRate')?.dataset.variantId;
    const isPackage = selected?.category === 'Package';
    if (!variantId && !isPackage && Number.isFinite(autoRate) && Math.abs(rate - autoRate) < 0.000001) {
        const saleType = document.querySelector('input[name="combinedSaleType"]:checked')?.value || 'Retail';
        const baseRate = product ? (saleType === 'Wholesale' ? Number(product.wholesalePrice || product.costPrice || 0) : Number(product.retailPrice || product.salePrice || 0)) : 0;
        if (baseRate > 0) {
            rate = baseRate;
            document.getElementById('combinedRate').value = rate.toFixed(2);
            document.getElementById('combinedRate').dataset.autoRate = document.getElementById('combinedRate').value;
        }
    }

    const total = rate * u;
    const el = document.getElementById('combinedCalculatedTotal');
    if (el) el.value = total ? total.toFixed(2) : '';
}

export function combinedStockRecord(item) {
    const cat = item ? (item.combinedCategory || item.category) : '';
    if (cat === 'Cosmetics') return (state.cosProducts || []).find(p => p.name === item.productName);
    if (cat === 'Package') return (state.packages || []).find(p => p.name === item.productName);
    return (state.products || []).find(p => p.name === item.productName);
}

export function addToCombinedBill() {
    const selected = getCombinedSelected();
    const qty = parseFloat(document.getElementById('combinedQty')?.value);
    const rate = parseFloat(document.getElementById('combinedRate')?.value);
    const rawUnitType = document.getElementById('combinedUnitType')?.value || '';
    const numberOfUnits = Math.max(1, parseInt(document.getElementById('combinedNumberOfUnits')?.value, 10) || 1);

    if (!selected || !Number.isFinite(qty) || qty <= 0 || !Number.isFinite(rate)) {
        alert('Please select product, quantity, and rate.');
        return;
    }

    const product = combinedStockRecord({ category: selected.category, productName: selected.name });
    const isPackage = selected.category === 'Package';

    if (!Array.isArray(state.currentBillItems)) state.currentBillItems = [];

    if (isPackage) {
        const pkg = (state.packages || []).find(p => p.name === selected.name);
        const unitType = (rawUnitType && rawUnitType !== 'Standard' && rawUnitType !== 'General') ? rawUnitType : (pkg?.unit || 'Pcs');
        const stockDeductionQty = (qty > 0 ? qty : 1) * numberOfUnits;
        const total = stockDeductionQty * rate;
        if (pkg) {
            const already = state.currentBillItems.filter(i => i.productName === selected.name && i.combinedCategory === 'Package').reduce((s, i) => s + Number(i.stockDeductionQty || 0), 0);
            if (stockDeductionQty + already > Number(pkg.stock || 0)) {
                alert(`Insufficient package stock for "${pkg.name}".\nAvailable: ${pkg.stock} ${pkg.unit || 'Pcs'}\nNeeded: ${stockDeductionQty + already} ${pkg.unit || 'Pcs'}`);
                return;
            }
        }
        state.currentBillItems.push({
            productName: selected.name,
            qty,
            unitType,
            quantityType: 'Pcs',
            numberOfUnits,
            rate,
            total,
            stockDeductionQty,
            combinedCategory: 'Package',
            isPackage: true,
            packageId: pkg?.id || '',
            packageQty: 1,
            packageName: pkg?.name || selected.name
        });
        finishAddCombinedItem();
        return;
    }

    const variantId = document.getElementById('combinedPackVariantSelect')?.value || document.getElementById('combinedRate')?.dataset.variantId || '';
    const variant = product?.variants?.find(v => String(v.id) === String(variantId));
    const unitType = (rawUnitType && rawUnitType !== 'Standard' && rawUnitType !== 'General') ? rawUnitType : (variant?.unit || product?.unit || 'Pcs');

    let stockDeductionQty = 0;
    let packageInfo = null;
    let variantName = '';

    if (variant) {
        variantName = variant.name;
        const factor = getBillingUnitFactor(variant.unit, product?.unit);
        stockDeductionQty = variant.size * factor * numberOfUnits;

        if (variant.packageId) {
            const pkg = (state.packages || []).find(p => String(p.id) === String(variant.packageId));
            if (pkg) packageInfo = { id: pkg.id, qty: 1, pkg, name: pkg.name };
        }
        if (!packageInfo && variant.packageName) {
            const pkg = (state.packages || []).find(p => p.name.toLowerCase() === variant.packageName.toLowerCase());
            if (pkg) packageInfo = { id: pkg.id, qty: 1, pkg, name: pkg.name };
            else packageInfo = { id: '', qty: 1, pkg: null, name: variant.packageName };
        }
    } else {
        const factor = getBillingUnitFactor(unitType, product?.unit);
        stockDeductionQty = (qty > 0 ? qty : 1) * factor * numberOfUnits;
        packageInfo = getProductPackageInfo(product);
        if (packageInfo && packageInfo.name) {
            variantName = packageInfo.name;
        }
    }

    const total = numberOfUnits * rate;

    // Check bulk product stock
    if (product) {
        const already = state.currentBillItems.filter(i => i.productName === selected.name && i.combinedCategory === selected.category && !i.isPackage).reduce((s, i) => s + Number(i.stockDeductionQty || 0), 0);
        if (stockDeductionQty + already > Number(product.stock || 0)) {
            alert(`Insufficient bulk stock for "${product.name}".\nAvailable: ${product.stock} ${product.unit}\nNeeded: ${(stockDeductionQty + already).toFixed(2)} ${product.unit}`);
            return;
        }
    }

    // Check packaging container stock
    if (packageInfo && packageInfo.pkg) {
        const pkg = packageInfo.pkg;
        const alreadyPkg = state.currentBillItems.filter(i => String(i.packageId) === String(pkg.id)).reduce((s, i) => s + Number(i.numberOfUnits || 1), 0);
        if (numberOfUnits + alreadyPkg > Number(pkg.stock || 0)) {
            alert(`Insufficient packaging stock for container "${pkg.name}".\nAvailable: ${pkg.stock} ${pkg.unit || 'Pcs'}\nNeeded: ${numberOfUnits + alreadyPkg} ${pkg.unit || 'Pcs'}`);
            return;
        }
    }

    state.currentBillItems.push({
        productName: selected.name,
        variantId: variant?.id || '',
        variantName: variantName || '',
        qty,
        unitType,
        quantityType: packageInfo?.name || 'Bottle',
        numberOfUnits,
        rate,
        total,
        stockDeductionQty,
        combinedCategory: selected.category,
        isPackage: false,
        packageId: packageInfo?.id || '',
        packageQty: 1,
        packageName: packageInfo?.name || ''
    });

    finishAddCombinedItem();
}

export function finishAddCombinedItem() {
    state.currentBillItems = sortBillItemsAlphabetically(state.currentBillItems || []);
    renderCombinedBillItems();
    ['combinedQty', 'combinedRate', 'combinedCalculatedTotal'].forEach(id => {
        const e = document.getElementById(id);
        if (e) e.value = '';
    });
    const sel = document.getElementById('combinedProductSelect');
    if (sel) sel.value = '';
    const variantWrapper = document.getElementById('combinedPackVariantWrapper');
    if (variantWrapper) variantWrapper.classList.add('hidden');
    const badgeEl = document.getElementById('combinedPackVariantBadge');
    if (badgeEl) badgeEl.textContent = '';
    const numEl = document.getElementById('combinedNumberOfUnits');
    if (numEl) numEl.value = '1';
    calculateCombinedBalance();
}

export function renderCombinedBillItems() {
    const c = document.getElementById('combinedBillItemsPreview');
    if (!c) return;
    state.currentBillItems = sortBillItemsAlphabetically(state.currentBillItems || []);
    let total = 0;
    c.innerHTML = state.currentBillItems.map((item, i) => {
        total += Number(item.total || 0);
        const cleanName = getCleanInvoiceProductName(item.productName);
        const rec = combinedStockRecord({ category: item.combinedCategory, productName: item.productName });
        const unitDisplay = (item.unitType && item.unitType !== 'Standard' && item.unitType !== 'General') ? item.unitType : (rec?.unit || 'Pcs');
        const qtyStr = `${item.qty} ${unitDisplay}`.trim();
        const units = Number(item.numberOfUnits || 1);
        return `<div class="bg-slate-900 p-2.5 rounded-xl border border-slate-800 text-xs">
            <div class="hidden sm:grid sm:grid-cols-[1.5fr_0.7fr_0.7fr_0.8fr_0.9fr_auto_auto] gap-1 items-center">
                <span class="font-semibold truncate">${cleanName} <small class="text-cyan-400">(${item.combinedCategory || ''})</small></span>
                <span>${qtyStr}</span>
                <span>${units}</span>
                <span>₹${Number(item.rate || 0).toFixed(2)}</span>
                <strong class="text-emerald-400">₹${Number(item.total || 0).toFixed(2)}</strong>
                <button type="button" onclick="editCombinedBillItem(${i})" class="text-sky-300 font-bold px-1.5 py-1 hover:bg-slate-800 rounded" title="Edit item">✎</button>
                <button type="button" onclick="window.removeCombinedBillItem(${i})" class="text-rose-400 font-bold px-1.5 py-1 hover:bg-slate-800 rounded" title="Delete item">✕</button>
            </div>
            <div class="sm:hidden flex flex-col gap-1.5">
                <div class="flex justify-between items-start gap-2">
                    <span class="font-bold text-white leading-snug break-words flex-1">${cleanName} <small class="text-cyan-400">(${item.combinedCategory || ''})</small></span>
                    <strong class="text-emerald-400 text-sm whitespace-nowrap shrink-0">₹${Number(item.total || 0).toFixed(2)}</strong>
                </div>
                <div class="flex justify-between items-center text-[11px] text-slate-400 border-t border-slate-800/60 pt-1">
                    <span>${qtyStr} × ${units} @ ₹${Number(item.rate || 0).toFixed(2)}</span>
                    <div class="flex items-center gap-1.5 shrink-0">
                        <button type="button" onclick="editCombinedBillItem(${i})" class="px-2.5 py-1 rounded-lg bg-slate-800 text-sky-300 border border-sky-500/30 font-bold text-[10px]">✎ Edit</button>
                        <button type="button" onclick="window.removeCombinedBillItem(${i})" class="px-2.5 py-1 rounded-lg bg-rose-950/60 text-rose-300 border border-rose-800/60 font-bold text-[10px]">✕ Remove</button>
                    </div>
                </div>
            </div>
        </div>`;
    }).join('') + (state.currentBillItems.length ? `<div class="text-right font-bold text-cyan-300 pt-1">Grand Total: ₹${total.toFixed(2)}</div>` : '');
    calculateCombinedBalance();
}

export function removeCombinedBillItem(index) {
    if (!Array.isArray(state.currentBillItems) || index < 0 || index >= state.currentBillItems.length) return;
    state.currentBillItems.splice(index, 1);
    renderCombinedBillItems();
    calculateCombinedBalance();
}

export function editCombinedBillItem(index) {
    const item = (state.currentBillItems || [])[index];
    if (!item) return;
    const newUnitsRaw = prompt(`Edit number of units/bottles for ${item.productName}${item.variantName ? ' (' + item.variantName + ')' : ''}:`, String(item.numberOfUnits || 1));
    if (newUnitsRaw === null) return;
    const newUnits = Math.max(1, parseInt(newUnitsRaw, 10) || 1);
    const newRateRaw = prompt(`Edit rate for ${item.productName}:`, String(item.rate ?? ''));
    if (newRateRaw === null) return;
    const newRate = parseFloat(newRateRaw);
    if (!Number.isFinite(newRate) || newRate < 0) { alert('Please enter a valid rate.'); return; }

    const perUnitBulk = (Number(item.stockDeductionQty) || 0) / (Number(item.numberOfUnits) || 1);
    const newStockDeductionQty = perUnitBulk * newUnits;
    const newTotal = newUnits * newRate;

    const product = combinedStockRecord(item);
    if (product && !item.isPackage) {
        const others = state.currentBillItems.filter((_, i) => i !== index && _.productName === item.productName && _.combinedCategory === item.combinedCategory && !_.isPackage).reduce((s, x) => s + Number(x.stockDeductionQty || 0), 0);
        if (newStockDeductionQty + others > Number(product.stock || 0)) {
            alert(`Insufficient stock for "${product.name}".\nAvailable: ${product.stock} ${product.unit}\nNeeded: ${(newStockDeductionQty + others).toFixed(2)} ${product.unit}`);
            return;
        }
    }
    if (item.packageId) {
        const pkg = (state.packages || []).find(p => String(p.id) === String(item.packageId));
        if (pkg) {
            const others = state.currentBillItems.filter((_, i) => i !== index && String(_.packageId) === String(pkg.id)).reduce((s, x) => s + Number(x.numberOfUnits || 1), 0);
            if (newUnits + others > Number(pkg.stock || 0)) {
                alert(`Insufficient packaging stock for container "${pkg.name}".\nAvailable: ${pkg.stock} ${pkg.unit || 'Pcs'}\nNeeded: ${newUnits + others} ${pkg.unit || 'Pcs'}`);
                return;
            }
        }
    }

    state.currentBillItems[index] = { ...item, numberOfUnits: newUnits, rate: newRate, total: newTotal, stockDeductionQty: newStockDeductionQty };
    state.currentBillItems = sortBillItemsAlphabetically(state.currentBillItems);
    renderCombinedBillItems();
    calculateCombinedBalance();
}

export function calculateCombinedBalance() {
    const total = (state.currentBillItems || []).reduce((s, i) => s + Number(i.total || 0), 0);
    const paidRaw = document.getElementById('combinedPaidAmt')?.value;
    const isPaidEmpty = paidRaw === '' || paidRaw === undefined;
    const paid = isPaidEmpty ? total : (parseFloat(paidRaw) || 0);
    const bal = total - paid;
    const due = Math.max(0, bal);
    const excess = Math.max(0, -bal);
    const f = document.getElementById('combinedPendingAmt');
    const st = document.getElementById('combinedBalanceStatus');
    if (f) f.value = due.toFixed(2);
    if (st) {
        if (bal > 0.001) {
            st.textContent = 'BALANCE DUE: ₹' + due.toFixed(2);
            st.className = 'text-xs font-black mt-1 text-right text-rose-400 animate-pulse';
        } else if (bal < -0.001) {
            st.textContent = 'BALANCE RETURN / CHANGE: ₹' + excess.toFixed(2);
            st.className = 'text-xs font-black mt-1 text-right text-amber-300';
        } else {
            st.textContent = 'PAID IN FULL — BALANCE: ₹0.00';
            st.className = 'text-xs font-black mt-1 text-right text-emerald-400';
        }
    }
}

export function getNextCombinedBillNumber() {
    const max = (state.customers || []).reduce((m, c) => {
        if (c?.billType !== 'Combined') return m;
        const n = parseInt(String(c.billNo || '').match(/(\d+)$/)?.[1] || 0, 10);
        return Math.max(m, n);
    }, 0);
    return 'COM-' + String(max + 1).padStart(4, '0');
}

export function resetCombinedBillForm(focus = true) {
    const f = document.getElementById('combinedBillingForm');
    if (!f) return;
    f.reset();
    const idxEl = document.getElementById('combinedBillIndex');
    if (idxEl) idxEl.value = '-1';
    const dispEl = document.getElementById('combinedBillNumberDisplay');
    if (dispEl) dispEl.textContent = getNextCombinedBillNumber();
    state.currentBillItems = [];
    renderCombinedBillItems();
    const variantWrapper = document.getElementById('combinedPackVariantWrapper');
    if (variantWrapper) variantWrapper.classList.add('hidden');
    const badgeEl = document.getElementById('combinedPackVariantBadge');
    if (badgeEl) badgeEl.textContent = '';
    if (focus) setTimeout(() => document.getElementById('combinedCustomerName')?.focus(), 80);
}

export function saveCombinedBill(e) {
    if (e && e.preventDefault) e.preventDefault();
    const idx = parseInt(document.getElementById('combinedBillIndex')?.value, 10);
    const name = (document.getElementById('combinedCustomerName')?.value.trim() || '').toUpperCase();
    const phone = document.getElementById('combinedCustomerPhone')?.value.trim() || '';
    const saleType = document.querySelector('input[name="combinedSaleType"]:checked')?.value || 'Retail';
    if (!name || !state.currentBillItems.length) {
        alert('Please enter customer and add at least one item.');
        return;
    }
    if (idx >= 0 && state.customers[idx]?.items) {
        restorePackageStock(state.customers[idx].items);
        state.customers[idx].items.forEach(old => {
            const p = combinedStockRecord(old);
            if (p) p.stock += Number(old.stockDeductionQty || old.qty || 0);
        });
    }

    // Comprehensive Pre-Check: Validate bulk stock & package stock
    const combinedDeficits = [];
    const bulkNeeded = new Map();
    state.currentBillItems.forEach(item => {
        const p = combinedStockRecord(item);
        if (p) {
            const key = String(p.id || p.name);
            const cur = bulkNeeded.get(key) || { product: p, needed: 0 };
            cur.needed += Number(item.stockDeductionQty || 0);
            bulkNeeded.set(key, cur);
        }
    });
    for (const [_, info] of bulkNeeded) {
        const avail = Number(info.product.stock || 0);
        if (info.needed > avail) {
            combinedDeficits.push(`• ${info.product.name}: Needed ${info.needed.toFixed(2)} ${info.product.unit || ''}, Available ${avail.toFixed(2)} ${info.product.unit || ''}`);
        }
    }

    const pkgNeeded = new Map();
    state.currentBillItems.forEach(item => {
        if (!item.packageId) return;
        const pkg = (state.packages || []).find(p => String(p.id) === String(item.packageId));
        if (pkg) {
            const key = String(pkg.id);
            const cur = pkgNeeded.get(key) || { pkg, needed: 0 };
            cur.needed += Number(item.numberOfUnits || 1);
            pkgNeeded.set(key, cur);
        }
    });
    for (const [_, info] of pkgNeeded) {
        const avail = Number(info.pkg.stock || 0);
        if (info.needed > avail) {
            combinedDeficits.push(`• Container (${info.pkg.name}): Needed ${info.needed} ${info.pkg.unit || 'Pcs'}, Available ${avail} ${info.pkg.unit || 'Pcs'}`);
        }
    }

    if (combinedDeficits.length > 0) {
        if (idx >= 0 && state.customers[idx]?.items) {
            checkAndDeductPackageStock(state.customers[idx].items);
            state.customers[idx].items.forEach(old => {
                const p = combinedStockRecord(old);
                if (p) p.stock = Math.max(0, (Number(p.stock) || 0) - Number(old.stockDeductionQty || old.qty || 0));
            });
        }
        alert(`⚠️ Cannot complete billing!\nInsufficient stock for the following items:\n\n${combinedDeficits.join('\n')}\n\nPlease adjust quantities or add stock.`);
        return;
    }

    checkAndDeductPackageStock(state.currentBillItems);
    state.currentBillItems.forEach(item => {
        const p = combinedStockRecord(item);
        if (p) {
            p.stock = Math.max(0, Number(p.stock || 0) - Number(item.stockDeductionQty || 0));
            p.savedAt = Date.now();
        }
    });

    const total = state.currentBillItems.reduce((s, i) => s + Number(i.total || 0), 0);
    const paidRaw = parseFloat(document.getElementById('combinedPaidAmt')?.value);
    const paid = Number.isFinite(paidRaw) ? Math.max(0, paidRaw) : total;
    const due = Math.max(0, total - paid);
    const excess = Math.max(0, paid - total);
    const old = idx >= 0 ? state.customers[idx] : null;
    const billNo = old?.billNo || getNextCombinedBillNumber();
    unmarkIdDeleted(billNo);
    unmarkIdDeleted('cust_' + name.toLowerCase());
    unmarkIdDeleted('custname_' + name.toLowerCase());

    const billId = (old && old.id) || ('bill_' + (billNo || Date.now()) + '_' + Math.random().toString(36).slice(2, 7));
    unmarkIdDeleted(billNo);
    unmarkIdDeleted(billId);

    const bill = {
        id: billId,
        billNo,
        billType: 'Combined',
        name, phone, saleType,
        paymentMode: document.getElementById('combinedPaymentMode')?.value || 'Cash',
        items: sortBillItemsAlphabetically(state.currentBillItems).map(i => ({...i})),
        grandTotal: total,
        paidAmount: paid,
        pendingAmount: due,
        excessAmount: excess,
        date: old?.date || getTodayDateString(),
        savedAt: Date.now()
    };

    if (idx >= 0) state.customers[idx] = bill; else state.customers.push(bill);
    syncToFirebase();
    if (window.renderAll) window.renderAll();
    previewBill(idx >= 0 ? idx : state.customers.length - 1);
    resetCombinedBillForm(false);
}

export function editCombinedSavedBill(index) {
    const c = state.customers[index];
    if (!c) return;
    if (window.switchTab) window.switchTab('billing', false);
    if (window.openBillingSection) window.openBillingSection('new');
    const custIdxEl = document.getElementById('custIndex');
    if (custIdxEl) custIdxEl.value = index;
    const billNoEl = document.getElementById('billNumberDisplay');
    if (billNoEl) billNoEl.textContent = c.billNo || 'OLD BILL';
    const nameEl = document.getElementById('custName');
    if (nameEl) nameEl.value = c.name || '';
    const phoneEl = document.getElementById('custPhone');
    if (phoneEl) phoneEl.value = c.phone || '';
    const radio = document.querySelector(`input[name="saleType"][value="${c.saleType || 'Retail'}"]`);
    if (radio) radio.checked = true;
    const discountEl = document.getElementById('billDiscountAmt');
    if (discountEl) discountEl.value = (c.discount !== undefined && Number(c.discount) > 0) ? Number(c.discount) : '';
    const paidEl = document.getElementById('billPaidAmt');
    if (paidEl) paidEl.value = Number(c.paidAmount || 0);
    const paymentModeEl = document.getElementById('billPaymentMode');
    if (paymentModeEl) paymentModeEl.value = c.paymentMode || 'Cash';
    state.currentBillItems = sortBillItemsAlphabetically((c.items || []).map(i => ({...i})));
    renderBillPreviewInput();
    calculateBalance();
    const editBadge = document.getElementById('billingEditMode');
    if (editBadge) editBadge.classList.remove('hidden');
    const btn = document.getElementById('custSubmitBtn');
    if (btn) btn.textContent = 'Update Bill & Payment';
    setTimeout(() => {
        document.getElementById('billingStandardContent')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        document.getElementById('billPaidAmt')?.focus();
    }, 100);
}

// Window attachments for inline HTML onclick handlers
if (typeof window !== 'undefined') {
    window.getProductWholesalePrice = getProductWholesalePrice;
    window.getProductRetailPrice = getProductRetailPrice;
    window.findUnifiedProduct = findUnifiedProduct;
    window.updateBillTypeBadge = updateBillTypeBadge;
    window.quickSaveProductRate = quickSaveProductRate;
    window.saveCurrentEnteredRateAsDefault = saveCurrentEnteredRateAsDefault;
    window.updateCurrentBillItemsSaleType = updateCurrentBillItemsSaleType;
    window.updateProductDropdown = updateProductDropdown;
    window.updateBillRateNotice = updateBillRateNotice;
    window.updateBillQuantityTypeDropdown = updateBillQuantityTypeDropdown;
    window.onSaleTypeChange = onSaleTypeChange;
    window.fillProductPrice = fillProductPrice;
    window.onPackVariantSelected = onPackVariantSelected;
    window.onBillQtyOrUnitChange = onBillQtyOrUnitChange;
    window.calculateItemTotal = calculateItemTotal;
    window.stepStdBillUnits = stepStdBillUnits;
    window.stepCombinedBillUnits = stepCombinedBillUnits;
    window.stepCosBillUnits = stepCosBillUnits;
    window.addToBillItems = addToBillItems;
    window.editBillItem = editBillItem;
    window.renderBillPreviewInput = renderBillPreviewInput;
    window.removeBillItem = removeBillItem;
    window.calculateBalance = calculateBalance;
    window.saveCustomer = saveCustomer;
    window.resetCustomerForm = resetCustomerForm;
    window.editCustomerBill = editCustomerBill;
    window.deleteCurrentEditedBill = deleteCurrentEditedBill;
    window.restorePackageStock = restorePackageStock;
    window.checkAndDeductPackageStock = checkAndDeductPackageStock;
    window.getStockProductRecord = getStockProductRecord;
    window.getNextBillNumber = getNextBillNumber;
    window.getNextCosBillNumber = getNextCosBillNumber;
    window.getNextCombinedBillNumber = getNextCombinedBillNumber;
    window.onCosSaleTypeChange = onCosSaleTypeChange;
    window.fillCosSalesStockDetails = fillCosSalesStockDetails;
    window.calculateCosSalesTotal = calculateCosSalesTotal;
    window.addToCosBillItems = addToCosBillItems;
    window.renderCosBillPreviewInput = renderCosBillPreviewInput;
    window.editCosBillItem = editCosBillItem;
    window.calculateCosSalesBalance = calculateCosSalesBalance;
    window.restoreCosSaleStock = restoreCosSaleStock;
    window.deductCosSaleStock = deductCosSaleStock;
    window.saveCosSales = saveCosSales;
    window.renderCosSales = renderCosSales;
    window.resetCosSalesForm = resetCosSalesForm;
    window.renderCosmeticsSummary = renderCosmeticsSummary;
    window.updateCombinedCustomerSelect = updateCombinedCustomerSelect;
    window.fillCombinedCustomer = fillCombinedCustomer;
    window.updateCombinedProductSelect = updateCombinedProductSelect;
    window.getCombinedSelected = getCombinedSelected;
    window.fillCombinedProductPrice = fillCombinedProductPrice;
    window.onCombinedPackVariantSelected = onCombinedPackVariantSelected;
    window.onCombinedSaleTypeChange = onCombinedSaleTypeChange;
    window.calculateCombinedItemTotal = calculateCombinedItemTotal;
    window.combinedStockRecord = combinedStockRecord;
    window.addToCombinedBill = addToCombinedBill;
    window.finishAddCombinedItem = finishAddCombinedItem;
    window.renderCombinedBillItems = renderCombinedBillItems;
    window.removeCombinedBillItem = removeCombinedBillItem;
    window.editCombinedBillItem = editCombinedBillItem;
    window.calculateCombinedBalance = calculateCombinedBalance;
    window.resetCombinedBillForm = resetCombinedBillForm;
    window.saveCombinedBill = saveCombinedBill;
    window.editCombinedSavedBill = editCombinedSavedBill;
}

