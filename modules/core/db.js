/**
 * FIA CLEAN & CARE - Firebase Realtime Database Sync & Tombstone Engine
 */

import {
    state,
    myFiaClientId,
    sanitizeTombstoneKey,
    markIdDeleted,
    isItemDeleted,
    isCustItemDeleted,
    isRecordDeleted,
    saveLocalStateSafely,
    createAutomaticLocalBackup,
    normalizeLoadedProducts,
    normalizeCustomerRecords
} from './state.js';

export function ensureFirebaseAuth() {
    if (!window.FB_AUTH) return Promise.resolve(null);
    if (window.FB_AUTH.currentUser) return Promise.resolve(window.FB_AUTH.currentUser);
    if (typeof window.ensureFirebaseAuth === 'function') {
        return window.ensureFirebaseAuth();
    }
    const persistence = (window.firebase && firebase.auth && firebase.auth.Auth && firebase.auth.Auth.Persistence)
        ? window.FB_AUTH.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(() => {})
        : Promise.resolve();
    return persistence.then(() => {
        if (window.FB_AUTH.currentUser) return window.FB_AUTH.currentUser;
        return window.FB_AUTH.signInAnonymously().then(c => c.user).catch(() => null);
    });
}

export function updateSyncStatus(connected, customText) {
    const el = document.getElementById('syncStatus');
    const syncBadge = document.getElementById('dashboardSyncBadge');
    const bottomBanner = document.getElementById('offlinePwaBanner');

    if (bottomBanner) {
        if (connected) {
            bottomBanner.classList.add('hidden');
        } else {
            bottomBanner.classList.remove('hidden');
        }
    }

    if (el) {
        if (connected === true) {
            const text = customText || 'Cloud Data Synchronized';
            el.innerHTML = `<span class="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span> ${text}`;
            el.className = 'inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-300 shadow-xs whitespace-nowrap min-w-0 transition-colors';
        } else if (connected === false) {
            const text = customText || 'Working under offline mode';
            el.innerHTML = `<span class="w-2 h-2 rounded-full bg-rose-500 shrink-0 animate-pulse"></span> ${text}`;
            el.className = 'inline-flex items-center gap-1.5 text-[11px] font-bold text-rose-800 bg-rose-50 px-2.5 py-1 rounded-full border border-rose-300 shadow-xs whitespace-nowrap min-w-0 transition-colors';
        } else {
            // connecting / syncing
            const text = customText || 'Connecting to Cloud Database...';
            el.innerHTML = `<span class="w-2 h-2 rounded-full bg-amber-500 shrink-0 animate-pulse"></span> ${text}`;
            el.className = 'inline-flex items-center gap-1.5 text-[11px] font-bold text-amber-800 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-300 shadow-xs whitespace-nowrap min-w-0 transition-colors';
        }
    }

    if (syncBadge) {
        if (connected === true) {
            syncBadge.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> Direct Sync Active';
            syncBadge.className = 'mt-1 inline-flex items-center gap-1.5 text-[10px] font-bold text-emerald-300 bg-emerald-950/60 border border-emerald-800/60 px-2.5 py-1.5 rounded-full';
        } else if (connected === false) {
            syncBadge.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-rose-400"></span> Offline Mode';
            syncBadge.className = 'mt-1 inline-flex items-center gap-1.5 text-[10px] font-bold text-rose-300 bg-rose-950/40 border border-rose-800/50 px-2.5 py-1.5 rounded-full';
        } else {
            syncBadge.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span> Connecting...';
            syncBadge.className = 'mt-1 inline-flex items-center gap-1.5 text-[10px] font-bold text-amber-300 bg-amber-950/40 border border-amber-800/50 px-2.5 py-1.5 rounded-full';
        }
    }
}

export function ensureStableTransactionIds() {
    const stamp = Date.now();
    (state.products || []).forEach((p, idx) => {
        if (!p) return;
        if (!p.id) p.id = 'prod_' + (stamp + idx);
    });
    (state.cosProducts || []).forEach((p, idx) => {
        if (!p) return;
        if (!p.id) p.id = 'cp_' + (stamp + idx);
    });
    (state.packages || []).forEach((p, idx) => {
        if (!p) return;
        if (!p.id) p.id = 'pkg_' + (stamp + idx);
    });
    (state.customers || []).forEach((c, idx) => {
        if (!c) return;
        if (!c.id && !c.billNo) c.id = 'cust_' + (stamp + idx);
        if (!c.savedAt) c.savedAt = stamp + idx;
    });
    (state.purchases || []).forEach((p, idx) => {
        if (!p) return;
        if (!p.id) p.id = 'purch_' + (stamp + idx);
        if (!p.savedAt) p.savedAt = stamp + idx;
    });
    (state.expenses || []).forEach((e, idx) => {
        if (!e) return;
        if (!e.id) e.id = 'exp_' + (stamp + idx);
        if (!e.savedAt) e.savedAt = stamp + idx;
    });
    (state.cosPurchases || []).forEach((p, idx) => {
        if (!p) return;
        if (!p.id) p.id = 'cospurch_' + (stamp + idx);
        if (!p.savedAt) p.savedAt = stamp + idx;
    });
    (state.cosSales || []).forEach((s, idx) => {
        if (!s) return;
        if (!s.id && !s.billNo) s.id = 'cossale_' + (stamp + idx);
        if (!s.savedAt) s.savedAt = stamp + idx;
    });
    (state.stockReturns || []).forEach((r, idx) => {
        if (!r) return;
        if (!r.id) r.id = 'ret_' + (stamp + idx);
        if (!r.savedAt) r.savedAt = stamp + idx;
    });
    (state.demands || []).forEach((d, idx) => {
        if (!d) return;
        if (!d.id) d.id = 'dem_' + (stamp + idx);
        if (!d.savedAt) d.savedAt = stamp + idx;
    });
    (state.orders || []).forEach((o, idx) => {
        if (!o) return;
        if (!o.id) o.id = 'ord_' + (stamp + idx);
        if (!o.savedAt) o.savedAt = stamp + idx;
    });
}

