/**
 * FIA CLEAN & CARE - Product-Wise Sales Analysis Engine
 * Consolidates quantity sold, revenue, and rankings across all customer bills (Cleaning, Cosmetics, Combined).
 * Strictly sorted in descending order (Highest sales first -> Lowest sales last).
 */

import { state, normalizeToDateKey, getTodayDateString, isCustItemDeleted, isItemDeleted } from '../core/state.js';
import { pullFromFirebase } from '../core/db.js';
import { normalizeCosSale } from './billing-history.js';

export let productAnalysisPeriod = 'all'; // 'all', 'today', 'this_week', 'this_month', 'custom'
export let productAnalysisCategory = 'all'; // 'all', 'cleaning', 'cosmetics'
export let productAnalysisSaleType = 'all'; // 'all', 'wholesale', 'retail'
export let productAnalysisSearchQuery = '';
export let productAnalysisStartDate = '';
export let productAnalysisEndDate = '';

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
    ['all', 'cleaning', 'cosmetics'].forEach(c => {
        const btn = document.getElementById('paCatBtn_' + c);
        if (!btn) return;
        if (c === productAnalysisCategory) {
            btn.className = 'px-3 py-1.5 rounded-xl bg-indigo-600 text-white font-bold text-xs shadow-sm transition';
        } else {
            btn.className = 'px-3 py-1.5 rounded-xl bg-slate-900 text-slate-300 border border-slate-700 font-bold text-xs hover:bg-slate-800 transition';
        }
    });
}

function updateSaleTypeButtonStyles() {
    ['all', 'retail', 'wholesale'].forEach(s => {
        const btn = document.getElementById('paSaleTypeBtn_' + s);
        if (!btn) return;
        if (s === productAnalysisSaleType) {
            btn.className = 'px-3 py-1.5 rounded-xl bg-emerald-600 text-white font-bold text-xs shadow-sm transition';
        } else {
            btn.className = 'px-3 py-1.5 rounded-xl bg-slate-900 text-slate-300 border border-slate-700 font-bold text-xs hover:bg-slate-800 transition';
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
export function getProductSalesAnalysisData() {
    const productMap = {};

    // Helper to find live stock
    const findStockInfo = (name, category) => {
        const clean = String(name || '').trim().toLowerCase();
        if (category === 'Cosmetics') {
            const prod = (state.cosProducts || []).find(p => p && String(p.name || '').trim().toLowerCase() === clean);
            return {
                stock: prod ? Number(prod.stock || 0) : null,
                unit: prod?.unit || 'Pcs'
            };
        } else {
            const prod = (state.products || []).find(p => p && String(p.name || '').trim().toLowerCase() === clean);
            return {
                stock: prod ? Number(prod.stock || 0) : null,
                unit: prod?.unit || 'Bottle/Ltr'
            };
        }
    };

    // 1. Process Cleaning & Combined Bills
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

            const mapKey = `${category}_${name.toLowerCase()}`;
            const qty = parseFloat(item.qty || item.quantity || 0) || 0;
            const rate = parseFloat(item.rate || item.price || 0) || 0;
            const total = parseFloat(item.total || (qty * rate) || 0) || 0;
            const unit = item.unit || '';

            if (!productMap[mapKey]) {
                const stockInfo = findStockInfo(name, category);
                productMap[mapKey] = {
                    name,
                    category,
                    qtySold: 0,
                    totalRevenue: 0,
                    billCount: 0,
                    billNos: new Set(),
                    unit: unit || stockInfo.unit,
                    currentStock: stockInfo.stock,
                    retailQty: 0,
                    wholesaleQty: 0
                };
            }

            productMap[mapKey].qtySold += qty;
            productMap[mapKey].totalRevenue += total;
            if (c.billNo) productMap[mapKey].billNos.add(String(c.billNo));
            if (billSaleType === 'wholesale') {
                productMap[mapKey].wholesaleQty += qty;
            } else {
                productMap[mapKey].retailQty += qty;
            }
        });
    });

    // 2. Process Cosmetics Bills
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
            const qty = parseFloat(item.qty || item.quantity || 0) || 0;
            const rate = parseFloat(item.rate || item.price || 0) || 0;
            const total = parseFloat(item.total || (qty * rate) || 0) || 0;
            const unit = item.unit || 'Pcs';

            if (!productMap[mapKey]) {
                const stockInfo = findStockInfo(name, category);
                productMap[mapKey] = {
                    name,
                    category,
                    qtySold: 0,
                    totalRevenue: 0,
                    billCount: 0,
                    billNos: new Set(),
                    unit: unit || stockInfo.unit,
                    currentStock: stockInfo.stock,
                    retailQty: 0,
                    wholesaleQty: 0
                };
            }

            productMap[mapKey].qtySold += qty;
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
    if (kpiTotalUnits) kpiTotalUnits.textContent = formatQty(totalUnits);
    if (kpiTotalRev) kpiTotalRev.textContent = '₹' + totalRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (kpiCount) kpiCount.textContent = allData.length + ' Products';

    renderProductSalesAnalysisListOnly(allData);
}

