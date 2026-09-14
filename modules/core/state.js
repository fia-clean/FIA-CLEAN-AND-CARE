/**
 * FIA CLEAN & CARE - Core Reactive State & Tombstone Engine
 */

export const MASTER_RECOVERY_KEY = "FIA786";
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
    stockReturns: [],
    clearedDayBookEntries: [],
    dayBookOpeningBalance: 0,
    dayBookOpeningExpense: 0,
    appPin: "1234",
    isLoggedIn: false,
    isFirebaseConnected: false,
    currentDayBookPreset: 'today',
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
    // Legacy name keys like 'cust_test' shouldn't blacklist real customers
    if (str.startsWith('cust_') && !/^cust_\d{10,}/.test(str)) {
        return null;
    }
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
                    if (clean) state.deletedRecordIds.add(clean);
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

export function isItemDeleted(item) {
    if (!item) return true;
    if (item._deleted === true) return true;
    if (item.id && isIdDeleted(item.id)) return true;
    if (item.billNo && isIdDeleted(item.billNo)) return true;
    return false;
}

export function isCustItemDeleted(c) {
    if (!c) return true;
    if (c._deleted === true) return true;
    if (c.billNo && isIdDeleted(c.billNo)) return true;
    if (c.id && isIdDeleted(c.id)) return true;
    return false;
}

export function isRecordDeleted(type, item) {
    if (!item) return false;
    if (type === 'customer') return isCustItemDeleted(item);
    return isItemDeleted(item);
}

// -------------------------------------------------------------
// Date & Currency Formatters
// -------------------------------------------------------------
export function formatDateDDMMYYYY(dateValue) {
    if (!dateValue) return '';
    if (typeof dateValue === 'string' && /^\d{2}\/\d{2}\/\d{4}$/.test(dateValue.trim())) {
        return dateValue.trim();
    }
    const date = new Date(dateValue);
    if (isNaN(date.getTime())) return String(dateValue);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
}

export function parseDateDDMMYYYY(value) {
    if (!value || typeof value !== 'string') return null;
    const parts = value.trim().split('/');
    if (parts.length !== 3) return null;
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const year = parseInt(parts[2], 10);
    const date = new Date(year, month, day);
    return isNaN(date.getTime()) ? null : date;
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
    if (!v) return '';
    v = String(v).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(v)) {
        const parts = v.split('/');
        return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    const d = new Date(v);
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

export function sortByNameAsc(list, field = 'name') {
    return [...(list || [])].sort((a, b) => String(a?.[field] ?? '').localeCompare(String(b?.[field] ?? ''), undefined, { sensitivity: 'base', numeric: true }));
}


// -------------------------------------------------------------
// Product Normalization
// -------------------------------------------------------------
export function normalizeLoadedProducts() {
    (state.products || []).forEach(p => {
        if (!p) return;
        const r = parseFloat(p.retailPrice);
        const s = parseFloat(p.salePrice || p.price || p.price2);
        if (!Number.isFinite(r) && Number.isFinite(s)) p.retailPrice = s;
        
        const w = parseFloat(p.wholesalePrice);
        const c = parseFloat(p.costPrice || p.price1);
        if (!Number.isFinite(w) && Number.isFinite(c)) p.wholesalePrice = c;
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
    });
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
        state.stockReturns = JSON.parse(localStorage.getItem('fia_stock_returns')) || [];
        state.clearedDayBookEntries = JSON.parse(localStorage.getItem('fia_cleared_daybook')) || [];
        state.dayBookOpeningBalance = Number(localStorage.getItem('fia_daybook_opening_balance') || 0);
        state.dayBookOpeningExpense = Number(localStorage.getItem('fia_daybook_opening_expense') || 0);
        state.appPin = localStorage.getItem('fia_app_pin') || "1234";
        normalizeLoadedProducts();
    } catch (e) {
        console.warn('Failed to load from localStorage:', e);
    }
}

export function saveLocalStateSafely() {
    try {
        localStorage.setItem('fia_products', JSON.stringify((state.products || []).filter(p => !isItemDeleted(p))));
        localStorage.setItem('fia_cosproducts', JSON.stringify((state.cosProducts || []).filter(p => !isItemDeleted(p))));
        localStorage.setItem('fia_customers', JSON.stringify((state.customers || []).filter(c => !isCustItemDeleted(c))));
        localStorage.setItem('fia_purchases', JSON.stringify((state.purchases || []).filter(p => !isItemDeleted(p))));
        localStorage.setItem('fia_expenses', JSON.stringify((state.expenses || []).filter(e => !isItemDeleted(e))));
        localStorage.setItem('fia_cospurchases', JSON.stringify((state.cosPurchases || []).filter(p => !isItemDeleted(p))));
        localStorage.setItem('fia_cossales', JSON.stringify((state.cosSales || []).filter(s => !isItemDeleted(s))));
        localStorage.setItem('fia_packages', JSON.stringify((state.packages || []).filter(p => !isItemDeleted(p))));
        localStorage.setItem('fia_stock_returns', JSON.stringify(state.stockReturns || []));
        localStorage.setItem('fia_cleared_daybook', JSON.stringify(state.clearedDayBookEntries || []));
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
        
        const backupData = {
            backupVersion: 1,
            app: 'FIA CLEAN & CARE',
            snapshotDate: todayDate,
            createdAt: now.toISOString(),
            stats: {
                products: (state.products || []).length,
                cosProducts: (state.cosProducts || []).length,
                customers: (state.customers || []).length,
                packages: (state.packages || []).length
            },
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
}