export function mergeInventoryProducts(localList, cloudList) {
    const map = new Map();
    const nameToId = new Map();
    const rawCloud = Array.isArray(cloudList) ? cloudList : Object.values(cloudList || {});
    rawCloud.forEach(item => {
        if (!item || isRecordDeleted(null, item)) return;
        const idKey = String(item.id || '').trim();
        const nameKey = String(item.name || '').trim().toLowerCase();
        if (idKey) {
            map.set(idKey, item);
            if (nameKey) nameToId.set(nameKey, idKey);
        } else if (nameKey) {
            map.set(nameKey, item);
        }
    });

    const rawLocal = Array.isArray(localList) ? localList : Object.values(localList || {});
    rawLocal.forEach(item => {
        if (!item || isRecordDeleted(null, item)) return;
        const idKey = String(item.id || '').trim();
        const nameKey = String(item.name || '').trim().toLowerCase();

        let targetKey = idKey;
        let existing = idKey ? map.get(idKey) : null;
        if (!existing && nameKey && nameToId.has(nameKey)) {
            targetKey = nameToId.get(nameKey);
            existing = map.get(targetKey);
        }
        if (!existing && nameKey && map.has(nameKey)) {
            targetKey = nameKey;
            existing = map.get(targetKey);
        }

        if (!existing) {
            const key = idKey || nameKey;
            if (key) {
                map.set(key, item);
                if (nameKey) nameToId.set(nameKey, key);
            }
        } else {
            const localTime = Number(item.savedAt || item.updatedAt || item.createdAt || 0);
            const cloudTime = Number(existing.savedAt || existing.updatedAt || existing.createdAt || 0);
            // Local overrides or equals cloud if modified explicitly after or at same time as cloud
            if (localTime >= cloudTime) {
                const stableId = existing.id || item.id;
                map.set(targetKey, { ...existing, ...item, id: stableId });
            }
        }
    });

    return Array.from(map.values());
}

export function mergeCollection(localList, cloudList, idField = 'id') {
    const map = new Map();
    const rawCloud = Array.isArray(cloudList) ? cloudList : Object.values(cloudList || {});
    rawCloud.forEach(item => {
        if (!item || isRecordDeleted(null, item)) return;
        const key = String(item[idField] || item.billNo || item.id || '').trim();
        if (key) map.set(key, item);
    });
    const rawLocal = Array.isArray(localList) ? localList : Object.values(localList || {});
    rawLocal.forEach(item => {
        if (!item || isRecordDeleted(null, item)) return;
        const key = String(item[idField] || item.billNo || item.id || '').trim();
        if (!key) return;
        if (!map.has(key)) {
            map.set(key, item);
        } else {
            const existing = map.get(key);
            const localTime = Number(item.savedAt || item.updatedAt || item.createdAt || 0);
            const cloudTime = Number(existing.savedAt || existing.updatedAt || existing.createdAt || 0);
            if (localTime >= cloudTime) {
                map.set(key, { ...existing, ...item });
            }
        }
    });
    return Array.from(map.values());
}

export function mergeCustomerBills(localList, cloudList) {
    const map = new Map();
    const getKey = c => {
        if (!c) return '';
        if (c.billNo) return 'bill_' + String(c.billNo).trim().toUpperCase();
        const upperName = String(c.name || '').trim().toUpperCase();
        if (upperName) return 'profile_' + upperName;
        if (c.id) return 'id_' + String(c.id).trim().toLowerCase();
        return '';
    };

    const processItem = (c) => {
        if (!c || isCustItemDeleted(c)) return;
        if (c.name) c.name = String(c.name).trim().toUpperCase();
        const k = getKey(c);
        if (!k) return;
        if (!map.has(k)) {
            map.set(k, c);
        } else {
            const existing = map.get(k);
            const incomingTime = Number(c.savedAt || c.createdAt || 0);
            const existingTime = Number(existing.savedAt || existing.createdAt || 0);
            if (incomingTime >= existingTime) {
                if (!c.billNo && !existing.billNo && c.id && existing.id && c.id !== existing.id) {
                    markIdDeleted(existing.id);
                }
                map.set(k, { ...existing, ...c, phone: c.phone || existing.phone || '' });
            } else {
                if (!c.billNo && !existing.billNo && c.id && existing.id && c.id !== existing.id) {
                    markIdDeleted(c.id);
                }
                if (!existing.phone && c.phone) {
                    existing.phone = c.phone;
                }
            }
        }
    };

    const rawCloud = Array.isArray(cloudList) ? cloudList : Object.values(cloudList || {});
    rawCloud.forEach(c => processItem(c));

    const rawLocal = Array.isArray(localList) ? localList : Object.values(localList || {});
    rawLocal.forEach(c => processItem(c));

    return Array.from(map.values());
}

