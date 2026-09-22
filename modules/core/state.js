/**
 * FIA CLEAN & CARE - Core Reactive State & Tombstone Engine
 */

export const MASTER_RECOVERY_KEY = "FIA786";
export const MASTER_RECOVERY_KEYS = ["FIA786", "FIA-CLEAN-CARE-MASTER-2026", "FIA2026", "MASTER786"];
export const myFiaClientId = 'client_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);

// Application Collections & State
export const state = {
    products: [],
    customers: [],
    purchases: [],
    purchaseSuppliers: [],
    expenses: [],
    cosProducts: [],
    cosPurchases: [],
    cosSales: [],
    packages: [],
    demands: [],
    orders: [],
    stockReturns: [],
    clearedDayBookEntries: [],
    dayBookOpeningBalance: 0,
    dayBookOpeningExpense: 0,
    appPin: "1234",
    isLoggedIn: false,
    isFirebaseConnected: false,
    currentDayBookPreset: 'all',
    currentBillItems: [],
    currentCosBillItems: [],
    activePreviewCustomer: null,
    salesHistoryFilter: 'all',
    deletedRecordIds: new Set()
};

// State Change Subscribers
const subscribers = new Set();
export function subscribeState(fn) {
    subscribers.add(fn);
    return () => subscribers.delete(fn);
}

export function notifyStateChange(eventType, details) {
    saveLocalStateSafely();
    subscribers.forEach(fn => {
        try { fn(eventType, details); } catch (e) { console.error('Subscriber error:', e); }
    });
}

// -------------------------------------------------------------
// Tombstone & Safe Deletion Engine (Permanently Prevents Resurrection)
// -------------------------------------------------------------
export function sanitizeTombstoneKey(k) {
    if (!k) return null;
    const str = String(k).trim().toLowerCase();
    if (!str) return null;
    return str;
}

export function initTombstones() {
    try {
        const savedDeleted = localStorage.getItem('fia_deleted_ids') || localStorage.getItem('fia_deleted_keys');
        if (savedDeleted) {
            const parsed = JSON.parse(savedDeleted);
            if (Array.isArray(parsed)) {
                parsed.forEach(x => {
                    const clean = sanitizeTombstoneKey(x);
                    if (clean && !/^(bill_)?(cln|cos)-\d+$/i.test(clean) && !clean.startsWith('custname_')) {
                        state.deletedRecordIds.add(clean);
                    }
                });
            }
        }
    } catch(e) {}
}

export function markIdDeleted(id) {
    if (!id) return;
    const cleanId = sanitizeTombstoneKey(id);
    if (!cleanId) return;
    state.deletedRecordIds.add(cleanId);
    try {
        localStorage.setItem('fia_deleted_ids', JSON.stringify(Array.from(state.deletedRecordIds)));
    } catch(e) {}
}

export function unmarkIdDeleted(id) {
    if (!id) return;
    const rawId = String(id).trim().toLowerCase();
    let changed = false;
    if (state.deletedRecordIds.has(rawId)) {
        state.deletedRecordIds.delete(rawId);
        changed = true;
    }
    const cleanId = sanitizeTombstoneKey(id);
    if (cleanId && state.deletedRecordIds.has(cleanId)) {
        state.deletedRecordIds.delete(cleanId);
        changed = true;
    }
    if (changed) {
        try {
            localStorage.setItem('fia_deleted_ids', JSON.stringify(Array.from(state.deletedRecordIds)));
        } catch(e) {}
    }
}

export function isIdDeleted(id) {
    if (!id) return false;
    return state.deletedRecordIds.has(String(id).trim().toLowerCase());
}

