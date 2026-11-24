/**
 * FIA CLEAN & CARE - Comprehensive Automated Regression Test Suite
 * 
 * Verifies 100% of core accounting, billing, FIFO settlement, DayBook reconciliation,
 * customer ledger consolidation, and profit margin calculations.
 * 
 * Run with: node tests/accounting-engine.test.js
 */

import {
    round2,
    calculateBillTotals,
    allocatePaymentFIFO,
    calculateDayBookSummary,
    calculateCustomerLedger
} from '../modules/core/accounting-engine.js';
import { reconcilePurchase } from '../modules/operations/purchases.js';
import { normalizePurchases, state } from '../modules/core/state.js';

let passed = 0;
let failed = 0;
const failures = [];

function assert(condition, testName, details = '') {
    if (condition) {
        passed++;
        console.log(`  ✓ ${testName}`);
    } else {
        failed++;
        console.error(`  ✕ FAILED: ${testName} ${details ? '(' + details + ')' : ''}`);
        failures.push({ testName, details });
    }
}

function assertEqual(actual, expected, testName) {
    const isMatch = (typeof actual === 'number' && typeof expected === 'number')
        ? Math.abs(actual - expected) < 0.001
        : JSON.stringify(actual) === JSON.stringify(expected);
    
    assert(isMatch, testName, `Expected: ${expected}, Got: ${actual}`);
}

console.log('\n================================================================');
console.log('       FIA CLEAN & CARE - AUTOMATED ACCOUNTING TEST SUITE        ');
console.log('================================================================\n');

// -------------------------------------------------------------
// GROUP 1: Precision & Currency Math (Tests 1-5)
// -------------------------------------------------------------
console.log('--- GROUP 1: Precision & Currency Math ---');
assertEqual(round2(10.005), 10.01, 'Test 1: Proper rounding of half-cent up');
assertEqual(round2(0.1 + 0.2), 0.3, 'Test 2: Floating point 0.1 + 0.2 equals 0.3');
assertEqual(round2('45.678'), 45.68, 'Test 3: String numeric conversion and rounding');
assertEqual(round2(null), 0, 'Test 4: Null handled safely as 0');
assertEqual(round2(-0.0001), 0, 'Test 5: Near-zero negative rounds to 0');

// -------------------------------------------------------------
// GROUP 2: Billing & Invoice Calculations (Tests 6-20)
// -------------------------------------------------------------
console.log('\n--- GROUP 2: Billing & Invoice Calculations ---');

// Test 6: Full Cash Sale
const bill1 = calculateBillTotals({
    items: [
        { total: 300 },
        { numberOfUnits: 2, rate: 100 }
    ],
    paidAmount: 500
});
assertEqual(bill1.subTotal, 500, 'Test 6: Subtotal calculation');
assertEqual(bill1.grandTotal, 500, 'Test 6: Grand total with zero discount');
assertEqual(bill1.pendingDue, 0, 'Test 6: Full cash sale has 0 pending due');
assertEqual(bill1.excessCash, 0, 'Test 6: Full cash sale has 0 excess cash');
assert(bill1.isFullyPaid, 'Test 6: Marked as fully paid');

// Test 7: Partial Payment with Due Generation
const bill2 = calculateBillTotals({
    items: [{ total: 1000 }],
    paidAmount: 400
});
assertEqual(bill2.grandTotal, 1000, 'Test 7: Grand total 1000');
assertEqual(bill2.paidAmount, 400, 'Test 7: Paid amount 400');
assertEqual(bill2.pendingDue, 600, 'Test 7: Pending due 600');
assertEqual(bill2.isFullyPaid, false, 'Test 7: Not fully paid');

// Test 8: Zero Payment (100% Credit Sale)
const bill3 = calculateBillTotals({
    items: [{ total: 850 }],
    paidAmount: 0
});
assertEqual(bill3.pendingDue, 850, 'Test 8: Entire bill becomes pending due');
assertEqual(bill3.currentBillPaid, 0, 'Test 8: Current bill paid is 0');

