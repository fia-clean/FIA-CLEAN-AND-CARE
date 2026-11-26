/**
 * FIA CLEAN & CARE - Product-Wise Sales Analysis Engine
 * Consolidates quantity sold, revenue, and rankings across all customer bills (Cleaning, Cosmetics, Combined).
 * Displays Top Selling, Lowest Sold, Total Units Sold, Revenue, and the complete product sales ranking.
 * Strictly sorted in descending order (Highest sales first -> Lowest sales last).
 */

import { state, normalizeToDateKey, getTodayDateString, isCustItemDeleted, isItemDeleted } from '../core/state.js';
import { pullFromFirebase } from '../core/db.js';
import { normalizeCosSale } from './billing-history.js';
import { getBillingUnitFactor } from './billing.js';

export let productAnalysisPeriod = 'today'; // Defaults to 'today' (can toggle 'this_week', 'this_month', 'all', 'custom')
export let productAnalysisCategory = 'all'; // 'all', 'cleaning', 'cosmetics', 'detergent'
export let productAnalysisSaleType = 'all'; // 'all', 'wholesale', 'retail'
export let productAnalysisSearchQuery = '';
export let productAnalysisStartDate = '';
export let productAnalysisEndDate = '';
export let isDetergentConfigOpen = false;

const DETERGENT_GROUP_STORAGE_KEY = 'fia_pa_detergent_group_config';

