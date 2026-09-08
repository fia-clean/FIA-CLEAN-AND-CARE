import React, { useState } from 'react';
import {
  Package,
  ShoppingCart,
  DollarSign,
  Plus,
  Edit2,
  Trash2,
  RotateCcw,
  BarChart3,
  Search,
  AlertCircle,
  X,
  Check,
  Save,
  Layers,
  Eye,
  Printer,
  FileText,
  CheckCircle2,
  Phone,
  Calendar,
} from 'lucide-react';
import { Product, CosmeticProduct, PurchaseRecord, Supplier, ExpenseRecord, StockReturnRecord, UnitType } from '../types';
import { formatCurrency, formatDateDDMMYYYY, getTodayDateString } from '../utils/formatters';

interface OperationsManagerProps {
  initialSubTab?: 'stock' | 'purchases' | 'expenses';
  products: Product[];
  cosProducts: CosmeticProduct[];
  purchases: PurchaseRecord[];
  suppliers: Supplier[];
  expenses: ExpenseRecord[];
  stockReturns: StockReturnRecord[];
  onSaveProduct: (product: Product) => void;
  onUpdateProduct: (product: Product) => void;
  onDeleteProduct: (id: string) => void;
  onSaveCosProduct: (product: CosmeticProduct) => void;
  onUpdateCosProduct: (product: CosmeticProduct) => void;
  onDeleteCosProduct: (id: string) => void;
  onSavePurchase: (purchase: PurchaseRecord) => void;
  onUpdatePurchase?: (purchase: PurchaseRecord) => void;
  onDeletePurchase: (id: string) => void;
  onAddSupplier: (supplier: Supplier) => void;
  onSaveExpense: (expense: ExpenseRecord) => void;
  onUpdateExpense?: (expense: ExpenseRecord) => void;
  onDeleteExpense: (id: string) => void;
  onSaveStockReturn: (stockReturn: StockReturnRecord) => void;
}