// Test 9: Flat Discount Applied
const bill4 = calculateBillTotals({
    items: [{ total: 1000 }],
    discount: 150,
    paidAmount: 850
});
assertEqual(bill4.discount, 150, 'Test 9: Discount recorded');
assertEqual(bill4.grandTotal, 850, 'Test 9: Grand total discounted to 850');
assertEqual(bill4.pendingDue, 0, 'Test 9: Net due 0 when discounted amount paid');

// Test 10: Discount Exceeding Subtotal (Capped)
const bill5 = calculateBillTotals({
    items: [{ total: 200 }],
    discount: 300,
    paidAmount: 0
});
assertEqual(bill5.discount, 200, 'Test 10: Discount capped at subtotal');
assertEqual(bill5.grandTotal, 0, 'Test 10: Grand total cannot go below 0');

// Test 11: Customer with Previous Due paying full amount
const bill6 = calculateBillTotals({
    items: [{ total: 1000 }],
    previousDue: 350,
    paidAmount: 1350
});
assertEqual(bill6.totalWithDue, 1350, 'Test 11: Total with previous due is 1350');
assertEqual(bill6.netBalanceDue, 0, 'Test 11: Net balance due is 0 when fully paid');
assertEqual(bill6.pendingDue, 0, 'Test 11: Current bill has 0 due');

// Test 12: Customer with Previous Due paying only current bill
const bill7 = calculateBillTotals({
    items: [{ total: 1000 }],
    previousDue: 350,
    paidAmount: 1000
});
assertEqual(bill7.currentBillPaid, 1000, 'Test 12: Current bill fully paid');
assertEqual(bill7.pendingDue, 0, 'Test 12: Current bill has 0 pending due');
assertEqual(bill7.netBalanceDue, 350, 'Test 12: Previous due remains 350');

// Test 13: Customer with Previous Due paying partial current bill
const bill8 = calculateBillTotals({
    items: [{ total: 1000 }],
    previousDue: 350,
    paidAmount: 600
});
assertEqual(bill8.currentBillPaid, 600, 'Test 13: Current bill paid 600');
assertEqual(bill8.pendingDue, 400, 'Test 13: Current bill pending 400');
assertEqual(bill8.netBalanceDue, 750, 'Test 13: Total net balance due is 750');

// Test 14: Customer with Advance Credit Applied
const bill9 = calculateBillTotals({
    items: [{ total: 1000 }],
    previousCredit: 200,
    paidAmount: 800
});
assertEqual(bill9.appliedCredit, 200, 'Test 14: 200 credit applied');
assertEqual(bill9.totalWithDue, 800, 'Test 14: Total with credit deduction is 800');
assertEqual(bill9.netBalanceDue, 0, 'Test 14: Net balance due 0');

// Test 15: Customer Credit Exceeding Bill
const bill10 = calculateBillTotals({
    items: [{ total: 300 }],
    previousCredit: 500,
    paidAmount: 0
});
assertEqual(bill10.appliedCredit, 300, 'Test 15: Only required 300 credit deducted');
assertEqual(bill10.totalWithDue, 0, 'Test 15: Bill amount becomes 0');
assertEqual(bill10.netBalanceDue, 0, 'Test 15: Zero balance due');

// Test 16: Auto-fill default paid amount when no previous due
const bill11 = calculateBillTotals({
    items: [{ total: 450 }],
    previousDue: 0,
    paidAmount: null
});
assertEqual(bill11.paidAmount, 450, 'Test 16: Defaults to full payment when no prior due');

// Test 17: Safe default paid amount (0) when customer has previous due
const bill12 = calculateBillTotals({
    items: [{ total: 450 }],
    previousDue: 200,
    paidAmount: null
});
assertEqual(bill12.paidAmount, 0, 'Test 17: Defaults to 0 to prevent unintentional auto-clear');

// Test 18: Overpayment Generating Excess Cash for Old Dues
const bill13 = calculateBillTotals({
    items: [{ total: 500 }],
    paidAmount: 800
});
assertEqual(bill13.currentBillPaid, 500, 'Test 18: Current bill receives 500');
assertEqual(bill13.pendingDue, 0, 'Test 18: Current bill has 0 pending due');
assertEqual(bill13.excessCash, 300, 'Test 18: 300 excess cash available for FIFO settlement');

