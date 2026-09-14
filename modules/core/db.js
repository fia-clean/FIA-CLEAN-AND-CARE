/**
 * FIA CLEAN & CARE - Firebase Realtime Database Sync & Tombstone Engine
 */

import {
    state,
    myFiaClientId,
    sanitizeTombstoneKey,
    isItemDeleted,
    isCustItemDeleted,
    isRecordDeleted,
    saveLocalStateSafely,
    createAutomaticLocalBackup,
    normalizeLoadedProducts
} from './state.js';

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
        if (customText) {
            el.innerHTML = `<span class="w-2 h-2 rounded-full ${connected ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}"></span> ${customText}`;
        } else if (connected) {
            el.innerHTML = `<span class="w-2 h-2 rounded-full bg-emerald-500"></span> Cloud Database Connected`;
        } else {
            el.innerHTML = `<span class="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span> Working under offline mode`;
        }
    }

    if (syncBadge) {
        if (connected) {
            syncBadge.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> Direct Sync Active';
            syncBadge.className = 'mt-1 inline-flex items-center gap-1.5 text-[10px] font-bold text-emerald-300 bg-emerald-950/60 border border-emerald-800/60 px-2.5 py-1.5 rounded-full';
        } else {
            syncBadge.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-amber-400"></span> Offline Mode';
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
        if (c.id) return 'id_' + String(c.id).trim().toLowerCase();
        if (c.billNo) return 'bill_' + String(c.billNo).trim().toUpperCase();
        return 'named_' + String(c.name || '').trim().toLowerCase();
    };

    const rawCloud = Array.isArray(cloudList) ? cloudList : Object.values(cloudList || {});
    rawCloud.forEach(c => {
        if (!c || isCustItemDeleted(c)) return;
        const k = getKey(c);
        if (k) map.set(k, c);
    });

    const rawLocal = Array.isArray(localList) ? localList : Object.values(localList || {});
    rawLocal.forEach(c => {
        if (!c || isCustItemDeleted(c)) return;
        const k = getKey(c);
        if (!k) return;
        if (!map.has(k)) {
            map.set(k, c);
        } else {
            const existing = map.get(k);
            const localTime = Number(c.savedAt || c.createdAt || 0);
            const cloudTime = Number(existing.savedAt || existing.createdAt || 0);
            if (localTime >= cloudTime) {
                map.set(k, { ...existing, ...c });
            }
        }
    });
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
    });
    for (const lc of (localState.customers || [])) {
        if (!lc || isCustItemDeleted(lc)) continue;
        const cc = (lc.id && cloudCustMap.get(String(lc.id).trim().toLowerCase())) || (lc.billNo && cloudCustMap.get('b_' + String(lc.billNo).trim().toUpperCase()));
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

export function buildSyncPayload() {
    return {
        products: (state.products || []).filter(p => !isItemDeleted(p)),
        cosProducts: (state.cosProducts || []).filter(p => !isItemDeleted(p)),
        customers: (state.customers || []).filter(c => !isCustItemDeleted(c)),
        purchases: (state.purchases || []).filter(p => !isItemDeleted(p)),
        expenses: (state.expenses || []).filter(e => !isItemDeleted(e)),
        cosPurchases: (state.cosPurchases || []).filter(p => !isItemDeleted(p)),
        cosSales: (state.cosSales || []).filter(s => !isItemDeleted(s)),
        packages: (state.packages || []).filter(p => !isItemDeleted(p)),
        stockReturns: state.stockReturns || [],
        clearedDayBookEntries: state.clearedDayBookEntries || [],
        dayBookOpeningBalance: Number(state.dayBookOpeningBalance || 0),
        dayBookOpeningExpense: Number(state.dayBookOpeningExpense || 0),
        appPin: state.appPin || "1234",
        _deletedIds: Array.from(state.deletedRecordIds).map(sanitizeTombstoneKey).filter(Boolean).slice(-1500),
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

    // 1. Un-tombstone active records sent by cloud so remote devices never suppress them
    const unmarkActive = (list, keyFn) => {
        const arr = Array.isArray(list) ? list : Object.values(list || {});
        arr.forEach(item => {
            if (!item) return;
            const keys = keyFn(item);
            keys.forEach(k => {
                if (k) {
                    const sk = sanitizeTombstoneKey(k);
                    if (sk) state.deletedRecordIds.delete(sk);
                }
            });
        });
    };
    unmarkActive(data.customers, c => [c.id, c.billNo]);
    unmarkActive(data.cosSales, s => [s.id, s.billNo]);
    unmarkActive(data.products, p => [p.id, p.barcode]);
    unmarkActive(data.cosProducts, p => [p.id, p.barcode]);
    unmarkActive(data.purchases, p => [p.id]);
    unmarkActive(data.cosPurchases, p => [p.id]);
    unmarkActive(data.expenses, e => [e.id]);
    unmarkActive(data.stockReturns, r => [r.id]);
    unmarkActive(data.packages, p => [p.id, p.name]);

    // 2. Sync remote tombstone deleted IDs into local tombstones
    const remoteDeleted = Array.isArray(data._deletedIds) ? data._deletedIds : (Array.isArray(data._deletedKeys) ? data._deletedKeys : []);
    remoteDeleted.forEach(k => {
        const cleanKey = sanitizeTombstoneKey(k);
        if (cleanKey) state.deletedRecordIds.add(cleanKey);
    });
    try {
        localStorage.setItem('fia_deleted_ids', JSON.stringify(Array.from(state.deletedRecordIds)));
    } catch(e) {}

    // 3. Safe bidirectional union: local unsaved records are NEVER erased!
    state.products = mergeInventoryProducts(state.products, data.products);
    state.cosProducts = mergeInventoryProducts(state.cosProducts, data.cosProducts);
    state.customers = mergeCustomerBills(state.customers, data.customers);
    state.purchases = mergeCollection(state.purchases, data.purchases, 'id');
    state.expenses = mergeCollection(state.expenses, data.expenses, 'id');
    state.cosPurchases = mergeCollection(state.cosPurchases, data.cosPurchases, 'id');
    state.cosSales = mergeCollection(state.cosSales, data.cosSales, 'id');
    state.packages = mergeInventoryProducts(state.packages, data.packages);
    state.stockReturns = mergeCollection(state.stockReturns, data.stockReturns, 'id');
    normalizeLoadedProducts();

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

    // If local device has additions or edits not present in Cloud, immediately auto-push to Cloud!
    if (hadPendingFlag || localHasAdditions) {
        console.log('[Sync Engine] Local additions or updates detected not yet in Cloud. Auto-pushing to Firebase...');
        localStorage.setItem('fia_has_pending_sync', 'true');
        queueAutoPushToFirebase();
    }

    if (window.renderAll) window.renderAll();
    if (typeof window.renderAccounts === 'function') window.renderAccounts();
    if (window.renderSalesHistory) window.renderSalesHistory();
    if (window.updateStockReturnDropdowns) window.updateStockReturnDropdowns();
    if (window.renderStockReturnHistory) window.renderStockReturnHistory();
    if (typeof window.renderConsolidatedStockReport === 'function') window.renderConsolidatedStockReport();
    if (typeof window.renderPackageConsolidationReport === 'function') window.renderPackageConsolidationReport();
}

let isSyncing = false;
let queuedSync = false;

export function syncToFirebase() {
    ensureStableTransactionIds();
    saveLocalStateSafely();
    createAutomaticLocalBackup();
    localStorage.setItem('fia_has_pending_sync', 'true');

    if (!window.FB_DB) {
        updateSyncStatus(false, 'Working under offline mode');
        return Promise.resolve(false);
    }

    if (isSyncing) {
        queuedSync = true;
        return Promise.resolve(true);
    }

    isSyncing = true;

    // Fast-bounded cloud merge: attempt to read latest cloud state within 1200ms
    const cloudFetchPromise = window.FB_DB.ref('fia_data').once('value')
        .then(snap => snap.val())
        .catch(() => null);
    const timeoutPromise = new Promise(resolve => setTimeout(() => resolve(null), 1200));

    return Promise.race([cloudFetchPromise, timeoutPromise])
        .then(function(cloud) {
            if (cloud) {
                state.products = mergeInventoryProducts(state.products, cloud.products);
                state.cosProducts = mergeInventoryProducts(state.cosProducts, cloud.cosProducts);
                state.customers = mergeCustomerBills(state.customers, cloud.customers);
                state.purchases = mergeCollection(state.purchases, cloud.purchases, 'id');
                state.expenses = mergeCollection(state.expenses, cloud.expenses, 'id');
                state.cosPurchases = mergeCollection(state.cosPurchases, cloud.cosPurchases, 'id');
                state.cosSales = mergeCollection(state.cosSales, cloud.cosSales, 'id');
                state.packages = mergeInventoryProducts(state.packages, cloud.packages);
                state.stockReturns = mergeCollection(state.stockReturns, cloud.stockReturns, 'id');
                saveLocalStateSafely();
            }

            const payload = buildSyncPayload();

            return window.FB_DB.ref('fia_data').set(payload).then(function() {
                localStorage.removeItem('fia_has_pending_sync');
                state.isFirebaseConnected = true;
                updateSyncStatus(true, 'Cloud Database Synced');
                return true;
            });
        })
        .catch(function(err) {
            console.error("Firebase write error:", err);
            updateSyncStatus(false, 'Sync Pending (Offline Mode)');
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
    if (!window.FB_DB) {
        updateSyncStatus(false, 'Working under offline mode');
        return Promise.resolve(false);
    }
    return window.FB_DB.ref('fia_data').once('value').then(function(snapshot) {
        const data = snapshot.val();
        if (data) {
            applyCloudData(data, false);
            return true;
        } else {
            if (state.products.length || state.customers.length || state.cosProducts.length || state.purchases.length) {
                syncToFirebase();
            }
            return false;
        }
    }).catch(function(error) {
        console.error("Firebase pull error:", error);
        state.isFirebaseConnected = false;
        updateSyncStatus(false, 'Working under offline mode');
        if (window.renderAll) window.renderAll();
        return false;
    });
}

export function startRealtimeSync() {
    if (!window.FB_DB) {
        updateSyncStatus(false, 'Working under offline mode');
        return;
    }
    updateSyncStatus(null, 'Connecting to Cloud Database...');

    window.FB_DB.ref('.info/connected').on('value', function(snap) {
        const isOnline = snap.val() === true;
        if (isOnline) {
            state.isFirebaseConnected = true;
            updateSyncStatus(true, 'Cloud Database Connected');
            pullFromFirebase();
        } else {
            state.isFirebaseConnected = false;
            updateSyncStatus(false, 'Working under offline mode');
        }
    });

    window.addEventListener('online', function() {
        if (window.FB_DB) {
            try { window.FB_DB.goOnline(); } catch(e) {}
        }
        pullFromFirebase();
    });
    window.addEventListener('offline', function() {
        state.isFirebaseConnected = false;
        updateSyncStatus(false, 'Working under offline mode');
    });

    window.FB_DB.ref('fia_data').on('value', function(snapshot) {
        const data = snapshot.val();
        if (data) {
            applyCloudData(data, true);
        }
    }, function(error) {
        console.error("Firebase Read Error:", error);
        state.isFirebaseConnected = false;
        updateSyncStatus(false, 'Working under offline mode');
        if (window.renderAll) window.renderAll();
    });
}

export function manualCloudSync() {
    updateSyncStatus(null, 'Syncing to Cloud...');
    return syncToFirebase().then(ok => {
        if (ok) {
            alert('Cloud sync completed successfully!');
        } else {
            alert('Could not sync with Cloud. Saved locally.');
        }
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
}

