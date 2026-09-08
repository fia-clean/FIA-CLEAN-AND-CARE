/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { subscribeToCloud, syncToCloud, forceSyncToCloud, saveDailySnapshot, CloudPayload } from './firebase';
import { Header } from './components/Header';
import { Navbar, TabType } from './components/Navbar';
import { Dashboard } from './components/Dashboard';
import { InvoicingManager } from './components/InvoicingManager';
import { CustomerManager } from './components/CustomerManager';
import { OperationsManager } from './components/OperationsManager';
import { DayBook } from './components/DayBook';
import { BillInvoiceModal } from './components/BillInvoiceModal';
import { getTodayDateString } from './utils/formatters';
import { PinModal } from './components/PinModal';
import { SettingsModal } from './components/SettingsModal';
import {
  initialCleaningProducts,
  initialCosmeticProducts,
  initialCustomers,
  initialSuppliers,
  initialSales,
  initialPurchases,
  initialExpenses,
} from './data/initialData';
import {
  Product,
  CosmeticProduct,
  CustomerProfile,
  Supplier,
  SaleRecord,
  PurchaseRecord,
  ExpenseRecord,
  StockReturnRecord,
} from './types';

export default function App() {
  // Authentication & Security - Starts locked by default (requires login on opening)
  const [isUnlocked, setIsUnlocked] = useState<boolean>(false);
  const [appPin, setAppPin] = useState<string>(() => {
    return localStorage.getItem('fia_app_pin') || '1234';
  });

  // Navigation: Defaults to Dashboard
  const [activeTab, setActiveTab] = useState<TabType>('home');
  const [invoicingSubTab, setInvoicingSubTab] = useState<'cleaning' | 'cosmetics' | 'history'>('cleaning');
  const [operationsSubTab, setOperationsSubTab] = useState<'stock' | 'purchases' | 'expenses'>('stock');

  // Modals
  const [previewSale, setPreviewSale] = useState<SaleRecord | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Filter predicates to completely eliminate preloaded demo/sample records
  const isPreloadedCleaningProduct = (p: Product) => {
    if (!p) return true;
    const dummyIds = ['prod_1', 'prod_2', 'prod_3', 'prod_4', 'prod_5', 'prod_6'];
    const dummyNames = [
      'dish wash liquid (concentrate)',
      'floor cleaner & disinfectant',
      'premium car wash shampoo',
      'toilet cleaner power gel',
      'liquid laundry detergent',
      'glass & surface cleaner',
    ];
    const dummyBarcodes = [
      '8901234001',
      '8901234002',
      '8901234003',
      '8901234004',
      '8901234005',
      '8901234006',
    ];
    return (
      dummyIds.includes(p.id) ||
      dummyNames.includes((p.name || '').trim().toLowerCase()) ||
      (p.barcode && dummyBarcodes.includes(p.barcode.trim()))
    );
  };

  const isPreloadedCosmeticProduct = (p: CosmeticProduct) => {
    if (!p) return true;
    const dummyIds = ['cprod_1', 'cprod_2', 'cprod_3', 'cprod_4'];
    const dummyNames = [
      'pure herbal hair oil',
      'moisturizing face wash aloe',
      'rose water toner pure',
      'herbal body lotion 200ml',
    ];
    const dummyBarcodes = ['8905678001', '8905678002', '8905678003', '8905678004'];
    return (
      dummyIds.includes(p.id) ||
      dummyNames.includes((p.name || '').trim().toLowerCase()) ||
      (p.barcode && dummyBarcodes.includes(p.barcode.trim()))
    );
  };

  const isPreloadedSupplier = (s: Supplier) => {
    if (!s) return true;
    const dummyIds = ['sup_1', 'sup_2', 'sup_3'];
    const dummyNames = [
      'kerala chem agencies',
      'crown packaging ind.',
      'green herbs traders',
    ];
    const dummyMobiles = ['9846012345', '9447112233', '9744889900'];
    return (
      dummyIds.includes(s.id) ||
      dummyNames.includes((s.name || '').trim().toLowerCase()) ||
      (s.mobile && dummyMobiles.includes(s.mobile.trim()))
    );
  };

  const isPreloadedMockCustomer = (c: CustomerProfile) => {
    if (!c || !c.name) return true;
    const dummyIds = ['cust_1', 'cust_2', 'cust_3', 'cust_4', 'cust_5'];
    const dummyNames = [
      'rahul k.',
      'anjali nair',
      'saji thomas',
      'al-madina hypermarket',
      'walk-in customer',
    ];
    const dummyPhones = ['9847123456', '9446011223', '9745566778', '9895001122'];
    return (
      dummyIds.includes(c.id) ||
      dummyNames.includes(c.name.trim().toLowerCase()) ||
      (c.phone && dummyPhones.includes(c.phone.trim()))
    );
  };

  const isPreloadedSale = (s: SaleRecord) => {
    if (!s) return true;
    const dummyIds = ['sale_1', 'sale_2', 'sale_3'];
    const dummyBillNos = ['cln-0042', 'cln-0041', 'cos-0012'];
    const dummyCustomerNames = [
      'rahul k.',
      'anjali nair',
      'saji thomas',
      'al-madina hypermarket',
      'walk-in customer',
    ];
    if (dummyIds.includes(s.id)) return true;
    if (s.billNo && dummyBillNos.includes(s.billNo.trim().toLowerCase())) return true;
    if (s.name && dummyCustomerNames.includes(s.name.trim().toLowerCase())) return true;
    return false;
  };

  const isPreloadedPurchase = (p: PurchaseRecord) => {
    if (!p) return true;
    const dummyIds = ['purch_1'];
    const dummySuppliers = ['kerala chem agencies', 'crown packaging ind.', 'green herbs traders'];
    if (dummyIds.includes(p.id)) return true;
    if (dummySuppliers.includes((p.supplierName || '').trim().toLowerCase())) return true;
    if ((p.rawMaterial || '').trim().toLowerCase() === 'dish wash raw concentrate') return true;
    return false;
  };

  const isPreloadedExpense = (e: ExpenseRecord) => {
    if (!e) return true;
    const dummyIds = ['exp_1', 'exp_2'];
    const dummyTitles = [
      'electricity bill shop',
      'delivery & transport charges',
    ];
    if (dummyIds.includes(e.id)) return true;
    if (dummyTitles.includes((e.title || '').trim().toLowerCase())) return true;
    return false;
  };

  // Automatic rolling backup vault: preserves snapshots across updates and sync events
  const saveToRollingVault = (allData: any) => {
    try {
      const VAULT_KEY = 'fia_backup_vault_history';
      const raw = localStorage.getItem(VAULT_KEY);
      let history: any[] = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(history)) history = [];

      const custCount = (allData.customers || []).length;
      const prodCount = (allData.products || []).length + (allData.cosProducts || []).length;
      const saleCount = (allData.sales || []).length;

      if (custCount === 0 && prodCount === 0 && saleCount === 0) return;

      const last = history[0];
      if (
        last &&
        last.custCount === custCount &&
        last.prodCount === prodCount &&
        last.saleCount === saleCount &&
        Date.now() - last.timestamp < 120000
      ) {
        return;
      }

      const now = new Date();
      const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const dateString = now.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });

      const snapshot = {
        id: 'vault_' + Date.now(),
        timestamp: Date.now(),
        displayLabel: `${dateString} at ${timeString}`,
        custCount,
        prodCount,
        saleCount,
        data: {
          products: allData.products,
          cosProducts: allData.cosProducts,
          customers: allData.customers,
          suppliers: allData.suppliers,
          sales: allData.sales,
          purchases: allData.purchases,
          expenses: allData.expenses,
          stockReturns: allData.stockReturns,
          clearedDayBookIds: allData.clearedDayBookIds,
          appPin: allData.appPin,
        }
      };

      history.unshift(snapshot);
      if (history.length > 20) {
        history = history.slice(0, 20);
      }
      localStorage.setItem(VAULT_KEY, JSON.stringify(history));
    } catch (err) {
      console.warn('Vault auto-save error:', err);
    }
  };

  // Application Data States (Loaded with Deep Legacy Migration & Fallback protection)
  const [products, setProducts] = useState<Product[]>(() => {
    try {
      const saved = localStorage.getItem('fia_products');
      if (saved !== null) {
        const parsed: Product[] = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.filter((p) => !isPreloadedCleaningProduct(p)).sort((a, b) =>
            (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' })
          );
        }
      }
      return initialCleaningProducts.filter((p) => !isPreloadedCleaningProduct(p)).sort((a, b) =>
        (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' })
      );
    } catch {
      return [];
    }
  });

  const [cosProducts, setCosProducts] = useState<CosmeticProduct[]>(() => {
    try {
      const saved = localStorage.getItem('fia_cosproducts');
      if (saved !== null) {
        const parsed: CosmeticProduct[] = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.filter((p) => !isPreloadedCosmeticProduct(p)).sort((a, b) =>
            (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' })
          );
        }
      }
      return initialCosmeticProducts.filter((p) => !isPreloadedCosmeticProduct(p)).sort((a, b) =>
        (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' })
      );
    } catch {
      return [];
    }
  });

  // Load Customers with DEEP MIGRATION from fia_customers_profiles, legacy fia_customers, and backup vault
  const [customers, setCustomers] = useState<CustomerProfile[]>(() => {
    try {
      const saved = localStorage.getItem('fia_customers_profiles');
      if (saved !== null) {
        const parsed: CustomerProfile[] = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.filter((c) => c && c.name && !isPreloadedMockCustomer(c)).sort((a, b) =>
            (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' })
          );
        }
      }

      const map = new Map<string, CustomerProfile>();

      // 1. Initial baseline (only for first-time boot)
      initialCustomers.forEach((c) => {
        if (!isPreloadedMockCustomer(c) && c && c.name) {
          map.set(c.id, c);
        }
      });

      // 2. DEEP MIGRATION: Check legacy fia_customers (from standalone HTML app)
      const legacyRaw = localStorage.getItem('fia_customers');
      if (legacyRaw) {
        try {
          const legacy = JSON.parse(legacyRaw);
          if (Array.isArray(legacy)) {
            legacy.forEach((item: any, idx: number) => {
              if (item && item.name && typeof item.name === 'string' && item.name.trim().length > 0) {
                const normName = item.name.trim().toUpperCase();
                const profile: CustomerProfile = {
                  id: item.id || `cust_mig_${Date.now()}_${idx}`,
                  name: normName,
                  phone: (item.phone || '').trim(),
                  createdAt: item.date || item.createdAt || new Date().toISOString().split('T')[0],
                };
                if (!isPreloadedMockCustomer(profile)) {
                  const exists = Array.from(map.values()).some(
                    (ex) => ex.name.toLowerCase().trim() === normName.toLowerCase()
                  );
                  if (!exists) {
                    map.set(profile.id, profile);
                  }
                }
              }
            });
          }
        } catch (e) {
          console.warn('Legacy fia_customers migration error:', e);
        }
      }

      // 3. DEEP MIGRATION: Check Rolling Vault for any historical customer profiles
      const vaultRaw = localStorage.getItem('fia_backup_vault_history');
      if (vaultRaw) {
        try {
          const vault = JSON.parse(vaultRaw);
          if (Array.isArray(vault) && vault.length > 0) {
            vault.forEach((snap: any) => {
              const vaultCusts = snap?.data?.customers;
              if (Array.isArray(vaultCusts)) {
                vaultCusts.forEach((c: CustomerProfile) => {
                  if (c && c.name && !isPreloadedMockCustomer(c)) {
                    const normName = c.name.trim().toUpperCase();
                    const exists = Array.from(map.values()).some(
                      (ex) => ex.name.toLowerCase().trim() === normName.toLowerCase()
                    );
                    if (!exists) {
                      map.set(c.id, { ...c, name: normName });
                    }
                  }
                });
              }
            });
          }
        } catch {}
      }

      return Array.from(map.values()).sort((a, b) =>
        (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' })
      );
    } catch {
      return [];
    }
  });

  const [suppliers, setSuppliers] = useState<Supplier[]>(() => {
    try {
      const saved = localStorage.getItem('fia_suppliers');
      if (saved !== null) {
        const parsed: Supplier[] = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.filter((s) => !isPreloadedSupplier(s)).sort((a, b) =>
            (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' })
          );
        }
      }

      return initialSuppliers.filter((s) => !isPreloadedSupplier(s)).sort((a, b) =>
        (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' })
      );
    } catch {
      return [];
    }
  });

  const [sales, setSales] = useState<SaleRecord[]>(() => {
    try {
      const saved = localStorage.getItem('fia_sales_records');
      if (saved !== null) {
        const parsed: SaleRecord[] = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.filter((s) => !isPreloadedSale(s));
        }
      }

      const map = new Map<string, SaleRecord>();
      initialSales.forEach(s => {
        if (!isPreloadedSale(s)) map.set(s.id, s);
      });

      // Check legacy fia_customers storage key for completed sales
      const legacyCustomers = localStorage.getItem('fia_customers');
      if (legacyCustomers) {
        const legacy = JSON.parse(legacyCustomers);
        if (Array.isArray(legacy) && legacy.length > 0) {
          legacy
            .filter((item: any) => item && Array.isArray(item.items) && item.items.length > 0)
            .forEach((item: any, idx: number) => {
              const id = item.id || `legacy_sale_${idx}`;
              if (!map.has(id)) {
                map.set(id, {
                  id,
                  billNo: item.billNo || `CLN-${String(idx + 1).padStart(4, '0')}`,
                  type: 'cleaning' as const,
                  name: item.name || 'Customer',
                  phone: item.phone || '',
                  saleType: item.saleType || 'Retail',
                  paymentMode: item.paymentMode || 'Cash',
                  items: item.items || [],
                  grandTotal: Number(item.grandTotal || 0),
                  paidAmount: Number(item.paidAmount !== undefined ? item.paidAmount : item.grandTotal || 0),
                  pendingAmount: Number(item.pendingAmount || 0),
                  excessAmount: Number(item.excessAmount || 0),
                  date: item.date || new Date().toISOString().split('T')[0],
                  createdAt: item.createdAt || Date.now()
                });
              }
            });
        }
      }
      return Array.from(map.values());
    } catch {
      return [];
    }
  });

  const [purchases, setPurchases] = useState<PurchaseRecord[]>(() => {
    try {
      const saved = localStorage.getItem('fia_purchases_records');
      if (saved !== null) {
        const parsed: PurchaseRecord[] = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.filter((p) => !isPreloadedPurchase(p));
        }
      }

      const map = new Map<string, PurchaseRecord>();
      initialPurchases.forEach(p => {
        if (!isPreloadedPurchase(p)) map.set(p.id, p);
      });

      // Deep migration: legacy fia_purchases key
      const legacyPurchases = localStorage.getItem('fia_purchases');
      if (legacyPurchases) {
        const legacy = JSON.parse(legacyPurchases);
        if (Array.isArray(legacy)) {
          legacy.forEach((item: any, idx: number) => {
            const id = item.id || `legacy_purch_${idx}`;
            if (!map.has(id)) {
              map.set(id, {
                id,
                supplierName: item.supplierName || item.supplier || 'Supplier',
                supplierMobile: item.supplierMobile || '',
                type: item.type || 'cleaning',
                stockId: item.stockId || '',
                rawMaterial: item.rawMaterial || item.item || 'Item',
                rawBarcode: item.rawBarcode || '',
                rawQty: Number(item.rawQty || item.qty || 0),
                rawUnit: item.rawUnit || item.unit || 'Ltr',
                rawUnitPrice: Number(item.rawUnitPrice || 0),
                rawCost: Number(item.rawCost || item.totalCost || item.amount || 0),
                paid: Number(item.paid || 0),
                balance: Number(item.balance || 0),
                date: item.date || new Date().toISOString().split('T')[0],
              });
            }
          });
        }
      }

      return Array.from(map.values());
    } catch {
      return [];
    }
  });

  const [expenses, setExpenses] = useState<ExpenseRecord[]>(() => {
    try {
      const saved = localStorage.getItem('fia_expenses_records');
      if (saved !== null) {
        const parsed: ExpenseRecord[] = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.filter((e) => !isPreloadedExpense(e));
        }
      }

      const map = new Map<string, ExpenseRecord>();
      initialExpenses.forEach(e => {
        if (!isPreloadedExpense(e)) map.set(e.id, e);
      });

      // Deep migration: legacy fia_expenses key
      const legacyExpenses = localStorage.getItem('fia_expenses');
      if (legacyExpenses) {
        const legacy = JSON.parse(legacyExpenses);
        if (Array.isArray(legacy)) {
          legacy.forEach((item: any, idx: number) => {
            const id = item.id || `legacy_exp_${idx}`;
            if (!map.has(id)) {
              map.set(id, {
                id,
                title: item.title || item.category || 'Expense',
                amount: Number(item.amount || 0),
                category: item.category || 'Shop Expense',
                date: item.date || new Date().toISOString().split('T')[0],
                notes: item.notes || '',
              });
            }
          });
        }
      }

      return Array.from(map.values());
    } catch {
      return [];
    }
  });

  const [stockReturns, setStockReturns] = useState<StockReturnRecord[]>(() => {
    try {
      const saved = localStorage.getItem('fia_stock_returns_records');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [clearedDayBookIds, setClearedDayBookIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('fia_cleared_daybook_ids');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Realtime Cloud Sync Tracking
  const isRemoteUpdateRef = useRef<boolean>(false);

  // Cloud / Offline Sync state
  const [syncStatus, setSyncStatus] = useState<{ connected: boolean; message: string }>({
    connected: false,
    message: 'Connecting to Cloud...',
  });

  // 1. Subscribe to Firebase Realtime Database with NON-DESTRUCTIVE UNION MERGE
  useEffect(() => {
    const unsubscribe = subscribeToCloud(
      (cloudData) => {
        isRemoteUpdateRef.current = true;

        if (Array.isArray(cloudData.products)) {
          setProducts(cloudData.products.filter((p) => !isPreloadedCleaningProduct(p)).sort((a, b) =>
            (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' })
          ));
        }
        if (Array.isArray(cloudData.cosProducts)) {
          setCosProducts(cloudData.cosProducts.filter((p) => !isPreloadedCosmeticProduct(p)).sort((a, b) =>
            (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' })
          ));
        }
        if (Array.isArray(cloudData.customers)) {
          setCustomers(cloudData.customers.filter((c) => c && c.name && !isPreloadedMockCustomer(c)).sort((a, b) =>
            (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' })
          ));
        }
        if (Array.isArray(cloudData.suppliers)) {
          setSuppliers(cloudData.suppliers.filter((s) => !isPreloadedSupplier(s)).sort((a, b) =>
            (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' })
          ));
        }
        if (Array.isArray(cloudData.sales)) {
          setSales(cloudData.sales.filter((s) => !isPreloadedSale(s)));
        }
        if (Array.isArray(cloudData.purchases)) {
          setPurchases(cloudData.purchases.filter((p) => !isPreloadedPurchase(p)));
        }
        if (Array.isArray(cloudData.expenses)) {
          setExpenses(cloudData.expenses.filter((e) => !isPreloadedExpense(e)));
        }
        if (Array.isArray(cloudData.stockReturns)) {
          setStockReturns(cloudData.stockReturns);
        }
        if (Array.isArray(cloudData.clearedDayBookIds)) {
          setClearedDayBookIds(cloudData.clearedDayBookIds);
        }
        if (cloudData.appPin) {
          setAppPin(cloudData.appPin);
        }

        setSyncStatus({ connected: true, message: 'Cloud Synchronized' });

        setTimeout(() => {
          isRemoteUpdateRef.current = false;
        }, 150);
      },
      (error) => {
        console.warn('Firebase realtime sync error:', error);
        setSyncStatus({ connected: false, message: 'Offline Mode (Local Cache)' });
      }
    );

    return () => {
      unsubscribe();
    };
  }, []);

  // Persist states to LocalStorage & Sync updates to Cloud
  useEffect(() => {
    try {
      localStorage.setItem('fia_products', JSON.stringify(products));
      localStorage.setItem('fia_cosproducts', JSON.stringify(cosProducts));
      localStorage.setItem('fia_customers_profiles', JSON.stringify(customers));
      localStorage.setItem('fia_suppliers', JSON.stringify(suppliers));
      localStorage.setItem('fia_sales_records', JSON.stringify(sales));
      localStorage.setItem('fia_purchases_records', JSON.stringify(purchases));
      localStorage.setItem('fia_expenses_records', JSON.stringify(expenses));
      localStorage.setItem('fia_stock_returns_records', JSON.stringify(stockReturns));
      localStorage.setItem('fia_cleared_daybook_ids', JSON.stringify(clearedDayBookIds));
      localStorage.setItem('fia_app_pin', appPin);
    } catch (err) {
      console.warn('LocalStorage save error:', err);
    }

    if (isRemoteUpdateRef.current) {
      return;
    }

    const payload = {
      products,
      cosProducts,
      customers,
      suppliers,
      sales,
      purchases,
      expenses,
      stockReturns,
      clearedDayBookIds,
      appPin,
    };

    const timer = setTimeout(async () => {
      setSyncStatus((prev) => ({ ...prev, message: 'Syncing to Cloud...' }));
      const ok = await syncToCloud(payload);
      if (ok) {
        setSyncStatus({ connected: true, message: 'Cloud Synchronized' });
      } else {
        setSyncStatus({ connected: false, message: 'Offline Mode' });
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [
    products,
    cosProducts,
    customers,
    suppliers,
    sales,
    purchases,
    expenses,
    stockReturns,
    clearedDayBookIds,
    appPin,
  ]);

  // Handlers for Products
  const handleSaveProduct = (newProd: Product) => {
    setProducts((prev) =>
      [...prev, newProd].sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }))
    );
  };
  const handleUpdateProduct = (updated: Product) => {
    setProducts((prev) =>
      prev.map((p) => (p.id === updated.id ? updated : p)).sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }))
    );
  };
  const handleDeleteProduct = (id: string) => {
    setProducts((prev) => {
      const next = prev.filter((p) => p.id !== id);
      try {
        localStorage.setItem('fia_products', JSON.stringify(next));
      } catch (e) {
        console.warn('Error saving products after delete:', e);
      }
      return next;
    });
  };

  // Handlers for Cosmetics
  const handleSaveCosProduct = (newProd: CosmeticProduct) => {
    setCosProducts((prev) =>
      [...prev, newProd].sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }))
    );
  };
  const handleUpdateCosProduct = (updated: CosmeticProduct) => {
    setCosProducts((prev) =>
      prev.map((p) => (p.id === updated.id ? updated : p)).sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }))
    );
  };
  const handleDeleteCosProduct = (id: string) => {
    setCosProducts((prev) => {
      const next = prev.filter((p) => p.id !== id);
      try {
        localStorage.setItem('fia_cosproducts', JSON.stringify(next));
      } catch (e) {
        console.warn('Error saving cosProducts after delete:', e);
      }
      return next;
    });
  };

  // Handlers for Customers
  const handleAddCustomer = (c: CustomerProfile) => {
    setCustomers((prev) =>
      [...prev, c].sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }))
    );
  };
  const handleUpdateCustomer = (updated: CustomerProfile) => {
    setCustomers((prev) =>
      prev.map((c) => (c.id === updated.id ? updated : c)).sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }))
    );
  };
  const handleBatchAddCustomers = (newCusts: CustomerProfile[]) => {
    setCustomers((prev) => {
      const map = new Map<string, CustomerProfile>();
      prev.forEach((c) => {
        if (c && c.name) map.set(c.id, c);
      });
      newCusts.forEach((c) => {
        if (!c || !c.name) return;
        const norm = c.name.trim().toUpperCase();
        const existing = Array.from(map.values()).find(
          (ex) => ex.name.toLowerCase().trim() === norm.toLowerCase()
        );
        if (existing) {
          map.set(existing.id, { ...existing, phone: c.phone || existing.phone });
        } else {
          map.set(c.id, { ...c, name: norm });
        }
      });
      return Array.from(map.values()).sort((a, b) =>
        (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' })
      );
    });
  };
  const handleDeleteCustomer = (id: string, deleteAssociatedInvoices: boolean = false) => {
    const customer = customers.find((c) => c.id === id);
    setCustomers((prev) => {
      const next = prev.filter((c) => c.id !== id);
      try {
        localStorage.setItem('fia_customers_profiles', JSON.stringify(next));
        // Also purge from legacy fia_customers if present so it does not resurrect
        const legacyRaw = localStorage.getItem('fia_customers');
        if (legacyRaw) {
          const parsed = JSON.parse(legacyRaw);
          if (Array.isArray(parsed)) {
            const filteredLeg = parsed.filter((item: any) =>
              item.id !== id && (customer ? (item.name || '').trim().toUpperCase() !== (customer.name || '').trim().toUpperCase() : true)
            );
            localStorage.setItem('fia_customers', JSON.stringify(filteredLeg));
          }
        }
      } catch (e) {
        console.warn('Error saving customers after delete:', e);
      }
      return next;
    });

    if (deleteAssociatedInvoices && customer) {
      setSales((prev) => {
        const nextSales = prev.filter((s) => {
          const matchName = (s.name || '').trim().toLowerCase() === (customer.name || '').trim().toLowerCase();
          const matchPhone = customer.phone && s.phone && s.phone.trim() === customer.phone.trim();
          return !(matchName || matchPhone);
        });
        try {
          localStorage.setItem('fia_sales_records', JSON.stringify(nextSales));
        } catch (e) {
          console.warn('Error saving sales after customer delete:', e);
        }
        return nextSales;
      });
    }
  };
  const handleClearAllCustomers = () => {
    setCustomers([]);
    try {
      localStorage.setItem('fia_customers_profiles', JSON.stringify([]));
    } catch (e) {
      console.warn('Error clearing customer profiles:', e);
    }
  };

  const handleClearAllData = () => {
    setProducts([]);
    setCosProducts([]);
    setCustomers([]);
    setSuppliers([]);
    setSales([]);
    setPurchases([]);
    setExpenses([]);
    setStockReturns([]);
    setClearedDayBookIds([]);
    try {
      localStorage.setItem('fia_products', JSON.stringify([]));
      localStorage.setItem('fia_cosproducts', JSON.stringify([]));
      localStorage.setItem('fia_customers_profiles', JSON.stringify([]));
      localStorage.setItem('fia_suppliers', JSON.stringify([]));
      localStorage.setItem('fia_sales_records', JSON.stringify([]));
      localStorage.setItem('fia_purchases_records', JSON.stringify([]));
      localStorage.setItem('fia_expenses_records', JSON.stringify([]));
      localStorage.setItem('fia_stock_returns_records', JSON.stringify([]));
      localStorage.setItem('fia_cleared_daybook_ids', JSON.stringify([]));
    } catch (e) {
      console.warn('Error clearing all app data:', e);
    }
  };

  // Handlers for Sales
  const handleSaveSale = (sale: SaleRecord) => {
    // Deduct stock for all items
    if (sale.type === 'cleaning') {
      setProducts((prev) =>
        prev.map((p) => {
          const matchingItems = sale.items.filter((item) => item.stockId === p.id);
          const deduction = matchingItems.reduce((sum, i) => sum + i.stockDeductionQty, 0);
          return deduction > 0 ? { ...p, stock: Math.max(0, p.stock - deduction) } : p;
        })
      );
    } else {
      setCosProducts((prev) =>
        prev.map((p) => {
          const matchingItems = sale.items.filter((item) => item.stockId === p.id);
          const deduction = matchingItems.reduce((sum, i) => sum + i.stockDeductionQty, 0);
          return deduction > 0 ? { ...p, stock: Math.max(0, p.stock - deduction) } : p;
        })
      );
    }
    setSales((prev) => [sale, ...prev]);
  };

  const handleUpdateSale = (updatedSale: SaleRecord) => {
    // Restore previous stock then deduct new
    const oldSale = sales.find((s) => s.id === updatedSale.id);
    if (oldSale) {
      if (oldSale.type === 'cleaning') {
        setProducts((prev) =>
          prev.map((p) => {
            const oldMatches = oldSale.items.filter((i) => i.stockId === p.id);
            const restoreQty = oldMatches.reduce((s, i) => s + i.stockDeductionQty, 0);
            const newMatches = updatedSale.items.filter((i) => i.stockId === p.id);
            const deductQty = newMatches.reduce((s, i) => s + i.stockDeductionQty, 0);
            return { ...p, stock: Math.max(0, p.stock + restoreQty - deductQty) };
          })
        );
      } else {
        setCosProducts((prev) =>
          prev.map((p) => {
            const oldMatches = oldSale.items.filter((i) => i.stockId === p.id);
            const restoreQty = oldMatches.reduce((s, i) => s + i.stockDeductionQty, 0);
            const newMatches = updatedSale.items.filter((i) => i.stockId === p.id);
            const deductQty = newMatches.reduce((s, i) => s + i.stockDeductionQty, 0);
            return { ...p, stock: Math.max(0, p.stock + restoreQty - deductQty) };
          })
        );
      }
    }
    setSales((prev) => prev.map((s) => (s.id === updatedSale.id ? updatedSale : s)));
  };

  const handleDeleteSale = (saleId: string) => {
    const sale = sales.find((s) => s.id === saleId);
    if (sale) {
      if (sale.type === 'cleaning') {
        setProducts((prev) => {
          const nextProds = prev.map((p) => {
            const matches = sale.items.filter((i) => i.stockId === p.id);
            const restoreQty = matches.reduce((s, i) => s + i.stockDeductionQty, 0);
            return restoreQty > 0 ? { ...p, stock: p.stock + restoreQty } : p;
          });
          try {
            localStorage.setItem('fia_products', JSON.stringify(nextProds));
          } catch (e) {
            console.warn(e);
          }
          return nextProds;
        });
      } else {
        setCosProducts((prev) => {
          const nextCos = prev.map((p) => {
            const matches = sale.items.filter((i) => i.stockId === p.id);
            const restoreQty = matches.reduce((s, i) => s + i.stockDeductionQty, 0);
            return restoreQty > 0 ? { ...p, stock: p.stock + restoreQty } : p;
          });
          try {
            localStorage.setItem('fia_cosproducts', JSON.stringify(nextCos));
          } catch (e) {
            console.warn(e);
          }
          return nextCos;
        });
      }
    }
    setSales((prev) => {
      const nextSales = prev.filter((s) => s.id !== saleId);
      try {
        localStorage.setItem('fia_sales_records', JSON.stringify(nextSales));
        // Clean legacy fia_customers if sale was recorded there
        const legacy = localStorage.getItem('fia_customers');
        if (legacy) {
          const parsed = JSON.parse(legacy);
          if (Array.isArray(parsed)) {
            const filtered = parsed.filter((item: any) => item.id !== saleId && item.billNo !== sale?.billNo);
            localStorage.setItem('fia_customers', JSON.stringify(filtered));
          }
        }
      } catch (e) {
        console.warn(e);
      }
      return nextSales;
    });
  };

  const handleEditSaleFromHistory = (sale: SaleRecord) => {
    setActiveTab('invoicing');
    setInvoicingSubTab(sale.type === 'cleaning' ? 'cleaning' : 'cosmetics');
  };

  // Handlers for Purchases & Expenses
  const handleSavePurchase = (p: PurchaseRecord) => {
    setPurchases((prev) => [p, ...prev]);
  };
  const handleUpdatePurchase = (p: PurchaseRecord) => {
    setPurchases((prev) => prev.map((item) => (item.id === p.id ? p : item)));
  };
  const handleDeletePurchase = (id: string) => {
    setPurchases((prev) => {
      const nextPurchases = prev.filter((p) => p.id !== id);
      try {
        localStorage.setItem('fia_purchases_records', JSON.stringify(nextPurchases));
        const legacy = localStorage.getItem('fia_purchases');
        if (legacy) {
          const parsed = JSON.parse(legacy);
          if (Array.isArray(parsed)) {
            const filtered = parsed.filter((item: any) => item.id !== id);
            localStorage.setItem('fia_purchases', JSON.stringify(filtered));
          }
        }
      } catch (e) {
        console.warn(e);
      }
      return nextPurchases;
    });
  };
  const handleAddSupplier = (s: Supplier) => {
    setSuppliers((prev) =>
      [...prev, s].sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }))
    );
  };

  const handleSaveExpense = (e: ExpenseRecord) => {
    setExpenses((prev) => [e, ...prev]);
  };
  const handleUpdateExpense = (e: ExpenseRecord) => {
    setExpenses((prev) => prev.map((item) => (item.id === e.id ? e : item)));
  };
  const handleDeleteExpense = (id: string) => {
    setExpenses((prev) => {
      const nextExpenses = prev.filter((e) => e.id !== id);
      try {
        localStorage.setItem('fia_expenses_records', JSON.stringify(nextExpenses));
        const legacy = localStorage.getItem('fia_expenses');
        if (legacy) {
          const parsed = JSON.parse(legacy);
          if (Array.isArray(parsed)) {
            const filtered = parsed.filter((item: any) => item.id !== id);
            localStorage.setItem('fia_expenses', JSON.stringify(filtered));
          }
        }
      } catch (e) {
        console.warn(e);
      }
      return nextExpenses;
    });
  };
  const handleSaveStockReturn = (ret: StockReturnRecord) => {
    setStockReturns((prev) => [ret, ...prev]);
  };

  const handleClearDayBook = (entryIds: string[]) => {
    setClearedDayBookIds((prev) => {
      const updated = [...new Set([...prev, ...entryIds])];
      try {
        localStorage.setItem('fia_cleared_daybook_ids', JSON.stringify(updated));
      } catch (e) {
        console.warn('Failed to save cleared ids', e);
      }
      return updated;
    });
  };

  const handleRestoreClearedDayBook = () => {
    setClearedDayBookIds([]);
    try {
      localStorage.setItem('fia_cleared_daybook_ids', JSON.stringify([]));
    } catch (e) {
      console.warn('Failed to clear daybook ids', e);
    }
  };

  const handleRestoreBackup = (data: any) => {
    if (Array.isArray(data.products)) setProducts(data.products);
    if (Array.isArray(data.cosProducts)) setCosProducts(data.cosProducts);
    if (Array.isArray(data.customers)) setCustomers(data.customers);
    if (Array.isArray(data.suppliers)) setSuppliers(data.suppliers);
    if (Array.isArray(data.sales)) setSales(data.sales);
    if (Array.isArray(data.purchases)) setPurchases(data.purchases);
    if (Array.isArray(data.expenses)) setExpenses(data.expenses);
    if (Array.isArray(data.stockReturns)) setStockReturns(data.stockReturns);
    if (Array.isArray(data.clearedDayBookIds)) setClearedDayBookIds(data.clearedDayBookIds);
    if (data.appPin) {
      setAppPin(data.appPin);
      try {
        localStorage.setItem('fia_app_pin', data.appPin);
      } catch (e) {
        console.warn('Failed to save PIN in localStorage', e);
      }
    }
    // Propagate restored data to Cloud and Local Vault immediately
    try {
      forceSyncToCloud(data);
      saveToRollingVault(data);
    } catch (e) {
      console.warn('Failed to sync restored backup:', e);
    }
  };

  const handleManualSync = async () => {
    setSyncStatus({ connected: true, message: 'Syncing to Cloud...' });
    const payload = {
      products,
      cosProducts,
      customers,
      suppliers,
      sales,
      purchases,
      expenses,
      stockReturns,
      clearedDayBookIds,
      appPin,
    };
    const ok = await syncToCloud(payload);
    if (ok) {
      setSyncStatus({ connected: true, message: 'Cloud Synchronized' });
    } else {
      setSyncStatus({ connected: false, message: 'Sync Failed (Offline)' });
    }
  };

  const handleLogout = () => {
    setIsUnlocked(false);
  };

  const handleDownloadBackup = () => {
    const backup = {
      backupVersion: 2,
      app: 'FIA CLEAN & CARE',
      createdAt: new Date().toISOString(),
      data: {
        products,
        cosProducts,
        customers,
        suppliers,
        sales,
        purchases,
        expenses,
        stockReturns,
        clearedDayBookIds,
        appPin,
      },
    };
    const nowStr = new Date().toISOString().split('T')[0];
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `FIA_CLEAN_CARE_BACKUP_${nowStr}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };


  // Automatic Daily Cloud Backup & Local Snapshot
  useEffect(() => {
    if (!isUnlocked) return;
    try {
      const today = new Date().toISOString().split('T')[0];
      const lastBackupDate = localStorage.getItem('fia_last_auto_backup_date');

      if (lastBackupDate !== today && (products.length > 0 || sales.length > 0)) {
        const payload: CloudPayload = {
          products,
          cosProducts,
          customers,
          suppliers,
          sales,
          purchases,
          expenses,
          stockReturns,
          clearedDayBookIds,
          appPin,
        };

        saveDailySnapshot(payload);
        handleDownloadBackup();
        localStorage.setItem('fia_last_auto_backup_date', today);
        console.log('[AutoBackup] Daily automated snapshot & backup downloaded for ' + today);
      }
    } catch (err) {
      console.warn('[AutoBackup] Background daily backup skipped:', err);
    }
  }, [isUnlocked, products.length, sales.length]);

  const handleNavigateTab = (tab: any) => {
    if (tab === 'billing') {
      setActiveTab('invoicing');
      setInvoicingSubTab('cleaning');
    } else if (tab === 'cosmetics') {
      setActiveTab('invoicing');
      setInvoicingSubTab('cosmetics');
    } else if (tab === 'history') {
      setActiveTab('invoicing');
      setInvoicingSubTab('history');
    } else if (tab === 'stock') {
      setActiveTab('operations');
      setOperationsSubTab('stock');
    } else if (tab === 'purchases') {
      setActiveTab('operations');
      setOperationsSubTab('purchases');
    } else if (tab === 'expenses') {
      setActiveTab('operations');
      setOperationsSubTab('expenses');
    } else {
      setActiveTab(tab);
    }
  };

  const handleUpdatePin = (newP: string) => {
    setAppPin(newP);
    try {
      localStorage.setItem('fia_app_pin', newP);
    } catch (e) {
      console.warn('Failed to save PIN in localStorage', e);
    }
  };

  // Badges & Counters
  const lowStockCount =
    products.filter((p) => Number(p.stock) <= 5).length +
    cosProducts.filter((p) => Number(p.stock) <= 5).length;

  const pendingDueCount = sales.filter((s) => s.pendingAmount > 0).length;
  const totalInvoicesCount = sales.length;

  if (!isUnlocked) {
    return (
      <PinModal
        isOpen={true}
        onSuccess={() => setIsUnlocked(true)}
      />
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-100 text-slate-900 font-sans">

      {/* Header */}
      <Header
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenBackup={() => setIsSettingsOpen(true)}
        onLogout={handleLogout}
        onManualSync={handleManualSync}
        syncStatus={syncStatus}
      />

      {/* Navigation matching requested order: Dashboard -> Customers -> Billing & Invoices -> Operations & Stock -> Day Book */}
      <Navbar
        activeTab={activeTab}
        onTabChange={handleNavigateTab}
        pendingDueCount={pendingDueCount}
        lowStockCount={lowStockCount}
        totalInvoicesCount={totalInvoicesCount}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6">
        {activeTab === 'home' && (
          <Dashboard
            products={products}
            cosProducts={cosProducts}
            customers={customers}
            sales={sales}
            purchases={purchases}
            expenses={expenses}
            onNavigate={handleNavigateTab}
            onDownloadBackup={handleDownloadBackup}
            onViewInvoice={(s) => setPreviewSale(s)}
          />
        )}

        {activeTab === 'customers' && (
          <CustomerManager
            customers={customers}
            sales={sales}
            onAddCustomer={handleAddCustomer}
            onBatchAddCustomers={handleBatchAddCustomers}
            onUpdateCustomer={handleUpdateCustomer}
            onDeleteCustomer={handleDeleteCustomer}
            onClearAllCustomers={handleClearAllCustomers}
            onViewInvoice={(s) => setPreviewSale(s)}
          />
        )}

        {(activeTab === 'invoicing' ||
          activeTab === 'billing' ||
          activeTab === 'cosmetics' ||
          activeTab === 'history') && (
          <InvoicingManager
            products={products}
            cosProducts={cosProducts}
            customers={customers}
            sales={sales}
            onSaveSale={handleSaveSale}
            onUpdateSale={handleUpdateSale}
            onDeleteSale={handleDeleteSale}
            onAddCustomer={handleAddCustomer}
            onViewInvoice={(s) => setPreviewSale(s)}
            onEditSale={handleEditSaleFromHistory}
            initialSubTab={invoicingSubTab}
          />
        )}

        {activeTab === 'operations' && (
          <OperationsManager
            initialSubTab={operationsSubTab}
            products={products}
            cosProducts={cosProducts}
            purchases={purchases}
            suppliers={suppliers}
            expenses={expenses}
            stockReturns={stockReturns}
            onSaveProduct={handleSaveProduct}
            onUpdateProduct={handleUpdateProduct}
            onDeleteProduct={handleDeleteProduct}
            onSaveCosProduct={handleSaveCosProduct}
            onUpdateCosProduct={handleUpdateCosProduct}
            onDeleteCosProduct={handleDeleteCosProduct}
            onSavePurchase={handleSavePurchase}
            onUpdatePurchase={handleUpdatePurchase}
            onDeletePurchase={handleDeletePurchase}
            onAddSupplier={handleAddSupplier}
            onSaveExpense={handleSaveExpense}
            onUpdateExpense={handleUpdateExpense}
            onDeleteExpense={handleDeleteExpense}
            onSaveStockReturn={handleSaveStockReturn}
          />
        )}

        {activeTab === 'accounts' && (
          <DayBook
            sales={sales}
            purchases={purchases}
            expenses={expenses}
            clearedEntryIds={clearedDayBookIds}
            onClearDayBook={handleClearDayBook}
            onRestoreClearedDayBook={handleRestoreClearedDayBook}
            onOpenBackupModal={() => setIsSettingsOpen(true)}
          />
        )}
      </main>

      {/* Invoice Modal with PDF Download and Print */}
      <BillInvoiceModal sale={previewSale} onClose={() => setPreviewSale(null)} />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        appPin={appPin}
        allData={{
          products,
          cosProducts,
          customers,
          suppliers,
          sales,
          purchases,
          expenses,
          stockReturns,
          clearedDayBookIds,
          appPin,
        }}
        onClose={() => setIsSettingsOpen(false)}
        onUpdatePin={handleUpdatePin}
        onRestoreBackup={handleRestoreBackup}
        onClearAllData={handleClearAllData}
      />
    </div>
  );
}