// Test 19: Floating point precision on 3 units at 33.33
const bill14 = calculateBillTotals({
    items: [{ numberOfUnits: 3, rate: 33.33 }],
    discount: 0.01,
    paidAmount: 99.98
});
assertEqual(bill14.grandTotal, 99.98, 'Test 19: Clean floating-point resolution');
assertEqual(bill14.pendingDue, 0, 'Test 19: 0 pending due with exact cents');

// Test 20: Empty Bill Protection
const bill15 = calculateBillTotals({ items: [] });
assertEqual(bill15.grandTotal, 0, 'Test 20: Empty bill returns 0 grand total without errors');

// -------------------------------------------------------------
// GROUP 3: FIFO Multi-Bill Debt Settlement (Tests 21-35)
// -------------------------------------------------------------
console.log('\n--- GROUP 3: FIFO Multi-Bill Debt Settlement ---');

// Test 21: Single older bill fully settled by excess cash
const billsA = [
    { id: 'b1', billNo: 'CLN-0001', date: '2026-11-01', pendingAmount: 200, paidAmount: 100 }
];
const fifo1 = allocatePaymentFIFO({
    excessCash: 200,
    unpaidBills: billsA,
    settlingBillNo: 'CLN-0005',
    paymentDate: '2026-11-23'
});
assertEqual(fifo1.duesSettled, 200, 'Test 21: 200 dues settled');
assertEqual(fifo1.remainingExcess, 0, 'Test 21: 0 excess remaining');
assertEqual(billsA[0].pendingAmount, 0, 'Test 21: Older bill pending becomes 0');
assertEqual(billsA[0].paidAmount, 300, 'Test 21: Older bill paid amount updated to 300');
assertEqual(billsA[0].paymentHistory.length, 1, 'Test 21: Payment history entry recorded');

// Test 22: Older bill partially settled
const billsB = [
    { id: 'b2', billNo: 'CLN-0002', date: '2026-11-05', pendingAmount: 500, paidAmount: 0 }
];
const fifo2 = allocatePaymentFIFO({
    excessCash: 200,
    unpaidBills: billsB,
    settlingBillNo: 'CLN-0006',
    paymentDate: '2026-11-23'
});
assertEqual(fifo2.duesSettled, 200, 'Test 22: 200 dues settled');
assertEqual(billsB[0].pendingAmount, 300, 'Test 22: Older bill remaining pending is 300');
assertEqual(billsB[0].paidAmount, 200, 'Test 22: Older bill paid is 200');

// Test 23: Multiple older bills settled in strict date ascending order
const billsC = [
    { id: 'b_new', billNo: 'CLN-0010', date: '2026-11-15', pendingAmount: 300, paidAmount: 0 },
    { id: 'b_old', billNo: 'CLN-0003', date: '2026-11-02', pendingAmount: 100, paidAmount: 0 },
    { id: 'b_mid', billNo: 'CLN-0007', date: '2026-11-10', pendingAmount: 200, paidAmount: 0 }
];
const fifo3 = allocatePaymentFIFO({
    excessCash: 250,
    unpaidBills: billsC,
    settlingBillNo: 'CLN-0012',
    paymentDate: '2026-11-23'
});
// Oldest bill (Nov 2, 100) -> fully settled (0 left)
// Middle bill (Nov 10, 200) -> 150 settled (50 left)
// Newest bill (Nov 15, 300) -> 0 settled (300 left)
assertEqual(fifo3.duesSettled, 250, 'Test 23: Exactly 250 settled across bills');
const billOld = billsC.find(b => b.id === 'b_old');
const billMid = billsC.find(b => b.id === 'b_mid');
const billNew = billsC.find(b => b.id === 'b_new');
assertEqual(billOld.pendingAmount, 0, 'Test 23: Oldest bill fully settled');
assertEqual(billMid.pendingAmount, 50, 'Test 23: Middle bill partially settled to 50');
assertEqual(billNew.pendingAmount, 300, 'Test 23: Newest bill untouched');