/**
 * Renders only the product cards list (fast live typing search)
 */
export function renderProductSalesAnalysisListOnly(providedData = null) {
    const container = document.getElementById('productAnalysisContainer');
    if (!container) return;

    const data = providedData || getProductSalesAnalysisData();
    let displayList = data;

    if (productAnalysisSearchQuery) {
        displayList = data.filter(p => p.name.toLowerCase().includes(productAnalysisSearchQuery) || p.category.toLowerCase().includes(productAnalysisSearchQuery));
    }

    if (!displayList.length) {
        container.innerHTML = `
            <div class="text-center py-10 bg-slate-900/40 rounded-2xl border border-slate-800 p-6 space-y-3">
                <span class="text-3xl">📦</span>
                <p class="text-slate-400 font-bold text-xs">No product sales found for this period and filter selection.</p>
                <button type="button" onclick="window.setProductAnalysisPeriod('all');window.setProductAnalysisCategory('all');window.setProductAnalysisSaleType('all');" class="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl text-xs font-bold transition">
                    Show All Sales Records
                </button>
            </div>`;
        return;
    }

    container.innerHTML = displayList.map((p, index) => {
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

        let stockInfoHtml = '';
        if (p.currentStock !== null) {
            const isLow = p.currentStock <= 5;
            stockInfoHtml = `<span class="text-[11px] font-semibold ${isLow ? 'text-rose-400 font-bold' : 'text-slate-400'}">
                Stock: <strong class="${isLow ? 'text-rose-300' : 'text-slate-200'}">${formatQty(p.currentStock)} ${p.unit}</strong> ${isLow ? '⚠️ Low' : '✓ In Stock'}
            </span>`;
        }

        return `
            <div class="bg-slate-900/80 hover:bg-slate-900 border border-slate-800 p-3.5 rounded-2xl transition space-y-2.5 shadow-sm">
                <div class="flex items-start justify-between gap-3">
                    <div class="flex items-start gap-2.5 min-w-0">
                        <div class="shrink-0 pt-0.5">${rankBadge}</div>
                        <div class="min-w-0">
                            <div class="flex items-center gap-1.5 flex-wrap">
                                <h3 class="font-extrabold text-slate-100 text-sm leading-snug break-words">${p.name}</h3>
                                ${catBadge}
                            </div>
                            <div class="flex items-center gap-3 text-slate-400 text-xs mt-1 flex-wrap">
                                <span>In <strong>${p.billCount}</strong> bills</span>
                                ${stockInfoHtml ? `<span>• ${stockInfoHtml}</span>` : ''}
                            </div>
                        </div>
                    </div>
                    <div class="text-right shrink-0">
                        <div class="text-base sm:text-lg font-black text-amber-300">${formatQty(p.qtySold)} <span class="text-xs font-semibold text-slate-400">${p.unit}</span></div>
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

    let totalQty = 0;
    let totalRev = 0;
    const lines = [
        `📊 *FIA CLEAN & CARE - Product-Wise Sales Report*`,
        `📅 Period: *${periodName}*`,
        `🏷️ Category: *${productAnalysisCategory.toUpperCase()}* | Type: *${productAnalysisSaleType.toUpperCase()}*`,
        `----------------------------------------`
    ];

    data.slice(0, 20).forEach((p, idx) => {
        totalQty += p.qtySold;
        totalRev += p.totalRevenue;
        const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}.`;
        lines.push(`${medal} *${p.name}* (${p.category})`);
        lines.push(`   └ Qty: *${formatQty(p.qtySold)} ${p.unit}* | Sales: *₹${p.totalRevenue.toFixed(2)}*`);
    });

    if (data.length > 20) {
        lines.push(`...and ${data.length - 20} more products`);
    }

    lines.push(`----------------------------------------`);
    lines.push(`📦 *Total Units Sold:* ${formatQty(totalQty)}`);
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
    window.onProductAnalysisSearch = onProductAnalysisSearch;
    window.onProductAnalysisCustomDateChange = onProductAnalysisCustomDateChange;
    window.renderProductSalesAnalysis = renderProductSalesAnalysis;
    window.renderProductSalesAnalysisListOnly = renderProductSalesAnalysisListOnly;
    window.shareProductAnalysisWhatsApp = shareProductAnalysisWhatsApp;
    window.refreshProductAnalysisFromCloud = refreshProductAnalysisFromCloud;
}
