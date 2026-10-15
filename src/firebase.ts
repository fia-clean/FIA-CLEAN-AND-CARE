import { initializeApp, getApps } from 'firebase/app';
import { getDatabase, ref, onValue, set, get, update, off } from 'firebase/database';
import { getAuth } from 'firebase/auth';

export const firebaseConfig = {
  apiKey: "AIzaSyAl6U6hwZsqNLoxYmdWrQMkH6F-0dnn7Kg",
  authDomain: "fia-clean-and-care.firebaseapp.com",
  databaseURL: "https://fia-clean-and-care-default-rtdb.firebaseio.com",
  projectId: "fia-clean-and-care",
  storageBucket: "fia-clean-and-care.firebasestorage.app",
  messagingSenderId: "64795058382",
  appId: "1:64795058382:web:adb5c87e5c53c07a67309f"
};

export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const db = getDatabase(app);
export const auth = getAuth(app);

export interface CloudPayload {
  products?: any[];
  cosProducts?: any[];
  customers?: any[];
  suppliers?: any[];
  sales?: any[];
  purchases?: any[];
  expenses?: any[];
  stockReturns?: any[];
  clearedDayBookIds?: string[];
  appPin?: string;
  _meta?: {
    updatedAt: number;
    clientId?: string;
  };
}

export const myClientId = 'client_' + Math.random().toString(36).substring(2, 9);
let cachedRemoteState: any = null;

export function subscribeToCloud(
  onData: (data: CloudPayload) => void,
  onError: (error: Error) => void
) {
  const dataRef = ref(db, 'fia_data');
  const unsubscribe = onValue(
    dataRef,
    (snapshot) => {
      const val = snapshot.val();
      if (val) {
        cachedRemoteState = val;

        // Skip self-echo: local state already has this data.
        // Prevents infinite re-render loops and input lag!
        if (val._meta && val._meta.clientId === myClientId) {
          return;
        }

        const normalizeArray = (arr: any) => {
          if (arr === undefined || arr === null) return undefined;
          return Array.isArray(arr) ? arr : Object.values(arr);
        };

        const parsed: CloudPayload = {
          products: normalizeArray(val.products),
          cosProducts: normalizeArray(val.cosProducts),
          customers: normalizeArray(val.customers),
          suppliers: normalizeArray(val.suppliers),
          sales: normalizeArray(val.sales),
          purchases: normalizeArray(val.purchases),
          expenses: normalizeArray(val.expenses),
          stockReturns: normalizeArray(val.stockReturns),
          clearedDayBookIds: normalizeArray(val.clearedDayBookIds || val.clearedDayBookEntries),
          appPin: val.appPin,
          _meta: val._meta
        };
        onData(parsed);
      }
    },
    (error) => {
      console.error('Firebase realtime sync error:', error);
      onError(error);
    }
  );

  return () => off(dataRef);
}

// Non-destructive intelligent array merge: ensures records from either cloud or local are never lost
function mergeUniqueRecords(localList: any[] | undefined, remoteList: any[] | undefined, primaryKey: string = 'id'): any[] {
  const normLocal = Array.isArray(localList) ? localList : (localList ? Object.values(localList) : []);
  const normRemote = Array.isArray(remoteList) ? remoteList : (remoteList ? Object.values(remoteList) : []);

  const map = new Map<string, any>();

  // 1. Remote records first
  normRemote.forEach((item) => {
    if (!item) return;
    const key = item[primaryKey] || (item.name ? item.name.toLowerCase().trim() : JSON.stringify(item));
    map.set(key, item);
  });

  // 2. Local records override/extend remote records (local changes take precedence)
  normLocal.forEach((item) => {
    if (!item) return;
    const key = item[primaryKey] || (item.name ? item.name.toLowerCase().trim() : JSON.stringify(item));
    map.set(key, item);
  });

  return Array.from(map.values());
}

export async function syncToCloud(payload: CloudPayload): Promise<boolean> {
  try {
    const dataRef = ref(db, 'fia_data');
    
    const enrichedPayload: CloudPayload = {
      products: Array.isArray(payload.products) ? payload.products : [],
      cosProducts: Array.isArray(payload.cosProducts) ? payload.cosProducts : [],
      customers: Array.isArray(payload.customers) ? payload.customers : [],
      suppliers: Array.isArray(payload.suppliers) ? payload.suppliers : [],
      sales: Array.isArray(payload.sales) ? payload.sales : [],
      purchases: Array.isArray(payload.purchases) ? payload.purchases : [],
      expenses: Array.isArray(payload.expenses) ? payload.expenses : [],
      stockReturns: Array.isArray(payload.stockReturns) ? payload.stockReturns : [],
      clearedDayBookIds: Array.isArray(payload.clearedDayBookIds) ? payload.clearedDayBookIds : [],
      appPin: payload.appPin || '1234',
      _meta: {
        updatedAt: Date.now(),
        clientId: myClientId,
      }
    };

    cachedRemoteState = enrichedPayload;
    await set(dataRef, enrichedPayload);
    return true;
  } catch (error) {
    console.error('Failed to sync to Firebase cloud:', error);
    return false;
  }
}

// Explicit overwrite sync (used only when user explicitly confirms restore or deletes a record)
export async function forceSyncToCloud(payload: CloudPayload): Promise<boolean> {
  try {
    const dataRef = ref(db, 'fia_data');
    const enriched: CloudPayload = {
      ...payload,
      _meta: {
        updatedAt: Date.now(),
        clientId: myClientId,
      }
    };
    await set(dataRef, enriched);
    saveDailySnapshot(enriched).catch(() => {});
    return true;
  } catch (err) {
    console.error('Failed force sync to Firebase:', err);
    return false;
  }
}

export async function saveDailySnapshot(payload: CloudPayload): Promise<boolean> {
  try {
    const today = new Date().toISOString().split('T')[0];
    const snapRef = ref(db, `fia_daily_backups/${today}`);
    await set(snapRef, {
      ...payload,
      _meta: {
        updatedAt: Date.now(),
        snapshotDate: today,
        clientId: myClientId,
      }
    });
    return true;
  } catch (err) {
    console.warn('Failed to save daily snapshot to Firebase:', err);
    return false;
  }
}