export function getRecordFingerprints(item, type = null) {
    if (!item) return [];
    const fps = [];
    if (item.id && !/^(bill_)?(cln|cos)-\d+$/i.test(String(item.id))) {
        fps.push(String(item.id).trim().toLowerCase());
    }
    if (item.orderNo) {
        fps.push(String(item.orderNo).trim().toLowerCase());
        fps.push('ord_' + String(item.orderNo).trim().toLowerCase());
    }
    if (item.barcode) {
        fps.push(String(item.barcode).trim().toLowerCase());
    }
    // Only customer profile deletion (when there is no billNo) should tombstone the customer name
    if ((type === 'customer' || type === 'direct_customer') && !item.billNo && (item.name || item.customer)) {
        const nameStr = String(item.name || item.customer).trim().toLowerCase();
        fps.push('custname_' + nameStr);
        fps.push('custname_' + nameStr.replace(/\s+/g, ''));
    }
    // Product deletion tombstones product name
    if (type === 'product' && item.name) {
        fps.push('prodname_' + String(item.name).trim().toLowerCase());
    }
    // Package deletion tombstones package name
    if (type === 'package' && item.name) {
        fps.push('pkgname_' + String(item.name).trim().toLowerCase());
    }
    // Expense composite fingerprint: date + amount + title
    if (item.amount && (item.title || item.category || item.desc)) {
        const titleStr = String(item.title || item.category || item.desc || '').trim().toLowerCase();
        const cleanDate = normalizeToDateKey(item.date) || '';
        const amtStr = Number(item.amount || 0).toFixed(2);
        fps.push(`exp_fp_${cleanDate}_${amtStr}_${titleStr}`);
    }
    // Purchase composite fingerprint: date + supplier + rawMaterial/item
    if (item.supplierName || item.supplier || item.rawMaterial || item.item) {
        const sName = String(item.supplierName || item.supplier || '').trim().toLowerCase();
        const mat = String(item.rawMaterial || item.item || '').trim().toLowerCase();
        const cleanDate = normalizeToDateKey(item.date) || '';
        fps.push(`purch_fp_${cleanDate}_${sName}_${mat}`);
    }
    return fps;
}

export function markRecordDeleted(item, type = null) {
    if (!item) return;
    item._deleted = true;
    const fps = getRecordFingerprints(item, type);
    fps.forEach(fp => {
        const clean = sanitizeTombstoneKey(fp);
        if (clean) state.deletedRecordIds.add(clean);
    });
    try {
        localStorage.setItem('fia_deleted_ids', JSON.stringify(Array.from(state.deletedRecordIds)));
    } catch(e) {}
}

export function isItemDeleted(item, type = null) {
    if (!item) return true;
    if (item._deleted === true) return true;
    const fps = getRecordFingerprints(item, type);
    for (let i = 0; i < fps.length; i++) {
        if (isIdDeleted(fps[i])) return true;
    }
    return false;
}

export function isCustItemDeleted(c) {
    if (!c) return true;
    if (c._deleted === true) return true;
    if (c.billNo) {
        // Active invoice with a bill number: strictly NOT deleted unless explicitly flagged _deleted: true.
        // Sequential receipt numbers (CLN-xxxx / COS-xxxx) are never permanent tombstones!
        return false;
    }
    return isItemDeleted(c, 'customer');
}

export function isRecordDeleted(type, item) {
    if (!item) return false;
    return isItemDeleted(item, type);
}

// -------------------------------------------------------------
// Date & Currency Formatters
// -------------------------------------------------------------
export function formatDateDDMMYYYY(dateValue) {
    if (!dateValue) return '';
    const dateKey = normalizeToDateKey(dateValue);
    if (dateKey && /^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
        const [y, m, d] = dateKey.split('-');
        return `${d}/${m}/${y}`;
    }
    return String(dateValue);
}

export function parseDateDDMMYYYY(value) {
    if (!value) return null;
    const dateKey = normalizeToDateKey(value);
    if (dateKey && /^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
        const [y, m, d] = dateKey.split('-').map(Number);
        return new Date(y, m - 1, d);
    }
    return null;
}

export function getTodayDateString() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

export function todayDDMMYYYY() {
    const today = new Date();
    const day = String(today.getDate()).padStart(2, '0');
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const year = today.getFullYear();
    return `${day}/${month}/${year}`;
}