// Test 24: Excess cash greater than all existing debts combined
const billsD = [
    { id: 'b1', date: '2026-11-01', pendingAmount: 100, paidAmount: 0 },
    { id: 'b2', date: '2026-11-02', pendingAmount: 150, paidAmount: 0 }
];
const fifo4 = allocatePaymentFIFO({
    excessCash: 400,
    unpaidBills: billsD,
    settlingBillNo: 'CLN-0015',
    paymentDate: '2026-11-23'
});
assertEqual(fifo4.duesSettled, 250, 'Test 24: Settled all 250 debt');
assertEqual(fifo4.remainingExcess, 150, 'Test 24: 150 remaining excess cash returned');
assertEqual(billsD[0].pendingAmount, 0, 'Test 24: Bill 1 cleared');
assertEqual(billsD[1].pendingAmount, 0, 'Test 24: Bill 2 cleared');

// Test 25: Zero excess cash passed to FIFO
const billsE = [{ id: 'b1', pendingAmount: 100 }];
const fifo5 = allocatePaymentFIFO({ excessCash: 0, unpaidBills: billsE });
assertEqual(fifo5.duesSettled, 0, 'Test 25: 0 dues settled');
assertEqual(billsE[0].pendingAmount, 100, 'Test 25: Bill pending unchanged');

// Test 26: Payment history note format verification
assertEqual(fifo1.settledPayments[0].payment.note, 'Settled via Bill #CLN-0005', 'Test 26: Accurate settlement audit note');

// Test 27: Direct due settlement without bill number
const fifo6 = allocatePaymentFIFO({
    excessCash: 50,
    unpaidBills: [{ id: 'b_dir', pendingAmount: 50 }],
    settlingBillNo: ''
});
assertEqual(fifo6.settledPayments[0].payment.note, 'Direct Due Settlement', 'Test 27: Direct settlement note');

// Test 28: Negative excess defense
const fifo7 = allocatePaymentFIFO({ excessCash: -100, unpaidBills: [{ pendingAmount: 50 }] });
assertEqual(fifo7.duesSettled, 0, 'Test 28: Negative excess rejected');

// Test 29: Bills with 0 pending are skipped
const billsF = [
    { id: 'b_zero', date: '2026-11-01', pendingAmount: 0, paidAmount: 100 },
    { id: 'b_actual', date: '2026-11-02', pendingAmount: 50, paidAmount: 0 }
];
const fifo8 = allocatePaymentFIFO({ excessCash: 30, unpaidBills: billsF });
assertEqual(billsF[0].pendingAmount, 0, 'Test 29: Zero-due bill untouched');
assertEqual(billsF[1].pendingAmount, 20, 'Test 29: Actual due bill receives payment');

// Test 30: Multi-bill cent-perfect fractional allocation
const billsG = [
    { id: 'f1', date: '2026-11-01', pendingAmount: 33.33 },
    { id: 'f2', date: '2026-11-02', pendingAmount: 66.67 }
];
const fifo9 = allocatePaymentFIFO({ excessCash: 50.00, unpaidBills: billsG });
assertEqual(billsG[0].pendingAmount, 0, 'Test 30: 33.33 cleared');
assertEqual(billsG[1].pendingAmount, 50.00, 'Test 30: Exactly 50.00 left on second bill');

// -------------------------------------------------------------
// GROUP 4: DayBook & Financial Reconciliation Engine (Tests 31-45)
// -------------------------------------------------------------
console.log('\n--- GROUP 4: DayBook & Financial Reconciliation Engine ---');

