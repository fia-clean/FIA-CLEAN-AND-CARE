/**
 * FIA CLEAN & CARE - Product-Wise Sales Analysis & Item List Engine
 * Consolidates quantity sold, revenue, stock levels & rankings across all customer bills (Cleaning, Cosmetics, Combined).
 * Provides both Summary Overview (Top/Lowest sold, Total Units, Revenue) and complete Item-Wise List of all products.
 */

import { state, normalizeToDateKey, getTodayDateString, isCustItemDeleted, isItemDeleted } from '../core/state.js';
import { pullFromFirebase } from '../core/db.js';
import { normalizeCosSale } from './billing-history.js';
import { getBillingUnitFactor } from './billing.js';

export let productAnalysisPeriod = 'today'; // 'today', 'this_week', 'this_month', 'all', 'custom'
export let productAnalysisCategory = 'all'; // 'all', 'cleaning', 'cosmetics'
export let productAnalysisSaleType = 'all'; // 'all', 'wholesale', 'retail'
export let productAnalysisSearchQuery = '';
export let productAnalysisStartDate = '';
export let productAnalysisEndDate = '';
export let productAnalysisSubTab = 'overview'; // 'overview' or 'itemwise'
export let productAnalysisStatusFilter = 'all'; // 'all', 'sold', 'unsold'
export let productAnalysisSortBy = 'highest_sold'; // 'highest_sold', 'lowest_sold', 'name_asc', 'highest_rev'

/**
 * Switch between Overview & Item-Wise List sub-tabs in Analysis
 */