export function detectLocalUnsynced(localState, cloudData) {
    if (!cloudData) return true;

    // Check cleaning products
    const cloudProducts = Array.isArray(cloudData.products) ? cloudData.products : Object.values(cloudData.products || {});
    const cloudProdMap = new Map();
    cloudProducts.forEach(p => {
        if (!p) return;
        if (p.id) cloudProdMap.set(String(p.id).trim(), p);
        if (p.name) cloudProdMap.set('named_' + String(p.name).trim().toLowerCase(), p);
    });
    for (const lp of (localState.products || [])) {
        if (!lp || isItemDeleted(lp)) continue;
        const cp = (lp.id && cloudProdMap.get(String(lp.id).trim())) || (lp.name && cloudProdMap.get('named_' + String(lp.name).trim().toLowerCase()));
        if (!cp) return true;
        if (Number(lp.savedAt || 0) > Number(cp.savedAt || 0)) return true;
    }

    // Check cosmetic products
    const cloudCos = Array.isArray(cloudData.cosProducts) ? cloudData.cosProducts : Object.values(cloudData.cosProducts || {});
    const cloudCosMap = new Map();
    cloudCos.forEach(p => {
        if (!p) return;
        if (p.id) cloudCosMap.set(String(p.id).trim(), p);
        if (p.name) cloudCosMap.set('named_' + String(p.name).trim().toLowerCase(), p);
    });
    for (const lp of (localState.cosProducts || [])) {
        if (!lp || isItemDeleted(lp)) continue;
        const cp = (lp.id && cloudCosMap.get(String(lp.id).trim())) || (lp.name && cloudCosMap.get('named_' + String(lp.name).trim().toLowerCase()));
        if (!cp) return true;
        if (Number(lp.savedAt || 0) > Number(cp.savedAt || 0)) return true;
    }

    // Check packages
    const cloudPkgs = Array.isArray(cloudData.packages) ? cloudData.packages : Object.values(cloudData.packages || {});
    const cloudPkgMap = new Map();
    cloudPkgs.forEach(p => {
        if (!p) return;
        if (p.id) cloudPkgMap.set(String(p.id).trim(), p);
        if (p.name) cloudPkgMap.set('named_' + String(p.name).trim().toLowerCase(), p);
    });
    for (const lp of (localState.packages || [])) {
        if (!lp || isItemDeleted(lp)) continue;
        const cp = (lp.id && cloudPkgMap.get(String(lp.id).trim())) || (lp.name && cloudPkgMap.get('named_' + String(lp.name).trim().toLowerCase()));
        if (!cp) return true;
        if (Number(lp.savedAt || 0) > Number(cp.savedAt || 0)) return true;
    }

    // Check customers
    const cloudCusts = Array.isArray(cloudData.customers) ? cloudData.customers : Object.values(cloudData.customers || {});
    const cloudCustMap = new Map();
    cloudCusts.forEach(c => {
        if (!c) return;
        if (c.id) cloudCustMap.set(String(c.id).trim().toLowerCase(), c);
        if (c.billNo) cloudCustMap.set('b_' + String(c.billNo).trim().toUpperCase(), c);
        if (!c.billNo && c.name) cloudCustMap.set('p_' + String(c.name).trim().toUpperCase(), c);
    });
    for (const lc of (localState.customers || [])) {
        if (!lc || isCustItemDeleted(lc)) continue;
        const cc = (lc.id && cloudCustMap.get(String(lc.id).trim().toLowerCase())) || 
                   (lc.billNo && cloudCustMap.get('b_' + String(lc.billNo).trim().toUpperCase())) ||
                   (!lc.billNo && lc.name && cloudCustMap.get('p_' + String(lc.name).trim().toUpperCase()));
        if (!cc) return true;
        if (Number(lc.savedAt || lc.createdAt || 0) > Number(cc.savedAt || cc.createdAt || 0)) return true;
    }

    // Check purchases, expenses, cosPurchases, cosSales, stockReturns
    const listPairs = [
        { local: localState.purchases, cloud: cloudData.purchases },
        { local: localState.expenses, cloud: cloudData.expenses },
        { local: localState.cosPurchases, cloud: cloudData.cosPurchases },
        { local: localState.cosSales, cloud: cloudData.cosSales },
        { local: localState.stockReturns, cloud: cloudData.stockReturns }
    ];
    for (const pair of listPairs) {
        const rawCloud = Array.isArray(pair.cloud) ? pair.cloud : Object.values(pair.cloud || {});
        const cMap = new Map();
        rawCloud.forEach(item => {
            if (!item) return;
            const k = String(item.id || item.billNo || '').trim();
            if (k) cMap.set(k, item);
        });
        for (const lItem of (pair.local || [])) {
            if (!lItem || isRecordDeleted(null, lItem)) continue;
            const k = String(lItem.id || lItem.billNo || '').trim();
            if (!k) continue;
            const cItem = cMap.get(k);
            if (!cItem) return true;
            if (Number(lItem.savedAt || lItem.createdAt || 0) > Number(cItem.savedAt || cItem.createdAt || 0)) return true;
        }
    }

    return false;
}

let autoPushTimer = null;
export function queueAutoPushToFirebase() {
    if (autoPushTimer) clearTimeout(autoPushTimer);
    autoPushTimer = setTimeout(() => {
        autoPushTimer = null;
        syncToFirebase();
    }, 400);
}