// Test 31: Full Cash Day (No credit, no old dues)
const db1 = calculateDayBookSummary({
    entries: [
        { id: '1', date: '2026-11-23', type: 'Income', category: 'Cleaning Sale', amount: 3000, paidAmount: 3000, pendingAmount: 0 },
        { id: '2', date: '2026-11-23', type: 'Income', category: 'Cosmetics Sale', amount: 2000, paidAmount: 2000, pendingAmount: 0 }
    ],
    fromDate: '2026-11-23',
    toDate: '2026-11-23'
});
assertEqual(db1.totalSales, 5000, 'Test 31: Total sales 5000');
assertEqual(db1.totalCollection, 5000, 'Test 31: Total collection 5000');
assertEqual(db1.periodDue, 0, 'Test 31: Today due 0');
assert(db1.isReconciled, 'Test 31: Golden equation reconciled');

// Test 32: Credit Sales Day (Partial cash, partial due)
const db2 = calculateDayBookSummary({
    entries: [
        { id: '1', date: '2026-11-23', type: 'Income', category: 'Cleaning Sale', amount: 5000, paidAmount: 3000, pendingAmount: 2000 }
    ],
    fromDate: '2026-11-23',
    toDate: '2026-11-23'
});
assertEqual(db2.totalSales, 5000, 'Test 32: Billed sales 5000');
assertEqual(db2.totalCollection, 3000, 'Test 32: Cash collected 3000');
assertEqual(db2.periodDue, 2000, 'Test 32: New due 2000');
assertEqual(db2.salesPaidPortion, 3000, 'Test 32: Sales paid portion 3000');
assert(db2.isReconciled, 'Test 32: Reconciled Collection === Sales - Due');

// Test 33: Day with Old Due Collections Only
const db3 = calculateDayBookSummary({
    entries: [
        { id: '1', date: '2026-11-23', type: 'Income', category: 'Customer Due Collection', amount: 1500, paidAmount: 1500, pendingAmount: 0 }
    ],
    fromDate: '2026-11-23',
    toDate: '2026-11-23'
});
assertEqual(db3.totalSales, 0, 'Test 33: Sales is 0 (old due collection is not new turnover)');
assertEqual(db3.duesCollected, 1500, 'Test 33: Dues collected 1500');
assertEqual(db3.totalCollection, 1500, 'Test 33: Collection is 1500');
assert(db3.isReconciled, 'Test 33: Reconciled');

// Test 34: Mixed Day (Sales + Part Due + Old Due Collection)
// Sales: 10,000, Today Due: 3,000 (Paid: 7,000)
// Old Due Collected: 2,500
// Expected Collection: 7,000 + 2,500 = 9,500
const db4 = calculateDayBookSummary({
    entries: [
        { id: '1', date: '2026-11-23', type: 'Income', category: 'Cleaning Sale', amount: 10000, paidAmount: 7000, pendingAmount: 3000 },
        { id: '2', date: '2026-11-23', type: 'Income', category: 'Customer Due Collection', amount: 2500, paidAmount: 2500, pendingAmount: 0 }
    ],
    fromDate: '2026-11-23',
    toDate: '2026-11-23'
});
assertEqual(db4.totalSales, 10000, 'Test 34: Sales is 10000');
assertEqual(db4.periodDue, 3000, 'Test 34: Today due is 3000');
assertEqual(db4.duesCollected, 2500, 'Test 34: Dues collected is 2500');
assertEqual(db4.totalCollection, 9500, 'Test 34: Total Collection is exactly 9500');
assert(db4.isReconciled, 'Test 34: Master reconciliation verified');

// Test 35: Opening Balance & Opening Expense
const db5 = calculateDayBookSummary({
    entries: [
        { id: '1', date: '2026-11-23', type: 'Income', category: 'Cleaning Sale', amount: 2000, paidAmount: 2000, pendingAmount: 0 },
        { id: '2', date: '2026-11-23', type: 'Expense', category: 'Purchase', amount: 800, paidAmount: 800 }
    ],
    fromDate: '2026-11-23',
    toDate: '2026-11-23',
    openingBalance: 1000,
    openingExpense: 200
});
assertEqual(db5.grossIncome, 3000, 'Test 35: Gross income (1000 opening + 2000 collection)');
assertEqual(db5.grossExpense, 1000, 'Test 35: Gross expense (200 opening + 800 purchase)');
assertEqual(db5.netBalance, 2000, 'Test 35: Net profit is 2000');
assert(db5.isProfit, 'Test 35: Operating profit verified');

