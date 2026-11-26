/**
 * FIA CLEAN & CARE - Product Analysis & Detergent Liquid Consolidation Tests
 * Run with: bun tests/product-analysis.test.js
 */

import {
    isDefaultDetergentLiquidName,
    isDetergentLiquidProduct,
    getProductSalesAnalysisData,
    summarizeDetergentLiquidSales,
    formatUnitTotals
} from '../modules/billing/product-analysis.js';

let passed = 0;
let failed = 0;

function assert(condition, testName, details = '') {
    if (condition) {
        passed++;
        console.log(`  ✓ ${testName}`);
    } else {
        failed++;
        console.error(`  ✕ FAILED: ${testName} ${details ? '(' + details + ')' : ''}`);
    }
}

function assertEqual(actual, expected, testName) {
    const isMatch = (typeof actual === 'number' && typeof expected === 'number')
        ? Math.abs(actual - expected) < 0.001
        : JSON.stringify(actual) === JSON.stringify(expected);
    assert(isMatch, testName, `Expected: ${expected}, Got: ${actual}`);
}

console.log('\n================================================================');
console.log('   FIA CLEAN & CARE - PRODUCT ANALYSIS & DETERGENT GROUP TESTS   ');
console.log('================================================================\n');

// 1. Default Detergent Liquid Name Detection
assert(isDefaultDetergentLiquidName('Forex Wash Plus', 'Cleaning'), 'Detects Forex Wash Plus');
assert(isDefaultDetergentLiquidName('Forexx Wash Plus', 'Cleaning'), 'Detects Forexx Wash Plus');
assert(isDefaultDetergentLiquidName('Excel Detergent Liquid', 'Cleaning'), 'Detects Excel Detergent Liquid');
assert(isDefaultDetergentLiquidName('Detergent Liquid Excel', 'Cleaning'), 'Detects Detergent Liquid Excel');
assert(isDefaultDetergentLiquidName('Fia Green Detergent Liquid', 'Cleaning'), 'Detects Fia Green Detergent Liquid');
assert(isDefaultDetergentLiquidName('Real Comfort', 'Cleaning'), 'Detects Real Comfort');
assert(isDefaultDetergentLiquidName('DETERGENT LIQUID_COMFORT', 'Cleaning'), 'Detects DETERGENT LIQUID_COMFORT');
assert(!isDefaultDetergentLiquidName('Dishwash Liquid', 'Cleaning'), 'Does not match Dishwash Liquid');
assert(!isDefaultDetergentLiquidName('White Phenyl', 'Cleaning'), 'Does not match White Phenyl');
assert(!isDefaultDetergentLiquidName('Face Cream', 'Cosmetics'), 'Does not match Cosmetics item');

// 2. Custom Group Overrides
assert(
    isDetergentLiquidProduct('Custom Bio Wash', 'Cleaning', { included: ['custom bio wash'], excluded: [] }),
    'Custom included product matches Detergent Liquid'
);
assert(
    !isDetergentLiquidProduct('Real Comfort', 'Cleaning', { included: [], excluded: ['real comfort'] }),
    'Custom excluded product is excluded from Detergent Liquid'
);

// 3. Consolidated Monthly Detergent Liquid Calculation across all 4 types
const sampleProducts = [
    { id: 'p1', name: 'Forex Wash Plus', stock: 50, unit: 'Ltr' },
    { id: 'p2', name: 'Excel Detergent Liquid', stock: 40, unit: 'Ltr' },
    { id: 'p3', name: 'Fia Green Detergent Liquid', stock: 30, unit: 'Ltr' },
    { id: 'p4', name: 'Real Comfort', stock: 25, unit: 'Ltr' },
    { id: 'p5', name: 'Dishwash Liquid', stock: 60, unit: 'Ltr' }
];

const today = new Date();
const monthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
const dayInMonth1 = `${monthKey}-01`;
const dayInMonth2 = `${monthKey}-02`;

