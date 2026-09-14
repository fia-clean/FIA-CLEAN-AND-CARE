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
        if (c.id) return 'id_' + String(c.id).trim().toLowerCase();
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

export function applyCloudData(data, isRealtimeEvent = false) {
    if (!data) return;
    if (isRealtimeEvent && data._meta && data._meta.clientId === myFiaClientId) {
        return;
    }

    // 1. Sync remote tombstone deleted IDs into local tombstones
    const remoteDeleted = Array.isArray(data._deletedIds) ? data._deletedIds : (Array.isArray(data._deletedKeys) ? data._deletedKeys : []);
    remoteDeleted.forEach(k => {
        const cleanKey = sanitizeTombstoneKey(k);
        if (cleanKey) state.deletedRecordIds.add(cleanKey);
    });
    try {
        localStorage.setItem('fia_deleted_ids', JSON.stringify(Array.from(state.deletedRecordIds)));
    } catch(e) {}

    // 2. Safe bidirectional union: local unsaved records are NEVER erased!
    state.products = mergeCollection(state.products, data.products, 'id');
    state.cosProducts = mergeCollection(state.cosProducts, data.cosProducts, 'id');
    state.customers = mergeCustomerBills(state.customers, data.customers);
    state.purchases = mergeCollection(state.purchases, data.purchases, 'id');
    state.expenses = mergeCollection(state.expenses, data.expenses, 'id');
    state.cosPurchases = mergeCollection(state.cosPurchases, data.cosPurchases, 'id');
    state.cosSales = mergeCollection(state.cosSales, data.cosSales, 'id');
    state.packages = mergeCollection(state.packages, data.packages, 'id');
    state.stockReturns = mergeCollection(state.stockReturns, data.stockReturns, 'id');
    normalizeLoadedProducts();

    if (data.clearedDayBookEntries) {
        const cloudCleared = Array.isArray(data.clearedDayBookEntries) ? data.clearedDayBookEntries : Object.values(data.clearedDayBookEntries);
        state.clearedDayBookEntries = Array.from(new Set([...(state.clearedDayBookEntries || []), ...cloudCleared]));
    }
    if (data.dayBookOpeningBalance !== undefined) state.dayBookOpeningBalance = Number(data.dayBookOpeningBalance || 0);
    if (data.dayBookOpeningExpense !== undefined) state.dayBookOpeningExpense = Number(data.dayBookOpeningExpense || 0);
    if (data.appPin) state.appPin = data.appPin;

    localStorage.removeItem('fia_has_pending_sync');
    saveLocalStateSafely();
    state.isFirebaseConnected = true;
    updateSyncStatus(true, 'Cloud Data Synchronized');

    if (window.renderAll) window.renderAll();
    if (window.updateStockReturnDropdowns) window.updateStockReturnDropdowns();
    if (window.renderStockReturnHistory) window.renderStockReturnHistory();
}

export function syncToFirebase() {
    ensureStableTransactionIds();
    saveLocalStateSafely();
    createAutomaticLocalBackup();
    localStorage.setItem('fia_has_pending_sync', 'true');

    if (!window.FB_DB) {
        updateSyncStatus(false, 'Working under offline mode');
        return Promise.resolve(false);
    }

    return window.FB_DB.ref('fia_data').once('value').then(function(snap) {
        const cloud = snap.val();
        let mergedProducts = state.products || [];
        let mergedCosProducts = state.cosProducts || [];
        let mergedCustomers = state.customers || [];
        let mergedPurchases = state.purchases || [];
        let mergedExpenses = state.expenses || [];
        let mergedCosPurchases = state.cosPurchases || [];
        let mergedCosSales = state.cosSales || [];
        let mergedPackages = state.packages || [];
        let mergedStockReturns = state.stockReturns || [];

        if (cloud) {
            mergedProducts = mergeCollection(state.products, cloud.products, 'id');
            mergedCosProducts = mergeCollection(state.cosProducts, cloud.cosProducts, 'id');
            mergedCustomers = mergeCustomerBills(state.customers, cloud.customers);
            mergedPurchases = mergeCollection(state.purchases, cloud.purchases, 'id');
            mergedExpenses = mergeCollection(state.expenses, cloud.expenses, 'id');
            mergedCosPurchases = mergeCollection(state.cosPurchases, cloud.cosPurchases, 'id');
            mergedCosSales = mergeCollection(state.cosSales, cloud.cosSales, 'id');
            mergedPackages = mergeCollection(state.packages, cloud.packages, 'id');
            mergedStockReturns = mergeCollection(state.stockReturns, cloud.stockReturns, 'id');

            // Synchronize state with the merged union
            state.products = mergedProducts;
            state.cosProducts = mergedCosProducts;
            state.customers = mergedCustomers;
            state.purchases = mergedPurchases;
            state.expenses = mergedExpenses;
            state.cosPurchases = mergedCosPurchases;
            state.cosSales = mergedCosSales;
            state.packages = mergedPackages;
            state.stockReturns = mergedStockReturns;
            saveLocalStateSafely();
        }

        const payload = {
            products: mergedProducts.filter(p => !isItemDeleted(p)),
            cosProducts: mergedCosProducts.filter(p => !isItemDeleted(p)),
            customers: mergedCustomers.filter(c => !isCustItemDeleted(c)),
            purchases: mergedPurchases.filter(p => !isItemDeleted(p)),
            expenses: mergedExpenses.filter(e => !isItemDeleted(e)),
            cosPurchases: mergedCosPurchases.filter(p => !isItemDeleted(p)),
            cosSales: mergedCosSales.filter(s => !isItemDeleted(s)),
            packages: mergedPackages.filter(p => !isItemDeleted(p)),
            stockReturns: mergedStockReturns || [],
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

        return window.FB_DB.ref('fia_data').set(payload).then(function() {
            localStorage.removeItem('fia_has_pending_sync');
            state.isFirebaseConnected = true;
            updateSyncStatus(true, 'Cloud Database Synced');
            return true;
        });
    }).catch(function(err) {
        console.error("Firebase write error:", err);
        updateSyncStatus(false, 'Sync Pending (Offline Mode)');
        return false;
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
}