export function switchProductAnalysisTab(subTab) {
    productAnalysisSubTab = subTab || 'overview';
    const overviewSec = document.getElementById('paOverviewSection');
    const itemWiseSec = document.getElementById('paItemWiseSection');
    const tabOverviewBtn = document.getElementById('btnPaSubTabOverview');
    const tabItemWiseBtn = document.getElementById('btnPaSubTabItemWise');
    const btnBillingAnalysis = document.getElementById('btnBillingAnalysis');
    const btnBillingItemWise = document.getElementById('btnBillingItemWise');

    if (productAnalysisSubTab === 'itemwise') {
        if (overviewSec) overviewSec.classList.add('hidden');
        if (itemWiseSec) itemWiseSec.classList.remove('hidden');

        if (tabOverviewBtn) {
            tabOverviewBtn.className = 'py-2 px-3 rounded-lg bg-slate-800 text-slate-300 hover:text-white font-bold text-xs flex items-center justify-center gap-1.5 transition';
        }
        if (tabItemWiseBtn) {
            tabItemWiseBtn.className = 'py-2 px-3 rounded-lg bg-cyan-600 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition shadow-sm';
        }
        if (btnBillingAnalysis) {
            btnBillingAnalysis.className = 'py-3 rounded-xl bg-slate-800 text-amber-300 border border-amber-800/50 text-xs font-bold flex items-center justify-center gap-1.5 transition';
        }
        if (btnBillingItemWise) {
            btnBillingItemWise.className = 'py-3 rounded-xl bg-cyan-600 text-white text-xs font-bold shadow-md flex items-center justify-center gap-1.5 transition';
        }

        renderProductSalesAnalysis();
        setTimeout(() => {
            const input = document.getElementById('paItemWiseSearchInput');
            if (input) input.focus();
        }, 60);
    } else {
        if (overviewSec) overviewSec.classList.remove('hidden');
        if (itemWiseSec) itemWiseSec.classList.add('hidden');

        if (tabOverviewBtn) {
            tabOverviewBtn.className = 'py-2 px-3 rounded-lg bg-amber-600 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition shadow-sm';
        }
        if (tabItemWiseBtn) {
            tabItemWiseBtn.className = 'py-2 px-3 rounded-lg bg-slate-800 text-slate-300 hover:text-white font-bold text-xs flex items-center justify-center gap-1.5 transition';
        }
        if (btnBillingAnalysis) {
            btnBillingAnalysis.className = 'py-3 rounded-xl bg-amber-600 text-white text-xs font-bold shadow-md flex items-center justify-center gap-1.5 transition';
        }
        if (btnBillingItemWise) {
            btnBillingItemWise.className = 'py-3 rounded-xl bg-slate-800 text-cyan-300 border border-cyan-800/50 text-xs font-bold flex items-center justify-center gap-1.5 transition';
        }

        renderProductSalesAnalysis();
    }
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

export function setProductAnalysisStatusFilter(status) {
    productAnalysisStatusFilter = status || 'all';
    updateStatusFilterButtonStyles();
    renderProductSalesAnalysisListOnly();
}

export function setProductAnalysisSortBy(sortKey) {
    productAnalysisSortBy = sortKey || 'highest_sold';
    updateSortButtonStyles();
    renderProductSalesAnalysis();
}

export function onProductAnalysisSearch(val) {
    productAnalysisSearchQuery = (val || '').trim().toLowerCase();
    // Keep both search inputs in sync if both exist
    const inputMain = document.getElementById('paItemWiseSearchInput');
    const inputFolder = document.getElementById('paSearchInput');
    if (inputMain && inputMain.value !== val) inputMain.value = val;
    if (inputFolder && inputFolder.value !== val) inputFolder.value = val;
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
    ['all', 'cleaning', 'cosmetics'].forEach(c => {
        const btn = document.getElementById('paCatBtn_' + c);
        if (!btn) return;
        if (c === productAnalysisCategory) {
            btn.className = 'px-2.5 py-1 rounded-lg bg-indigo-600 text-white font-bold text-[11px] shadow-sm transition';
        } else {
            btn.className = 'px-2.5 py-1 rounded-lg bg-slate-900 text-slate-300 border border-slate-700 font-bold text-[11px] hover:bg-slate-800 transition';
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

function updateStatusFilterButtonStyles() {
    ['all', 'sold', 'unsold'].forEach(st => {
        const btn = document.getElementById('paStatusBtn_' + st);
        if (!btn) return;
        if (st === productAnalysisStatusFilter) {
            btn.className = 'px-2.5 py-1 rounded-lg bg-cyan-600 text-white font-bold text-[10px] shadow-sm transition';
        } else {
            btn.className = 'px-2.5 py-1 rounded-lg bg-slate-900 text-slate-300 border border-slate-700 font-bold text-[10px] hover:bg-slate-800 transition';
        }
    });
}

function updateSortButtonStyles() {
    const sel = document.getElementById('paSortSelect');
    if (sel && sel.value !== productAnalysisSortBy) {
        sel.value = productAnalysisSortBy;
    }
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
 * Includes all active products from inventory as well as billed custom products.
 */
export function getProductSalesAnalysisData(includeAllProducts = true) {
    const productMap = {};

    // Helper to find live stock
    const findStockInfo = (name, category) => {
        const clean = String(name || '').trim().toLowerCase();
        if (category === 'Cosmetics') {
            const prod = (state.cosProducts || []).find(p => p && !isItemDeleted(p, 'cosProduct') && String(p.name || '').trim().toLowerCase() === clean);
            return {
                stock: (prod && prod.stock !== undefined && prod.stock !== null && !isNaN(prod.stock)) ? Number(prod.stock) : null,
                unit: prod?.unit || 'Pcs'
            };
        } else {
            const prod = (state.products || []).find(p => p && !isItemDeleted(p, 'product') && String(p.name || '').trim().toLowerCase() === clean);
            return {
                stock: (prod && prod.stock !== undefined && prod.stock !== null && !isNaN(prod.stock)) ? Number(prod.stock) : null,
                unit: prod?.unit || 'Bottle/Ltr'
            };
        }
    };

    // 1. Prepopulate master products from inventory so every product is tracked
    if (includeAllProducts) {
        // Cleaning inventory
        if (productAnalysisCategory === 'all' || productAnalysisCategory === 'cleaning') {
            (state.products || []).forEach(p => {
                if (!p || isItemDeleted(p, 'product')) return;
                const name = String(p.name || '').trim();
                if (!name) return;
                const mapKey = `Cleaning_${name.toLowerCase()}`;
                if (!productMap[mapKey]) {
                    productMap[mapKey] = {
                        name,
                        category: 'Cleaning',
                        qtySold: 0,
                        unitsSold: 0,
                        totalRevenue: 0,
                        billCount: 0,
                        billNos: new Set(),
                        unit: p.unit || 'Bottle/Ltr',
                        currentStock: (p.stock !== undefined && p.stock !== null && !isNaN(p.stock)) ? Number(p.stock) : null,
                        retailQty: 0,
                        wholesaleQty: 0
                    };
                }
            });
        }

        // Cosmetics inventory
        if (productAnalysisCategory === 'all' || productAnalysisCategory === 'cosmetics') {
            (state.cosProducts || []).forEach(p => {
                if (!p || isItemDeleted(p, 'cosProduct')) return;
                const name = String(p.name || '').trim();
                if (!name) return;
                const mapKey = `Cosmetics_${name.toLowerCase()}`;
                if (!productMap[mapKey]) {
                    productMap[mapKey] = {
                        name,
                        category: 'Cosmetics',
                        qtySold: 0,
                        unitsSold: 0,
                        totalRevenue: 0,
                        billCount: 0,
                        billNos: new Set(),
                        unit: p.unit || 'Pcs',
                        currentStock: (p.stock !== undefined && p.stock !== null && !isNaN(p.stock)) ? Number(p.stock) : null,
                        retailQty: 0,
                        wholesaleQty: 0
                    };
                }
            });
        }
    }

    // 2. Process Cleaning & Combined Customer Bills
    (state.customers || []).forEach(c => {
        if (!c || c._deleted || isCustItemDeleted(c)) return;
        if (c.isCancelled || c.status === 'cancelled') return; // Exclude cancelled bills

        const billDate = c.date || c.savedAt;
        if (!isDateInPeriod(billDate, productAnalysisPeriod, productAnalysisStartDate, productAnalysisEndDate)) return;

        const billSaleType = String(c.saleType || 'Retail').toLowerCase();
        if (productAnalysisSaleType !== 'all' && billSaleType !== productAnalysisSaleType) return;

        const items = Array.isArray(c.items) 
            ? c.items 
            : (c.items && typeof c.items === 'object' ? Object.values(c.items) : []);

        items.forEach(item => {
            if (!item) return;
            const rawName = item.productName || item.name || item.item;
            if (!rawName) return;

            const name = String(rawName).trim();
            const category = (c.billType === 'Combined' && item.combinedCategory === 'Cosmetics') ? 'Cosmetics' : 'Cleaning';

            if (productAnalysisCategory !== 'all' && productAnalysisCategory !== category.toLowerCase()) return;

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
            if (c.billNo) productMap[mapKey].billNos.add(String(c.billNo));
            if (billSaleType === 'wholesale') {
                productMap[mapKey].wholesaleQty += qty;
            } else {
                productMap[mapKey].retailQty += qty;
            }
        });
    });

    // 3. Process Cosmetics Bills
    (state.cosSales || []).forEach(s => {
        if (!s || s._deleted || isItemDeleted(s, 'cosSale')) return;
        if (s.isCancelled || s.status === 'cancelled') return; // Exclude cancelled bills

        const norm = normalizeCosSale(s);
        const billDate = norm.date || s.date || s.savedAt;
        if (!isDateInPeriod(billDate, productAnalysisPeriod, productAnalysisStartDate, productAnalysisEndDate)) return;

        const billSaleType = String(norm.saleType || s.saleType || 'Retail').toLowerCase();
        if (productAnalysisSaleType !== 'all' && billSaleType !== productAnalysisSaleType) return;

        const category = 'Cosmetics';
        if (productAnalysisCategory !== 'all' && productAnalysisCategory !== 'cosmetics') return;

        const items = Array.isArray(norm.items) ? norm.items : [];
        items.forEach(item => {
            if (!item) return;
            const rawName = item.productName || item.name || item.item;
            if (!rawName) return;

            const name = String(rawName).trim();
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
            if (billNo) productMap[mapKey].billNos.add(String(billNo));
            if (billSaleType === 'wholesale') {
                productMap[mapKey].wholesaleQty += qty;
            } else {
                productMap[mapKey].retailQty += qty;
            }
        });
    });

    const list = Object.values(productMap).map(p => ({
        ...p,
        billCount: p.billNos.size || (p.qtySold > 0 ? 1 : 0)
    }));

    // Sorting according to selected order
    list.sort((a, b) => {
        if (productAnalysisSortBy === 'name_asc') {
            return a.name.localeCompare(b.name);
        }
        if (productAnalysisSortBy === 'lowest_sold') {
            if (a.qtySold !== b.qtySold) return a.qtySold - b.qtySold;
            return a.totalRevenue - b.totalRevenue;
        }
        if (productAnalysisSortBy === 'highest_rev') {
            if (b.totalRevenue !== a.totalRevenue) return b.totalRevenue - a.totalRevenue;
            return b.qtySold - a.qtySold;
        }
        // Default: 'highest_sold' (Highest quantity sold at the very top)
        if (b.qtySold !== a.qtySold) {
            return b.qtySold - a.qtySold;
        }
        return b.totalRevenue - a.totalRevenue;
    });

    return list;
}

/**
 * Render Master Product Sales Analysis & Item-Wise View
 */
export function renderProductSalesAnalysis() {
    updatePeriodButtonStyles();
    updateCategoryButtonStyles();
    updateSaleTypeButtonStyles();
    updateStatusFilterButtonStyles();
    updateSortButtonStyles();

    const allData = getProductSalesAnalysisData(true);

    // Summary calculations across all data before search filtering
    const totalUnits = allData.reduce((sum, p) => sum + p.qtySold, 0);
    const totalRevenue = allData.reduce((sum, p) => sum + p.totalRevenue, 0);

    const soldItems = allData.filter(p => p.qtySold > 0);
    const unsoldItems = allData.filter(p => p.qtySold === 0);

    // Identify top and lowest seller among products with sales
    const sortedSold = [...soldItems].sort((a, b) => {
        if (b.qtySold !== a.qtySold) return b.qtySold - a.qtySold;
        return b.totalRevenue - a.totalRevenue;
    });

    const topSeller = sortedSold.length > 0 ? sortedSold[0] : null;
    const lowestSeller = sortedSold.length > 1 ? sortedSold[sortedSold.length - 1] : (sortedSold.length === 1 ? sortedSold[0] : null);

    // 1. Update Overview KPI Elements
    const kpiTopName = document.getElementById('paKpiTopName');
    const kpiTopQty = document.getElementById('paKpiTopQty');
    const kpiLowName = document.getElementById('paKpiLowName');
    const kpiLowQty = document.getElementById('paKpiLowQty');
    const kpiTotalUnits = document.getElementById('paKpiTotalUnits');
    const kpiTotalRev = document.getElementById('paKpiTotalRevenue');
    const kpiCount = document.getElementById('paKpiProductCount');

    if (kpiTopName) kpiTopName.textContent = topSeller ? topSeller.name : '—';
    if (kpiTopQty) kpiTopQty.textContent = topSeller ? `${formatQty(topSeller.qtySold)} ${topSeller.unit}` : '0 Qty';
    if (kpiLowName) kpiLowName.textContent = lowestSeller ? lowestSeller.name : '—';
    if (kpiLowQty) kpiLowQty.textContent = lowestSeller ? `${formatQty(lowestSeller.qtySold)} ${lowestSeller.unit}` : '—';
    if (kpiTotalUnits) kpiTotalUnits.textContent = formatQty(totalUnits);
    if (kpiTotalRev) kpiTotalRev.textContent = '₹' + totalRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (kpiCount) kpiCount.textContent = `${soldItems.length} of ${allData.length} Sold`;

    // 2. Update Subtab Badge & Item-wise KPI Strip Elements
    const badge = document.getElementById('paItemWiseCountBadge');
    if (badge) badge.textContent = `${allData.length} Items`;

    const iwTotalProds = document.getElementById('paIwTotalProducts');
    const iwSoldProds = document.getElementById('paIwSoldProducts');
    const iwUnsoldProds = document.getElementById('paIwUnsoldProducts');
    const iwTotalUnits = document.getElementById('paIwTotalUnits');

    if (iwTotalProds) iwTotalProds.textContent = String(allData.length);
    if (iwSoldProds) iwSoldProds.textContent = String(soldItems.length);
    if (iwUnsoldProds) iwUnsoldProds.textContent = String(unsoldItems.length);
    if (iwTotalUnits) iwTotalUnits.textContent = formatQty(totalUnits);

    const btnStatusAll = document.getElementById('paStatusBtn_all');
    if (btnStatusAll) btnStatusAll.textContent = `All (${allData.length})`;
    const btnStatusSold = document.getElementById('paStatusBtn_sold');
    if (btnStatusSold) btnStatusSold.textContent = `✓ Sold (${soldItems.length})`;
    const btnStatusUnsold = document.getElementById('paStatusBtn_unsold');
    if (btnStatusUnsold) btnStatusUnsold.textContent = `0 Sold (${unsoldItems.length})`;

    const folderBadge = document.getElementById('paFolderCountBadge');
    if (folderBadge) folderBadge.textContent = `${soldItems.length} Products Sold`;

    renderProductSalesAnalysisListOnly(allData);
}

/**
 * Toggle Collapsible Product Analysis Folder Card (Overview tab)
 */
export function toggleProductAnalysisFolder(forceState) {
    const content = document.getElementById('productAnalysisFolderContent');
    const toggleBtn = document.getElementById('paFolderToggleBtn');
    const btnIcon = document.getElementById('paFolderBtnIcon');
    const btnText = document.getElementById('paFolderBtnText');
    const statusText = document.getElementById('paFolderStatusText');
    if (!content) return;

    const isCurrentlyHidden = content.classList.contains('hidden');
    const willOpen = (typeof forceState === 'boolean') ? forceState : isCurrentlyHidden;

    if (willOpen) {
        content.classList.remove('hidden');
        if (btnIcon) btnIcon.textContent = '📁';
        if (btnText) btnText.textContent = 'Close';
        if (statusText) statusText.textContent = 'Showing product breakdown • Tap to fold';
        if (toggleBtn) {
            toggleBtn.className = 'bg-slate-800 hover:bg-slate-700 text-slate-200 px-2.5 py-1.5 rounded-xl border border-slate-700 text-xs font-bold transition flex items-center gap-1 cursor-pointer whitespace-nowrap';
        }
        setTimeout(() => {
            document.getElementById('paSearchInput')?.focus();
        }, 80);
    } else {
        content.classList.add('hidden');
        if (btnIcon) btnIcon.textContent = '👁️';
        if (btnText) btnText.textContent = 'View';
        if (statusText) statusText.textContent = 'Tap to view / hide detailed product ranking list';
        if (toggleBtn) {
            toggleBtn.className = 'bg-amber-600 hover:bg-amber-500 text-white px-2.5 py-1.5 rounded-xl border border-amber-500 text-xs font-bold shadow-md transition flex items-center gap-1 cursor-pointer whitespace-nowrap';
        }
    }
}

/**
 * Builds HTML for an individual product sales card
 */
function buildProductCardHtml(p, index) {
    const isSold = p.qtySold > 0;
    const rank = index + 1;
    let rankBadge = '';

    if (isSold) {
        if (rank === 1 && productAnalysisSortBy === 'highest_sold') {
            rankBadge = `<span class="w-7 h-7 rounded-xl bg-amber-500 text-slate-950 font-black text-xs flex items-center justify-center shadow-md shadow-amber-500/20" title="Rank #1 Top Seller">🥇 1</span>`;
        } else if (rank === 2 && productAnalysisSortBy === 'highest_sold') {
            rankBadge = `<span class="w-7 h-7 rounded-xl bg-slate-300 text-slate-950 font-black text-xs flex items-center justify-center shadow-md shadow-slate-300/20" title="Rank #2 Seller">🥈 2</span>`;
        } else if (rank === 3 && productAnalysisSortBy === 'highest_sold') {
            rankBadge = `<span class="w-7 h-7 rounded-xl bg-amber-700 text-white font-black text-xs flex items-center justify-center shadow-md" title="Rank #3 Seller">🥉 3</span>`;
        } else {
            rankBadge = `<span class="w-7 h-7 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs flex items-center justify-center border border-slate-700">#${rank}</span>`;
        }
    } else {
        rankBadge = `<span class="w-7 h-7 rounded-xl bg-slate-900 text-slate-500 font-bold text-xs flex items-center justify-center border border-slate-800">#${rank}</span>`;
    }

    const catBadge = p.category === 'Cleaning'
        ? `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-800/60">🧹 Cleaning</span>`
        : `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-pink-950/80 text-pink-300 border border-pink-800/60">💄 Cosmetics</span>`;

    const soldStatusBadge = isSold
        ? `<span class="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-950/80 text-emerald-400 border border-emerald-800/60">✓ Sold</span>`
        : `<span class="px-2 py-0.5 rounded-full text-[9px] font-bold bg-slate-800 text-slate-400 border border-slate-700">0 Sold</span>`;

    let stockInfoHtml = '';
    if (p.currentStock !== null) {
        const isLow = p.currentStock <= 5;
        stockInfoHtml = `<span class="text-[11px] font-semibold ${isLow ? 'text-rose-400 font-bold' : 'text-slate-400'}">
            Stock: <strong class="${isLow ? 'text-rose-300' : 'text-slate-200'}">${formatQty(p.currentStock)} ${p.unit}</strong> ${isLow ? '⚠️ Low' : '✓ In Stock'}
        </span>`;
    }

    const unitsSoldNote = (p.unitsSold > 0 && p.unit !== 'Pcs' && p.unitsSold !== p.qtySold)
        ? `<div class="text-[10px] text-slate-400 font-medium">(${p.unitsSold} units/bottles)</div>`
        : '';

    return `
        <div class="bg-slate-900/80 hover:bg-slate-900 border ${isSold ? 'border-slate-800' : 'border-slate-800/60 opacity-90'} p-3.5 rounded-2xl transition space-y-2.5 shadow-sm">
            <div class="flex items-start justify-between gap-3">
                <div class="flex items-start gap-2.5 min-w-0">
                    <div class="shrink-0 pt-0.5">${rankBadge}</div>
                    <div class="min-w-0">
                        <div class="flex items-center gap-1.5 flex-wrap">
                            <h3 class="font-extrabold text-slate-100 text-sm leading-snug break-words">${p.name}</h3>
                            ${catBadge}
                            ${soldStatusBadge}
                        </div>
                        <div class="flex items-center gap-3 text-slate-400 text-xs mt-1 flex-wrap">
                            <span>${p.billCount > 0 ? `In <strong>${p.billCount}</strong> bill${p.billCount > 1 ? 's' : ''}` : 'No bills in period'}</span>
                            ${stockInfoHtml ? `<span>• ${stockInfoHtml}</span>` : ''}
                        </div>
                    </div>
                </div>
                <div class="text-right shrink-0">
                    <div class="text-base sm:text-lg font-black ${isSold ? 'text-amber-300' : 'text-slate-400'}">${formatQty(p.qtySold)} <span class="text-xs font-semibold text-slate-400">${p.unit}</span></div>
                    ${unitsSoldNote}
                    <div class="text-xs font-bold ${isSold ? 'text-emerald-400' : 'text-slate-500'} mt-0.5">₹${p.totalRevenue.toFixed(2)}</div>
                </div>
            </div>

            <!-- Breakdown: Retail vs Wholesale & Avg Rate -->
            <div class="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                <div class="flex items-center gap-2">
                    <span class="inline-flex items-center gap-1"><span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> Retail: <strong class="text-slate-300">${formatQty(p.retailQty)}</strong></span>
                    <span class="inline-flex items-center gap-1"><span class="w-1.5 h-1.5 rounded-full bg-sky-400"></span> Wholesale: <strong class="text-slate-300">${formatQty(p.wholesaleQty)}</strong></span>
                </div>
                <div class="text-[10px] text-slate-500 font-medium">Avg Rate: ₹${p.qtySold > 0 ? (p.totalRevenue / p.qtySold).toFixed(2) : '0.00'}</div>
            </div>
        </div>
    `;
}

/**
 * Renders the product cards list into both Item-Wise container and the overview folder container
 */
export function renderProductSalesAnalysisListOnly(providedData = null) {
    const mainContainer = document.getElementById('paItemWiseContainer');
    const folderContainer = document.getElementById('productAnalysisContainer');

    const data = providedData || getProductSalesAnalysisData(true);

    // Apply Status Filter
    let filteredList = data;
    if (productAnalysisStatusFilter === 'sold') {
        filteredList = filteredList.filter(p => p.qtySold > 0);
    } else if (productAnalysisStatusFilter === 'unsold') {
        filteredList = filteredList.filter(p => p.qtySold === 0);
    }

    // Apply Live Search Query
    if (productAnalysisSearchQuery) {
        filteredList = filteredList.filter(p =>
            p.name.toLowerCase().includes(productAnalysisSearchQuery) ||
            p.category.toLowerCase().includes(productAnalysisSearchQuery)
        );
    }

    const emptyHtml = `
        <div class="text-center py-8 bg-slate-900/40 rounded-2xl border border-slate-800 p-6 space-y-3">
            <span class="text-3xl">📦</span>
            <p class="text-slate-400 font-bold text-xs">No products found matching the current filters and search.</p>
            <button type="button" onclick="window.setProductAnalysisPeriod('all'); window.setProductAnalysisCategory('all'); window.setProductAnalysisSaleType('all'); window.setProductAnalysisStatusFilter('all');" class="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl text-xs font-bold transition">
                Reset All Filters
            </button>
        </div>`;

    const cardsHtml = filteredList.length ? filteredList.map((p, idx) => buildProductCardHtml(p, idx)).join('') : emptyHtml;

    if (mainContainer) {
        mainContainer.innerHTML = cardsHtml;
    }

    // In folder container (Overview tab), show sold items list by default
    if (folderContainer) {
        const soldOnlyList = productAnalysisSearchQuery 
            ? data.filter(p => p.qtySold > 0 && (p.name.toLowerCase().includes(productAnalysisSearchQuery) || p.category.toLowerCase().includes(productAnalysisSearchQuery)))
            : data.filter(p => p.qtySold > 0);
        
        folderContainer.innerHTML = soldOnlyList.length 
            ? soldOnlyList.map((p, idx) => buildProductCardHtml(p, idx)).join('') 
            : `<div class="text-center py-6 text-slate-400 font-bold text-xs">No product sales found for this period.</div>`;
    }
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
    const data = getProductSalesAnalysisData(true);
    if (!data.length) {
        alert('No product data found to share.');
        return;
    }

    const periodName = {
        all: 'All Time',
        today: 'Today',
        this_week: 'This Week',
        this_month: 'This Month',
        custom: 'Custom Range'
    }[productAnalysisPeriod] || productAnalysisPeriod;

    const soldItems = data.filter(p => p.qtySold > 0);
    const unsoldItems = data.filter(p => p.qtySold === 0);
    const totalQty = data.reduce((sum, p) => sum + p.qtySold, 0);
    const totalRev = data.reduce((sum, p) => sum + p.totalRevenue, 0);

    const lines = [
        `📊 *FIA CLEAN & CARE - Item-Wise Sales Report*`,
        `📅 Period: *${periodName}*`,
        `🏷️ Category: *${productAnalysisCategory.toUpperCase()}* | Type: *${productAnalysisSaleType.toUpperCase()}*`,
        `----------------------------------------`,
        `📦 *Total Products:* ${data.length} (${soldItems.length} Sold | ${unsoldItems.length} Unsold)`,
        `🔢 *Total Units Sold:* ${formatQty(totalQty)}`,
        `💰 *Total Revenue:* ₹${totalRev.toFixed(2)}`,
        `----------------------------------------`,
        `*TOP SELLING ITEMS:*`
    ];

    soldItems.slice(0, 25).forEach((p, idx) => {
        const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}.`;
        lines.push(`${medal} *${p.name}* (${p.category})`);
        lines.push(`   └ Qty Sold: *${formatQty(p.qtySold)} ${p.unit}* | Sales: *₹${p.totalRevenue.toFixed(2)}* | Stock: ${p.currentStock !== null ? formatQty(p.currentStock) : '—'}`);
    });

    if (soldItems.length > 25) {
        lines.push(`...and ${soldItems.length - 25} more sold products`);
    }

    if (unsoldItems.length > 0) {
        lines.push(`----------------------------------------`);
        lines.push(`💤 *Unsold Products in Period:* ${unsoldItems.length} items`);
    }

    lines.push(`----------------------------------------`);
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
            setTimeout(() => { btn.innerHTML = '↻ Cloud Sync'; }, 1500);
        }
    }).catch(() => {
        renderProductSalesAnalysis();
        if (btn) { btn.disabled = false; btn.innerHTML = '↻ Cloud Sync'; }
    });
}

// Global window attachments
if (typeof window !== 'undefined') {
    window.setProductAnalysisPeriod = setProductAnalysisPeriod;
    window.setProductAnalysisCategory = setProductAnalysisCategory;
    window.setProductAnalysisSaleType = setProductAnalysisSaleType;
    window.setProductAnalysisStatusFilter = setProductAnalysisStatusFilter;
    window.setProductAnalysisSortBy = setProductAnalysisSortBy;
    window.switchProductAnalysisTab = switchProductAnalysisTab;
    window.onProductAnalysisSearch = onProductAnalysisSearch;
    window.onProductAnalysisCustomDateChange = onProductAnalysisCustomDateChange;
    window.renderProductSalesAnalysis = renderProductSalesAnalysis;
    window.renderProductSalesAnalysisListOnly = renderProductSalesAnalysisListOnly;
    window.toggleProductAnalysisFolder = toggleProductAnalysisFolder;
    window.shareProductAnalysisWhatsApp = shareProductAnalysisWhatsApp;
    window.refreshProductAnalysisFromCloud = refreshProductAnalysisFromCloud;
}