export const OperationsManager: React.FC<OperationsManagerProps> = ({
  products,
  cosProducts,
  purchases,
  suppliers,
  expenses,
  stockReturns,
  onSaveProduct,
  onUpdateProduct,
  onDeleteProduct,
  onSaveCosProduct,
  onUpdateCosProduct,
  onDeleteCosProduct,
  onSavePurchase,
  onUpdatePurchase,
  onDeletePurchase,
  onAddSupplier,
  onSaveExpense,
  onUpdateExpense,
  onDeleteExpense,
  onSaveStockReturn,
  initialSubTab = 'stock',
}) => {
  const [mainTab, setMainTab] = useState<'stock' | 'purchases' | 'expenses'>(initialSubTab);

  React.useEffect(() => {
    if (initialSubTab) {
      setMainTab(initialSubTab);
    }
  }, [initialSubTab]);
  const [stockCategory, setStockCategory] = useState<'cleaning' | 'cosmetics'>('cleaning');
  const [stockActionTab, setStockActionTab] = useState<'add' | 'view' | 'return' | 'consolidated'>('add');
  const [purchaseCategory, setPurchaseCategory] = useState<'cleaning' | 'cosmetics'>('cleaning');
  const [purchaseActionTab, setPurchaseActionTab] = useState<'add' | 'view' | 'return'>('add');

  // Dedicated Modal States for View Stock Edit & Delete
  const [viewingStockItem, setViewingStockItem] = useState<{
    type: 'cleaning' | 'cosmetics';
    id: string;
    name: string;
    barcode?: string;
    stock: number;
    unit: UnitType;
    price1: number; // Wholesale or Cost Price
    price2: number; // Retail or Sale Price
  } | null>(null);

  const [editingStockItem, setEditingStockItem] = useState<{
    type: 'cleaning' | 'cosmetics';
    id: string;
    name: string;
    barcode: string;
    stock: number;
    unit: UnitType;
    price1: number; // Wholesale or Cost Price
    price2: number; // Retail or Sale Price
  } | null>(null);

  const [deletingStockItem, setDeletingStockItem] = useState<{
    type: 'cleaning' | 'cosmetics';
    id: string;
    name: string;
    stock: number;
    unit: string;
  } | null>(null);

  // Dedicated in-app delete modal state for Purchases
  const [deletingPurchaseRecord, setDeletingPurchaseRecord] = useState<PurchaseRecord | null>(null);

  // Dedicated view and delete modal states for Expenses
  const [viewingExpense, setViewingExpense] = useState<ExpenseRecord | null>(null);
  const [deletingExpenseRecord, setDeletingExpenseRecord] = useState<ExpenseRecord | null>(null);

  // Product Form states
  const [editingCleanId, setEditingCleanId] = useState<string | null>(null);
  const [cleanName, setCleanName] = useState('');
  const [cleanBarcode, setCleanBarcode] = useState('');
  const [cleanStock, setCleanStock] = useState<number>(0);
  const [cleanUnit, setCleanUnit] = useState<UnitType>('Ltr');
  const [cleanWholesale, setCleanWholesale] = useState<number>(0);
  const [cleanRetail, setCleanRetail] = useState<number>(0);

  // Add stock to existing
  const [addStockProdId, setAddStockProdId] = useState('');
  const [addStockQty, setAddStockQty] = useState<number>(0);

  // Cosmetic Product Form
  const [editingCosId, setEditingCosId] = useState<string | null>(null);
  const [cosName, setCosName] = useState('');
  const [cosBarcode, setCosBarcode] = useState('');
  const [cosStock, setCosStock] = useState<number>(0);
  const [cosUnit, setCosUnit] = useState<UnitType>('Bottle');
  const [cosCost, setCosCost] = useState<number>(0);
  const [cosSale, setCosSale] = useState<number>(0);

  // Purchase Form states
  const [purchSupplierName, setPurchSupplierName] = useState('');
  const [purchSupplierMobile, setPurchSupplierMobile] = useState('');
  const [purchType, setPurchType] = useState<'cleaning' | 'cosmetics'>('cleaning');
  const [purchStockId, setPurchStockId] = useState('');
  const [purchItemName, setPurchItemName] = useState('');
  const [purchBarcode, setPurchBarcode] = useState('');
  const [purchQty, setPurchQty] = useState<number>(0);
  const [purchUnit, setPurchUnit] = useState<UnitType>('Ltr');
  const [purchUnitPrice, setPurchUnitPrice] = useState<number>(0);
  const [purchTotalCost, setPurchTotalCost] = useState<number>(0);
  const [purchPaid, setPurchPaid] = useState<number>(0);
  const [purchDate, setPurchDate] = useState(getTodayDateString());

  // Purchase Actions States (Edit, View, Return, Search)
  const [editingPurchaseId, setEditingPurchaseId] = useState<string | null>(null);
  const [viewingPurchase, setViewingPurchase] = useState<PurchaseRecord | null>(null);
  const [returnPurchase, setReturnPurchase] = useState<PurchaseRecord | null>(null);
  const [selectedReturnPurchId, setSelectedReturnPurchId] = useState<string>('');
  const [returnQty, setReturnQty] = useState<number>(1);
  const [returnDate, setReturnDate] = useState<string>(getTodayDateString());
  const [returnReason, setReturnReason] = useState<string>('');
  const [purchaseSearchQuery, setPurchaseSearchQuery] = useState<string>('');
  const [purchaseFilterType, setPurchaseFilterType] = useState<'all' | 'cleaning' | 'cosmetics'>('all');
  const [newSupName, setNewSupName] = useState('');
  const [newSupMobile, setNewSupMobile] = useState('');

  // Expense Form
  const [expTitle, setExpTitle] = useState('');
  const [expAmount, setExpAmount] = useState<number>(0);
  const [expDate, setExpDate] = useState(getTodayDateString());
  const [editingExpId, setEditingExpId] = useState<string | null>(null);

  // Stock Return Form
  const [retProductId, setRetProductId] = useState('');
  const [retCustomer, setRetCustomer] = useState('');
  const [retQty, setRetQty] = useState<number>(0);
  const [retCondition, setRetCondition] = useState<'Usable' | 'Damaged'>('Usable');
  const [retReason, setRetReason] = useState('');

  // Search filter
  const [stockSearchQuery, setStockSearchQuery] = useState('');

  // Auto calculate purchase total
  const handlePurchaseQtyPriceChange = (q: number, price: number) => {
    setPurchQty(q);
    setPurchUnitPrice(price);
    const total = Number((q * price).toFixed(2));
    setPurchTotalCost(total);
    setPurchPaid(total);
  };

  // Save Cleaning Product
  const handleSaveCleanProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cleanName.trim()) return;

    const prod: Product = {
      id: editingCleanId || 'prod_' + Date.now(),
      name: cleanName.trim(),
      barcode: cleanBarcode.trim() || undefined,
      stock: Number(cleanStock || 0),
      unit: cleanUnit,
      wholesalePrice: Number(cleanWholesale || 0),
      retailPrice: Number(cleanRetail || 0),
    };

    if (editingCleanId) {
      onUpdateProduct(prod);
      alert('Product updated successfully!');
    } else {
      onSaveProduct(prod);
      alert('Product added to inventory!');
    }

    setEditingCleanId(null);
    setCleanName('');
    setCleanBarcode('');
    setCleanStock(0);
    setCleanWholesale(0);
    setCleanRetail(0);
  };

  const handleEditCleanProduct = (p: Product) => {
    setEditingCleanId(p.id);
    setCleanName(p.name);
    setCleanBarcode(p.barcode || '');
    setCleanStock(p.stock);
    setCleanUnit(p.unit);
    setCleanWholesale(p.wholesalePrice);
    setCleanRetail(p.retailPrice);
    setStockActionTab('add');
  };

  const handleAddStockQuick = () => {
    if (!addStockProdId || addStockQty <= 0) {
      alert('Please choose a product and enter a positive quantity.');
      return;
    }
    const p = products.find((x) => x.id === addStockProdId);
    if (!p) return;
    onUpdateProduct({ ...p, stock: p.stock + addStockQty });
    alert(`Added ${addStockQty} ${p.unit} to ${p.name}!`);
    setAddStockQty(0);
    setAddStockProdId('');
  };

  // View Stock Modal Handlers for Edit and Delete
  const openEditCleanStock = (p: Product) => {
    setEditingStockItem({
      type: 'cleaning',
      id: p.id,
      name: p.name,
      barcode: p.barcode || '',
      stock: p.stock,
      unit: p.unit,
      price1: p.wholesalePrice,
      price2: p.retailPrice,
    });
  };

  const openEditCosStock = (p: CosmeticProduct) => {
    setEditingStockItem({
      type: 'cosmetics',
      id: p.id,
      name: p.name,
      barcode: p.barcode || '',
      stock: p.stock,
      unit: p.unit,
      price1: p.costPrice,
      price2: p.salePrice,
    });
  };

  const handleSaveStockModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStockItem || !editingStockItem.name.trim()) return;

    if (editingStockItem.type === 'cleaning') {
      onUpdateProduct({
        id: editingStockItem.id,
        name: editingStockItem.name.trim(),
        barcode: editingStockItem.barcode.trim() || undefined,
        stock: Number(editingStockItem.stock || 0),
        unit: editingStockItem.unit,
        wholesalePrice: Number(editingStockItem.price1 || 0),
        retailPrice: Number(editingStockItem.price2 || 0),
      });
    } else {
      onUpdateCosProduct({
        id: editingStockItem.id,
        name: editingStockItem.name.trim(),
        barcode: editingStockItem.barcode.trim() || undefined,
        stock: Number(editingStockItem.stock || 0),
        unit: editingStockItem.unit,
        costPrice: Number(editingStockItem.price1 || 0),
        salePrice: Number(editingStockItem.price2 || 0),
      });
    }
    setEditingStockItem(null);
  };

  const handleConfirmDeleteStock = () => {
    if (!deletingStockItem) return;
    if (deletingStockItem.type === 'cleaning') {
      onDeleteProduct(deletingStockItem.id);
    } else {
      onDeleteCosProduct(deletingStockItem.id);
    }
    setDeletingStockItem(null);
  };

  // Save Cosmetic Product
  const handleSaveCosProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cosName.trim()) return;

    const prod: CosmeticProduct = {
      id: editingCosId || 'cprod_' + Date.now(),
      name: cosName.trim(),
      barcode: cosBarcode.trim() || undefined,
      stock: Number(cosStock || 0),
      unit: cosUnit,
      costPrice: Number(cosCost || 0),
      salePrice: Number(cosSale || 0),
    };

    if (editingCosId) {
      onUpdateCosProduct(prod);
      alert('Cosmetic product updated!');
    } else {
      onSaveCosProduct(prod);
      alert('Cosmetic product saved!');
    }

    setEditingCosId(null);
    setCosName('');
    setCosBarcode('');
    setCosStock(0);
    setCosCost(0);
    setCosSale(0);
  };

  const handleEditCosProduct = (p: CosmeticProduct) => {
    setEditingCosId(p.id);
    setCosName(p.name);
    setCosBarcode(p.barcode || '');
    setCosStock(p.stock);
    setCosUnit(p.unit);
    setCosCost(p.costPrice);
    setCosSale(p.salePrice);
    setStockActionTab('add');
  };

  // Cancel Edit Purchase
  const handleCancelEditPurchase = () => {
    setEditingPurchaseId(null);
    setPurchSupplierName('');
    setPurchSupplierMobile('');
    setPurchStockId('');
    setPurchItemName('');
    setPurchBarcode('');
    setPurchQty(0);
    setPurchUnitPrice(0);
    setPurchTotalCost(0);
    setPurchPaid(0);
    setPurchDate(getTodayDateString());
  };

  // Load Purchase for Editing
  const handleEditPurchase = (p: PurchaseRecord) => {
    setEditingPurchaseId(p.id);
    setPurchSupplierName(p.supplierName);
    setPurchSupplierMobile(p.supplierMobile || '');
    setPurchType(p.type || 'cleaning');
    setPurchStockId(p.stockId || '');
    setPurchItemName(p.rawMaterial);
    setPurchBarcode(p.rawBarcode || '');
    setPurchQty(p.rawQty);
    setPurchUnit(p.rawUnit);
    setPurchUnitPrice(
      p.rawUnitPrice || (p.rawQty > 0 ? Number((p.rawCost / p.rawQty).toFixed(2)) : 0)
    );
    setPurchTotalCost(p.rawCost);
    setPurchPaid(p.paid);
    setPurchDate(p.date || getTodayDateString());
    setPurchaseCategory(p.type || 'cleaning');
    setPurchaseActionTab('add');

    // Scroll to purchase form
    const formEl = document.getElementById('purchaseFormCard');
    if (formEl) {
      formEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Save or Update Purchase
  const handleSavePurchase = (e: React.FormEvent) => {
    e.preventDefault();
    if (!purchSupplierName.trim()) {
      alert('Please enter supplier name.');
      return;
    }
    const rawMaterialName = purchStockId
      ? (purchType === 'cleaning'
          ? products.find((p) => p.id === purchStockId)?.name
          : cosProducts.find((p) => p.id === purchStockId)?.name) || purchItemName
      : purchItemName;

    if (!rawMaterialName) {
      alert('Please choose or enter a product name.');
      return;
    }

    const totalCost = Number(purchTotalCost || 0);
    const paid = Number(purchPaid || 0);

    if (editingPurchaseId) {
      const existing = purchases.find((p) => p.id === editingPurchaseId);
      if (existing) {
        // Manage stock adjustments
        if (existing.stockId === purchStockId && purchStockId) {
          const qtyDiff = Number(purchQty || 0) - Number(existing.rawQty || 0);
          if (qtyDiff !== 0) {
            if (purchType === 'cleaning') {
              const prod = products.find((p) => p.id === purchStockId);
              if (prod) onUpdateProduct({ ...prod, stock: Math.max(0, prod.stock + qtyDiff) });
            } else {
              const cprod = cosProducts.find((p) => p.id === purchStockId);
              if (cprod) onUpdateCosProduct({ ...cprod, stock: Math.max(0, cprod.stock + qtyDiff) });
            }
          }
        } else {
          if (existing.stockId) {
            if (existing.type === 'cleaning') {
              const oldP = products.find((p) => p.id === existing.stockId);
              if (oldP) onUpdateProduct({ ...oldP, stock: Math.max(0, oldP.stock - Number(existing.rawQty || 0)) });
            } else {
              const oldCp = cosProducts.find((p) => p.id === existing.stockId);
              if (oldCp) onUpdateCosProduct({ ...oldCp, stock: Math.max(0, oldCp.stock - Number(existing.rawQty || 0)) });
            }
          }
          if (purchStockId) {
            if (purchType === 'cleaning') {
              const newP = products.find((p) => p.id === purchStockId);
              if (newP) onUpdateProduct({ ...newP, stock: newP.stock + Number(purchQty || 0) });
            } else {
              const newCp = cosProducts.find((p) => p.id === purchStockId);
              if (newCp) onUpdateCosProduct({ ...newCp, stock: newCp.stock + Number(purchQty || 0) });
            }
          }
        }

        const returnedAmount = existing.returnedAmount || 0;
        const netPurchaseAmount = Math.max(0, totalCost - returnedAmount);
        const netBalance = Math.max(0, netPurchaseAmount - paid);

        const updatedRecord: PurchaseRecord = {
          ...existing,
          type: purchType,
          supplierName: purchSupplierName.trim(),
          supplierMobile: purchSupplierMobile.trim() || undefined,
          rawMaterial: rawMaterialName,
          stockId: purchStockId || undefined,
          rawBarcode: purchBarcode.trim() || undefined,
          rawQty: Number(purchQty || 0),
          rawUnit: purchUnit,
          rawUnitPrice: Number(purchUnitPrice || 0),
          rawCost: totalCost,
          paid: paid,
          balance: Math.max(0, totalCost - paid),
          netPurchaseAmount: netPurchaseAmount,
          netBalance: netBalance,
          date: purchDate,
        };

        if (onUpdatePurchase) {
          onUpdatePurchase(updatedRecord);
        }
        alert('Purchase record updated successfully!');
        handleCancelEditPurchase();
        return;
      }
    }

    // New Purchase
    const purchRecord: PurchaseRecord = {
      id: 'purch_' + Date.now(),
      type: purchType,
      supplierName: purchSupplierName.trim(),
      supplierMobile: purchSupplierMobile.trim() || undefined,
      rawMaterial: rawMaterialName,
      stockId: purchStockId || undefined,
      rawBarcode: purchBarcode.trim() || undefined,
      rawQty: Number(purchQty || 0),
      rawUnit: purchUnit,
      rawUnitPrice: Number(purchUnitPrice || 0),
      rawCost: totalCost,
      paid: paid,
      balance: Math.max(0, totalCost - paid),
      netPurchaseAmount: totalCost,
      netBalance: Math.max(0, totalCost - paid),
      date: purchDate,
      savedAt: Date.now(),
      returns: [],
    };

    onSavePurchase(purchRecord);

    // If linked to existing stock product, increment stock!
    if (purchStockId) {
      if (purchType === 'cleaning') {
        const prod = products.find((p) => p.id === purchStockId);
        if (prod) onUpdateProduct({ ...prod, stock: prod.stock + Number(purchQty || 0) });
      } else {
        const cprod = cosProducts.find((p) => p.id === purchStockId);
        if (cprod) onUpdateCosProduct({ ...cprod, stock: cprod.stock + Number(purchQty || 0) });
      }
    }

    alert('Purchase saved and inventory updated!');
    handleCancelEditPurchase();
  };

  // Confirm Delete Purchase with Stock Reversal (In-App Modal)
  const handleConfirmDeletePurchase = () => {
    if (!deletingPurchaseRecord) return;
    const p = deletingPurchaseRecord;

    if (p.stockId) {
      const netToDeduct = Math.max(0, Number(p.rawQty || 0) - Number(p.returnedQty || 0));
      if (netToDeduct > 0) {
        if (p.type === 'cleaning') {
          const prod = products.find((x) => x.id === p.stockId);
          if (prod) onUpdateProduct({ ...prod, stock: Math.max(0, prod.stock - netToDeduct) });
        } else {
          const cprod = cosProducts.find((x) => x.id === p.stockId);
          if (cprod) onUpdateCosProduct({ ...cprod, stock: Math.max(0, cprod.stock - netToDeduct) });
        }
      }
    }

    onDeletePurchase(p.id);
    if (editingPurchaseId === p.id) {
      handleCancelEditPurchase();
    }
    setDeletingPurchaseRecord(null);
  };

  // Confirm Delete Expense (In-App Modal)
  const handleConfirmDeleteExpense = () => {
    if (!deletingExpenseRecord) return;
    onDeleteExpense(deletingExpenseRecord.id);
    if (editingExpId === deletingExpenseRecord.id) {
      handleCancelEditExpense();
    }
    setDeletingExpenseRecord(null);
  };

  // Open Return Modal
  const handleOpenReturnModal = (p: PurchaseRecord) => {
    const alreadyReturned = Number(p.returnedQty || 0);
    const available = Math.max(0, Number(p.rawQty || 0) - alreadyReturned);
    if (available <= 0) {
      alert(`All ${p.rawQty} ${p.rawUnit} of this purchase have already been returned to supplier!`);
      return;
    }
    setReturnPurchase(p);
    setReturnQty(1);
    setReturnDate(getTodayDateString());
    setReturnReason('');
  };

  // Save Purchase Return
  const handleSavePurchaseReturn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!returnPurchase) return;

    const available = Math.max(0, Number(returnPurchase.rawQty || 0) - Number(returnPurchase.returnedQty || 0));
    const qtyToReturn = Number(returnQty);

    if (qtyToReturn <= 0 || qtyToReturn > available) {
      alert(`Please enter a valid return quantity (1 to ${available} ${returnPurchase.rawUnit}).`);
      return;
    }

    const unitPrice =
      returnPurchase.rawUnitPrice ||
      (returnPurchase.rawCost / (returnPurchase.rawQty || 1));
    const refundAmount = Number((qtyToReturn * unitPrice).toFixed(2));

    const newReturn = {
      id: 'pret_' + Date.now(),
      qty: qtyToReturn,
      date: returnDate,
      reason: returnReason.trim() || 'Defective / Supplier Return',
      amount: refundAmount,
      savedAt: Date.now(),
    };

    // Deduct returned quantity from linked stock
    if (returnPurchase.stockId) {
      if (returnPurchase.type === 'cleaning') {
        const prod = products.find((p) => p.id === returnPurchase.stockId);
        if (prod) onUpdateProduct({ ...prod, stock: Math.max(0, prod.stock - qtyToReturn) });
      } else {
        const cprod = cosProducts.find((p) => p.id === returnPurchase.stockId);
        if (cprod) onUpdateCosProduct({ ...cprod, stock: Math.max(0, cprod.stock - qtyToReturn) });
      }
    }

    const updatedReturns = [...(returnPurchase.returns || []), newReturn];
    const totalReturnedQty = Number(returnPurchase.returnedQty || 0) + qtyToReturn;
    const totalReturnedAmount = Number(((returnPurchase.returnedAmount || 0) + refundAmount).toFixed(2));
    const netPurchaseAmount = Math.max(0, Number((returnPurchase.rawCost - totalReturnedAmount).toFixed(2)));
    const netBalance = Math.max(0, Number((returnPurchase.balance - refundAmount).toFixed(2)));

    const updatedRecord: PurchaseRecord = {
      ...returnPurchase,
      returnedQty: totalReturnedQty,
      returnedAmount: totalReturnedAmount,
      netPurchaseAmount: netPurchaseAmount,
      netBalance: netBalance,
      returns: updatedReturns,
    };

    if (onUpdatePurchase) {
      onUpdatePurchase(updatedRecord);
    }

    // Also record into stock returns log
    onSaveStockReturn({
      id: 'stkret_' + Date.now(),
      type: returnPurchase.type,
      productId: returnPurchase.stockId || returnPurchase.rawMaterial,
      productName: returnPurchase.rawMaterial,
      unit: returnPurchase.rawUnit,
      qty: qtyToReturn,
      condition: 'Damaged',
      reason: `Returned to ${returnPurchase.supplierName}: ${returnReason.trim() || 'Defective Goods'}`,
      date: returnDate,
      savedAt: Date.now(),
    });

    alert(
      `Successfully processed return of ${qtyToReturn} ${returnPurchase.rawUnit} to ${returnPurchase.supplierName}! (Refund Value: ₹${refundAmount})`
    );
    setReturnPurchase(null);
  };

  // Add Supplier quick
  const handleAddSupplierQuick = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSupName.trim()) return;
    onAddSupplier({
      id: 'sup_' + Date.now(),
      name: newSupName.trim(),
      mobile: newSupMobile.trim(),
    });
    alert(`Supplier ${newSupName} added!`);
    setNewSupName('');
    setNewSupMobile('');
  };

  // Save Expense (Create or Edit)
  const handleSaveExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!expTitle.trim() || expAmount <= 0) {
      alert('Please enter expense title and valid amount.');
      return;
    }

    if (editingExpId) {
      if (onUpdateExpense) {
        onUpdateExpense({
          id: editingExpId,
          title: expTitle.trim(),
          amount: Number(expAmount),
          date: expDate,
          savedAt: Date.now(),
        });
      }
      alert('Expense record updated!');
      handleCancelEditExpense();
    } else {
      onSaveExpense({
        id: 'exp_' + Date.now(),
        title: expTitle.trim(),
        amount: Number(expAmount),
        date: expDate,
        savedAt: Date.now(),
      });
      alert('Expense recorded!');
      setExpTitle('');
      setExpAmount(0);
    }
  };

  const handleEditExpense = (ex: ExpenseRecord) => {
    setEditingExpId(ex.id);
    setExpTitle(ex.title);
    setExpAmount(ex.amount);
    setExpDate(ex.date);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEditExpense = () => {
    setEditingExpId(null);
    setExpTitle('');
    setExpAmount(0);
    setExpDate(getTodayDateString());
  };

  // Save Stock Return
  const handleSaveReturn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!retProductId || retQty <= 0) {
      alert('Please select product and enter valid return quantity.');
      return;
    }
    const isClean = stockCategory === 'cleaning';
    const prod = isClean
      ? products.find((p) => p.id === retProductId)
      : cosProducts.find((p) => p.id === retProductId);

    if (!prod) return;

    if (retCondition === 'Usable') {
      if (isClean) {
        onUpdateProduct({ ...(prod as Product), stock: prod.stock + retQty });
      } else {
        onUpdateCosProduct({ ...(prod as CosmeticProduct), stock: prod.stock + retQty });
      }
    }

    onSaveStockReturn({
      id: 'ret_' + Date.now(),
      type: stockCategory,
      productId: prod.id,
      productName: prod.name,
      unit: prod.unit,
      customer: retCustomer.trim() || undefined,
      qty: retQty,
      condition: retCondition,
      reason: retReason.trim() || undefined,
      date: getTodayDateString(),
      savedAt: Date.now(),
    });

    alert(
      retCondition === 'Usable'
        ? `Returned ${retQty} ${prod.unit} back to usable stock.`
        : `Recorded ${retQty} ${prod.unit} as damaged stock.`
    );
    setRetProductId('');
    setRetCustomer('');
    setRetQty(0);
    setRetReason('');
  };

  return (
    <div className="space-y-6">
      {/* Main Operations Tabs */}
      <div className="flex bg-slate-200 p-1 rounded-lg max-w-md">
        <button
          onClick={() => setMainTab('stock')}
          className={`flex-1 py-2 text-xs font-bold rounded-md transition ${
            mainTab === 'stock' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          📦 Stock Inventory
        </button>
        <button
          onClick={() => setMainTab('purchases')}
          className={`flex-1 py-2 text-xs font-bold rounded-md transition ${
            mainTab === 'purchases' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          🛒 Purchases
        </button>
        <button
          onClick={() => setMainTab('expenses')}
          className={`flex-1 py-2 text-xs font-bold rounded-md transition ${
            mainTab === 'expenses' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          💸 Expenses
        </button>
      </div>

      {/* ================= SECTION 1: STOCK MANAGEMENT ================= */}
      {mainTab === 'stock' && (
        <div className="space-y-6">
          {/* Cleaning vs Cosmetics Sub tabs & Actions Header (Mobile Responsive) */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-lg border border-slate-200 shadow-xs">
            <div className="grid grid-cols-2 gap-2 sm:flex sm:gap-2 w-full sm:w-auto">
              <button
                onClick={() => setStockCategory('cleaning')}
                className={`px-3 py-2 sm:px-4 sm:py-2 rounded text-xs font-bold transition text-center cursor-pointer ${
                  stockCategory === 'cleaning'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                🧹 Cleaning ({products.length})
              </button>
              <button
                onClick={() => setStockCategory('cosmetics')}
                className={`px-3 py-2 sm:px-4 sm:py-2 rounded text-xs font-bold transition text-center cursor-pointer ${
                  stockCategory === 'cosmetics'
                    ? 'bg-pink-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                💄 Cosmetics ({cosProducts.length})
              </button>
            </div>

            {/* Stock Action Sub-Tabs - Scrollable & Never Cut Off on Mobile */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 sm:pb-0 scrollbar-none w-full sm:w-auto">
              {[
                { id: 'add', label: '➕ Add Stock' },
                { id: 'view', label: '👁️ View List' },
                { id: 'return', label: '↩️ Returns' },
                { id: 'consolidated', label: '📊 Consolidated' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setStockActionTab(tab.id as any)}
                  className={`px-3 py-1.5 rounded text-xs font-semibold whitespace-nowrap shrink-0 transition cursor-pointer ${
                    stockActionTab === tab.id
                      ? 'bg-slate-900 text-white font-bold shadow-xs'
                      : 'text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200/60'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* ADD STOCK TAB */}
          {stockActionTab === 'add' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Add New Product Form */}
              <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-xs space-y-4">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800">
                  {stockCategory === 'cleaning'
                    ? editingCleanId
                      ? 'Edit Cleaning Product'
                      : 'Add New Cleaning Product'
                    : editingCosId
                    ? 'Edit Cosmetic Product'
                    : 'Add New Cosmetic Product'}
                </h3>

                {stockCategory === 'cleaning' ? (
                  <form onSubmit={handleSaveCleanProduct} className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700">Product Name</label>
                      <input
                        type="text"
                        placeholder="e.g. Dish Wash Concentrate"
                        value={cleanName}
                        onChange={(e) => setCleanName(e.target.value.toUpperCase())}
                        required
                        className="w-full border-2 border-slate-200 p-2.5 rounded-md text-xs font-semibold focus:border-indigo-500 outline-none"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-700">Opening Stock</label>
                        <input
                          type="number"
                          value={cleanStock || ''}
                          onChange={(e) => setCleanStock(parseFloat(e.target.value) || 0)}
                          min="0"
                          step="any"
                          className="w-full border-2 border-slate-200 p-2.5 rounded-md text-xs font-mono font-bold focus:border-indigo-500 outline-none"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-700">Stock Unit</label>
                        <select
                          value={cleanUnit}
                          onChange={(e) => setCleanUnit(e.target.value as UnitType)}
                          className="w-full border-2 border-slate-200 p-2.5 rounded-md text-xs font-semibold focus:border-indigo-500 outline-none bg-white"
                        >
                          <option value="Ltr">Litre (Ltr)</option>
                          <option value="Kg">Kilogram (Kg)</option>
                          <option value="Gram">Gram (g)</option>
                          <option value="ml">Millilitre (ml)</option>
                          <option value="Pcs">Pieces (Pcs)</option>
                          <option value="Bottle">Bottle</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-700">Wholesale Rate (₹)</label>
                        <input
                          type="number"
                          value={cleanWholesale || ''}
                          onChange={(e) => setCleanWholesale(parseFloat(e.target.value) || 0)}
                          min="0"
                          step="any"
                          className="w-full border-2 border-slate-200 p-2.5 rounded-md text-xs font-mono focus:border-indigo-500 outline-none"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-700">Retail Rate (₹)</label>
                        <input
                          type="number"
                          value={cleanRetail || ''}
                          onChange={(e) => setCleanRetail(parseFloat(e.target.value) || 0)}
                          min="0"
                          step="any"
                          className="w-full border-2 border-slate-200 p-2.5 rounded-md text-xs font-mono font-bold text-indigo-700 focus:border-indigo-500 outline-none"
                        />
                      </div>
                    </div>

                    <div className="flex gap-2 pt-2">
                      <button
                        type="submit"
                        className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded font-bold text-xs shadow transition"
                      >
                        {editingCleanId ? 'Update Product' : 'Save Product'}
                      </button>
                      {editingCleanId && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingCleanId(null);
                            setCleanName('');
                            setCleanStock(0);
                            setCleanWholesale(0);
                            setCleanRetail(0);
                          }}
                          className="px-4 bg-slate-100 text-slate-600 py-2.5 rounded text-xs font-bold"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </form>
                ) : (
                  /* Cosmetic Product Form */
                  <form onSubmit={handleSaveCosProduct} className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700">Cosmetic Product Name</label>
                      <input
                        type="text"
                        placeholder="e.g. Herbal Hair Oil 200ml"
                        value={cosName}
                        onChange={(e) => setCosName(e.target.value.toUpperCase())}
                        required
                        className="w-full border-2 border-slate-200 p-2.5 rounded-md text-xs font-semibold focus:border-pink-500 outline-none"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-700">Opening Stock</label>
                        <input
                          type="number"
                          value={cosStock || ''}
                          onChange={(e) => setCosStock(parseFloat(e.target.value) || 0)}
                          min="0"
                          step="any"
                          className="w-full border-2 border-slate-200 p-2.5 rounded-md text-xs font-mono font-bold focus:border-pink-500 outline-none"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-700">Unit</label>
                        <select
                          value={cosUnit}
                          onChange={(e) => setCosUnit(e.target.value as UnitType)}
                          className="w-full border-2 border-slate-200 p-2.5 rounded-md text-xs font-semibold focus:border-pink-500 outline-none bg-white"
                        >
                          <option value="Bottle">Bottle</option>
                          <option value="Pcs">Pieces</option>
                          <option value="Ltr">Litre</option>
                          <option value="ml">ml</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-700">Cost Price (₹)</label>
                        <input
                          type="number"
                          value={cosCost || ''}
                          onChange={(e) => setCosCost(parseFloat(e.target.value) || 0)}
                          min="0"
                          step="any"
                          className="w-full border-2 border-slate-200 p-2.5 rounded-md text-xs font-mono focus:border-pink-500 outline-none"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-700">Sale Price (₹)</label>
                        <input
                          type="number"
                          value={cosSale || ''}
                          onChange={(e) => setCosSale(parseFloat(e.target.value) || 0)}
                          min="0"
                          step="any"
                          className="w-full border-2 border-slate-200 p-2.5 rounded-md text-xs font-mono font-bold text-pink-700 focus:border-pink-500 outline-none"
                        />
                      </div>
                    </div>

                    <div className="flex gap-2 pt-2">
                      <button
                        type="submit"
                        className="flex-1 bg-pink-600 hover:bg-pink-700 text-white py-2.5 rounded font-bold text-xs shadow transition"
                      >
                        {editingCosId ? 'Update Cosmetic' : 'Save Cosmetic'}
                      </button>
                      {editingCosId && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingCosId(null);
                            setCosName('');
                            setCosStock(0);
                            setCosCost(0);
                            setCosSale(0);
                          }}
                          className="px-4 bg-slate-100 text-slate-600 py-2.5 rounded text-xs font-bold"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </form>
                )}
              </div>

              {/* Quick Add Stock To Existing */}
              <div className="bg-slate-50 p-5 rounded-lg border border-slate-200 space-y-4">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800">
                  ➕ Fast Add Stock to Existing Product
                </h3>
                <p className="text-xs text-slate-500">
                  Quickly add incoming batch quantity directly to existing product stock.
                </p>

                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">Select Product</label>
                    <select
                      value={addStockProdId}
                      onChange={(e) => setAddStockProdId(e.target.value)}
                      className="w-full border-2 border-slate-200 bg-white p-2.5 rounded-md text-xs font-semibold focus:border-indigo-500 outline-none"
                    >
                      <option value="">-- Choose Product --</option>
                      {[...products]
                        .sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }))
                        .map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} (Current: {p.stock} {p.unit})
                          </option>
                        ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">Quantity to Add</label>
                    <input
                      type="number"
                      placeholder="Enter quantity"
                      value={addStockQty || ''}
                      onChange={(e) => setAddStockQty(parseFloat(e.target.value) || 0)}
                      min="0"
                      step="any"
                      className="w-full border-2 border-slate-200 bg-white p-2.5 rounded-md text-xs font-mono font-bold focus:border-indigo-500 outline-none"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleAddStockQuick}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-2.5 rounded font-bold text-xs shadow transition"
                  >
                    + ADD STOCK TO INVENTORY
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* VIEW STOCK LIST TAB */}
          {stockActionTab === 'view' && (
            <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-xs space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-3">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                    <Package className="w-4 h-4 text-indigo-600" />
                    <span>View & Manage Stock</span>
                  </h3>
                  <span className="text-xs bg-indigo-50 text-indigo-700 font-bold px-2 py-0.5 rounded-full">
                    {products.length + cosProducts.length} Products
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {/* Category switcher directly inside View Stock */}
                  <div className="flex bg-slate-100 p-0.5 rounded-md border border-slate-200">
                    <button
                      type="button"
                      onClick={() => setStockCategory('cleaning')}
                      className={`text-xs px-3 py-1 rounded font-bold transition ${
                        stockCategory === 'cleaning'
                          ? 'bg-white text-indigo-700 shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Cleaning Stock ({products.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setStockCategory('cosmetics')}
                      className={`text-xs px-3 py-1 rounded font-bold transition ${
                        stockCategory === 'cosmetics'
                          ? 'bg-white text-pink-700 shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Cosmetic Stock ({cosProducts.length})
                    </button>
                  </div>

                  <div className="relative w-full sm:w-56">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                    <input
                      type="text"
                      placeholder="Search stock..."
                      value={stockSearchQuery}
                      onChange={(e) => setStockSearchQuery(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded pl-8 pr-3 py-1.5 text-xs text-slate-700 outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {stockCategory === 'cleaning' ? (
                  products.filter((p) => (p.name || '').toLowerCase().includes(stockSearchQuery.toLowerCase())).length === 0 ? (
                    <div className="col-span-full py-12 text-center text-slate-400 text-xs">
                      No cleaning products found. Click <strong>"Add / Edit Product"</strong> to register your products.
                    </div>
                  ) : (
                    products
                      .filter((p) => (p.name || '').toLowerCase().includes(stockSearchQuery.toLowerCase()))
                      .sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }))
                      .map((p) => (
                        <div
                          key={p.id}
                          className="p-4 rounded-lg border border-slate-200 bg-white hover:border-indigo-300 hover:shadow-xs transition space-y-2.5 flex flex-col justify-between"
                        >
                          <div>
                            <div className="flex items-start justify-between gap-2">
                              <h4 className="text-xs font-bold text-slate-900 leading-snug">{p.name}</h4>
                              <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 font-bold shrink-0">
                                Cleaning
                              </span>
                            </div>

                            <div className="flex items-baseline gap-2 mt-2">
                              <span className="text-xs text-slate-500">Available:</span>
                              <span
                                className={`text-lg font-mono font-bold ${
                                  p.stock <= 5 ? 'text-rose-600' : 'text-slate-900'
                                }`}
                              >
                                {p.stock} {p.unit}
                              </span>
                              {p.stock <= 5 && (
                                <span className="text-[10px] bg-rose-100 text-rose-700 px-1.5 py-0.2 rounded font-bold">
                                  LOW STOCK
                                </span>
                              )}
                            </div>

                            <div className="text-[11px] text-slate-500 pt-2 mt-2 border-t border-slate-100 flex justify-between">
                              <span>Wholesale: ₹{p.wholesalePrice}</span>
                              <span className="text-indigo-700 font-bold">Retail: ₹{p.retailPrice}</span>
                            </div>
                            {p.barcode && (
                              <div className="text-[10px] text-slate-400 font-mono pt-0.5">
                                Barcode: {p.barcode}
                              </div>
                            )}
                          </div>

                          {/* Action Buttons: View, Edit Stock & Delete Stock */}
                          <div className="flex items-center gap-1.5 pt-2 border-t border-slate-100">
                            <button
                              type="button"
                              onClick={() =>
                                setViewingStockItem({
                                  type: 'cleaning',
                                  id: p.id,
                                  name: p.name,
                                  barcode: p.barcode,
                                  stock: p.stock,
                                  unit: p.unit,
                                  price1: p.wholesalePrice,
                                  price2: p.retailPrice,
                                })
                              }
                              className="flex items-center justify-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-1.5 px-2.5 rounded-md text-xs font-bold transition border border-slate-200 shadow-2xs cursor-pointer"
                              title="View Product Details"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>View</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => openEditCleanStock(p)}
                              className="flex-1 flex items-center justify-center gap-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 py-1.5 px-2 rounded-md text-xs font-bold transition border border-indigo-200 shadow-2xs cursor-pointer"
                              title="Edit Stock details and quantity"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                              <span>Edit Stock</span>
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setDeletingStockItem({
                                  type: 'cleaning',
                                  id: p.id,
                                  name: p.name,
                                  stock: p.stock,
                                  unit: p.unit,
                                })
                              }
                              className="flex items-center justify-center gap-1 bg-rose-50 hover:bg-rose-100 text-rose-700 py-1.5 px-2 rounded-md text-xs font-bold transition border border-rose-200 shadow-2xs cursor-pointer"
                              title="Delete Stock Item"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Delete</span>
                            </button>
                          </div>
                        </div>
                      ))
                  )
                ) : (
                  cosProducts.filter((p) => (p.name || '').toLowerCase().includes(stockSearchQuery.toLowerCase())).length === 0 ? (
                    <div className="col-span-full py-12 text-center text-slate-400 text-xs">
                      No cosmetic products found. Click <strong>"Add / Edit Product"</strong> to register your products.
                    </div>
                  ) : (
                    cosProducts
                      .filter((p) => (p.name || '').toLowerCase().includes(stockSearchQuery.toLowerCase()))
                      .sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }))
                      .map((p) => (
                        <div
                          key={p.id}
                          className="p-4 rounded-lg border border-slate-200 bg-white hover:border-pink-300 hover:shadow-xs transition space-y-2.5 flex flex-col justify-between"
                        >
                          <div>
                            <div className="flex items-start justify-between gap-2">
                              <h4 className="text-xs font-bold text-slate-900 leading-snug">{p.name}</h4>
                              <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-pink-50 text-pink-700 font-bold shrink-0">
                                Cosmetics
                              </span>
                            </div>

                            <div className="flex items-baseline gap-2 mt-2">
                              <span className="text-xs text-slate-500">Available:</span>
                              <span
                                className={`text-lg font-mono font-bold ${
                                  p.stock <= 5 ? 'text-rose-600' : 'text-slate-900'
                                }`}
                              >
                                {p.stock} {p.unit}
                              </span>
                              {p.stock <= 5 && (
                                <span className="text-[10px] bg-rose-100 text-rose-700 px-1.5 py-0.2 rounded font-bold">
                                  LOW STOCK
                                </span>
                              )}
                            </div>

                            <div className="text-[11px] text-slate-500 pt-2 mt-2 border-t border-slate-100 flex justify-between">
                              <span>Cost: ₹{p.costPrice}</span>
                              <span className="text-pink-700 font-bold">Sale: ₹{p.salePrice}</span>
                            </div>
                            {p.barcode && (
                              <div className="text-[10px] text-slate-400 font-mono pt-0.5">
                                Barcode: {p.barcode}
                              </div>
                            )}
                          </div>

                          {/* Action Buttons: View, Edit Stock & Delete Stock */}
                          <div className="flex items-center gap-1.5 pt-2 border-t border-slate-100">
                            <button
                              type="button"
                              onClick={() =>
                                setViewingStockItem({
                                  type: 'cosmetics',
                                  id: p.id,
                                  name: p.name,
                                  barcode: p.barcode,
                                  stock: p.stock,
                                  unit: p.unit,
                                  price1: p.costPrice,
                                  price2: p.salePrice,
                                })
                              }
                              className="flex items-center justify-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-1.5 px-2.5 rounded-md text-xs font-bold transition border border-slate-200 shadow-2xs cursor-pointer"
                              title="View Product Details"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>View</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => openEditCosStock(p)}
                              className="flex-1 flex items-center justify-center gap-1 bg-pink-50 hover:bg-pink-100 text-pink-700 py-1.5 px-2 rounded-md text-xs font-bold transition border border-pink-200 shadow-2xs cursor-pointer"
                              title="Edit Cosmetic Stock details and quantity"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                              <span>Edit Stock</span>
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setDeletingStockItem({
                                  type: 'cosmetics',
                                  id: p.id,
                                  name: p.name,
                                  stock: p.stock,
                                  unit: p.unit,
                                })
                              }
                              className="flex items-center justify-center gap-1 bg-rose-50 hover:bg-rose-100 text-rose-700 py-1.5 px-2 rounded-md text-xs font-bold transition border border-rose-200 shadow-2xs cursor-pointer"
                              title="Delete Stock Item"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Delete</span>
                            </button>
                          </div>
                        </div>
                      ))
                  )
                )}
              </div>
            </div>
          )}

          {/* STOCK RETURNS TAB */}
          {stockActionTab === 'return' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-xs space-y-4">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800">
                  ↩️ Record Customer Return Stock
                </h3>
                <form onSubmit={handleSaveReturn} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">Product</label>
                    <select
                      value={retProductId}
                      onChange={(e) => setRetProductId(e.target.value)}
                      required
                      className="w-full border-2 border-slate-200 bg-white p-2.5 rounded-md text-xs font-semibold focus:border-indigo-500 outline-none"
                    >
                      <option value="">-- Select Product to Return --</option>
                      {[...(stockCategory === 'cleaning' ? products : cosProducts)]
                        .sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }))
                        .map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} (Current: {p.stock} {p.unit})
                          </option>
                        ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700">Return Qty</label>
                      <input
                        type="number"
                        value={retQty || ''}
                        onChange={(e) => setRetQty(parseFloat(e.target.value) || 0)}
                        min="0.1"
                        step="any"
                        required
                        className="w-full border-2 border-slate-200 p-2.5 rounded-md text-xs font-mono font-bold focus:border-indigo-500 outline-none"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700">Condition</label>
                      <select
                        value={retCondition}
                        onChange={(e) => setRetCondition(e.target.value as any)}
                        className="w-full border-2 border-slate-200 p-2.5 rounded-md text-xs font-semibold focus:border-indigo-500 outline-none bg-white"
                      >
                        <option value="Usable">🟢 Usable (Add back to stock)</option>
                        <option value="Damaged">🔴 Damaged (Do not add)</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">Customer / Party Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Rahul K."
                      value={retCustomer}
                      onChange={(e) => setRetCustomer(e.target.value)}
                      className="w-full border-2 border-slate-200 p-2.5 rounded-md text-xs focus:border-indigo-500 outline-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">Reason / Remarks</label>
                    <input
                      type="text"
                      placeholder="Optional reason..."
                      value={retReason}
                      onChange={(e) => setRetReason(e.target.value.toUpperCase())}
                      className="w-full border-2 border-slate-200 p-2.5 rounded-md text-xs focus:border-indigo-500 outline-none"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded font-bold text-xs shadow transition"
                  >
                    RECORD STOCK RETURN
                  </button>
                </form>
              </div>

              {/* Returns History */}
              <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-xs space-y-4">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800">
                  Return History
                </h3>
                <div className="space-y-2.5 max-h-[400px] overflow-y-auto">
                  {stockReturns.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-6">No returns recorded yet.</p>
                  ) : (
                    stockReturns
                      .slice()
                      .reverse()
                      .map((ret) => (
                        <div
                          key={ret.id}
                          className="p-3 bg-slate-50 rounded border border-slate-200 text-xs space-y-1"
                        >
                          <div className="flex justify-between items-center">
                            <span className="font-bold text-slate-900">{ret.productName}</span>
                            <span
                              className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${
                                ret.condition === 'Usable'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {ret.condition}
                            </span>
                          </div>
                          <p className="text-slate-500">
                            {ret.qty} {ret.unit} • {formatDateDDMMYYYY(ret.date)} • {ret.customer || 'No customer'}
                          </p>
                          {ret.reason && <p className="text-[11px] text-slate-600 italic">"{ret.reason}"</p>}
                        </div>
                      ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* CONSOLIDATED STOCK REPORT TAB */}
          {stockActionTab === 'consolidated' && (
            <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-xs space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800">
                📊 Consolidated Stock Report (Cleaning + Cosmetics)
              </h3>
              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 uppercase font-semibold">
                    <tr>
                      <th className="p-2.5">#</th>
                      <th className="p-2.5">Category</th>
                      <th className="p-2.5">Product Name</th>
                      <th className="p-2.5 text-right">Available Stock</th>
                      <th className="p-2.5">Unit</th>
                      <th className="p-2.5">Barcode</th>
                      <th className="p-2.5 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {[
                      ...products.map((p) => ({ ...p, category: 'Cleaning' })),
                      ...cosProducts.map((p) => ({ ...p, category: 'Cosmetics' })),
                    ]
                      .sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }))
                      .map((p, idx) => (
                        <tr key={p.id} className="hover:bg-slate-50">
                          <td className="p-2.5 font-mono text-slate-400">{idx + 1}</td>
                          <td className="p-2.5">
                            <span
                              className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                p.category === 'Cleaning'
                                  ? 'bg-indigo-50 text-indigo-700'
                                  : 'bg-pink-50 text-pink-700'
                              }`}
                            >
                              {p.category}
                            </span>
                          </td>
                          <td className="p-2.5 font-semibold text-slate-900">{p.name}</td>
                          <td
                            className={`p-2.5 text-right font-mono font-bold ${
                              p.stock <= 5 ? 'text-rose-600' : 'text-slate-900'
                            }`}
                          >
                            {p.stock}
                          </td>
                          <td className="p-2.5 font-mono text-slate-500">{p.unit}</td>
                          <td className="p-2.5 font-mono text-slate-400">{p.barcode || '—'}</td>
                          <td className="p-2.5 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  if (p.category === 'Cleaning') {
                                    const item = products.find((x) => x.id === p.id);
                                    if (item) {
                                      setViewingStockItem({
                                        type: 'cleaning',
                                        id: item.id,
                                        name: item.name,
                                        barcode: item.barcode,
                                        stock: item.stock,
                                        unit: item.unit,
                                        price1: item.wholesalePrice,
                                        price2: item.retailPrice,
                                      });
                                    }
                                  } else {
                                    const item = cosProducts.find((x) => x.id === p.id);
                                    if (item) {
                                      setViewingStockItem({
                                        type: 'cosmetics',
                                        id: item.id,
                                        name: item.name,
                                        barcode: item.barcode,
                                        stock: item.stock,
                                        unit: item.unit,
                                        price1: item.costPrice,
                                        price2: item.salePrice,
                                      });
                                    }
                                  }
                                }}
                                className="p-1.5 text-slate-600 hover:bg-slate-100 rounded transition cursor-pointer"
                                title="View Product Details"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  if (p.category === 'Cleaning') {
                                    const item = products.find((x) => x.id === p.id);
                                    if (item) openEditCleanStock(item);
                                  } else {
                                    const item = cosProducts.find((x) => x.id === p.id);
                                    if (item) openEditCosStock(item);
                                  }
                                }}
                                className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded transition cursor-pointer"
                                title="Edit Stock"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setDeletingStockItem({
                                    type: p.category === 'Cleaning' ? 'cleaning' : 'cosmetics',
                                    id: p.id,
                                    name: p.name,
                                    stock: p.stock,
                                    unit: p.unit,
                                  })
                                }
                                className="p-1.5 text-rose-600 hover:bg-rose-50 rounded transition cursor-pointer"
                                title="Delete Stock"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ================= SECTION 2: PURCHASES ================= */}
      {mainTab === 'purchases' && (
        <div className="space-y-6">
          {/* Header Controls: Categories & Action Sub-Tabs (Matching Stock Module) */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-lg border border-slate-200">
            {/* Category Toggle: Cleaning vs Cosmetics */}
            <div className="flex bg-slate-100 p-1 rounded-lg">
              <button
                type="button"
                onClick={() => {
                  setPurchaseCategory('cleaning');
                  setPurchType('cleaning');
                  setPurchStockId('');
                }}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  purchaseCategory === 'cleaning'
                    ? 'bg-white text-blue-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                🧹 Cleaning Purchases ({purchases.filter((p) => p.type === 'cleaning').length})
              </button>
              <button
                type="button"
                onClick={() => {
                  setPurchaseCategory('cosmetics');
                  setPurchType('cosmetics');
                  setPurchStockId('');
                }}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  purchaseCategory === 'cosmetics'
                    ? 'bg-white text-pink-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                💄 Cosmetics Purchases ({purchases.filter((p) => p.type === 'cosmetics').length})
              </button>
            </div>

            {/* Purchase Action Sub-Tabs (Add, View List, Returns) - Responsive */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 sm:pb-0 scrollbar-none w-full sm:w-auto">
              {[
                { id: 'add', label: editingPurchaseId ? '✏️ Edit Purchase' : '➕ Add Purchase' },
                { id: 'view', label: '👁️ View List' },
                { id: 'return', label: '↩️ Returns' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setPurchaseActionTab(tab.id as any)}
                  className={`px-3 py-1.5 rounded text-xs font-semibold whitespace-nowrap shrink-0 transition cursor-pointer ${
                    purchaseActionTab === tab.id
                      ? 'bg-slate-900 text-white font-bold shadow-xs'
                      : 'text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200/60'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* ================= SUB-TAB 1: ADD / EDIT PURCHASE ================= */}
          {purchaseActionTab === 'add' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Main Purchase Entry Form */}
              <div id="purchaseFormCard" className="lg:col-span-2 bg-white p-5 rounded-lg border border-slate-200 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center text-white ${
                        purchaseCategory === 'cleaning' ? 'bg-blue-600' : 'bg-pink-600'
                      }`}
                    >
                      <ShoppingCart className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800">
                        {editingPurchaseId
                          ? `Edit ${purchaseCategory === 'cleaning' ? 'Cleaning' : 'Cosmetics'} Purchase`
                          : `New ${purchaseCategory === 'cleaning' ? 'Cleaning' : 'Cosmetics'} Purchase`}
                      </h3>
                      <p className="text-[11px] text-slate-400">
                        {editingPurchaseId
                          ? 'Update purchase details and inventory stock'
                          : 'Record purchase and automatically increment inventory stock'}
                      </p>
                    </div>
                  </div>

                  {editingPurchaseId && (
                    <button
                      type="button"
                      onClick={handleCancelEditPurchase}
                      className="text-xs text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded font-bold transition cursor-pointer"
                    >
                      Cancel Edit
                    </button>
                  )}
                </div>

                {editingPurchaseId && (
                  <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 font-medium flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Editing active record. Saving changes will adjust inventory stock automatically.</span>
                  </div>
                )}

                <form onSubmit={handleSavePurchase} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-700">Select Existing Supplier</label>
                      <select
                        value={purchSupplierName}
                        onChange={(e) => {
                          setPurchSupplierName(e.target.value);
                          const s = suppliers.find((x) => x.name === e.target.value);
                          if (s) setPurchSupplierMobile(s.mobile || '');
                        }}
                        className="w-full border-2 border-slate-200 bg-white p-2.5 rounded-lg text-xs focus:border-blue-500 outline-none"
                      >
                        <option value="">-- Choose Supplier / Or Type Custom Below --</option>
                        {[...suppliers]
                          .sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }))
                          .map((s) => (
                            <option key={s.id} value={s.name}>
                              {s.name} {s.mobile ? `(${s.mobile})` : ''}
                            </option>
                          ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-700">Supplier Name (Required) *</label>
                      <input
                        type="text"
                        placeholder="Supplier Name / Company"
                        value={purchSupplierName}
                        onChange={(e) => setPurchSupplierName(e.target.value.toUpperCase())}
                        required
                        className="w-full border-2 border-slate-200 p-2.5 rounded-lg text-xs focus:border-blue-500 outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-700">Supplier Mobile</label>
                      <input
                        type="tel"
                        placeholder="Phone / WhatsApp"
                        value={purchSupplierMobile}
                        onChange={(e) => setPurchSupplierMobile(e.target.value)}
                        className="w-full border border-slate-200 p-2.5 rounded-lg text-xs font-mono focus:border-blue-500 outline-none"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-700">Link to Inventory Stock</label>
                      <select
                        value={purchStockId}
                        onChange={(e) => {
                          setPurchStockId(e.target.value);
                          if (e.target.value) {
                            const p =
                              purchaseCategory === 'cleaning'
                                ? products.find((x) => x.id === e.target.value)
                                : cosProducts.find((x) => x.id === e.target.value);
                            if (p) {
                              setPurchUnit(p.unit);
                              setPurchBarcode(p.barcode || '');
                            }
                          }
                        }}
                        className="w-full border-2 border-slate-200 bg-white p-2.5 rounded-lg text-xs focus:border-blue-500 outline-none"
                      >
                        <option value="">-- Choose Stock Product (Auto Adds Stock) --</option>
                        {[...(purchaseCategory === 'cleaning' ? products : cosProducts)]
                          .sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }))
                          .map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} (Current: {p.stock} {p.unit})
                            </option>
                          ))}
                      </select>
                    </div>
                  </div>

                  {!purchStockId && (
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-700">Product / Raw Material Name *</label>
                      <input
                        type="text"
                        placeholder="e.g. Caustic Soda Flakes, Fragrance Oil, Liquid Base"
                        value={purchItemName}
                        onChange={(e) => setPurchItemName(e.target.value.toUpperCase())}
                        required={!purchStockId}
                        className="w-full border-2 border-slate-200 p-2.5 rounded-lg text-xs focus:border-blue-500 outline-none"
                      />
                    </div>
                  )}

                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-700">Quantity *</label>
                      <input
                        type="number"
                        value={purchQty || ''}
                        onChange={(e) =>
                          handlePurchaseQtyPriceChange(
                            parseFloat(e.target.value) || 0,
                            purchUnitPrice
                          )
                        }
                        min="0.1"
                        step="any"
                        required
                        className="w-full border-2 border-slate-200 p-2.5 rounded-lg text-xs font-mono font-bold focus:border-blue-500 outline-none"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-700">Unit</label>
                      <select
                        value={purchUnit}
                        onChange={(e) => setPurchUnit(e.target.value as UnitType)}
                        className="w-full border border-slate-200 bg-white p-2.5 rounded-lg text-xs focus:border-blue-500 outline-none"
                      >
                        <option value="Ltr">Ltr</option>
                        <option value="Kg">Kg</option>
                        <option value="Pcs">Pcs</option>
                        <option value="Box">Box</option>
                        <option value="Set">Set</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-700">Unit Rate (₹)</label>
                      <input
                        type="number"
                        value={purchUnitPrice || ''}
                        onChange={(e) =>
                          handlePurchaseQtyPriceChange(
                            purchQty,
                            parseFloat(e.target.value) || 0
                          )
                        }
                        min="0"
                        step="any"
                        className="w-full border border-slate-200 p-2.5 rounded-lg text-xs font-mono focus:border-blue-500 outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-700">Total Cost (₹)</label>
                      <input
                        type="number"
                        value={purchTotalCost || ''}
                        onChange={(e) => setPurchTotalCost(parseFloat(e.target.value) || 0)}
                        className="w-full border-2 border-slate-200 p-2.5 rounded-lg text-xs font-mono font-bold text-blue-700 focus:border-blue-500 outline-none"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-700">Paid Amount (₹)</label>
                      <input
                        type="number"
                        value={purchPaid || ''}
                        onChange={(e) => setPurchPaid(parseFloat(e.target.value) || 0)}
                        className="w-full border-2 border-slate-200 p-2.5 rounded-lg text-xs font-mono font-bold text-emerald-700 focus:border-blue-500 outline-none"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-700">Purchase Date</label>
                      <input
                        type="date"
                        value={purchDate}
                        onChange={(e) => setPurchDate(e.target.value)}
                        className="w-full border border-slate-200 p-2.5 rounded-lg text-xs font-mono focus:border-blue-500 outline-none"
                      />
                    </div>
                  </div>

                  {editingPurchaseId ? (
                    <div className="flex gap-2 pt-2">
                      <button
                        type="button"
                        onClick={handleCancelEditPurchase}
                        className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-3 rounded-lg font-bold text-xs transition cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="flex-2 bg-amber-600 hover:bg-amber-700 text-white py-3 rounded-lg font-bold text-xs shadow-md transition flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Save className="w-4 h-4" />
                        <span>UPDATE PURCHASE</span>
                      </button>
                    </div>
                  ) : (
                    <button
                      type="submit"
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-bold text-xs shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>SAVE & UPDATE INVENTORY</span>
                    </button>
                  )}
                </form>
              </div>

              {/* Quick Add Supplier & Quick Info */}
              <div className="space-y-4">
                <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-xs space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                    <span>👤 Quick Add Supplier</span>
                  </h4>
                  <form onSubmit={handleAddSupplierQuick} className="space-y-2.5">
                    <input
                      type="text"
                      placeholder="Supplier Name *"
                      value={newSupName}
                      onChange={(e) => setNewSupName(e.target.value)}
                      required
                      className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-lg text-xs focus:border-indigo-500 outline-none"
                    />
                    <input
                      type="tel"
                      placeholder="Mobile / Contact No"
                      value={newSupMobile}
                      onChange={(e) => setNewSupMobile(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-lg text-xs font-mono focus:border-indigo-500 outline-none"
                    />
                    <button
                      type="submit"
                      className="w-full bg-slate-900 hover:bg-slate-800 text-white py-2.5 rounded-lg text-xs font-bold shadow-xs transition cursor-pointer"
                    >
                      + ADD SUPPLIER
                    </button>
                  </form>
                </div>

                <div className="bg-blue-50/70 p-4 rounded-lg border border-blue-200 text-xs text-blue-900 space-y-2">
                  <h5 className="font-bold flex items-center gap-1.5 text-blue-950">
                    <span>💡 Stock Link Feature</span>
                  </h5>
                  <p className="text-[11px] text-blue-800 leading-relaxed">
                    Selecting an existing product from the <strong>"Link to Inventory Stock"</strong> dropdown will automatically increase that item's available stock immediately upon saving!
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ================= SUB-TAB 2: VIEW PURCHASES LIST ================= */}
          {purchaseActionTab === 'view' && (
            <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-xs space-y-5">
              {/* Category Summary Stats Banner */}
              {(() => {
                const categoryPurchases = purchases.filter((p) => p.type === purchaseCategory);
                const totalCost = categoryPurchases.reduce((s, p) => s + (p.rawCost || 0), 0);
                const totalPaid = categoryPurchases.reduce((s, p) => s + (p.paid || 0), 0);
                const totalBal = categoryPurchases.reduce((s, p) => s + (p.balance || 0), 0);
                const totalReturns = categoryPurchases.reduce((s, p) => s + (p.returnedAmount || 0), 0);

                return (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                      <span className="text-[10px] text-slate-500 font-bold uppercase block">Total Purchases</span>
                      <span className="text-base font-bold font-mono text-slate-900">{formatCurrency(totalCost)}</span>
                    </div>
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                      <span className="text-[10px] text-emerald-700 font-bold uppercase block">Amount Paid</span>
                      <span className="text-base font-bold font-mono text-emerald-800">{formatCurrency(totalPaid)}</span>
                    </div>
                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg">
                      <span className="text-[10px] text-rose-700 font-bold uppercase block">Balance Due</span>
                      <span className="text-base font-bold font-mono text-rose-800">{formatCurrency(totalBal)}</span>
                    </div>
                    <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                      <span className="text-[10px] text-purple-700 font-bold uppercase block">Total Returns</span>
                      <span className="text-base font-bold font-mono text-purple-800">{formatCurrency(totalReturns)}</span>
                    </div>
                  </div>
                );
              })()}

              {/* Toolbar: Search, Filters, Count */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800">
                    {purchaseCategory === 'cleaning' ? '🧹 Cleaning Purchases' : '💄 Cosmetics Purchases'}
                  </h3>
                  <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-mono font-bold">
                    {purchases.filter((p) => p.type === purchaseCategory).length}
                  </span>
                </div>

                <div className="relative min-w-[240px]">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search supplier, item, mobile..."
                    value={purchaseSearchQuery}
                    onChange={(e) => setPurchaseSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-lg text-xs outline-none focus:border-blue-500"
                  />
                  {purchaseSearchQuery && (
                    <button
                      onClick={() => setPurchaseSearchQuery('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Purchase Cards List */}
              <div className="space-y-3 max-h-[640px] overflow-y-auto pr-1">
                {purchases.filter((p) => p.type === purchaseCategory).length === 0 ? (
                  <div className="text-center py-16 text-xs text-slate-400 bg-slate-50/50 rounded-lg border border-dashed border-slate-200">
                    No {purchaseCategory} purchases recorded yet. Switch to "➕ Add Purchase" tab to record your first entry.
                  </div>
                ) : (
                  [...purchases]
                    .filter((p) => p.type === purchaseCategory)
                    .filter((p) => {
                      if (!purchaseSearchQuery.trim()) return true;
                      const q = purchaseSearchQuery.toLowerCase();
                      return (
                        (p.supplierName || '').toLowerCase().includes(q) ||
                        (p.rawMaterial || '').toLowerCase().includes(q) ||
                        (p.supplierMobile && p.supplierMobile.includes(q)) ||
                        (p.rawBarcode && p.rawBarcode.toLowerCase().includes(q))
                      );
                    })
                    .sort((a, b) => {
                      const itemComp = (a.rawMaterial || '').localeCompare(b.rawMaterial || '', undefined, { sensitivity: 'base' });
                      if (itemComp !== 0) return itemComp;
                      return (a.supplierName || '').localeCompare(b.supplierName || '', undefined, { sensitivity: 'base' });
                    })
                    .map((p) => {
                      const alreadyReturned = Number(p.returnedQty || 0);
                      const canReturn = Math.max(0, Number(p.rawQty || 0) - alreadyReturned) > 0;

                      return (
                        <div
                          key={p.id}
                          className="p-4 rounded-xl border border-slate-200 bg-white hover:border-blue-300 hover:shadow-xs transition-all space-y-3"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                            <div className="space-y-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-extrabold text-slate-900">{p.supplierName}</span>
                                {p.supplierMobile && (
                                  <a
                                    href={`tel:${p.supplierMobile}`}
                                    className="text-[11px] font-mono text-blue-600 hover:underline flex items-center gap-0.5"
                                  >
                                    <Phone className="w-3 h-3" />
                                    {p.supplierMobile}
                                  </a>
                                )}
                              </div>

                              <p className="text-sm font-bold text-slate-800">{p.rawMaterial}</p>

                              <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                                <span>📅 {formatDateDDMMYYYY(p.date)}</span>
                                <span>•</span>
                                <span>
                                  Qty: <strong className="font-mono text-slate-800">{p.rawQty} {p.rawUnit}</strong>
                                </span>
                                {p.rawUnitPrice > 0 && (
                                  <>
                                    <span>•</span>
                                    <span>Rate: <strong className="font-mono text-slate-700">₹{p.rawUnitPrice}</strong></span>
                                  </>
                                )}
                              </div>

                              {alreadyReturned > 0 && (
                                <div className="inline-flex items-center gap-1 text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded">
                                  <RotateCcw className="w-3 h-3" />
                                  <span>Returned: {alreadyReturned} {p.rawUnit} (Refund: ₹{p.returnedAmount || 0})</span>
                                </div>
                              )}
                            </div>

                            {/* 4 Action Buttons: View, Edit, Return, Delete */}
                            <div className="flex flex-wrap items-center gap-1.5 shrink-0 pt-1 sm:pt-0">
                              <button
                                type="button"
                                onClick={() => setViewingPurchase(p)}
                                className="bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 px-2.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                                title="View full purchase details"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>View</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleEditPurchase(p)}
                                className="bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 px-2.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                                title="Edit this purchase entry"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                                <span>Edit</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleOpenReturnModal(p)}
                                disabled={!canReturn}
                                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                                  canReturn
                                    ? 'bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200'
                                    : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed opacity-60'
                                }`}
                                title={canReturn ? 'Return items to supplier' : 'All items already returned'}
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                                <span>Return</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => setDeletingPurchaseRecord(p)}
                                className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 px-2.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                                title="Delete purchase record"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Delete</span>
                              </button>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center justify-between pt-2 border-t border-slate-100 text-xs gap-2">
                            <div className="flex items-center gap-3">
                              <span className="text-slate-600">
                                Total: <strong className="font-mono text-slate-900">{formatCurrency(p.rawCost)}</strong>
                              </span>
                              <span className="text-slate-600">
                                Paid: <strong className="font-mono text-emerald-600">{formatCurrency(p.paid)}</strong>
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              {alreadyReturned > 0 && (
                                <span className="text-slate-500 font-mono text-[11px]">
                                  Net: {formatCurrency(p.netPurchaseAmount ?? (p.rawCost - (p.returnedAmount || 0)))}
                                </span>
                              )}
                              {p.balance > 0 ? (
                                <span className="font-mono font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                                  Bal Due: {formatCurrency(p.balance)}
                                </span>
                              ) : (
                                <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-bold text-[11px]">
                                  Fully Paid ✓
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                )}
              </div>
            </div>
          )}

          {/* ================= SUB-TAB 3: PURCHASE RETURNS ================= */}
          {purchaseActionTab === 'return' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Record Purchase Return Form */}
              <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-xs space-y-4">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                  <RotateCcw className="w-4 h-4 text-purple-700" />
                  <span>Record Return to Supplier ({purchaseCategory === 'cleaning' ? 'Cleaning' : 'Cosmetics'})</span>
                </h3>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!selectedReturnPurchId) {
                      alert('Please select a purchase to return.');
                      return;
                    }
                    const targetPurch = purchases.find((p) => p.id === selectedReturnPurchId);
                    if (targetPurch) {
                      setReturnPurchase(targetPurch);
                      handleSavePurchaseReturn(e);
                    }
                  }}
                  className="space-y-4"
                >
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">Select Purchase Record *</label>
                    <select
                      value={selectedReturnPurchId}
                      onChange={(e) => {
                        setSelectedReturnPurchId(e.target.value);
                        const p = purchases.find((x) => x.id === e.target.value);
                        if (p) {
                          setReturnPurchase(p);
                          setReturnQty(1);
                        }
                      }}
                      required
                      className="w-full border-2 border-slate-200 bg-white p-2.5 rounded-lg text-xs focus:border-purple-600 outline-none"
                    >
                      <option value="">-- Choose Purchase to Return Goods --</option>
                      {purchases
                        .filter((p) => p.type === purchaseCategory)
                        .sort((a, b) => {
                          const supComp = (a.supplierName || '').localeCompare(b.supplierName || '', undefined, { sensitivity: 'base' });
                          if (supComp !== 0) return supComp;
                          return (a.rawMaterial || '').localeCompare(b.rawMaterial || '', undefined, { sensitivity: 'base' });
                        })
                        .map((p) => {
                          const avail = Math.max(0, Number(p.rawQty || 0) - Number(p.returnedQty || 0));
                          return (
                            <option key={p.id} value={p.id} disabled={avail <= 0}>
                              {formatDateDDMMYYYY(p.date)} • {p.supplierName} • {p.rawMaterial} (Avail: {avail} {p.rawUnit})
                            </option>
                          );
                        })}
                    </select>
                  </div>

                  {selectedReturnPurchId && (() => {
                    const selP = purchases.find((p) => p.id === selectedReturnPurchId);
                    if (!selP) return null;
                    const avail = Math.max(0, Number(selP.rawQty || 0) - Number(selP.returnedQty || 0));
                    const unitRate = selP.rawUnitPrice || (selP.rawCost / (selP.rawQty || 1));

                    return (
                      <div className="p-3 bg-purple-50 rounded-lg border border-purple-200 text-xs space-y-1">
                        <div className="flex justify-between font-bold text-purple-950">
                          <span>{selP.supplierName}</span>
                          <span>Purchased: {selP.rawQty} {selP.rawUnit}</span>
                        </div>
                        <div className="flex justify-between text-purple-800">
                          <span>Material: {selP.rawMaterial}</span>
                          <span>Already Returned: {selP.returnedQty || 0} {selP.rawUnit}</span>
                        </div>
                        <div className="pt-1 border-t border-purple-200 flex justify-between font-bold text-purple-900">
                          <span>Max Available to Return:</span>
                          <span className="font-mono text-sm">{avail} {selP.rawUnit}</span>
                        </div>
                      </div>
                    );
                  })()}

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700">Return Quantity *</label>
                      <input
                        type="number"
                        min="0.1"
                        step="any"
                        value={returnQty || ''}
                        onChange={(e) => setReturnQty(parseFloat(e.target.value) || 0)}
                        required
                        className="w-full border-2 border-slate-200 p-2.5 rounded-lg text-xs font-mono font-bold focus:border-purple-600 outline-none"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700">Return Date</label>
                      <input
                        type="date"
                        value={returnDate}
                        onChange={(e) => setReturnDate(e.target.value)}
                        className="w-full border border-slate-200 p-2.5 rounded-lg text-xs font-mono focus:border-purple-600 outline-none"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">Reason for Return</label>
                    <input
                      type="text"
                      placeholder="e.g. Damaged container, Defective raw material"
                      value={returnReason}
                      onChange={(e) => setReturnReason(e.target.value)}
                      className="w-full border border-slate-200 p-2.5 rounded-lg text-xs focus:border-purple-600 outline-none"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-purple-700 hover:bg-purple-800 text-white py-3 rounded-lg font-bold text-xs shadow-md transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>PROCESS PURCHASE RETURN</span>
                  </button>
                </form>
              </div>

              {/* Purchase Returns History */}
              <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-xs space-y-4">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800 flex items-center justify-between">
                  <span>↩️ Return History ({purchaseCategory === 'cleaning' ? 'Cleaning' : 'Cosmetics'})</span>
                </h3>

                {(() => {
                  const catPurchases = purchases.filter((p) => p.type === purchaseCategory);
                  const returnEntries: Array<{
                    purchId: string;
                    supplier: string;
                    material: string;
                    unit: string;
                    ret: { id: string; qty: number; date: string; reason: string; amount: number; savedAt: number };
                  }> = [];

                  catPurchases.forEach((p) => {
                    (p.returns || []).forEach((r) => {
                      returnEntries.push({
                        purchId: p.id,
                        supplier: p.supplierName,
                        material: p.rawMaterial,
                        unit: p.rawUnit,
                        ret: r,
                      });
                    });
                  });

                  returnEntries.sort((a, b) => (b.ret.savedAt || 0) - (a.ret.savedAt || 0));

                  if (returnEntries.length === 0) {
                    return (
                      <p className="text-xs text-slate-400 text-center py-12 bg-slate-50/50 rounded-lg border border-dashed border-slate-200">
                        No purchase returns recorded for {purchaseCategory} goods yet.
                      </p>
                    );
                  }

                  return (
                    <div className="space-y-2.5 max-h-[460px] overflow-y-auto pr-1">
                      {returnEntries.map((item) => (
                        <div
                          key={item.ret.id}
                          className="p-3 bg-purple-50/40 rounded-lg border border-purple-200 text-xs space-y-1"
                        >
                          <div className="flex justify-between items-start">
                            <span className="font-bold text-purple-950">{item.supplier} — {item.material}</span>
                            <span className="font-mono font-bold text-purple-800">
                              {formatCurrency(item.ret.amount)}
                            </span>
                          </div>
                          <p className="text-slate-500 font-mono text-[11px]">
                            📅 {formatDateDDMMYYYY(item.ret.date)} • Returned: {item.ret.qty} {item.unit}
                          </p>
                          {item.ret.reason && (
                            <p className="text-[11px] text-purple-900 italic bg-white/60 p-1 rounded">
                              "{item.ret.reason}"
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ================= SECTION 3: EXPENSES ================= */}
      {mainTab === 'expenses' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800">
                {editingExpId ? '✏️ Edit Business Expense' : '💸 Record Business Expense'}
              </h3>
              {editingExpId && (
                <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded">
                  EDITING
                </span>
              )}
            </div>
            <form onSubmit={handleSaveExpense} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Expense Title</label>
                <input
                  type="text"
                  placeholder="e.g. Shop Rent, Electricity, Freight"
                  value={expTitle}
                  onChange={(e) => setExpTitle(e.target.value.toUpperCase())}
                  required
                  className="w-full border-2 border-slate-200 p-2.5 rounded-md text-xs font-semibold focus:border-rose-500 outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Amount (₹)</label>
                <input
                  type="number"
                  placeholder="0.00"
                  value={expAmount || ''}
                  onChange={(e) => setExpAmount(parseFloat(e.target.value) || 0)}
                  min="1"
                  step="any"
                  required
                  className="w-full border-2 border-slate-200 p-2.5 rounded-md text-xs font-mono font-bold text-rose-600 focus:border-rose-500 outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Date</label>
                <input
                  type="date"
                  value={expDate}
                  onChange={(e) => setExpDate(e.target.value)}
                  className="w-full border border-slate-200 p-2 rounded text-xs font-mono focus:border-rose-500 outline-none"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 bg-rose-600 hover:bg-rose-500 text-white py-2.5 rounded font-bold text-xs shadow transition cursor-pointer"
                >
                  {editingExpId ? 'UPDATE EXPENSE RECORD' : 'SAVE EXPENSE'}
                </button>
                {editingExpId && (
                  <button
                    type="button"
                    onClick={handleCancelEditExpense}
                    className="px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-bold text-xs transition cursor-pointer"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </div>

          <div className="lg:col-span-2 bg-white p-5 rounded-lg border border-slate-200 shadow-xs space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800">
              Expense History
            </h3>
            <div className="space-y-2.5 max-h-[500px] overflow-y-auto">
              {expenses.length === 0 ? (
                <div className="text-center py-10 text-xs text-slate-400">
                  No expenses recorded yet.
                </div>
              ) : (
                [...expenses]
                  .sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0))
                  .map((ex) => (
                    <div
                      key={ex.id}
                      className="p-3.5 rounded border border-slate-200 bg-rose-50/20 flex justify-between items-center text-xs"
                    >
                      <div>
                        <h4 className="font-bold text-slate-900">{ex.title}</h4>
                        <p className="text-[11px] font-mono text-slate-400">
                          {formatDateDDMMYYYY(ex.date)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-rose-600 text-sm mr-2">
                          {formatCurrency(ex.amount)}
                        </span>
                        <button
                          type="button"
                          onClick={() => setViewingExpense(ex)}
                          className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1 cursor-pointer transition border border-slate-200 shadow-2xs"
                          title="View Expense Details"
                        >
                          <Eye className="w-3 h-3 text-slate-600" />
                          <span>View</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleEditExpense(ex)}
                          className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1 cursor-pointer transition shadow-2xs"
                          title="Edit Expense"
                        >
                          <Edit2 className="w-3 h-3 text-indigo-600" />
                          <span>Edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingExpenseRecord(ex)}
                          className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1 cursor-pointer transition shadow-2xs"
                          title="Delete Expense"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Delete</span>
                        </button>
                      </div>
                    </div>
                  ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ================= EDIT STOCK MODAL ================= */}
      {editingStockItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white">
                  <Edit2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold leading-tight">Edit Stock Item</h3>
                  <p className="text-[11px] text-slate-400">
                    {editingStockItem.type === 'cleaning' ? 'Cleaning Inventory' : 'Cosmetic Inventory'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingStockItem(null)}
                className="text-slate-400 hover:text-white p-1 rounded-md transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveStockModal} className="p-5 space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Product Name *</label>
                <input
                  type="text"
                  required
                  value={editingStockItem.name}
                  onChange={(e) =>
                    setEditingStockItem({ ...editingStockItem, name: e.target.value })
                  }
                  className="w-full border-2 border-slate-200 rounded-md p-2.5 text-xs font-semibold focus:border-indigo-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Available Stock *</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={editingStockItem.stock}
                    onChange={(e) =>
                      setEditingStockItem({
                        ...editingStockItem,
                        stock: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full border-2 border-indigo-200 bg-indigo-50/50 rounded-md p-2.5 text-xs font-mono font-bold text-slate-900 focus:border-indigo-500 outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Stock Unit</label>
                  <select
                    value={editingStockItem.unit}
                    onChange={(e) =>
                      setEditingStockItem({
                        ...editingStockItem,
                        unit: e.target.value as UnitType,
                      })
                    }
                    className="w-full border-2 border-slate-200 rounded-md p-2.5 text-xs font-semibold focus:border-indigo-500 outline-none cursor-pointer"
                  >
                    <option value="Ltr">Ltr (Liter)</option>
                    <option value="ml">ml (Milliliter)</option>
                    <option value="Kg">Kg (Kilogram)</option>
                    <option value="Gram">Gram</option>
                    <option value="mg">mg (Milligram)</option>
                    <option value="Bottle">Bottle</option>
                    <option value="Pcs">Pcs</option>
                  </select>
                </div>
              </div>

              {/* Quick stock adjustment buttons */}
              <div className="flex items-center gap-1.5 pt-0.5">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                  Quick Adjust:
                </span>
                {[-10, -5, -1, 1, 5, 10].map((adj) => (
                  <button
                    key={adj}
                    type="button"
                    onClick={() =>
                      setEditingStockItem({
                        ...editingStockItem,
                        stock: Math.max(0, Number((editingStockItem.stock + adj).toFixed(3))),
                      })
                    }
                    className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold transition ${
                      adj > 0
                        ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                        : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
                    }`}
                  >
                    {adj > 0 ? `+${adj}` : adj}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">
                    {editingStockItem.type === 'cleaning' ? 'Wholesale Price (₹)' : 'Cost Price (₹)'}
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={editingStockItem.price1 || ''}
                    onChange={(e) =>
                      setEditingStockItem({
                        ...editingStockItem,
                        price1: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full border-2 border-slate-200 rounded-md p-2.5 text-xs font-mono font-bold focus:border-indigo-500 outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">
                    {editingStockItem.type === 'cleaning' ? 'Retail Price (₹)' : 'Sale Price (₹)'}
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={editingStockItem.price2 || ''}
                    onChange={(e) =>
                      setEditingStockItem({
                        ...editingStockItem,
                        price2: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full border-2 border-slate-200 rounded-md p-2.5 text-xs font-mono font-bold text-indigo-700 focus:border-indigo-500 outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 flex justify-between">
                  <span>Barcode / Code</span>
                  <span className="text-[10px] text-slate-400 font-normal">Optional</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. 890123456"
                  value={editingStockItem.barcode}
                  onChange={(e) =>
                    setEditingStockItem({ ...editingStockItem, barcode: e.target.value })
                  }
                  className="w-full border-2 border-slate-200 rounded-md p-2 text-xs font-mono focus:border-indigo-500 outline-none"
                />
              </div>

              <div className="pt-3 flex gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingStockItem(null)}
                  className="flex-1 py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 shadow"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= DELETE STOCK CONFIRMATION DIALOG ================= */}
      {deletingStockItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
                <Trash2 className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Delete Stock Item?</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Are you sure you want to permanently delete{' '}
                <strong className="text-slate-900">"{deletingStockItem.name}"</strong>?
              </p>
              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-600">
                Current Stock: <strong className="text-slate-900">{deletingStockItem.stock} {deletingStockItem.unit}</strong>
              </div>
              <p className="text-[11px] text-rose-600 font-medium">
                This item will be removed from inventory and billing selection.
              </p>
            </div>

            <div className="bg-slate-50 px-5 py-3.5 border-t border-slate-200 flex gap-2">
              <button
                type="button"
                onClick={() => setDeletingStockItem(null)}
                className="flex-1 py-2 px-3 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-bold transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteStock}
                className="flex-1 py-2 px-3 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 shadow"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Yes, Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= VIEW PURCHASE DETAILS MODAL ================= */}
      {viewingPurchase && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-8">
            {/* Header */}
            <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-xs">
                  <Eye className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold tracking-wide">Purchase Details</h3>
                  <p className="text-[11px] text-slate-300 font-mono">Ref: {viewingPurchase.id}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewingPurchase(null)}
                className="text-slate-400 hover:text-white p-1 rounded transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto text-xs">
              {/* Supplier & Category Information */}
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Supplier</span>
                  <span className="text-xs font-bold text-slate-900 block">{viewingPurchase.supplierName}</span>
                  {viewingPurchase.supplierMobile ? (
                    <a
                      href={`tel:${viewingPurchase.supplierMobile}`}
                      className="text-[11px] text-blue-600 hover:underline font-mono inline-flex items-center gap-1 mt-0.5"
                    >
                      <Phone className="w-3 h-3" />
                      {viewingPurchase.supplierMobile}
                    </a>
                  ) : (
                    <span className="text-[11px] text-slate-400 italic">No mobile</span>
                  )}
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Purchase Date & Category</span>
                  <span className="text-xs font-mono font-bold text-slate-800 block">
                    📅 {formatDateDDMMYYYY(viewingPurchase.date)}
                  </span>
                  <span
                    className={`inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      viewingPurchase.type === 'cleaning'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-pink-100 text-pink-800'
                    }`}
                  >
                    {viewingPurchase.type === 'cleaning' ? '🧹 Cleaning' : '💄 Cosmetics'}
                  </span>
                </div>
              </div>

              {/* Product / Material Details */}
              <div className="p-3 bg-white rounded-lg border border-slate-200 space-y-2">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Purchased Material</span>
                    <span className="text-sm font-extrabold text-slate-900">{viewingPurchase.rawMaterial}</span>
                    {viewingPurchase.rawBarcode && (
                      <span className="text-[11px] font-mono text-slate-500 block mt-0.5">
                        Barcode: {viewingPurchase.rawBarcode}
                      </span>
                    )}
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Quantity</span>
                    <span className="text-base font-mono font-black text-blue-900">
                      {viewingPurchase.rawQty} {viewingPurchase.rawUnit}
                    </span>
                    {viewingPurchase.rawUnitPrice > 0 && (
                      <span className="text-[11px] text-slate-500 font-mono block">
                        Rate: ₹{viewingPurchase.rawUnitPrice} / {viewingPurchase.rawUnit}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Financial Breakdown */}
              <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-700">Payment Breakdown</h4>
                <div className="space-y-1.5 font-mono text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Total Purchase Cost:</span>
                    <span className="font-bold text-slate-900">{formatCurrency(viewingPurchase.rawCost)}</span>
                  </div>
                  <div className="flex justify-between text-emerald-700">
                    <span>Amount Paid:</span>
                    <span className="font-bold">{formatCurrency(viewingPurchase.paid)}</span>
                  </div>
                  <div className="flex justify-between text-rose-700 border-t border-slate-200 pt-1.5 font-bold">
                    <span>Balance Due:</span>
                    <span>{formatCurrency(viewingPurchase.balance)}</span>
                  </div>

                  {(viewingPurchase.returnedQty || 0) > 0 && (
                    <>
                      <div className="flex justify-between text-purple-700 pt-1 border-t border-dashed border-slate-300">
                        <span>Total Returned ({viewingPurchase.returnedQty} {viewingPurchase.rawUnit}):</span>
                        <span className="font-bold">-{formatCurrency(viewingPurchase.returnedAmount || 0)}</span>
                      </div>
                      <div className="flex justify-between text-slate-900 font-extrabold pt-1">
                        <span>Net Final Amount:</span>
                        <span>{formatCurrency(viewingPurchase.netPurchaseAmount ?? (viewingPurchase.rawCost - (viewingPurchase.returnedAmount || 0)))}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Returns History Table (if any) */}
              {viewingPurchase.returns && viewingPurchase.returns.length > 0 && (
                <div className="p-3 bg-purple-50/60 rounded-lg border border-purple-200 space-y-2">
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-purple-900 flex items-center gap-1.5">
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Purchase Returns History ({viewingPurchase.returns.length})</span>
                  </h4>
                  <div className="divide-y divide-purple-100 text-[11px]">
                    {viewingPurchase.returns.map((ret) => (
                      <div key={ret.id} className="py-2 flex justify-between items-center">
                        <div>
                          <span className="font-bold text-purple-950 font-mono">
                            {ret.qty} {viewingPurchase.rawUnit} returned on {formatDateDDMMYYYY(ret.date)}
                          </span>
                          <p className="text-slate-500 italic mt-0.5">"{ret.reason}"</p>
                        </div>
                        <span className="font-mono font-bold text-purple-800">
                          {formatCurrency(ret.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="bg-slate-50 px-5 py-3 border-t border-slate-200 flex flex-wrap gap-2 justify-between items-center">
              <button
                type="button"
                onClick={() => window.print()}
                className="bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 py-2 px-3 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const item = viewingPurchase;
                    setViewingPurchase(null);
                    setDeletingPurchaseRecord(item);
                  }}
                  className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 py-2 px-3 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  title="Delete this purchase record"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const item = viewingPurchase;
                    setViewingPurchase(null);
                    handleEditPurchase(item);
                  }}
                  className="bg-amber-600 hover:bg-amber-700 text-white py-2 px-3 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Edit Purchase</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewingPurchase(null)}
                  className="bg-slate-200 hover:bg-slate-300 text-slate-800 py-2 px-4 rounded-lg text-xs font-bold transition cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= PURCHASE RETURN MODAL ================= */}
      {returnPurchase && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-8">
            {/* Header */}
            <div className="bg-purple-900 text-white px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-purple-700 flex items-center justify-center text-white shadow-xs">
                  <RotateCcw className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold tracking-wide">Purchase Return</h3>
                  <p className="text-[11px] text-purple-200">Return goods to supplier & adjust stock</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setReturnPurchase(null)}
                className="text-purple-300 hover:text-white p-1 rounded transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePurchaseReturn} className="p-5 space-y-4">
              {/* Info summary */}
              <div className="p-3 bg-purple-50/70 border border-purple-200 rounded-lg space-y-1 text-xs text-purple-950">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-sm text-purple-900">{returnPurchase.supplierName}</span>
                  <span className="font-mono text-[11px] text-slate-500">{formatDateDDMMYYYY(returnPurchase.date)}</span>
                </div>
                <p className="font-semibold text-slate-800">{returnPurchase.rawMaterial}</p>
                <div className="flex justify-between items-center text-[11px] pt-1 border-t border-purple-200">
                  <span>Purchased: <strong className="font-mono">{returnPurchase.rawQty} {returnPurchase.rawUnit}</strong></span>
                  <span>Already Returned: <strong className="font-mono text-purple-700">{returnPurchase.returnedQty || 0} {returnPurchase.rawUnit}</strong></span>
                  <span className="font-bold text-purple-900">
                    Max Available: {Math.max(0, Number(returnPurchase.rawQty || 0) - Number(returnPurchase.returnedQty || 0))} {returnPurchase.rawUnit}
                  </span>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">
                  Quantity to Return ({returnPurchase.rawUnit}) *
                </label>
                <input
                  type="number"
                  min="0.1"
                  max={Math.max(0, Number(returnPurchase.rawQty || 0) - Number(returnPurchase.returnedQty || 0))}
                  step="any"
                  value={returnQty || ''}
                  onChange={(e) => setReturnQty(parseFloat(e.target.value) || 0)}
                  required
                  className="w-full border-2 border-slate-200 p-2.5 rounded-lg text-xs font-mono font-bold focus:border-purple-600 outline-none text-slate-900"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Return Date</label>
                <input
                  type="date"
                  value={returnDate}
                  onChange={(e) => setReturnDate(e.target.value)}
                  className="w-full border border-slate-200 p-2 rounded-lg text-xs font-mono focus:border-purple-600 outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Reason for Return</label>
                <input
                  type="text"
                  placeholder="e.g. Defective / Damaged packing / Quality issue"
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  className="w-full border border-slate-200 p-2 rounded-lg text-xs focus:border-purple-600 outline-none"
                />
              </div>

              {/* Estimated Refund Value */}
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs flex justify-between items-center">
                <span className="text-slate-600 font-medium">Estimated Refund Value:</span>
                <span className="font-mono font-black text-purple-800 text-sm">
                  {formatCurrency(
                    Number(returnQty || 0) *
                      (returnPurchase.rawUnitPrice ||
                        returnPurchase.rawCost / (returnPurchase.rawQty || 1))
                  )}
                </span>
              </div>

              <p className="text-[11px] text-slate-500 italic">
                ℹ️ This will deduct {returnQty || 0} {returnPurchase.rawUnit} from the product's inventory stock and update purchase balances.
              </p>

              <div className="pt-2 flex gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setReturnPurchase(null)}
                  className="flex-1 py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 px-3 bg-purple-700 hover:bg-purple-800 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 shadow cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Confirm Return</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* ================= VIEW STOCK ITEM DETAILS MODAL ================= */}
      {viewingStockItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-xs">
                  <Package className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold tracking-wide">Product Details</h3>
                  <p className="text-[11px] text-slate-300">
                    {viewingStockItem.type === 'cleaning' ? '🧹 Cleaning Product' : '💄 Cosmetic Product'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewingStockItem(null)}
                className="text-slate-400 hover:text-white p-1 rounded transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Product Name</span>
                <h4 className="text-base font-extrabold text-slate-900 mt-0.5">{viewingStockItem.name}</h4>
                {viewingStockItem.barcode && (
                  <span className="text-[11px] font-mono text-slate-500 block mt-0.5">
                    Barcode: {viewingStockItem.barcode}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <div>
                  <span className="text-[10px] text-slate-500 font-bold uppercase block">Current Stock</span>
                  <span className={`text-lg font-mono font-bold ${viewingStockItem.stock <= 5 ? 'text-rose-600' : 'text-slate-900'}`}>
                    {viewingStockItem.stock} {viewingStockItem.unit}
                  </span>
                  {viewingStockItem.stock <= 5 && (
                    <span className="text-[10px] bg-rose-100 text-rose-700 px-1.5 py-0.2 rounded font-bold block w-fit mt-0.5">
                      LOW STOCK
                    </span>
                  )}
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 font-bold uppercase block">Category & Unit</span>
                  <span className="text-xs font-semibold text-slate-800 block mt-1">
                    {viewingStockItem.type === 'cleaning' ? 'Cleaning' : 'Cosmetics'} ({viewingStockItem.unit})
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 p-3 bg-indigo-50/40 border border-indigo-100 rounded-lg font-mono">
                <div>
                  <span className="text-[10px] text-slate-500 font-bold uppercase block">
                    {viewingStockItem.type === 'cleaning' ? 'Wholesale Rate' : 'Cost Price'}
                  </span>
                  <span className="text-sm font-bold text-slate-800">{formatCurrency(viewingStockItem.price1)}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 font-bold uppercase block">
                    {viewingStockItem.type === 'cleaning' ? 'Retail Rate' : 'Sale Price'}
                  </span>
                  <span className="text-sm font-bold text-indigo-700">{formatCurrency(viewingStockItem.price2)}</span>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 px-5 py-3 border-t border-slate-200 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => {
                  const item = viewingStockItem;
                  setViewingStockItem(null);
                  setDeletingStockItem({
                    type: item.type,
                    id: item.id,
                    name: item.name,
                    stock: item.stock,
                    unit: item.unit,
                  });
                }}
                className="py-2 px-3 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const item = viewingStockItem;
                    setViewingStockItem(null);
                    setEditingStockItem({
                      type: item.type,
                      id: item.id,
                      name: item.name,
                      barcode: item.barcode || '',
                      stock: item.stock,
                      unit: item.unit,
                      price1: item.price1,
                      price2: item.price2,
                    });
                  }}
                  className="py-2 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Edit Stock</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewingStockItem(null)}
                  className="py-2 px-4 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg text-xs font-bold transition cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= DELETE PURCHASE CONFIRMATION MODAL ================= */}
      {deletingPurchaseRecord && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
                <Trash2 className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Delete Purchase Record?</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Are you sure you want to permanently delete purchase record for{' '}
                <strong className="text-slate-900">"{deletingPurchaseRecord.supplierName} — {deletingPurchaseRecord.rawMaterial}"</strong>?
              </p>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-700 space-y-1">
                <div className="flex justify-between">
                  <span>Purchase Amount:</span>
                  <strong className="text-slate-900">{formatCurrency(deletingPurchaseRecord.rawCost)}</strong>
                </div>
                <div className="flex justify-between">
                  <span>Date:</span>
                  <span>{formatDateDDMMYYYY(deletingPurchaseRecord.date)}</span>
                </div>
              </div>
              {deletingPurchaseRecord.stockId && (
                <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-[11px] text-amber-900 text-left">
                  ⚠️ <strong>Stock Reversal:</strong>{' '}
                  {Math.max(0, Number(deletingPurchaseRecord.rawQty || 0) - Number(deletingPurchaseRecord.returnedQty || 0))}{' '}
                  {deletingPurchaseRecord.rawUnit} will be automatically deducted from your stock inventory.
                </div>
              )}
            </div>

            <div className="bg-slate-50 px-5 py-3.5 border-t border-slate-200 flex gap-2">
              <button
                type="button"
                onClick={() => setDeletingPurchaseRecord(null)}
                className="flex-1 py-2 px-3 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-bold transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeletePurchase}
                className="flex-1 py-2 px-3 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 shadow cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Yes, Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= VIEW EXPENSE DETAILS MODAL ================= */}
      {viewingExpense && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-rose-600 flex items-center justify-center text-white shadow-xs">
                  <DollarSign className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold tracking-wide">Expense Details</h3>
                  <p className="text-[11px] text-slate-300">Shop & Operations Outflow</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewingExpense(null)}
                className="text-slate-400 hover:text-white p-1 rounded transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-3.5 text-xs">
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Title / Category</span>
                <h4 className="text-base font-extrabold text-slate-900 mt-0.5">{viewingExpense.title}</h4>
              </div>

              <div className="p-3 bg-rose-50/40 border border-rose-100 rounded-lg flex justify-between items-center">
                <span className="text-slate-600 font-medium">Expense Amount:</span>
                <span className="text-lg font-mono font-black text-rose-600">
                  {formatCurrency(viewingExpense.amount)}
                </span>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex justify-between items-center font-mono">
                <span className="text-slate-500">Date Recorded:</span>
                <span className="font-bold text-slate-800">{formatDateDDMMYYYY(viewingExpense.date)}</span>
              </div>
            </div>

            <div className="bg-slate-50 px-5 py-3 border-t border-slate-200 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => {
                  const item = viewingExpense;
                  setViewingExpense(null);
                  setDeletingExpenseRecord(item);
                }}
                className="py-2 px-3 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const item = viewingExpense;
                    setViewingExpense(null);
                    handleEditExpense(item);
                  }}
                  className="py-2 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Edit</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewingExpense(null)}
                  className="py-2 px-4 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg text-xs font-bold transition cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= DELETE EXPENSE CONFIRMATION MODAL ================= */}
      {deletingExpenseRecord && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
                <Trash2 className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Delete Expense Record?</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Are you sure you want to permanently delete{' '}
                <strong className="text-slate-900">"{deletingExpenseRecord.title}"</strong>?
              </p>
              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-700 space-y-1">
                <div className="flex justify-between">
                  <span>Amount:</span>
                  <strong className="text-rose-600">{formatCurrency(deletingExpenseRecord.amount)}</strong>
                </div>
                <div className="flex justify-between">
                  <span>Date:</span>
                  <span>{formatDateDDMMYYYY(deletingExpenseRecord.date)}</span>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 px-5 py-3.5 border-t border-slate-200 flex gap-2">
              <button
                type="button"
                onClick={() => setDeletingExpenseRecord(null)}
                className="flex-1 py-2 px-3 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-bold transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteExpense}
                className="flex-1 py-2 px-3 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 shadow cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Yes, Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