const sampleCustomers = [
    {
        id: 'b1',
        billNo: 'CLN-0101',
        date: dayInMonth1,
        saleType: 'Retail',
        items: [
            { productName: 'Forex Wash Plus', qty: 5, unitType: 'Ltr', numberOfUnits: 2, stockDeductionQty: 10, total: 800 },
            { productName: 'Excel Detergent Liquid', qty: 500, unitType: 'ml', numberOfUnits: 4, stockDeductionQty: 2, total: 200 },
            { productName: 'Dishwash Liquid', qty: 10, unitType: 'Ltr', numberOfUnits: 1, stockDeductionQty: 10, total: 500 }
        ]
    },
    {
        id: 'b2',
        billNo: 'CLN-0102',
        date: dayInMonth2,
        saleType: 'Wholesale',
        items: [
            { productName: 'Fia Green Detergent Liquid', qty: 30, unitType: 'Ltr', numberOfUnits: 1, stockDeductionQty: 30, total: 1800 },
            { productName: 'Real Comfort', qty: 5, unitType: 'Ltr', numberOfUnits: 3, stockDeductionQty: 15, total: 1050 }
        ]
    },
    {
        id: 'b3',
        billNo: 'CLN-0103',
        date: dayInMonth2,
        saleType: 'Retail',
        isCancelled: true,
        items: [
            { productName: 'Forex Wash Plus', qty: 100, unitType: 'Ltr', numberOfUnits: 1, stockDeductionQty: 100, total: 8000 }
        ]
    },
    {
        id: 'b4',
        billNo: 'CLN-0104',
        date: '2024-01-15',
        saleType: 'Retail',
        items: [
            { productName: 'Forex Wash Plus', qty: 50, unitType: 'Ltr', numberOfUnits: 1, stockDeductionQty: 50, total: 4000 }
        ]
    }
];

const detergentDataThisMonth = getProductSalesAnalysisData({
    period: 'this_month',
    category: 'detergent',
    saleType: 'all',
    customers: sampleCustomers,
    cosSales: [],
    products: sampleProducts,
    cosProducts: []
});

assertEqual(detergentDataThisMonth.length, 4, 'Detergent filter returns all 4 detergent liquid products (excludes Dishwash)');
const summary = summarizeDetergentLiquidSales(detergentDataThisMonth);
assertEqual(summary.totalQty, 57, 'Combined Detergent Liquid total is 57 Ltr (10 + 2 + 30 + 15)');
assertEqual(summary.totalRevenue, 3850, 'Combined Detergent Liquid revenue is 3850 (800 + 200 + 1800 + 1050)');
assertEqual(summary.totalRetailQty, 12, 'Retail detergent qty is 12 Ltr (10 + 2)');
assertEqual(summary.totalWholesaleQty, 45, 'Wholesale detergent qty is 45 Ltr (30 + 15)');
assertEqual(summary.totalBills, 2, 'Unique bill count across all 4 detergent types is 2 (no double counting b1/b2)');
assertEqual(summary.formattedTotalQty, '57 Ltr', 'Formatted total qty is 57 Ltr');

const allTimeSummary = summarizeDetergentLiquidSales(
    getProductSalesAnalysisData({
        period: 'all',
        category: 'all',
        saleType: 'all',
        customers: sampleCustomers,
        cosSales: [],
        products: sampleProducts,
        cosProducts: []
    })
);
assertEqual(allTimeSummary.totalQty, 107, 'All-time combined Detergent Liquid excludes cancelled b3 and includes b4 (57 + 50 = 107 Ltr)');
assertEqual(formatUnitTotals([{ qtySold: 12.5, unit: 'Ltr' }, { qtySold: 2.5, unit: 'Ltr' }]), '15 Ltr', 'formatUnitTotals sums matching units');

console.log('\n----------------------------------------------------------------');
console.log(`Passed: ${passed} | Failed: ${failed}`);
if (failed > 0) {
    process.exit(1);
}
console.log('✓ ALL PRODUCT ANALYSIS TESTS PASSED SUCCESSFULLY!\n');