export function unmarkAllActiveLocalRecords() {
    const activeLocalKeys = new Set();
    const register = (list, keyFn) => {
        const arr = Array.isArray(list) ? list : Object.values(list || {});
        arr.forEach(item => {
            if (!item || item._deleted === true) return;
            const keys = keyFn(item);
            keys.forEach(k => {
                if (k) {
                    const sk = sanitizeTombstoneKey(k);
                    if (sk) activeLocalKeys.add(sk);
                    const raw = String(k).trim().toLowerCase();
                    if (raw) activeLocalKeys.add(raw);
                }
            });
        });
    };

    register(state.customers, c => [c.id, c.billNo]);
    register(state.cosSales, s => [s.id, s.billNo]);
    register(state.products, p => [p.id, p.barcode]);
    register(state.cosProducts, p => [p.id, p.barcode]);
    register(state.purchases, p => [p.id]);
    register(state.cosPurchases, p => [p.id]);
    register(state.expenses, e => [e.id]);
    register(state.stockReturns, r => [r.id]);
    register(state.packages, p => [p.id, p.name]);
    register(state.demands, d => [d.id]);
    register(state.orders, o => [o.id, o.orderNo]);

    activeLocalKeys.forEach(k => state.deletedRecordIds.delete(k));
    return activeLocalKeys;
}

export function buildSyncPayload() {
    const getSafeArray = (memArray, storageKey, filterFn) => {
        if (Array.isArray(memArray)) {
            return memArray.filter(filterFn);
        }
        try {
            const stored = JSON.parse(localStorage.getItem(storageKey) || '[]');
            if (Array.isArray(stored)) {
                return stored.filter(filterFn);
            }
        } catch(e) {}
        return [];
    };

    return {
        products: getSafeArray(state.products, 'fia_products', p => !isItemDeleted(p, 'product')),
        cosProducts: getSafeArray(state.cosProducts, 'fia_cosproducts', p => !isItemDeleted(p, 'cosProduct')),
        customers: getSafeArray(state.customers, 'fia_customers', c => !isCustItemDeleted(c)),
        purchases: getSafeArray(state.purchases, 'fia_purchases', p => !isItemDeleted(p, 'purchase')),
        expenses: getSafeArray(state.expenses, 'fia_expenses', e => !isItemDeleted(e, 'expense')),
        cosPurchases: getSafeArray(state.cosPurchases, 'fia_cospurchases', p => !isItemDeleted(p, 'cosPurchase')),
        cosSales: getSafeArray(state.cosSales, 'fia_cossales', s => !isItemDeleted(s, 'cosSale')),
        packages: getSafeArray(state.packages, 'fia_packages', p => !isItemDeleted(p, 'package')),
        demands: getSafeArray(state.demands, 'fia_demands', d => !isItemDeleted(d, 'demand')),
        orders: getSafeArray(state.orders, 'fia_orders', o => !isItemDeleted(o, 'order')),
        stockReturns: (state.stockReturns || []).filter(r => !isItemDeleted(r, 'stockReturn')),
        clearedDayBookEntries: state.clearedDayBookEntries || [],
        dayBookOpeningBalance: Number(state.dayBookOpeningBalance || 0),
        dayBookOpeningExpense: Number(state.dayBookOpeningExpense || 0),
        appPin: state.appPin || "1234",
        _deletedIds: Array.from(state.deletedRecordIds).map(sanitizeTombstoneKey).filter(Boolean).slice(-2000),
        _meta: {
            clientId: myFiaClientId,
            updatedAt: Date.now()
        }
    };
}