function escapeHtml(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

export function normalizeProductNameForMatch(name) {
    return String(name || '')
        .toLowerCase()
        .replace(/[_-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

export function getDetergentGroupConfig() {
    try {
        if (typeof localStorage === 'undefined') return { included: [], excluded: [] };
        const raw = localStorage.getItem(DETERGENT_GROUP_STORAGE_KEY);
        if (!raw) return { included: [], excluded: [] };
        const parsed = JSON.parse(raw);
        return {
            included: Array.isArray(parsed?.included) ? parsed.included.map(normalizeProductNameForMatch).filter(Boolean) : [],
            excluded: Array.isArray(parsed?.excluded) ? parsed.excluded.map(normalizeProductNameForMatch).filter(Boolean) : []
        };
    } catch (e) {
        return { included: [], excluded: [] };
    }
}

export function saveDetergentGroupConfig(config) {
    try {
        if (typeof localStorage === 'undefined') return;
        const clean = {
            included: Array.from(new Set((config?.included || []).map(normalizeProductNameForMatch).filter(Boolean))),
            excluded: Array.from(new Set((config?.excluded || []).map(normalizeProductNameForMatch).filter(Boolean)))
        };
        localStorage.setItem(DETERGENT_GROUP_STORAGE_KEY, JSON.stringify(clean));
    } catch (e) {}
}

/**
 * Default smart matching for Detergent Liquid group:
 * 1. Forex / Forexx Wash Plus
 * 2. Excel Detergent Liquid / Detergent Liquid Excel
 * 3. Fia Green Detergent Liquid
 * 4. Real Comfort / Detergent Liquid Comfort
 * Plus any product explicitly named "Detergent Liquid".
 */
export function isDefaultDetergentLiquidName(name, category = 'Cleaning') {
    const norm = normalizeProductNameForMatch(name);
    if (!norm) return false;
    const isCleaning = String(category || 'Cleaning').toLowerCase() !== 'cosmetics';

    if (/\bdetergent\s*liq/.test(norm)) return true;
    if (/\bwash\s*plus\b/.test(norm) || /\bforexx?\b/.test(norm)) return true;
    if (/\bfia\s*green\b/.test(norm)) return true;
    if (/\breal\s*comfort\b/.test(norm)) return true;
    if (norm.includes('detergent') && norm.includes('comfort')) return true;
    if (isCleaning && (/\bexcel\b/.test(norm) || /\bdtl\b/.test(norm))) return true;

    return false;
}

export function isDetergentLiquidProduct(name, category = 'Cleaning', customConfig = null) {
    const norm = normalizeProductNameForMatch(name);
    if (!norm) return false;
    const cfg = customConfig || getDetergentGroupConfig();
    if (cfg.excluded.includes(norm)) return false;
    if (cfg.included.includes(norm)) return true;
    return isDefaultDetergentLiquidName(name, category);
}

export function formatUnitTotals(items) {
    if (!Array.isArray(items) || items.length === 0) return '0 Ltr';
    const unitMap = {};
    items.forEach(item => {
        const u = String(item.unit || 'Ltr').trim() || 'Ltr';
        unitMap[u] = (unitMap[u] || 0) + (Number(item.qtySold) || 0);
    });
    const entries = Object.entries(unitMap);
    if (entries.length === 0) return '0 Ltr';
    return entries.map(([u, q]) => `${formatQty(q)} ${u}`).join(' + ');
}

export function summarizeDetergentLiquidSales(items) {
    const detergentItems = (items || []).filter(p => p && p.isDetergentLiquid);
    const billSet = new Set();
    let totalQty = 0;
    let totalUnitsSold = 0;
    let totalRevenue = 0;
    let totalRetailQty = 0;
    let totalWholesaleQty = 0;

    detergentItems.forEach(p => {
        totalQty += Number(p.qtySold) || 0;
        totalUnitsSold += Number(p.unitsSold) || 0;
        totalRevenue += Number(p.totalRevenue) || 0;
        totalRetailQty += Number(p.retailQty) || 0;
        totalWholesaleQty += Number(p.wholesaleQty) || 0;
        if (Array.isArray(p.billNosList)) {
            p.billNosList.forEach(b => billSet.add(b));
        } else if (p.billNos instanceof Set) {
            p.billNos.forEach(b => billSet.add(b));
        }
    });

    const primaryUnit = detergentItems[0]?.unit || 'Ltr';

    return {
        products: detergentItems,
        productCount: detergentItems.length,
        totalQty,
        totalUnitsSold,
        totalRevenue,
        totalRetailQty,
        totalWholesaleQty,
        totalBills: billSet.size,
        primaryUnit,
        formattedTotalQty: formatUnitTotals(detergentItems)
    };
}

export function toggleDetergentGroupConfig() {
    isDetergentConfigOpen = !isDetergentConfigOpen;
    renderProductSalesAnalysis();
}

export function toggleDetergentGroupProduct(productName, isChecked) {
    const norm = normalizeProductNameForMatch(productName);
    if (!norm) return;
    const cfg = getDetergentGroupConfig();
    cfg.included = cfg.included.filter(x => x !== norm);
    cfg.excluded = cfg.excluded.filter(x => x !== norm);

    const defaultMatch = isDefaultDetergentLiquidName(productName, 'Cleaning');
    if (isChecked && !defaultMatch) {
        cfg.included.push(norm);
    } else if (!isChecked && defaultMatch) {
        cfg.excluded.push(norm);
    }
    saveDetergentGroupConfig(cfg);
    renderProductSalesAnalysis();
}

export function resetDetergentGroupConfig() {
    saveDetergentGroupConfig({ included: [], excluded: [] });
    renderProductSalesAnalysis();
}

export function setProductAnalysisPeriod(period) {
    productAnalysisPeriod = period;
    const customBox = document.getElementById('paCustomDateRangeBox');
    if (customBox) {
        customBox.classList.toggle('hidden', period !== 'custom');
    }
    updatePeriodButtonStyles();
    renderProductSalesAnalysis();
}

export function setProductAnalysisCategory(cat) {
    productAnalysisCategory = cat;
    updateCategoryButtonStyles();
    renderProductSalesAnalysis();
}

export function setProductAnalysisSaleType(saleType) {
    productAnalysisSaleType = saleType;
    updateSaleTypeButtonStyles();
    renderProductSalesAnalysis();
}

export function onProductAnalysisSearch(val) {
    productAnalysisSearchQuery = (val || '').trim().toLowerCase();
    renderProductSalesAnalysisListOnly();
}

export function onProductAnalysisCustomDateChange() {
    productAnalysisStartDate = document.getElementById('paStartDate')?.value || '';
    productAnalysisEndDate = document.getElementById('paEndDate')?.value || '';
    renderProductSalesAnalysis();
}

function updatePeriodButtonStyles() {
    ['all', 'today', 'this_week', 'this_month', 'custom'].forEach(p => {
        const btn = document.getElementById('paPeriodBtn_' + p);
        if (!btn) return;
        if (p === productAnalysisPeriod) {
            btn.className = 'px-3 py-1.5 rounded-xl bg-amber-600 text-white font-bold text-xs shadow-sm transition';
        } else {
            btn.className = 'px-3 py-1.5 rounded-xl bg-slate-900 text-slate-300 border border-slate-700 font-bold text-xs hover:bg-slate-800 transition';
        }
    });
}

function updateCategoryButtonStyles() {
    ['all', 'cleaning', 'cosmetics', 'detergent'].forEach(c => {
        const btn = document.getElementById('paCatBtn_' + c);
        if (!btn) return;
        if (c === productAnalysisCategory) {
            btn.className = c === 'detergent'
                ? 'px-2.5 py-1 rounded-lg bg-cyan-600 text-white font-bold text-[11px] shadow-sm transition'
                : 'px-2.5 py-1 rounded-lg bg-indigo-600 text-white font-bold text-[11px] shadow-sm transition';
        } else {
            btn.className = c === 'detergent'
                ? 'px-2.5 py-1 rounded-lg bg-slate-900 text-cyan-300 border border-cyan-800/60 font-bold text-[11px] hover:bg-slate-800 transition'
                : 'px-2.5 py-1 rounded-lg bg-slate-900 text-slate-300 border border-slate-700 font-bold text-[11px] hover:bg-slate-800 transition';
        }
    });
}

function updateSaleTypeButtonStyles() {
    ['all', 'retail', 'wholesale'].forEach(s => {
        const btn = document.getElementById('paSaleTypeBtn_' + s);
        if (!btn) return;
        if (s === productAnalysisSaleType) {
            btn.className = 'px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-bold text-[11px] shadow-sm transition';
        } else {
            btn.className = 'px-2.5 py-1 rounded-lg bg-slate-900 text-slate-300 border border-slate-700 font-bold text-[11px] hover:bg-slate-800 transition';
        }
    });
}

/**
 * Filter matching logic for date periods
 */
function isDateInPeriod(dateStr, period, customStart, customEnd) {
    if (!dateStr || period === 'all') return true;
    const cleanDate = normalizeToDateKey(dateStr);
    if (!cleanDate) return true;

    const todayStr = getTodayDateString();
    if (period === 'today') {
        return cleanDate === todayStr;
    }

    const today = new Date();
    if (period === 'this_week') {
        const d = new Date(today);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday start
        d.setDate(diff);
        const mondayStr = normalizeToDateKey(d);
        return cleanDate >= mondayStr && cleanDate <= todayStr;
    }

    if (period === 'this_month') {
        const monthStartStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
        return cleanDate >= monthStartStr && cleanDate <= todayStr;
    }

    if (period === 'custom') {
        if (customStart && cleanDate < customStart) return false;
        if (customEnd && cleanDate > customEnd) return false;
        return true;
    }

    return true;
}

/**
 * Compile Consolidated Product Sales Data
 */
export function getProductSalesAnalysisData(options = {}) {
    const activePeriod = options.period !== undefined ? options.period : productAnalysisPeriod;
    const activeCategory = options.ignoreCategoryFilter ? 'all' : (options.category !== undefined ? options.category : productAnalysisCategory);
    const activeSaleType = options.saleType !== undefined ? options.saleType : productAnalysisSaleType;
    const activeStartDate = options.startDate !== undefined ? options.startDate : productAnalysisStartDate;
    const activeEndDate = options.endDate !== undefined ? options.endDate : productAnalysisEndDate;
    const customersSource = options.customers || state.customers || [];
    const cosSalesSource = options.cosSales || state.cosSales || [];
    const productsSource = options.products || state.products || [];
    const cosProductsSource = options.cosProducts || state.cosProducts || [];

    const productMap = {};

    // Helper to find live stock
    const findStockInfo = (name, category) => {
        const clean = String(name || '').trim().toLowerCase();
        if (category === 'Cosmetics') {
            const prod = cosProductsSource.find(p => p && String(p.name || '').trim().toLowerCase() === clean);
            return {
                stock: prod ? Number(prod.stock || 0) : null,
                unit: prod?.unit || 'Pcs'
            };
        } else {
            const prod = productsSource.find(p => p && String(p.name || '').trim().toLowerCase() === clean);
            return {
                stock: prod ? Number(prod.stock || 0) : null,
                unit: prod?.unit || 'Bottle/Ltr'
            };
        }
    };

    const matchesCategoryFilter = (name, category) => {
        if (activeCategory === 'all') return true;
        if (activeCategory === 'detergent') return isDetergentLiquidProduct(name, category);
        return activeCategory === category.toLowerCase();
    };

    // 1. Process Cleaning & Combined Bills
    customersSource.forEach(c => {
        if (!c || c._deleted || isCustItemDeleted(c)) return;
        if (c.isCancelled || c.status === 'cancelled') return; // Exclude cancelled bills

        const billDate = c.date || c.savedAt;
        if (!isDateInPeriod(billDate, activePeriod, activeStartDate, activeEndDate)) return;

        const billSaleType = String(c.saleType || 'Retail').toLowerCase();
        if (activeSaleType !== 'all' && billSaleType !== activeSaleType) return;

        const items = Array.isArray(c.items)
            ? c.items
            : (c.items && typeof c.items === 'object' ? Object.values(c.items) : []);

        items.forEach(item => {
            if (!item) return;
            const rawName = item.productName || item.name || item.item;
            if (!rawName) return;

            const name = String(rawName).trim();
            const category = (c.billType === 'Combined' && item.combinedCategory === 'Cosmetics') ? 'Cosmetics' : 'Cleaning';

            if (!matchesCategoryFilter(name, category)) return;

            const stockInfo = findStockInfo(name, category);
            const baseUnit = stockInfo.unit || item.unit || item.unitType || (category === 'Cosmetics' ? 'Pcs' : 'Ltr');
            const unitsCount = parseFloat(item.numberOfUnits || item.units || 1) || 1;

            let qty = 0;
            if (typeof item.stockDeductionQty === 'number' && !isNaN(item.stockDeductionQty) && item.stockDeductionQty > 0) {
                qty = item.stockDeductionQty;
            } else {
                const rawQ = parseFloat(item.qty || item.quantity || 0) || 0;
                const factor = getBillingUnitFactor(item.unitType || item.unit || baseUnit, baseUnit);
                qty = rawQ > 0 ? (rawQ * factor * unitsCount) : unitsCount;
            }

            const mapKey = `${category}_${name.toLowerCase()}`;
            const rate = parseFloat(item.rate || item.price || 0) || 0;
            const total = parseFloat(item.total || (qty * rate) || 0) || 0;
            const unit = baseUnit;

            if (!productMap[mapKey]) {
                productMap[mapKey] = {
                    name,
                    category,
                    isDetergentLiquid: isDetergentLiquidProduct(name, category),
                    qtySold: 0,
                    unitsSold: 0,
                    totalRevenue: 0,
                    billCount: 0,
                    billNos: new Set(),
                    unit: unit,
                    currentStock: stockInfo.stock,
                    retailQty: 0,
                    wholesaleQty: 0
                };
            }

            productMap[mapKey].qtySold += qty;
            productMap[mapKey].unitsSold += unitsCount;
            productMap[mapKey].totalRevenue += total;
            const billKey = c.billNo ? `cln_${c.billNo}` : (c.id ? `cln_id_${c.id}` : '');
            if (billKey) productMap[mapKey].billNos.add(billKey);
            if (billSaleType === 'wholesale') {
                productMap[mapKey].wholesaleQty += qty;
            } else {
                productMap[mapKey].retailQty += qty;
            }
        });
    });

    // 2. Process Cosmetics Bills
    cosSalesSource.forEach(s => {
        if (!s || s._deleted || isItemDeleted(s, 'cosSale')) return;
        if (s.isCancelled || s.status === 'cancelled') return; // Exclude cancelled bills

        const norm = normalizeCosSale(s);
        const billDate = norm.date || s.date || s.savedAt;
        if (!isDateInPeriod(billDate, activePeriod, activeStartDate, activeEndDate)) return;

        const billSaleType = String(norm.saleType || s.saleType || 'Retail').toLowerCase();
        if (activeSaleType !== 'all' && billSaleType !== activeSaleType) return;

        const category = 'Cosmetics';
        if (activeCategory !== 'all' && activeCategory !== 'cosmetics' && activeCategory !== 'detergent') return;

        const items = Array.isArray(norm.items) ? norm.items : [];
        items.forEach(item => {
            if (!item) return;
            const rawName = item.productName || item.name || item.item;
            if (!rawName) return;

            const name = String(rawName).trim();
            if (!matchesCategoryFilter(name, category)) return;

            const mapKey = `${category}_${name.toLowerCase()}`;
            const stockInfo = findStockInfo(name, category);
            const baseUnit = stockInfo.unit || item.unit || item.unitType || 'Pcs';
            const unitsCount = parseFloat(item.numberOfUnits || item.units || 1) || 1;

            let qty = 0;
            if (typeof item.stockDeductionQty === 'number' && !isNaN(item.stockDeductionQty) && item.stockDeductionQty > 0) {
                qty = item.stockDeductionQty;
            } else {
                const rawQ = parseFloat(item.qty || item.quantity || 0) || 0;
                const factor = getBillingUnitFactor(item.unitType || item.unit || baseUnit, baseUnit);
                qty = rawQ > 0 ? (rawQ * factor * unitsCount) : unitsCount;
            }

            const rate = parseFloat(item.rate || item.price || 0) || 0;
            const total = parseFloat(item.total || (qty * rate) || 0) || 0;
            const unit = baseUnit;

            if (!productMap[mapKey]) {
                productMap[mapKey] = {
                    name,
                    category,
                    isDetergentLiquid: isDetergentLiquidProduct(name, category),
                    qtySold: 0,
                    unitsSold: 0,
                    totalRevenue: 0,
                    billCount: 0,
                    billNos: new Set(),
                    unit: unit,
                    currentStock: stockInfo.stock,
                    retailQty: 0,
                    wholesaleQty: 0
                };
            }

            productMap[mapKey].qtySold += qty;
            productMap[mapKey].unitsSold += unitsCount;
            productMap[mapKey].totalRevenue += total;
            const billNo = s.billNo || norm.billNo;
            const billKey = billNo ? `cos_${billNo}` : (s.id ? `cos_id_${s.id}` : '');
            if (billKey) productMap[mapKey].billNos.add(billKey);
            if (billSaleType === 'wholesale') {
                productMap[mapKey].wholesaleQty += qty;
            } else {
                productMap[mapKey].retailQty += qty;
            }
        });
    });

    const list = Object.values(productMap).map(p => ({
        ...p,
        billNosList: Array.from(p.billNos),
        billCount: p.billNos.size || 1
    }));

    // CRITICAL: Sort in strictly DESCENDING ORDER (Highest quantity sold at the very top)
    list.sort((a, b) => {
        if (b.qtySold !== a.qtySold) {
            return b.qtySold - a.qtySold;
        }
        return b.totalRevenue - a.totalRevenue;
    });

    return list;
}

function getAllKnownDetergentCandidates() {
    const map = new Map();
    (state.products || []).forEach(p => {
        if (!p || !p.name) return;
        const norm = normalizeProductNameForMatch(p.name);
        if (!map.has(norm)) {
            map.set(norm, { name: String(p.name).trim(), category: 'Cleaning', unit: p.unit || 'Ltr', stock: Number(p.stock || 0) });
        }
    });
    (state.customers || []).forEach(c => {
        if (!c || c._deleted || isCustItemDeleted(c) || c.isCancelled || c.status === 'cancelled') return;
        const items = Array.isArray(c.items) ? c.items : (c.items && typeof c.items === 'object' ? Object.values(c.items) : []);
        items.forEach(item => {
            const rawName = item?.productName || item?.name || item?.item;
            if (!rawName) return;
            const cat = (c.billType === 'Combined' && item.combinedCategory === 'Cosmetics') ? 'Cosmetics' : 'Cleaning';
            if (cat !== 'Cleaning') return;
            const norm = normalizeProductNameForMatch(rawName);
            if (!map.has(norm)) {
                map.set(norm, { name: String(rawName).trim(), category: 'Cleaning', unit: item.unit || 'Ltr', stock: null });
            }
        });
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
}

function renderDetergentConfigPanelHtml() {
    if (!isDetergentConfigOpen) return '';
    const candidates = getAllKnownDetergentCandidates();
    const rowsHtml = candidates.length
        ? candidates.map(c => {
            const checked = isDetergentLiquidProduct(c.name, c.category);
            return `
                <label class="flex items-center justify-between gap-2 p-2 rounded-xl bg-slate-950/80 border ${checked ? 'border-cyan-600/60 bg-cyan-950/20' : 'border-slate-800'} cursor-pointer hover:border-cyan-500/50 transition text-xs">
                    <span class="flex items-center gap-2 min-w-0">
                        <input type="checkbox" data-prod-name="${escapeHtml(c.name)}" ${checked ? 'checked' : ''} onchange="window.toggleDetergentGroupProduct(this.dataset.prodName, this.checked)" class="accent-cyan-500 w-3.5 h-3.5 shrink-0">
                        <span class="font-bold text-slate-200 truncate">${escapeHtml(c.name)}</span>
                    </span>
                    <span class="text-[10px] text-slate-400 shrink-0">${escapeHtml(c.unit || 'Ltr')}</span>
                </label>`;
        }).join('')
        : `<p class="text-[11px] text-slate-400 text-center py-2">No cleaning products found yet.</p>`;

    return `
        <div id="paDetergentConfigBox" class="mt-2.5 pt-2.5 border-t border-cyan-800/40 space-y-2">
            <div class="flex items-center justify-between gap-2 flex-wrap">
                <div>
                    <div class="text-[11px] font-extrabold text-cyan-200">Select Detergent Liquid Products</div>
                    <div class="text-[10px] text-slate-400">Checked items are combined into the Detergent Liquid Total.</div>
                </div>
                <div class="flex items-center gap-1.5">
                    <button type="button" onclick="window.resetDetergentGroupConfig()" class="text-[10px] px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 font-bold transition">↺ Reset Default</button>
                    <button type="button" onclick="window.toggleDetergentGroupConfig()" class="text-[10px] px-2 py-1 rounded-lg bg-cyan-700 hover:bg-cyan-600 text-white font-bold transition">Done</button>
                </div>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-48 overflow-y-auto pr-0.5">
                ${rowsHtml}
            </div>
        </div>`;
}

function renderDetergentSummaryPanel(detergentItems) {
    const container = document.getElementById('paDetergentSummaryContainer');
    if (!container) return;

    if (productAnalysisCategory === 'cosmetics') {
        container.innerHTML = '';
        return;
    }

    const summary = summarizeDetergentLiquidSales(detergentItems);
    const configuredCandidates = getAllKnownDetergentCandidates().filter(c => isDetergentLiquidProduct(c.name, c.category));
    const soldMap = new Map(summary.products.map(p => [normalizeProductNameForMatch(p.name), p]));

    // Include configured detergent types with 0 sales when in 'detergent' mode
    const mergedBreakdown = [...summary.products];
    configuredCandidates.forEach(c => {
        const norm = normalizeProductNameForMatch(c.name);
        if (!soldMap.has(norm)) {
            mergedBreakdown.push({
                name: c.name,
                category: c.category,
                unit: c.unit || 'Ltr',
                qtySold: 0,
                totalRevenue: 0,
                billCount: 0,
                retailQty: 0,
                wholesaleQty: 0,
                isZeroSales: true
            });
        }
    });

    if (summary.products.length === 0 && configuredCandidates.length === 0 && productAnalysisCategory !== 'detergent') {
        container.innerHTML = '';
        return;
    }

    const periodLabel = {
        all: 'All Time',
        today: 'Today',
        this_week: 'This Week',
        this_month: 'This Month',
        custom: 'Custom Range'
    }[productAnalysisPeriod] || 'Selected Period';

    const configHtml = renderDetergentConfigPanelHtml();

    if (productAnalysisCategory === 'detergent') {
        const typeRows = mergedBreakdown.length
            ? mergedBreakdown.map(p => `
                <div class="flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl bg-slate-950/70 border ${p.qtySold > 0 ? 'border-cyan-800/40' : 'border-slate-800/80 opacity-75'} text-xs">
                    <div class="min-w-0">
                        <div class="font-bold text-slate-100 truncate">${escapeHtml(p.name)}</div>
                        <div class="text-[10px] text-slate-400">
                            ${p.qtySold > 0 ? `${p.billCount} bills • Retail ${formatQty(p.retailQty)} / Wholesale ${formatQty(p.wholesaleQty)}` : 'No sales in this period'}
                        </div>
                    </div>
                    <div class="text-right shrink-0">
                        <div class="font-black ${p.qtySold > 0 ? 'text-cyan-300' : 'text-slate-500'}">${formatQty(p.qtySold)} ${escapeHtml(p.unit)}</div>
                        <div class="text-[10px] font-bold ${p.qtySold > 0 ? 'text-emerald-400' : 'text-slate-500'}">₹${Number(p.totalRevenue || 0).toFixed(2)}</div>
                    </div>
                </div>`).join('')
            : `<div class="text-xs text-slate-400 py-2">No Detergent Liquid products matched. Tap "⚙️ Group Products" to select them.</div>`;

        container.innerHTML = `
            <div class="bg-gradient-to-br from-cyan-950/70 via-slate-900 to-slate-950 border border-cyan-500/40 rounded-2xl p-3.5 space-y-3 shadow-md">
                <div class="flex items-start justify-between gap-2 flex-wrap">
                    <div>
                        <div class="flex items-center gap-1.5 flex-wrap">
                            <span class="text-sm">🧴</span>
                            <h3 class="font-black text-cyan-200 text-xs sm:text-sm">Detergent Liquid — Combined Total</h3>
                            <span class="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-bold">${escapeHtml(periodLabel)}</span>
                        </div>
                        <p class="text-[10px] text-slate-400 mt-0.5">All ${mergedBreakdown.length || summary.productCount} Detergent Liquid types counted together</p>
                    </div>
                    <button type="button" onclick="window.toggleDetergentGroupConfig()" class="text-[10px] bg-slate-900 hover:bg-slate-800 text-cyan-300 border border-cyan-700/60 px-2.5 py-1 rounded-lg font-bold transition">⚙️ Group Products</button>
                </div>

                <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div class="bg-slate-950/80 border border-cyan-500/40 rounded-xl p-2.5">
                        <div class="text-[10px] text-cyan-300 font-bold uppercase">Total Detergent Sold</div>
                        <div class="text-base sm:text-lg font-black text-white mt-0.5">${escapeHtml(summary.formattedTotalQty)}</div>
                        <div class="text-[10px] text-slate-400">${summary.productCount} active types</div>
                    </div>
                    <div class="bg-slate-950/80 border border-slate-800 rounded-xl p-2.5">
                        <div class="text-[10px] text-slate-400 font-bold uppercase">Total Revenue</div>
                        <div class="text-base font-black text-emerald-400 mt-0.5">₹${summary.totalRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                        <div class="text-[10px] text-slate-400">In ${summary.totalBills} bills</div>
                    </div>
                    <div class="bg-slate-950/80 border border-slate-800 rounded-xl p-2.5">
                        <div class="text-[10px] text-emerald-400 font-bold uppercase">Retail Total</div>
                        <div class="text-sm font-black text-slate-100 mt-0.5">${formatQty(summary.totalRetailQty)} ${escapeHtml(summary.primaryUnit)}</div>
                        <div class="text-[10px] text-slate-400">Retail sales</div>
                    </div>
                    <div class="bg-slate-950/80 border border-slate-800 rounded-xl p-2.5">
                        <div class="text-[10px] text-sky-400 font-bold uppercase">Wholesale Total</div>
                        <div class="text-sm font-black text-slate-100 mt-0.5">${formatQty(summary.totalWholesaleQty)} ${escapeHtml(summary.primaryUnit)}</div>
                        <div class="text-[10px] text-slate-400">Wholesale sales</div>
                    </div>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    ${typeRows}
                </div>
                ${configHtml}
            </div>`;
        return;
    }

    // Compact summary banner shown in 'all' or 'cleaning' view
    const pillsHtml = mergedBreakdown.map(p => `
        <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-950/90 border border-slate-800 text-[10px]">
            <span class="text-slate-300 font-semibold">${escapeHtml(p.name)}:</span>
            <strong class="${p.qtySold > 0 ? 'text-cyan-300' : 'text-slate-500'}">${formatQty(p.qtySold)} ${escapeHtml(p.unit)}</strong>
        </span>`).join('');

    container.innerHTML = `
        <div class="bg-gradient-to-r from-cyan-950/50 via-slate-900/90 to-slate-900 border border-cyan-700/50 rounded-2xl p-3 space-y-2 shadow-sm">
            <div class="flex items-center justify-between gap-2 flex-wrap">
                <div class="flex items-center gap-2 flex-wrap min-w-0">
                    <span class="text-base">🧴</span>
                    <div>
                        <div class="text-xs font-extrabold text-cyan-200 flex items-center gap-1.5 flex-wrap">
                            <span>Detergent Liquid Combined (${escapeHtml(periodLabel)}):</span>
                            <span class="px-2 py-0.5 rounded-lg bg-cyan-500/20 text-cyan-200 border border-cyan-500/40 font-black">${escapeHtml(summary.formattedTotalQty)}</span>
                            <span class="text-emerald-400 font-black">₹${summary.totalRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                        <div class="text-[10px] text-slate-400">${summary.productCount} of ${mergedBreakdown.length || summary.productCount} types sold • ${summary.totalBills} bills</div>
                    </div>
                </div>
                <div class="flex items-center gap-1.5 shrink-0">
                    <button type="button" onclick="window.setProductAnalysisCategory('detergent')" class="text-[10px] bg-cyan-600 hover:bg-cyan-500 text-white px-2.5 py-1 rounded-lg font-bold shadow-xs transition">View Only Detergent →</button>
                    <button type="button" onclick="window.toggleDetergentGroupConfig()" class="text-[10px] bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 px-2 py-1 rounded-lg font-bold transition" title="Configure Detergent Liquid products">⚙️</button>
                </div>
            </div>
            ${pillsHtml ? `<div class="flex items-center gap-1.5 flex-wrap">${pillsHtml}</div>` : ''}
            ${configHtml}
        </div>`;
}

/**
 * Render Master Product Sales Analysis View
 */
export function renderProductSalesAnalysis() {
    const container = document.getElementById('productAnalysisContainer');
    if (!container) return;

    updatePeriodButtonStyles();
    updateCategoryButtonStyles();
    updateSaleTypeButtonStyles();

    const allData = getProductSalesAnalysisData();

    // Summary calculations across all data before search filtering
    const totalUnits = allData.reduce((sum, p) => sum + p.qtySold, 0);
    const totalRevenue = allData.reduce((sum, p) => sum + p.totalRevenue, 0);
    const topSeller = allData.length > 0 ? allData[0] : null;
    const lowestSeller = allData.length > 1 ? allData[allData.length - 1] : null;
    const detergentData = productAnalysisCategory === 'detergent'
        ? allData
        : getProductSalesAnalysisData({ category: 'detergent' });
    const detergentSummary = summarizeDetergentLiquidSales(detergentData);

    // Update KPI Banner Elements
    const kpiTopName = document.getElementById('paKpiTopName');
    const kpiTopQty = document.getElementById('paKpiTopQty');
    const kpiLowName = document.getElementById('paKpiLowName');
    const kpiLowQty = document.getElementById('paKpiLowQty');
    const kpiTotalUnits = document.getElementById('paKpiTotalUnits');
    const kpiTotalRev = document.getElementById('paKpiTotalRevenue');
    const kpiCount = document.getElementById('paKpiProductCount');

    if (kpiTopName) kpiTopName.textContent = topSeller ? topSeller.name : '—';
    if (kpiTopQty) kpiTopQty.textContent = topSeller ? `${formatQty(topSeller.qtySold)} ${topSeller.unit}` : '0 Qty';
    if (kpiLowName) kpiLowName.textContent = lowestSeller ? lowestSeller.name : (allData.length === 1 ? 'Only 1 item' : '—');
    if (kpiLowQty) kpiLowQty.textContent = lowestSeller ? `${formatQty(lowestSeller.qtySold)} ${lowestSeller.unit}` : '—';
    if (kpiTotalUnits) {
        kpiTotalUnits.textContent = productAnalysisCategory === 'detergent'
            ? detergentSummary.formattedTotalQty
            : formatQty(totalUnits);
    }
    if (kpiTotalRev) kpiTotalRev.textContent = '₹' + totalRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (kpiCount) {
        kpiCount.textContent = productAnalysisCategory === 'detergent'
            ? `${allData.length} Types • ${detergentSummary.totalBills} Bills`
            : `${allData.length} Products`;
    }

    const countBadge = document.getElementById('paFolderCountBadge');
    if (countBadge) countBadge.textContent = allData.length + ' Products';

    renderDetergentSummaryPanel(detergentData);
    renderProductSalesAnalysisListOnly(allData);
}

/**
 * Renders the product cards list (fast live typing search)
 */
export function renderProductSalesAnalysisListOnly(providedData = null) {
    const container = document.getElementById('productAnalysisContainer');
    if (!container) return;

    const data = providedData || getProductSalesAnalysisData();
    let displayList = data;

    if (productAnalysisSearchQuery) {
        displayList = data.filter(p =>
            p.name.toLowerCase().includes(productAnalysisSearchQuery) ||
            p.category.toLowerCase().includes(productAnalysisSearchQuery) ||
            (p.isDetergentLiquid && ('detergent liquid'.includes(productAnalysisSearchQuery) || 'dtl'.includes(productAnalysisSearchQuery)))
        );
    }

    const countBadge = document.getElementById('paFolderCountBadge');
    if (countBadge) {
        countBadge.textContent = productAnalysisSearchQuery 
            ? `${displayList.length} of ${data.length} Products` 
            : `${data.length} Products`;
    }

    if (!displayList.length) {
        container.innerHTML = `
            <div class="text-center py-8 bg-slate-900/40 rounded-2xl border border-slate-800 p-6 space-y-3">
                <span class="text-3xl">📦</span>
                <p class="text-slate-400 font-bold text-xs">No product sales found for this period and filter selection.</p>
                <button type="button" onclick="window.setProductAnalysisPeriod('all'); window.setProductAnalysisCategory('all'); window.setProductAnalysisSaleType('all');" class="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl text-xs font-bold transition">
                    Show All Sales Records
                </button>
            </div>`;
        return;
    }

    let searchTotalBanner = '';
    if (productAnalysisSearchQuery && displayList.length > 0) {
        const filteredRev = displayList.reduce((sum, p) => sum + p.totalRevenue, 0);
        searchTotalBanner = `
            <div class="bg-amber-950/30 border border-amber-500/40 rounded-xl px-3 py-2 flex items-center justify-between gap-2 flex-wrap text-xs">
                <span class="text-amber-200 font-bold">Filtered Total (${displayList.length} items): <strong class="text-white">${escapeHtml(formatUnitTotals(displayList))}</strong></span>
                <span class="text-emerald-400 font-black">₹${filteredRev.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>`;
    }

    container.innerHTML = searchTotalBanner + displayList.map((p, index) => {
        const rank = index + 1;
        let rankBadge = '';
        if (rank === 1) {
            rankBadge = `<span class="w-7 h-7 rounded-xl bg-amber-500 text-slate-950 font-black text-xs flex items-center justify-center shadow-md shadow-amber-500/20" title="Rank #1 Top Seller">🥇 1</span>`;
        } else if (rank === 2) {
            rankBadge = `<span class="w-7 h-7 rounded-xl bg-slate-300 text-slate-950 font-black text-xs flex items-center justify-center shadow-md shadow-slate-300/20" title="Rank #2 Seller">🥈 2</span>`;
        } else if (rank === 3) {
            rankBadge = `<span class="w-7 h-7 rounded-xl bg-amber-700 text-white font-black text-xs flex items-center justify-center shadow-md" title="Rank #3 Seller">🥉 3</span>`;
        } else {
            rankBadge = `<span class="w-7 h-7 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs flex items-center justify-center border border-slate-700">#${rank}</span>`;
        }

        const catBadge = p.category === 'Cleaning'
            ? `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-800/60">🧹 Cleaning</span>`
            : `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-pink-950/80 text-pink-300 border border-pink-800/60">💄 Cosmetics</span>`;

        const detergentBadge = p.isDetergentLiquid
            ? `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-950/80 text-cyan-300 border border-cyan-700/60">🧴 Detergent Liquid</span>`
            : '';

        let stockInfoHtml = '';
        if (p.currentStock !== null) {
            const isLow = p.currentStock <= 5;
            stockInfoHtml = `<span class="text-[11px] font-semibold ${isLow ? 'text-rose-400 font-bold' : 'text-slate-400'}">
                Stock: <strong class="${isLow ? 'text-rose-300' : 'text-slate-200'}">${formatQty(p.currentStock)} ${escapeHtml(p.unit)}</strong> ${isLow ? '⚠️ Low' : '✓ In Stock'}
            </span>`;
        }

        const unitsSoldNote = (p.unitsSold > 0 && p.unit !== 'Pcs' && p.unitsSold !== p.qtySold)
            ? `<div class="text-[10px] text-slate-400 font-medium">(${p.unitsSold} units/bottles)</div>`
            : '';

        return `
            <div class="bg-slate-900/80 hover:bg-slate-900 border border-slate-800 p-3.5 rounded-2xl transition space-y-2.5 shadow-sm">
                <div class="flex items-start justify-between gap-3">
                    <div class="flex items-start gap-2.5 min-w-0">
                        <div class="shrink-0 pt-0.5">${rankBadge}</div>
                        <div class="min-w-0">
                            <div class="flex items-center gap-1.5 flex-wrap">
                                <h3 class="font-extrabold text-slate-100 text-sm leading-snug break-words">${escapeHtml(p.name)}</h3>
                                ${catBadge}
                                ${detergentBadge}
                            </div>
                            <div class="flex items-center gap-3 text-slate-400 text-xs mt-1 flex-wrap">
                                <span>In <strong>${p.billCount}</strong> bills</span>
                                ${stockInfoHtml ? `<span>• ${stockInfoHtml}</span>` : ''}
                            </div>
                        </div>
                    </div>
                    <div class="text-right shrink-0">
                        <div class="text-base sm:text-lg font-black text-amber-300">${formatQty(p.qtySold)} <span class="text-xs font-semibold text-slate-400">${escapeHtml(p.unit)}</span></div>
                        ${unitsSoldNote}
                        <div class="text-xs font-bold text-emerald-400 mt-0.5">₹${p.totalRevenue.toFixed(2)}</div>
                    </div>
                </div>

                <!-- Breakdown Bar (Retail vs Wholesale) -->
                <div class="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                    <div class="flex items-center gap-2">
                        <span class="inline-flex items-center gap-1"><span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> Retail: <strong class="text-slate-300">${formatQty(p.retailQty)}</strong></span>
                        <span class="inline-flex items-center gap-1"><span class="w-1.5 h-1.5 rounded-full bg-sky-400"></span> Wholesale: <strong class="text-slate-300">${formatQty(p.wholesaleQty)}</strong></span>
                    </div>
                    <div class="text-[10px] text-slate-500 font-medium">Avg Rate: ₹${p.qtySold > 0 ? (p.totalRevenue / p.qtySold).toFixed(2) : '0.00'}</div>
                </div>
            </div>
        `;
    }).join('');
}

function formatQty(num) {
    if (num === null || num === undefined || isNaN(num)) return '0';
    const n = Number(num);
    return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

/**
 * Share Product-wise Analysis Summary via WhatsApp
 */
export function shareProductAnalysisWhatsApp() {
    const data = getProductSalesAnalysisData();
    if (!data.length) {
        alert('No product sales data found to share.');
        return;
    }

    const periodName = {
        all: 'All Time',
        today: 'Today',
        this_week: 'This Week',
        this_month: 'This Month',
        custom: 'Custom Range'
    }[productAnalysisPeriod] || productAnalysisPeriod;

    const categoryName = productAnalysisCategory === 'detergent'
        ? 'DETERGENT LIQUID (ALL TYPES)'
        : productAnalysisCategory.toUpperCase();

    const totalQty = data.reduce((sum, p) => sum + p.qtySold, 0);
    const totalRev = data.reduce((sum, p) => sum + p.totalRevenue, 0);
    const lines = [
        `📊 *FIA CLEAN & CARE - Product-Wise Sales Report*`,
        `📅 Period: *${periodName}*`,
        `🏷️ Category: *${categoryName}* | Type: *${productAnalysisSaleType.toUpperCase()}*`,
        `----------------------------------------`
    ];

    data.slice(0, 25).forEach((p, idx) => {
        const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}.`;
        lines.push(`${medal} *${p.name}* (${p.category})`);
        lines.push(`   └ Qty: *${formatQty(p.qtySold)} ${p.unit}* | Sales: *₹${p.totalRevenue.toFixed(2)}*`);
    });

    if (data.length > 25) {
        lines.push(`...and ${data.length - 25} more products`);
    }

    lines.push(`----------------------------------------`);
    lines.push(`📦 *Total Sold:* ${productAnalysisCategory === 'detergent' ? formatUnitTotals(data) : formatQty(totalQty)}`);
    lines.push(`💰 *Total Product Sales:* ₹${totalRev.toFixed(2)}`);
    lines.push(`✨ Generated by FIA CLEAN & CARE App`);

    const text = encodeURIComponent(lines.join('\n'));
    window.open(`https://wa.me/?text=${text}`, '_blank');
}

/**
 * Refresh Analysis data from Cloud
 */
export function refreshProductAnalysisFromCloud() {
    const btn = document.getElementById('paCloudRefreshBtn');
    if (btn) { btn.disabled = true; btn.innerHTML = '⟳ Syncing...'; }
    pullFromFirebase().then(() => {
        renderProductSalesAnalysis();
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '✓ Synced';
            setTimeout(() => { btn.innerHTML = '↻ Sync'; }, 1500);
        }
    }).catch(() => {
        renderProductSalesAnalysis();
        if (btn) { btn.disabled = false; btn.innerHTML = '↻ Sync'; }
    });
}

// Global window attachments
if (typeof window !== 'undefined') {
    window.setProductAnalysisPeriod = setProductAnalysisPeriod;
    window.setProductAnalysisCategory = setProductAnalysisCategory;
    window.setProductAnalysisSaleType = setProductAnalysisSaleType;
    window.onProductAnalysisSearch = onProductAnalysisSearch;
    window.onProductAnalysisCustomDateChange = onProductAnalysisCustomDateChange;
    window.renderProductSalesAnalysis = renderProductSalesAnalysis;
    window.renderProductSalesAnalysisListOnly = renderProductSalesAnalysisListOnly;
    window.shareProductAnalysisWhatsApp = shareProductAnalysisWhatsApp;
    window.refreshProductAnalysisFromCloud = refreshProductAnalysisFromCloud;
    window.toggleDetergentGroupConfig = toggleDetergentGroupConfig;
    window.toggleDetergentGroupProduct = toggleDetergentGroupProduct;
    window.resetDetergentGroupConfig = resetDetergentGroupConfig;
}