// Test 36: Operating Loss Detection
const db6 = calculateDayBookSummary({
    entries: [
        { id: '1', date: '2026-11-23', type: 'Income', category: 'Sale', amount: 500, paidAmount: 500 },
        { id: '2', date: '2026-11-23', type: 'Expense', category: 'Purchase', amount: 2000 }
    ],
    fromDate: '2026-11-23',
    toDate: '2026-11-23'
});
assertEqual(db6.netBalance, -1500, 'Test 36: Net balance is -1500');
assertEqual(db6.isProfit, false, 'Test 36: Marked as operating loss');

// Test 37: Profit Margin & Markup Calculation
// Income: 1000, Expense: 500 -> Net: 500
// Margin = 500/1000 = 50.0%
// Markup = 500/500 = 100.0%
const db7 = calculateDayBookSummary({
    entries: [
        { id: '1', date: '2026-11-23', type: 'Income', category: 'Sale', amount: 1000, paidAmount: 1000 },
        { id: '2', date: '2026-11-23', type: 'Expense', category: 'Expense', amount: 500 }
    ],
    fromDate: '2026-11-23',
    toDate: '2026-11-23'
});
assertEqual(db7.marginPct, 50, 'Test 37: Profit margin is 50%');
assertEqual(db7.markupPct, 100, 'Test 37: Markup is 100%');

// Test 38: Cleared DayBook Entries Excluded
const db8 = calculateDayBookSummary({
    entries: [
        { id: 'keep', date: '2026-11-23', type: 'Income', category: 'Sale', amount: 1000, paidAmount: 1000 },
        { id: 'cleared', date: '2026-11-23', type: 'Income', category: 'Sale', amount: 500, paidAmount: 500 }
    ],
    fromDate: '2026-11-23',
    toDate: '2026-11-23',
    clearedIds: ['cleared']
});
assertEqual(db8.totalSales, 1000, 'Test 38: Cleared entry excluded from sales');
assertEqual(db8.entryCount, 1, 'Test 38: Exactly 1 active entry counted');

// Test 39: Date Range Filtering (Inclusive)
const db9 = calculateDayBookSummary({
    entries: [
        { id: '1', date: '2026-11-20', type: 'Income', category: 'Sale', amount: 100, paidAmount: 100 },
        { id: '2', date: '2026-11-22', type: 'Income', category: 'Sale', amount: 200, paidAmount: 200 },
        { id: '3', date: '2026-11-23', type: 'Income', category: 'Sale', amount: 300, paidAmount: 300 },
        { id: '4', date: '2026-11-25', type: 'Income', category: 'Sale', amount: 400, paidAmount: 400 }
    ],
    fromDate: '2026-11-21',
    toDate: '2026-11-23'
});
assertEqual(db9.totalSales, 500, 'Test 39: Only Nov 22 and Nov 23 included (200 + 300 = 500)');

// Test 40: Empty Date Filters (All Time Summary)
const db10 = calculateDayBookSummary({
    entries: [
        { id: '1', date: '2026-10-01', type: 'Income', category: 'Sale', amount: 100, paidAmount: 100 },
        { id: '2', date: '2026-11-23', type: 'Income', category: 'Sale', amount: 200, paidAmount: 200 }
    ]
});
assertEqual(db10.totalSales, 300, 'Test 40: All time sales aggregated');

// -------------------------------------------------------------
// GROUP 5: Customer Consolidation Ledger & Account Statement (Tests 41-50)
// -------------------------------------------------------------
console.log('\n--- GROUP 5: Customer Consolidation Ledger ---');