export function applyCloudData(data, isRealtimeEvent = false) {
    if (!data) return;
    if (isRealtimeEvent && data._meta && data._meta.clientId === myFiaClientId) {
        return;
    }

    // Detect un-pushed local items or newer timestamps before updating local state
    const hadPendingFlag = localStorage.getItem('fia_has_pending_sync') === 'true';
    const localHasAdditions = detectLocalUnsynced(state, data);

    // 1. Ingest all remote tombstones first so deletions propagate permanently
    const remoteDeleted = Array.isArray(data._deletedIds) ? data._deletedIds : (Array.isArray(data._deletedKeys) ? data._deletedKeys : []);
    remoteDeleted.forEach(k => {
        const cleanKey = sanitizeTombstoneKey(k);
        if (cleanKey) {
            state.deletedRecordIds.add(cleanKey);
        }
    });
    try {
        localStorage.setItem('fia_deleted_ids', JSON.stringify(Array.from(state.deletedRecordIds)));
    } catch(e) {}

    // 2. Immediately purge any locally stored items that match tombstones
    state.products = (state.products || []).filter(p => !isItemDeleted(p, 'product'));
    state.cosProducts = (state.cosProducts || []).filter(p => !isItemDeleted(p, 'cosProduct'));
    state.customers = (state.customers || []).filter(c => !isCustItemDeleted(c));
    state.purchases = (state.purchases || []).filter(p => !isItemDeleted(p, 'purchase'));
    state.expenses = (state.expenses || []).filter(e => !isItemDeleted(e, 'expense'));
    state.cosPurchases = (state.cosPurchases || []).filter(p => !isItemDeleted(p, 'cosPurchase'));
    state.cosSales = (state.cosSales || []).filter(s => !isItemDeleted(s, 'cosSale'));
    state.packages = (state.packages || []).filter(p => !isItemDeleted(p, 'package'));
    state.stockReturns = (state.stockReturns || []).filter(r => !isItemDeleted(r, 'stockReturn'));
    state.demands = (state.demands || []).filter(d => !isItemDeleted(d, 'demand'));
    state.orders = (state.orders || []).filter(o => !isItemDeleted(o, 'order'));

    // 3. Safe bidirectional union: local unsaved records are preserved, tombstoned cloud items are filtered out
    state.products = mergeInventoryProducts(state.products, data.products);
    state.cosProducts = mergeInventoryProducts(state.cosProducts, data.cosProducts);
    state.customers = mergeCustomerBills(state.customers, data.customers);
    state.purchases = mergeCollection(state.purchases, data.purchases, 'id');
    state.expenses = mergeCollection(state.expenses, data.expenses, 'id');
    state.cosPurchases = mergeCollection(state.cosPurchases, data.cosPurchases, 'id');
    state.cosSales = mergeCollection(state.cosSales, data.cosSales, 'id');
    state.packages = mergeInventoryProducts(state.packages, data.packages);
    state.stockReturns = mergeCollection(state.stockReturns, data.stockReturns, 'id');
    state.demands = mergeCollection(state.demands, data.demands, 'id');
    state.orders = mergeCollection(state.orders, data.orders, 'id');
    normalizeLoadedProducts();
    normalizeCustomerRecords();

    if (data.clearedDayBookEntries) {
        const cloudCleared = Array.isArray(data.clearedDayBookEntries) ? data.clearedDayBookEntries : Object.values(data.clearedDayBookEntries);
        state.clearedDayBookEntries = Array.from(new Set([...(state.clearedDayBookEntries || []), ...cloudCleared]));
    }
    if (data.dayBookOpeningBalance !== undefined) state.dayBookOpeningBalance = Number(data.dayBookOpeningBalance || 0);
    if (data.dayBookOpeningExpense !== undefined) state.dayBookOpeningExpense = Number(data.dayBookOpeningExpense || 0);
    if (data.appPin) state.appPin = data.appPin;

    saveLocalStateSafely();
    state.isFirebaseConnected = true;
    updateSyncStatus(true, 'Cloud Data Synchronized');

    // Dynamically refresh billing form numbers (CLN-xxxx and COS-xxxx)
    updateBillingFormDisplays();

    // If local device has additions or edits not present in Cloud, immediately auto-push to Cloud!
    if (hadPendingFlag || localHasAdditions) {
        console.log('[Sync Engine] Local additions or updates detected not yet in Cloud. Auto-pushing to Firebase...');
        localStorage.setItem('fia_has_pending_sync', 'true');
        queueAutoPushToFirebase();
    }

    if (window.renderAll) window.renderAll();
    if (typeof window.renderAccounts === 'function') window.renderAccounts();
    if (window.__fiaSalesHistoryFilter === 'customer') {
        if (typeof window.renderCustomerSalesHistory === 'function') window.renderCustomerSalesHistory();
    } else {
        if (window.renderSalesHistory) window.renderSalesHistory();
    }
    if (window.updateStockReturnDropdowns) window.updateStockReturnDropdowns();
    if (window.renderStockReturnHistory) window.renderStockReturnHistory();
    if (typeof window.renderConsolidatedStockReport === 'function') window.renderConsolidatedStockReport();
    if (typeof window.renderPackageConsolidationReport === 'function') window.renderPackageConsolidationReport();
    if (typeof window.renderDno === 'function') window.renderDno();
}

export function updateBillingFormDisplays() {
    try {
        const billNoEl = document.getElementById('billNumberDisplay');
        const idxEl = document.getElementById('custIndex');
        if (billNoEl && (!idxEl || String(idxEl.value) === '-1')) {
            if (typeof window.getNextBillNumber === 'function') {
                billNoEl.textContent = window.getNextBillNumber();
            }
        }
        const cosBillNoEl = document.getElementById('cosBillNumberDisplay');
        const cosIdxEl = document.getElementById('cosSIndex');
        if (cosBillNoEl && (!cosIdxEl || String(cosIdxEl.value) === '-1')) {
            if (typeof window.getNextCosBillNumber === 'function') {
                cosBillNoEl.textContent = window.getNextCosBillNumber();
            }
        }
    } catch (e) {
        console.warn('updateBillingFormDisplays error:', e);
    }
}

let isSyncing = false;
let queuedSync = false;

export async function fetchDirectCloudData() {
    if (!navigator.onLine) return null;
    try {
        const user = await (ensureFirebaseAuth ? ensureFirebaseAuth().catch(() => null) : Promise.resolve(null));
        if (!user || typeof user.getIdToken !== 'function') return null;
        const token = await user.getIdToken();
        if (!token) return null;
        const url = 'https://fia-clean-and-care-default-rtdb.firebaseio.com/fia_data.json?auth=' + encodeURIComponent(token);
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) {
            console.warn('[Sync Engine] Direct REST fetch status:', res.status);
            return null;
        }
        return await res.json();
    } catch (e) {
        console.warn('[Sync Engine] Direct REST pull notice:', e);
        return null;
    }
}