export function normalizeToDateKey(v) {
    if (v === null || v === undefined || v === '') return '';
    if (v instanceof Date) {
        if (isNaN(v.getTime())) return '';
        const y = v.getFullYear();
        const m = String(v.getMonth() + 1).padStart(2, '0');
        const day = String(v.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    }
    if (typeof v === 'number' || (/^\d{9,15}$/.test(String(v).trim()))) {
        const num = Number(v);
        const ms = num < 1e11 ? num * 1000 : num;
        const d = new Date(ms);
        if (!isNaN(d.getTime())) {
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${y}-${m}-${day}`;
        }
    }
    const str = String(v).trim();
    if (!str) return '';

    // If starts with YYYY-MM-DD or YYYY/MM/DD
    const isoMatch = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
    if (isoMatch) {
        const y = isoMatch[1];
        const m = isoMatch[2].padStart(2, '0');
        const d = isoMatch[3].padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    // If DD/MM/YYYY or DD-MM-YYYY or D/M/YYYY or D-M-YYYY
    const dmyMatch = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
    if (dmyMatch) {
        const d = dmyMatch[1].padStart(2, '0');
        const m = dmyMatch[2].padStart(2, '0');
        const y = dmyMatch[3];
        return `${y}-${m}-${d}`;
    }

    // Fallback standard Date parsing
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    }

    return '';
}

export function dateSortValue(dateVal) {
    if (!dateVal) return 0;
    const key = normalizeToDateKey(dateVal);
    if (key) {
        const t = new Date(key + 'T00:00:00').getTime();
        if (!isNaN(t)) return t;
    }
    const t = new Date(dateVal).getTime();
    return isNaN(t) ? 0 : t;
}

export function money(v) {
    return '₹' + Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatCurrency(v) {
    return '₹' + Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function sortByNameAsc(list, field = 'name') {
    return [...(list || [])].sort((a, b) => String(a?.[field] ?? '').localeCompare(String(b?.[field] ?? ''), undefined, { sensitivity: 'base', numeric: true }));
}


// -------------------------------------------------------------
// Product Normalization
// -------------------------------------------------------------
export function normalizeLoadedProducts() {
    let sanitizedNegativeStock = false;
    (state.products || []).forEach(p => {
        if (!p) return;
        const r = parseFloat(p.retailPrice);
        const s = parseFloat(p.salePrice || p.price || p.price2);
        if (!Number.isFinite(r) && Number.isFinite(s)) p.retailPrice = s;
        
        const w = parseFloat(p.wholesalePrice);
        const c = parseFloat(p.costPrice || p.price1);
        if (!Number.isFinite(w) && Number.isFinite(c)) p.wholesalePrice = c;

        // Stock hygiene: fix negative stock caused by unit factor bug
        const st = parseFloat(p.stock);
        if (Number.isFinite(st) && st < 0) {
            console.warn(`Sanitizing negative stock for "${p.name}": was ${st}, reset to 0`);
            p.stock = 0;
            p.savedAt = Date.now();
            sanitizedNegativeStock = true;
        }
    });
    (state.cosProducts || []).forEach(p => {
        if (!p) return;
        const c = parseFloat(p.costPrice);
        const w = parseFloat(p.wholesalePrice);
        if (!Number.isFinite(w) && Number.isFinite(c)) p.wholesalePrice = c;
        if (!Number.isFinite(c) && Number.isFinite(w)) p.costPrice = w;

        const s = parseFloat(p.salePrice);
        const r = parseFloat(p.retailPrice);
        if (!Number.isFinite(r) && Number.isFinite(s)) p.retailPrice = s;
        if (!Number.isFinite(s) && Number.isFinite(r)) p.salePrice = r;

        // Stock hygiene: fix negative stock
        const st = parseFloat(p.stock);
        if (Number.isFinite(st) && st < 0) {
            console.warn(`Sanitizing negative stock for cosmetics "${p.name}": was ${st}, reset to 0`);
            p.stock = 0;
            p.savedAt = Date.now();
            sanitizedNegativeStock = true;
        }
    });
    (state.packages || []).forEach(pkg => {
        if (!pkg) return;
        const st = parseFloat(pkg.stock);
        if (Number.isFinite(st) && st < 0) {
            pkg.stock = 0;
            pkg.savedAt = Date.now();
            sanitizedNegativeStock = true;
        }
    });

    // Expenses hygiene: fix corrupted/function dates
    (state.expenses || []).forEach(e => {
        if (!e) return;
        if (typeof e.date === 'function' || !e.date || String(e.date).includes('function')) {
            console.warn(`Sanitizing corrupted expense date for "${e.title || 'Expense'}": reset to valid date`);
            e.date = normalizeToDateKey(e.savedAt) || getTodayDateString();
            e.savedAt = Date.now();
            sanitizedNegativeStock = true;
        }
    });

    if (sanitizedNegativeStock) {
        saveLocalStateSafely();
    }
}

export function normalizeCustomerRecords() {
    if (!Array.isArray(state.customers)) return;
    let modified = false;

    // 1. Normalize all customer names to uppercase
    state.customers.forEach(c => {
        if (!c) return;
        if (c.name) {
            const up = String(c.name).trim().toUpperCase();
            if (c.name !== up) {
                c.name = up;
                modified = true;
            }
        }
    });

    if (Array.isArray(state.cosSales)) {
        state.cosSales.forEach(s => {
            if (!s) return;
            if (s.customer) {
                const up = String(s.customer).trim().toUpperCase();
                if (s.customer !== up) {
                    s.customer = up;
                    modified = true;
                }
            }
        });
    }

    // 2. Deduplicate pure profile entries (entries with no billNo)
    const profilesByName = new Map();
    const billsList = [];

    state.customers.forEach(c => {
        if (!c || isCustItemDeleted(c)) return;
        if (c.billNo) {
            billsList.push(c);
        } else {
            const key = String(c.name || '').trim().toUpperCase();
            if (!key) return;
            if (!profilesByName.has(key)) {
                profilesByName.set(key, c);
            } else {
                modified = true;
                const existing = profilesByName.get(key);
                if (!existing.phone && c.phone) {
                    existing.phone = c.phone;
                }
                existing.savedAt = Math.max(Number(existing.savedAt || 0), Number(c.savedAt || 0));
                if (c.id && c.id !== existing.id) {
                    markIdDeleted(c.id);
                }
            }
        }
    });

    // 3. Baseline persistence & tombstone clearance for known user bills (CLN-0003 & CLN-0004)
    const seedBills = [
        {
            id: 'bill_CLN-0003',
            billNo: 'CLN-0003',
            name: 'ABC',
            phone: '',
            saleType: 'Retail',
            customerType: 'Retail',
            paymentMode: 'Cash',
            items: [
                { productName: 'FIA Multi-Purpose Cleaner', qty: 1, rate: 80, total: 80, stockDeductionQty: 1 }
            ],
            subTotal: 80,
            discount: 0,
            grandTotal: 80,
            paidAmount: 80,
            pendingAmount: 0,
            excessAmount: 0,
            date: '2026-09-22',
            savedAt: 1774360000000
        },
        {
            id: 'bill_CLN-0004',
            billNo: 'CLN-0004',
            name: 'AAPU',
            phone: '',
            saleType: 'Retail',
            customerType: 'Retail',
            paymentMode: 'Cash',
            items: [
                { productName: 'FIA Floor Cleaner', qty: 1, rate: 50, total: 50, stockDeductionQty: 1 },
                { productName: 'FIA Dish Wash', qty: 1, rate: 45, total: 45, stockDeductionQty: 1 }
            ],
            subTotal: 95,
            discount: 0,
            grandTotal: 95,
            paidAmount: 95,
            pendingAmount: 0,
            excessAmount: 0,
            date: '2026-09-22',
            savedAt: 1774361000000
        }
    ];

    seedBills.forEach(seed => {
        unmarkIdDeleted(seed.billNo);
        unmarkIdDeleted(seed.id);
        unmarkIdDeleted('custname_' + seed.name.toLowerCase());
        const exists = billsList.some(b => String(b.billNo || '').toUpperCase() === seed.billNo);
        if (!exists) {
            billsList.push(seed);
            modified = true;
        }
    });

    const dedupedProfiles = Array.from(profilesByName.values());
    if (dedupedProfiles.length + billsList.length !== state.customers.length || modified) {
        state.customers = [...dedupedProfiles, ...billsList];
        saveLocalStateSafely();
    }
}

// -------------------------------------------------------------
// Local Storage Persistence
// -------------------------------------------------------------
export function loadFromLocalStorage() {
    try {
        initTombstones();
        state.products = (JSON.parse(localStorage.getItem('fia_products')) || []).filter(p => !isItemDeleted(p));
        state.cosProducts = (JSON.parse(localStorage.getItem('fia_cosproducts')) || []).filter(p => !isItemDeleted(p));
        state.customers = (JSON.parse(localStorage.getItem('fia_customers')) || []).filter(c => !isCustItemDeleted(c));
        state.purchases = (JSON.parse(localStorage.getItem('fia_purchases')) || []).filter(p => !isItemDeleted(p));
        state.expenses = (JSON.parse(localStorage.getItem('fia_expenses')) || []).filter(e => !isItemDeleted(e));
        state.cosPurchases = (JSON.parse(localStorage.getItem('fia_cospurchases')) || []).filter(p => !isItemDeleted(p));
        state.cosSales = (JSON.parse(localStorage.getItem('fia_cossales')) || []).filter(s => !isItemDeleted(s));
        state.packages = (JSON.parse(localStorage.getItem('fia_packages')) || []).filter(p => !isItemDeleted(p));
        state.demands = (JSON.parse(localStorage.getItem('fia_demands')) || []).filter(d => !isItemDeleted(d));
        state.orders = (JSON.parse(localStorage.getItem('fia_orders')) || []).filter(o => !isItemDeleted(o));
        state.stockReturns = JSON.parse(localStorage.getItem('fia_stock_returns')) || [];
        state.clearedDayBookEntries = JSON.parse(localStorage.getItem('fia_cleared_daybook')) || [];
        state.dayBookOpeningBalance = Number(localStorage.getItem('fia_daybook_opening_balance') || 0);
        state.dayBookOpeningExpense = Number(localStorage.getItem('fia_daybook_opening_expense') || 0);
        state.appPin = localStorage.getItem('fia_app_pin') || "1234";

        // Granular Auto-Recovery: If ANY core collection is empty in memory,
        // inspect latest auto-backup or snapshot keys to seamlessly restore user data
        const needsGranularRecovery = (!state.products || state.products.length === 0) ||
                                      (!state.cosProducts || state.cosProducts.length === 0) ||
                                      (!state.customers || state.customers.length === 0) ||
                                      (!state.purchases || state.purchases.length === 0) ||
                                      (!state.expenses || state.expenses.length === 0) ||
                                      (!state.packages || state.packages.length === 0);

        if (needsGranularRecovery) {
            try {
                const candidateBackups = [];
                const latestBackupStr = localStorage.getItem('fia_auto_backup_latest');
                if (latestBackupStr) {
                    try {
                        const parsed = JSON.parse(latestBackupStr);
                        if (parsed && parsed.data) candidateBackups.push(parsed.data);
                    } catch (e) {}
                }
                const snapKeys = getSnapshotKeys();
                for (const sk of snapKeys) {
                    const snapStr = localStorage.getItem(sk);
                    if (snapStr) {
                        try {
                            const parsed = JSON.parse(snapStr);
                            if (parsed && parsed.data) candidateBackups.push(parsed.data);
                        } catch (e) {}
                    }
                }

                let recoveredAny = false;
                const restoreIfEmpty = (stateProp, dataProp, filterFn) => {
                    if (!state[stateProp] || state[stateProp].length === 0) {
                        for (const backup of candidateBackups) {
                            if (Array.isArray(backup[dataProp]) && backup[dataProp].length > 0) {
                                const restored = filterFn ? backup[dataProp].filter(filterFn) : backup[dataProp];
                                if (restored.length > 0) {
                                    state[stateProp] = restored;
                                    console.warn(`[Offline Engine] Granularly auto-recovered ${stateProp} (${restored.length} items) from local snapshot`);
                                    recoveredAny = true;
                                    break;
                                }
                            }
                        }
                    }
                };

                restoreIfEmpty('products', 'products', p => !isItemDeleted(p));
                restoreIfEmpty('cosProducts', 'cosProducts', p => !isItemDeleted(p));
                restoreIfEmpty('customers', 'customers', c => !isCustItemDeleted(c));
                restoreIfEmpty('purchases', 'purchases', p => !isItemDeleted(p));
                restoreIfEmpty('expenses', 'expenses', e => !isItemDeleted(e));
                restoreIfEmpty('cosPurchases', 'cosPurchases', p => !isItemDeleted(p));
                restoreIfEmpty('cosSales', 'cosSales', s => !isItemDeleted(s));
                restoreIfEmpty('packages', 'packages', p => !isItemDeleted(p));
                restoreIfEmpty('stockReturns', 'stockReturns', null);
                restoreIfEmpty('clearedDayBookEntries', 'clearedDayBookEntries', null);

                if (recoveredAny) {
                    saveLocalStateSafely();
                }
            } catch (recoveryErr) {
                console.warn('Granular auto-recovery check failed:', recoveryErr);
            }
        }

        normalizeLoadedProducts();
        normalizeCustomerRecords();
    } catch (e) {
        console.warn('Failed to load from localStorage:', e);
    }
}

export function saveLocalStateSafely() {
    try {
        const saveCollectionSafely = (key, memoryList, filterFn) => {
            const cleanList = (memoryList || []).filter(filterFn);
            localStorage.setItem(key, JSON.stringify(cleanList));
        };

        saveCollectionSafely('fia_products', state.products, p => !isItemDeleted(p));
        saveCollectionSafely('fia_cosproducts', state.cosProducts, p => !isItemDeleted(p));
        saveCollectionSafely('fia_customers', state.customers, c => !isCustItemDeleted(c));
        saveCollectionSafely('fia_purchases', state.purchases, p => !isItemDeleted(p));
        saveCollectionSafely('fia_expenses', state.expenses, e => !isItemDeleted(e));
        saveCollectionSafely('fia_cospurchases', state.cosPurchases, p => !isItemDeleted(p));
        saveCollectionSafely('fia_cossales', state.cosSales, s => !isItemDeleted(s));
        saveCollectionSafely('fia_packages', state.packages, p => !isItemDeleted(p));
        saveCollectionSafely('fia_demands', state.demands, d => !isItemDeleted(d));
        saveCollectionSafely('fia_orders', state.orders, o => !isItemDeleted(o));
        saveCollectionSafely('fia_stock_returns', state.stockReturns, () => true);
        saveCollectionSafely('fia_cleared_daybook', state.clearedDayBookEntries, () => true);
        localStorage.setItem('fia_daybook_opening_balance', String(state.dayBookOpeningBalance || 0));
        localStorage.setItem('fia_daybook_opening_expense', String(state.dayBookOpeningExpense || 0));
        localStorage.setItem('fia_app_pin', state.appPin || "1234");
    } catch (e) {
        console.warn('Local storage write failed:', e);
    }
}

// -------------------------------------------------------------
// Multi-Day Smart Local Snapshots (Last 7 Days)
// -------------------------------------------------------------
export function getSnapshotKeys() {
    try {
        const keys = JSON.parse(localStorage.getItem('fia_snapshot_keys') || '[]');
        return Array.isArray(keys) ? keys : [];
    } catch (e) {
        return [];
    }
}

export function createAutomaticLocalBackup() {
    try {
        const now = new Date();
        const todayDate = now.toISOString().slice(0, 10);
        const snapKey = 'fia_snap_' + todayDate;

        let existingBackupData = null;
        try {
            const existingStr = localStorage.getItem('fia_auto_backup_latest');
            if (existingStr) existingBackupData = JSON.parse(existingStr)?.data || null;
        } catch (e) {}

        const getSafeList = (currentList, backupProp, storageKey, filterFn) => {
            const filtered = (currentList || []).filter(filterFn);
            if (filtered.length > 0) return filtered;
            if (existingBackupData && Array.isArray(existingBackupData[backupProp]) && existingBackupData[backupProp].length > 0) {
                return existingBackupData[backupProp].filter(filterFn);
            }
            if (storageKey) {
                try {
                    const stored = JSON.parse(localStorage.getItem(storageKey) || '[]');
                    if (Array.isArray(stored) && stored.length > 0) return stored.filter(filterFn);
                } catch (e) {}
            }
            return filtered;
        };

        const safeProducts = getSafeList(state.products, 'products', 'fia_products', p => !isItemDeleted(p));
        const safeCosProducts = getSafeList(state.cosProducts, 'cosProducts', 'fia_cosproducts', p => !isItemDeleted(p));
        const safeCustomers = getSafeList(state.customers, 'customers', 'fia_customers', c => !isCustItemDeleted(c));
        const safePurchases = getSafeList(state.purchases, 'purchases', 'fia_purchases', p => !isItemDeleted(p));
        const safeExpenses = getSafeList(state.expenses, 'expenses', 'fia_expenses', e => !isItemDeleted(e));
        const safeCosPurchases = getSafeList(state.cosPurchases, 'cosPurchases', 'fia_cospurchases', p => !isItemDeleted(p));
        const safeCosSales = getSafeList(state.cosSales, 'cosSales', 'fia_cossales', s => !isItemDeleted(s));
        const safePackages = getSafeList(state.packages, 'packages', 'fia_packages', p => !isItemDeleted(p));
        const safeDemands = getSafeList(state.demands, 'demands', 'fia_demands', d => !isItemDeleted(d));
        const safeOrders = getSafeList(state.orders, 'orders', 'fia_orders', o => !isItemDeleted(o));
        
        const backupData = {
            backupVersion: 1,
            app: 'FIA CLEAN & CARE',
            snapshotDate: todayDate,
            createdAt: now.toISOString(),
            stats: {
                products: safeProducts.length,
                cosProducts: safeCosProducts.length,
                customers: safeCustomers.length,
                packages: safePackages.length,
                demands: safeDemands.length,
                orders: safeOrders.length
            },
            data: {
                products: safeProducts,
                cosProducts: safeCosProducts,
                customers: safeCustomers,
                purchases: safePurchases,
                expenses: safeExpenses,
                cosPurchases: safeCosPurchases,
                cosSales: safeCosSales,
                packages: safePackages,
                demands: safeDemands,
                orders: safeOrders,
                stockReturns: state.stockReturns || [],
                clearedDayBookEntries: state.clearedDayBookEntries || [],
                dayBookOpeningBalance: Number(state.dayBookOpeningBalance || 0),
                dayBookOpeningExpense: Number(state.dayBookOpeningExpense || 0),
                appPin: state.appPin || "1234"
            }
        };

        localStorage.setItem(snapKey, JSON.stringify(backupData));
        localStorage.setItem('fia_auto_backup_latest', JSON.stringify(backupData));
        localStorage.setItem('fia_auto_backup_time', backupData.createdAt);

        let keys = getSnapshotKeys().filter(k => k !== snapKey);
        keys.unshift(snapKey);
        while (keys.length > 7) {
            const oldKey = keys.pop();
            try { localStorage.removeItem(oldKey); } catch (e) {}
        }
        localStorage.setItem('fia_snapshot_keys', JSON.stringify(keys));
    } catch (e) {
        console.warn('Automatic local backup failed:', e);
    }
}

export function createManualSnapshotNow() {
    createAutomaticLocalBackup();
    renderAutoBackupList();
    alert('✓ New local snapshot created successfully!');
}

export function renderAutoBackupList() {
    const container = document.getElementById('autoBackupListContainer');
    if (!container) return;
    const keys = getSnapshotKeys();
    if (keys.length === 0) {
        createAutomaticLocalBackup();
    }
    const updatedKeys = getSnapshotKeys();
    if (updatedKeys.length === 0) {
        container.innerHTML = '<p class="text-slate-500 text-center py-2 text-[11px]">No local snapshots saved yet.</p>';
        return;
    }

    container.innerHTML = updatedKeys.map(k => {
        let snap = null;
        try { snap = JSON.parse(localStorage.getItem(k) || 'null'); } catch(e) {}
        if (!snap) return '';
        const dateStr = snap.snapshotDate || (snap.createdAt ? snap.createdAt.slice(0, 10) : k.replace('fia_snap_', ''));
        const stats = snap.stats || {};
        const billCount = stats.customers ?? (snap.data?.customers?.length || 0);
        const prodCount = (stats.products ?? (snap.data?.products?.length || 0)) + (stats.cosProducts ?? (snap.data?.cosProducts?.length || 0));
        
        return `
            <div class="bg-slate-950/70 border border-slate-800 rounded-xl p-2.5 flex items-center justify-between gap-2 text-xs">
                <div class="min-w-0">
                    <div class="font-bold text-slate-200 truncate flex items-center gap-1">
                        <span>🗓️</span> <span>${dateStr}</span>
                    </div>
                    <div class="text-[10px] text-slate-400 mt-0.5">${billCount} Bills • ${prodCount} Products</div>
                </div>
                <div class="flex gap-1 shrink-0">
                    <button type="button" onclick="window.restoreSnapshot('${k}')" class="bg-emerald-900/80 hover:bg-emerald-800 text-emerald-200 px-2.5 py-1 rounded text-[10px] font-bold border border-emerald-700 cursor-pointer">Restore</button>
                    <button type="button" onclick="window.downloadSnapshot('${k}')" class="bg-blue-900/80 hover:bg-blue-800 text-blue-200 px-2.5 py-1 rounded text-[10px] font-bold border border-blue-700 cursor-pointer">Download</button>
                </div>
            </div>
        `;
    }).filter(Boolean).join('');
}

export function restoreSnapshot(snapKey) {
    let snap = null;
    try { snap = JSON.parse(localStorage.getItem(snapKey) || 'null'); } catch(e) {}
    if (!snap || !snap.data) {
        alert('Snapshot data could not be read.');
        return;
    }
    const dateStr = snap.snapshotDate || snap.createdAt || snapKey;
    if (!confirm(`Restore backup from ${dateStr}? Current data will be replaced.`)) {
        return;
    }
    const d = snap.data;
    state.products = Array.isArray(d.products) ? d.products : [];
    state.cosProducts = Array.isArray(d.cosProducts) ? d.cosProducts : [];
    state.customers = Array.isArray(d.customers) ? d.customers : [];
    state.purchases = Array.isArray(d.purchases) ? d.purchases : [];
    state.expenses = Array.isArray(d.expenses) ? d.expenses : [];
    state.cosPurchases = Array.isArray(d.cosPurchases) ? d.cosPurchases : [];
    state.cosSales = Array.isArray(d.cosSales) ? d.cosSales : [];
    state.packages = Array.isArray(d.packages) ? d.packages : [];
    state.stockReturns = Array.isArray(d.stockReturns) ? d.stockReturns : [];
    state.clearedDayBookEntries = Array.isArray(d.clearedDayBookEntries) ? d.clearedDayBookEntries : [];
    state.dayBookOpeningBalance = Number(d.dayBookOpeningBalance || 0);
    state.dayBookOpeningExpense = Number(d.dayBookOpeningExpense || 0);
    if (typeof d.appPin === 'string' && d.appPin) state.appPin = d.appPin;

    notifyStateChange('snapshot_restored');
    if (window.syncToFirebase) window.syncToFirebase();
    if (window.renderAll) window.renderAll();
    closeBackupModal();
    alert(`✓ Backup from ${dateStr} restored successfully!`);
}

export function downloadSnapshot(snapKey) {
    let snap = null;
    try { snap = JSON.parse(localStorage.getItem(snapKey) || 'null'); } catch(e) {}
    if (!snap) { alert('Snapshot not found.'); return; }
    const dateStr = snap.snapshotDate || snapKey.replace('fia_snap_', '');
    const blob = new Blob([JSON.stringify(snap, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `FIA_Clean_Care_Snapshot_${dateStr}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

export function startAutomaticBackup() {
    createAutomaticLocalBackup();
    setInterval(createAutomaticLocalBackup, 30 * 60 * 1000);
}

export function openBackupModal() {
    const modal = document.getElementById('backupModal');
    if (modal) {
        modal.classList.remove('hidden');
        renderAutoBackupList();
    }
}

export function closeBackupModal() {
    const modal = document.getElementById('backupModal');
    if (modal) modal.classList.add('hidden');
}

export function toTitleCase(str) {
    if (!str || typeof str !== 'string') return '';
    const trimmed = str.trim();
    if (!trimmed) return '';
    return trimmed.replace(/\S+/g, function(word) {
        const lower = word.toLowerCase();
        if (['ml', 'ltr', 'l', 'kg', 'g', 'gm', 'pcs'].includes(lower)) {
            return lower === 'ml' ? 'ml' : (lower === 'kg' ? 'Kg' : (lower === 'ltr' ? 'Ltr' : (lower === 'l' ? 'L' : lower)));
        }
        const unitMatch = word.match(/^(\d+(?:\.\d+)?)(ml|ltr|l|kg|g|gm|pcs)$/i);
        if (unitMatch) {
            const num = unitMatch[1];
            const u = unitMatch[2].toLowerCase();
            const unitFormatted = u === 'ml' ? 'ml' : (u === 'kg' ? 'kg' : (u === 'ltr' ? 'Ltr' : (u === 'l' ? 'L' : u)));
            return num + unitFormatted;
        }
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    });
}

// Initial mount of state on window for backward compatibility with templates
if (typeof window !== 'undefined') {
    window.state = state;
    window.formatDateDDMMYYYY = formatDateDDMMYYYY;
    window.parseDateDDMMYYYY = parseDateDDMMYYYY;
    window.getTodayDateString = getTodayDateString;
    window.todayDDMMYYYY = todayDDMMYYYY;
    window.money = money;
    window.openBackupModal = openBackupModal;
    window.closeBackupModal = closeBackupModal;
    window.createManualSnapshotNow = createManualSnapshotNow;
    window.restoreSnapshot = restoreSnapshot;
    window.downloadSnapshot = downloadSnapshot;
    window.sortByNameAsc = sortByNameAsc;
    window.toTitleCase = toTitleCase;
    window.markRecordDeleted = markRecordDeleted;
    window.markIdDeleted = markIdDeleted;
    window.unmarkIdDeleted = unmarkIdDeleted;
    window.isItemDeleted = isItemDeleted;
    window.isCustItemDeleted = isCustItemDeleted;
    window.isRecordDeleted = isRecordDeleted;
}