// Test 41: Multi-bill customer ledger
const custBills1 = [
    { id: 'b1', grandTotal: 1000, paidAmount: 600, pendingAmount: 400 },
    { id: 'b2', grandTotal: 500, paidAmount: 500, pendingAmount: 0 },
    { id: 'b3', grandTotal: 2000, paidAmount: 1000, pendingAmount: 1000 }
];
const ledger1 = calculateCustomerLedger(custBills1);
assertEqual(ledger1.totalPurchases, 3500, 'Test 41: Total purchases 3500');
assertEqual(ledger1.totalPaid, 2100, 'Test 41: Total paid 2100');
assertEqual(ledger1.totalDue, 1400, 'Test 41: Total due 1400');
assertEqual(ledger1.isCleared, false, 'Test 41: Not cleared');

// Test 42: Fully cleared customer
const custBills2 = [
    { id: 'b1', grandTotal: 500, paidAmount: 500, pendingAmount: 0 }
];
const ledger2 = calculateCustomerLedger(custBills2);
assertEqual(ledger2.totalDue, 0, 'Test 42: Total due 0');
assert(ledger2.isCleared, 'Test 42: Marked as cleared');

// Test 43: Cancelled bills excluded
const custBills3 = [
    { id: 'b1', grandTotal: 500, paidAmount: 500, pendingAmount: 0 },
    { id: 'b_canc', grandTotal: 1000, paidAmount: 0, pendingAmount: 1000, isCancelled: true }
];
const ledger3 = calculateCustomerLedger(custBills3);
assertEqual(ledger3.totalPurchases, 500, 'Test 43: Cancelled bill excluded from purchases');
assertEqual(ledger3.totalDue, 0, 'Test 43: Cancelled bill excluded from dues');

// Test 44: Deleted bills (_deleted flag) excluded
const custBills4 = [
    { id: 'b1', grandTotal: 300, paidAmount: 300, pendingAmount: 0 },
    { id: 'b_del', grandTotal: 700, paidAmount: 0, pendingAmount: 700, _deleted: true }
];
const ledger4 = calculateCustomerLedger(custBills4);
assertEqual(ledger4.totalPurchases, 300, 'Test 44: Deleted bill excluded');

// Test 45: Customer with fractional balance
const custBills5 = [
    { id: 'b1', grandTotal: 100.50, paidAmount: 50.25, pendingAmount: 50.25 }
];
const ledger5 = calculateCustomerLedger(custBills5);
assertEqual(ledger5.totalDue, 50.25, 'Test 45: Fractional cent precision verified');

// Test 46: High-volume customer (20 bills)
const custBills6 = Array.from({ length: 20 }, (_, i) => ({
    id: `b_${i}`,
    grandTotal: 100,
    paidAmount: 80,
    pendingAmount: 20
}));
const ledger6 = calculateCustomerLedger(custBills6);
assertEqual(ledger6.totalPurchases, 2000, 'Test 46: 20 bills purchase total 2000');
assertEqual(ledger6.totalDue, 400, 'Test 46: 20 bills due total 400');

// Test 47: Empty bills array
const ledger7 = calculateCustomerLedger([]);
assertEqual(ledger7.totalPurchases, 0, 'Test 47: Empty array safe');
assertEqual(ledger7.isCleared, true, 'Test 47: Empty bills marked cleared');

// Test 48: Sub-cent due rounding (e.g. 0.0001) marked as cleared
const custBills8 = [{ grandTotal: 100, paidAmount: 100, pendingAmount: 0.0001 }];
const ledger8 = calculateCustomerLedger(custBills8);
assert(ledger8.isCleared, 'Test 48: Sub-cent rounding treated as cleared');

// Test 49: Combined multi-department purchases
const custBills9 = [
    { grandTotal: 600, paidAmount: 600, pendingAmount: 0, type: 'cleaning' },
    { grandTotal: 400, paidAmount: 200, pendingAmount: 200, type: 'cosmetics' }
];
const ledger9 = calculateCustomerLedger(custBills9);
assertEqual(ledger9.totalPurchases, 1000, 'Test 49: Cleaning + Cosmetics purchases combined');
assertEqual(ledger9.totalDue, 200, 'Test 49: Unified due verified');

// Test 50: Zero floating point drift on 10 repeated additions
let driftTest = 0;
for (let i = 0; i < 10; i++) {
    driftTest = round2(driftTest + 0.1);
}
assertEqual(driftTest, 1.0, 'Test 50: Zero float drift on repeated increments');