export async function pushDirectCloudData(payload) {
    if (!navigator.onLine) return false;
    try {
        const user = await (ensureFirebaseAuth ? ensureFirebaseAuth().catch(() => null) : Promise.resolve(null));
        if (!user || typeof user.getIdToken !== 'function') return false;
        const token = await user.getIdToken();
        if (!token) return false;
        const url = 'https://fia-clean-and-care-default-rtdb.firebaseio.com/fia_data.json?auth=' + encodeURIComponent(token);
        const res = await fetch(url, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        return res.ok;
    } catch (e) {
        console.warn('[Sync Engine] Direct REST push notice:', e);
        return false;
    }
}

export function syncToFirebase() {
    ensureStableTransactionIds();
    saveLocalStateSafely();
    createAutomaticLocalBackup();
    localStorage.setItem('fia_has_pending_sync', 'true');

    if (!navigator.onLine) {
        state.isFirebaseConnected = false;
        updateSyncStatus(false, 'Working under offline mode');
        isSyncing = false;
        return Promise.resolve(true);
    }

    if (isSyncing) {
        queuedSync = true;
        return Promise.resolve(true);
    }

    isSyncing = true;

    // Direct push: Push current local state and tombstones directly without re-fetching stale cloud records
    const payload = buildSyncPayload();

    const authReady = ensureFirebaseAuth ? ensureFirebaseAuth().catch(() => null) : Promise.resolve(null);

    return authReady.then(() => {
        if (!window.FB_DB) {
            return pushDirectCloudData(payload).then(ok => {
                if (!ok) throw new Error('Direct REST push failed');
                return true;
            });
        }
        const writePromise = window.FB_DB.ref('fia_data').set(payload);
        // Robust 25s timeout for mobile data / high latency networks
        const writeTimeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Firebase write timeout (network slow)')), 25000));
        return Promise.race([writePromise, writeTimeout]).catch(sdkErr => {
            console.warn('[Sync Engine] SDK write stalled or timed out. Falling back to direct HTTPS REST PUT...', sdkErr);
            return pushDirectCloudData(payload).then(ok => {
                if (ok) return true;
                throw sdkErr;
            });
        });
    })
    .then(function() {
        localStorage.removeItem('fia_has_pending_sync');
        state.isFirebaseConnected = true;
        updateSyncStatus(true, 'Cloud Data Synchronized');
        updateBillingFormDisplays();
        return true;
    })
    .catch(function(err) {
        console.warn("Firebase write error or timeout notice:", err);
        const errStr = String(err?.message || err?.code || err || '').toUpperCase();
        if (errStr.includes('PERMISSION') || errStr.includes('AUTH')) {
            console.warn('Firebase Write PERMISSION_DENIED. Attempting auto-auth...');
            if (ensureFirebaseAuth) ensureFirebaseAuth();
            updateSyncStatus(null, 'Connecting to Cloud Security...');
            state.isFirebaseConnected = false;
        } else if (!navigator.onLine) {
            state.isFirebaseConnected = false;
            updateSyncStatus(false, 'Working under offline mode');
        } else {
            // Still online, network was slow or momentary blip - keep pending flag to auto-retry
            updateSyncStatus(null, 'Syncing to Cloud (Retrying)...');
            setTimeout(() => {
                if (localStorage.getItem('fia_has_pending_sync') === 'true' && navigator.onLine) {
                    syncToFirebase();
                }
            }, 3000);
        }
        return false;
    })
    .finally(function() {
        isSyncing = false;
        if (queuedSync) {
            queuedSync = false;
            syncToFirebase();
        }
    });
}

export function pullFromFirebase() {
    if (!navigator.onLine) {
        state.isFirebaseConnected = false;
        updateSyncStatus(false, 'Working under offline mode');
        return Promise.resolve(false);
    }

    // Try direct ultra-fast REST pull first (guaranteed instant response, bypasses mobile WebSocket latency)
    return fetchDirectCloudData().then(restData => {
        if (restData) {
            applyCloudData(restData, false);
            return true;
        }
        throw new Error('REST pull returned empty, fallback to SDK');
    }).catch(err => {
        if (!window.FB_DB) return false;
        const authReady = ensureFirebaseAuth ? ensureFirebaseAuth().catch(() => null) : Promise.resolve(null);
        return authReady.then(() => {
            const pullPromise = window.FB_DB.ref('fia_data').once('value');
            // Robust 25s timeout for mobile data / high latency networks
            const pullTimeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Firebase pull timeout (network slow)')), 25000));
            return Promise.race([pullPromise, pullTimeout]);
        }).then(function(snapshot) {
            const data = snapshot ? snapshot.val() : null;
            if (data) {
                applyCloudData(data, false);
                return true;
            } else {
                if (state.products.length || state.customers.length || state.cosProducts.length || state.purchases.length) {
                    syncToFirebase();
                }
                return false;
            }
        });
    }).catch(function(error) {
        console.warn("Firebase pull notice:", error);
        const errStr = String(error?.message || error?.code || error || '').toUpperCase();
        if (errStr.includes('PERMISSION') || errStr.includes('AUTH')) {
            console.warn('Firebase Pull Auth notice. Attempting auto-auth...');
            state.isFirebaseConnected = false;
            updateSyncStatus(null, 'Connecting to Cloud Security...');
            if (ensureFirebaseAuth) {
                ensureFirebaseAuth().then(u => {
                    if (u) setTimeout(pullFromFirebase, 1200);
                });
            }
        } else if (!navigator.onLine) {
            state.isFirebaseConnected = false;
            updateSyncStatus(false, 'Working under offline mode');
        } else {
            // Online but slow pull - do not falsely scream offline mode
            console.log('[Sync Engine] Pull latency. Retrying cloud pull...');
            setTimeout(() => {
                if (navigator.onLine) pullFromFirebase();
            }, 3000);
        }
        if (window.renderAll) window.renderAll();
        return false;
    });
}

let realtimeListenerRef = null;
let realtimeListenerCallback = null;
let realtimeRetryTimeout = null;

export function attachRealtimeListener() {
    if (!window.FB_DB) return;
    if (realtimeRetryTimeout) {
        clearTimeout(realtimeRetryTimeout);
        realtimeRetryTimeout = null;
    }
    if (realtimeListenerRef && realtimeListenerCallback) {
        try {
            realtimeListenerRef.off('value', realtimeListenerCallback);
        } catch(e) {}
        realtimeListenerRef = null;
        realtimeListenerCallback = null;
    }

    realtimeListenerRef = window.FB_DB.ref('fia_data');
    realtimeListenerCallback = function(snapshot) {
        const data = snapshot.val();
        if (data) {
            applyCloudData(data, true);
        }
    };

    realtimeListenerRef.on('value', realtimeListenerCallback, function(error) {
        console.warn("Firebase Realtime Read Notice:", error);
        const errStr = String(error?.message || error?.code || error || '').toUpperCase();
        
        // Auto-heal / Reconnect if listener encounters error or detachment
        if (errStr.includes('PERMISSION') || errStr.includes('AUTH')) {
            console.warn("Firebase PERMISSION_DENIED on realtime listener - re-authenticating...");
            state.isFirebaseConnected = false;
            updateSyncStatus(null, 'Connecting to Cloud Security...');
            if (ensureFirebaseAuth) {
                ensureFirebaseAuth().then(user => {
                    if (user) {
                        setTimeout(attachRealtimeListener, 1500);
                    }
                });
            }
        } else if (!navigator.onLine) {
            state.isFirebaseConnected = false;
            updateSyncStatus(false, 'Working under offline mode');
        } else {
            // Transient network interruption or socket reset - automatically re-attach!
            console.log('[Sync Engine] Transient realtime listener error. Scheduling auto-reconnect...');
            updateSyncStatus(null, 'Reconnecting to Cloud...');
            realtimeRetryTimeout = setTimeout(() => {
                attachRealtimeListener();
            }, 3000);
        }
        if (window.renderAll) window.renderAll();
    });
}

let offlineDebounceTimer = null;

export function startRealtimeSync() {
    if (!window.FB_DB) {
        updateSyncStatus(false, 'Working under offline mode');
        return;
    }
    updateSyncStatus(null, 'Connecting to Cloud Database...');

    const checkAndSync = () => {
        if (ensureFirebaseAuth) {
            ensureFirebaseAuth().then(() => {
                attachRealtimeListener();
                // Always pull and merge latest cloud data first so remote bills are never missed
                pullFromFirebase().then(() => {
                    if (localStorage.getItem('fia_has_pending_sync') === 'true') {
                        syncToFirebase();
                    }
                });
            }).catch(() => {
                attachRealtimeListener();
                pullFromFirebase();
            });
        } else {
            attachRealtimeListener();
            pullFromFirebase().then(() => {
                if (localStorage.getItem('fia_has_pending_sync') === 'true') {
                    syncToFirebase();
                }
            });
        }
    };

    // Firebase .info/connected listener with debouncing to prevent false offline mode
    window.FB_DB.ref('.info/connected').on('value', function(snap) {
        const isOnline = snap.val() === true;
        if (isOnline) {
            if (offlineDebounceTimer) {
                clearTimeout(offlineDebounceTimer);
                offlineDebounceTimer = null;
            }
            state.isFirebaseConnected = true;
            updateSyncStatus(true, 'Cloud Data Synchronized');
            checkAndSync();
        } else {
            // When disconnected, check if browser actually has network connection
            if (navigator.onLine) {
                // Device has internet, socket is negotiating or reconnecting
                updateSyncStatus(null, 'Connecting to Cloud Database...');
                if (!offlineDebounceTimer) {
                    // Only transition to offline mode if disconnected continuously for > 15s
                    offlineDebounceTimer = setTimeout(() => {
                        if (!state.isFirebaseConnected) {
                            updateSyncStatus(false, 'Working under offline mode');
                        }
                    }, 15000);
                }
            } else {
                state.isFirebaseConnected = false;
                updateSyncStatus(false, 'Working under offline mode');
            }
        }
    });

    window.addEventListener('online', function() {
        if (offlineDebounceTimer) {
            clearTimeout(offlineDebounceTimer);
            offlineDebounceTimer = null;
        }
        updateSyncStatus(null, 'Connecting to Cloud Database...');
        if (window.FB_DB) {
            try { window.FB_DB.goOnline(); } catch(e) {}
        }
        checkAndSync();
    });

    window.addEventListener('offline', function() {
        if (offlineDebounceTimer) {
            clearTimeout(offlineDebounceTimer);
            offlineDebounceTimer = null;
        }
        state.isFirebaseConnected = false;
        updateSyncStatus(false, 'Working under offline mode');
    });

    // Mobile / Tablet Sleep, Resume & Tab Switching Handlers
    document.addEventListener('visibilitychange', function() {
        if (document.visibilityState === 'visible') {
            console.log('[Sync Engine] App visible/resumed. Refreshing cloud sync...');
            if (window.FB_DB) {
                try { window.FB_DB.goOnline(); } catch(e) {}
            }
            if (navigator.onLine) {
                checkAndSync();
            }
        }
    });

    window.addEventListener('focus', function() {
        if (window.FB_DB) {
            try { window.FB_DB.goOnline(); } catch(e) {}
        }
        if (navigator.onLine && !state.isFirebaseConnected) {
            checkAndSync();
        }
    });

    // Periodic Heartbeat Watchdog: ensure realtime listener is active and fetch any updates
    setInterval(() => {
        if (navigator.onLine && window.FB_DB) {
            if (!realtimeListenerRef) {
                console.log('[Sync Engine Watchdog] Re-attaching dormant realtime listener...');
                attachRealtimeListener();
            }
            if (!state.isFirebaseConnected) {
                try { window.FB_DB.goOnline(); } catch(e) {}
            }
        }
    }, 45000);

    // Initial listener attachment and sync
    checkAndSync();
}

export function manualCloudSync() {
    updateSyncStatus(null, 'Syncing with Cloud...');
    // Bidirectional sync: Pull first to merge all cloud records into local state, then push
    return pullFromFirebase().then(() => {
        return syncToFirebase();
    }).then(ok => {
        if (window.renderAll) window.renderAll();
        if (window.__fiaSalesHistoryFilter === 'customer') {
            if (typeof window.renderCustomerSalesHistory === 'function') window.renderCustomerSalesHistory();
        } else {
            if (typeof window.renderSalesHistory === 'function') window.renderSalesHistory();
        }
        updateBillingFormDisplays();
        alert('✓ Cloud sync completed successfully!\nAll bills and data are up to date across all devices.');
        return true;
    }).catch(err => {
        console.warn('Manual sync fallback notice:', err);
        return syncToFirebase().then(() => {
            if (window.renderAll) window.renderAll();
            updateBillingFormDisplays();
            alert('Cloud sync completed.');
            return true;
        });
    });
}

export function downloadFullBackup() {
    const backup = {
        backupVersion: 1,
        app: 'FIA CLEAN & CARE',
        createdAt: new Date().toISOString(),
        data: {
            products: state.products || [],
            cosProducts: state.cosProducts || [],
            customers: state.customers || [],
            purchases: state.purchases || [],
            expenses: state.expenses || [],
            cosPurchases: state.cosPurchases || [],
            cosSales: state.cosSales || [],
            packages: state.packages || [],
            stockReturns: state.stockReturns || [],
            clearedDayBookEntries: state.clearedDayBookEntries || [],
            dayBookOpeningBalance: state.dayBookOpeningBalance || 0,
            dayBookOpeningExpense: state.dayBookOpeningExpense || 0,
            appPin: state.appPin || "1234"
        }
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `FIA_CLEAN_CARE_BACKUP_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    alert('Backup file downloaded successfully.');
}

export function openBackupFilePicker(inputId) {
    const input = document.getElementById(inputId);
    if (!input) return;
    input.value = '';
    input.click();
}

export function restoreFullBackup(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    const fileName = (file.name || '').toLowerCase();
    if (!fileName.endsWith('.json') && file.type && file.type !== 'application/json' && file.type !== 'text/json' && file.type !== 'text/plain') {
        alert('Please select a FIA CLEAN & CARE JSON backup file (.json).');
        event.target.value = '';
        return;
    }
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const rawText = String(e.target.result || '').replace(/^\uFEFF/, '').trim();
            const backup = JSON.parse(rawText);
            const d = (backup && backup.data && typeof backup.data === 'object') ? backup.data : backup;
            const looksLikeFiaBackup = backup && (backup.app === 'FIA CLEAN & CARE' || backup.backupVersion !== undefined);
            const valid = d && typeof d === 'object' && looksLikeFiaBackup &&
                ['products', 'cosProducts', 'customers', 'purchases', 'expenses', 'cosPurchases', 'cosSales'].every(k => Array.isArray(d[k]));
            if (!valid) throw new Error('Invalid FIA CLEAN & CARE backup structure');
            if (!confirm('Restore this backup? Current data on this device and cloud will be replaced.')) return;
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
            saveLocalStateSafely();
            syncToFirebase();
            if (window.renderAll) window.renderAll();
            alert('Backup restored successfully!');
        } catch(err) {
            console.error(err);
            alert('Backup restore failed. Please select a valid FIA backup file.');
        } finally {
            event.target.value = '';
            const a = document.getElementById('backupFileInput');
            const b = document.getElementById('dayBookBackupFileInput');
            if (a) a.value = '';
            if (b) b.value = '';
        }
    };
    reader.readAsText(file);
}

// Window attachments for backward compatibility
if (typeof window !== 'undefined') {
    window.syncToFirebase = syncToFirebase;
    window.pullFromFirebase = pullFromFirebase;
    window.startRealtimeSync = startRealtimeSync;
    window.updateSyncStatus = updateSyncStatus;
    window.manualCloudSync = manualCloudSync;
    window.downloadFullBackup = downloadFullBackup;
    window.openBackupFilePicker = openBackupFilePicker;
    window.restoreFullBackup = restoreFullBackup;
    window.applyCloudData = applyCloudData;
    window.mergeInventoryProducts = mergeInventoryProducts;
    window.mergeCollection = mergeCollection;
    window.detectLocalUnsynced = detectLocalUnsynced;
    window.buildSyncPayload = buildSyncPayload;
    window.attachRealtimeListener = attachRealtimeListener;
    window.updateBillingFormDisplays = updateBillingFormDisplays;
    window.fetchDirectCloudData = fetchDirectCloudData;
    window.pushDirectCloudData = pushDirectCloudData;
}