// --- GROUP 6: Purchases Auto-Paid Reconciliation & Migration ---
console.log('\n--- GROUP 6: Purchases Auto-Paid Reconciliation & Migration ---');

// Test 51: Legacy purchase (e.g. Lead Chemicals ₹12,500) where paid was 0 & balance was 12500
const legacyPurch1 = {
    id: 'purch_lead_chemicals',
    supplierName: 'LEAD CHEMICALS',
    rawMaterial: 'Chemicals',
    rawQty: 10,
    rawCost: 12500,
    paid: 0,
    balance: 12500
};
reconcilePurchase(legacyPurch1, false);
assertEqual(legacyPurch1.paid, 12500, 'Test 51: Legacy purchase paid auto-reconciled to full net cost (12,500)');
assertEqual(legacyPurch1.balance, 0, 'Test 51: Legacy purchase balance due auto-cleared to 0');
assertEqual(legacyPurch1.netBalance, 0, 'Test 51: Legacy purchase net balance is 0');
assertEqual(legacyPurch1.refundDue, 0, 'Test 51: Refund due is 0');

// Test 52: Legacy cosmetics purchase with null/empty paid
const legacyCosPurch = {
    id: 'cospurch_perinthalmanna',
    supplier: 'Oru Kuppi Perinthalmanna',
    item: 'Bottles Bulk',
    qty: 50,
    amount: 12000,
    paid: null,
    balance: 12000
};
reconcilePurchase(legacyCosPurch, true);
assertEqual(legacyCosPurch.paid, 12000, 'Test 52: Cosmetics purchase with null paid auto-reconciled to 12,000');
assertEqual(legacyCosPurch.balance, 0, 'Test 52: Cosmetics balance due is 0');

// Test 53: State normalizePurchases function batch migration
state.purchases = [
    { id: 'p1', supplierName: 'Dealer A', rawCost: 5000, paid: 0, balance: 5000 },
    { id: 'p2', supplierName: 'Dealer B', rawCost: 3000, paid: 3000, balance: 0 }
];
state.cosPurchases = [
    { id: 'cp1', supplier: 'Dealer C', amount: 8000, paid: 0, balance: 8000 }
];
normalizePurchases();
assertEqual(state.purchases[0].paid, 5000, 'Test 53: State batch normalizer auto-pays unmigrated cleaning purchase');
assertEqual(state.purchases[0].balance, 0, 'Test 53: State batch normalizer clears due on cleaning purchase');
assertEqual(state.cosPurchases[0].paid, 8000, 'Test 53: State batch normalizer auto-pays unmigrated cosmetics purchase');
assertEqual(state.cosPurchases[0].balance, 0, 'Test 53: State batch normalizer clears due on cosmetics purchase');

// Test 54: Purchase with return retains correct net calculation
const purchWithReturn = {
    id: 'purch_ret_1',
    supplierName: 'Dealer D',
    rawCost: 1000,
    rawQty: 10,
    rawUnitPrice: 100,
    returns: [{ qty: 2, amount: 200, isCashRefund: true }]
};
reconcilePurchase(purchWithReturn, false);
assertEqual(purchWithReturn.netPurchaseAmount, 800, 'Test 54: Net purchase amount is 800 after 200 return');
assertEqual(purchWithReturn.balance, 0, 'Test 54: Balance due remains 0 on cash refund return');

console.log('\n================================================================');
if (failed === 0) {
    console.log(`✓ ALL ${passed} AUTOMATED TESTS PASSED SUCCESSFULLY!`);
    console.log('✓ Business calculations, reconciliation, and FIFO logic 100% stable.');
    console.log('================================================================\n');
    process.exit(0);
} else {
    console.error(`✕ ${failed} TEST(S) FAILED out of ${passed + failed}!`);
    failures.forEach(f => console.error(`  - ${f.testName}: ${f.details}`));
    console.log('================================================================\n');
    process.exit(1);
}
