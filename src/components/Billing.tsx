import React, { useState, useEffect } from 'react';
import {
  Plus,
  Trash2,
  Printer,
  Calculator,
  RefreshCw,
  Sparkles,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  X,
  ShieldAlert,
} from 'lucide-react';
import { Product, CustomerProfile, BillItem, SaleRecord } from '../types';
import {
  formatCurrency,
  generateNextBillNo,
  getTodayDateString,
  getCleanInvoiceProductName,
} from '../utils/formatters';

interface BillingProps {
  products: Product[];
  customers: CustomerProfile[];
  sales: SaleRecord[];
  onSaveSale: (sale: SaleRecord) => void;
  onUpdateSale: (sale: SaleRecord) => void;
  onDeleteSale: (saleId: string) => void;
  onAddCustomer: (customer: CustomerProfile) => void;
  onViewInvoice: (sale: SaleRecord) => void;
  editingSale?: SaleRecord | null;
  onClearEditingSale?: () => void;
  onNavigateToHistory?: () => void;
}

export const Billing: React.FC<BillingProps> = ({
  products,
  customers,
  sales,
  onSaveSale,
  onUpdateSale,
  onAddCustomer,
  onViewInvoice,
  editingSale,
  onClearEditingSale,
}) => {
  // Editing state
  const [editingSaleId, setEditingSaleId] = useState<string | null>(null);

  // Notifications & Stock Modal State
  const [notificationToast, setNotificationToast] = useState<{
    type: 'success' | 'error' | 'warning';
    message: string;
  } | null>(null);

  const [stockErrorModal, setStockErrorModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    available: number;
    requested: number;
    shortage: number;
    unit: string;
  } | null>(null);

  // Form Fields
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [saleType, setSaleType] = useState<'Retail' | 'Wholesale'>('Retail');
  const [paymentMode, setPaymentMode] = useState<'Cash' | 'Online'>('Cash');
  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [billDate, setBillDate] = useState(getTodayDateString());

  // Current Item in composition
  const [selectedProductId, setSelectedProductId] = useState('');
  const [manualPackSize, setManualPackSize] = useState<number>(500); // default 500 ml
  const [selectedPackUnit, setSelectedPackUnit] = useState<'ml' | 'Ltr' | 'g' | 'Kg' | 'mg'>('ml');
  const [itemQty, setItemQty] = useState<number>(1);
  const [manualUnitRate, setManualUnitRate] = useState<number | ''>(''); // manual override if needed

  // Cart of items for current bill
  const [billItems, setBillItems] = useState<BillItem[]>([]);

  // Load editing sale if supplied
  useEffect(() => {
    if (editingSale) {
      setEditingSaleId(editingSale.id);
      setCustomerName(editingSale.name || '');
      setCustomerPhone(editingSale.phone || '');
      setSaleType(editingSale.saleType || 'Retail');
      setPaymentMode(editingSale.paymentMode || 'Cash');
      setPaidAmount(editingSale.paidAmount || 0);
      setBillDate(editingSale.date || getTodayDateString());
      setBillItems(editingSale.items || []);
    }
  }, [editingSale]);

  // Auto-generate Bill Number
  const cleaningSales = sales.filter((s) => s.type === 'cleaning');
  const nextBillNo = editingSaleId
    ? sales.find((s) => s.id === editingSaleId)?.billNo || 'CLN-0001'
    : generateNextBillNo('CLN', cleaningSales);

  // Selected product object
  const selectedProduct = products.find((p) => p.id === selectedProductId);

  // Auto-adapt pack unit when selectedProduct changes
  useEffect(() => {
    if (selectedProduct) {
      if (
        selectedProduct.unit === 'Kg' ||
        selectedProduct.unit === 'Gram' ||
        selectedProduct.unit === 'mg'
      ) {
        setSelectedPackUnit('g');
        setManualPackSize(500);
      } else if (selectedProduct.unit === 'Ltr' || selectedProduct.unit === 'ml') {
        setSelectedPackUnit('ml');
        setManualPackSize(500);
      }
    }
  }, [selectedProductId, selectedProduct]);

  // Base rate of selected product per Liter / Kg
  const baseRate = selectedProduct
    ? saleType === 'Wholesale'
      ? selectedProduct.wholesalePrice
      : selectedProduct.retailPrice
    : 0;

  // Real ML / Gram / Liter / Kg Conversion Math:
  const isLiquidOrWeight =
    selectedProduct &&
    (selectedProduct.unit === 'Ltr' ||
      selectedProduct.unit === 'Kg' ||
      selectedProduct.unit === 'ml' ||
      selectedProduct.unit === 'Gram' ||
      selectedProduct.unit === 'mg');

  // Multiplier for price calculation per single pack relative to base unit (1 Ltr or 1 Kg)
  const getPackRateMultiplier = (size: number, unit: 'ml' | 'Ltr' | 'g' | 'Kg' | 'mg'): number => {
    if (unit === 'Ltr' || unit === 'Kg') return size;
    if (unit === 'ml' || unit === 'g') return size / 1000;
    if (unit === 'mg') return size / 1000000;
    return 1;
  };

  // Stock deduction multiplier in product base unit (Ltr or Kg)
  const getStockDeductionPerPack = (
    size: number,
    packUnit: 'ml' | 'Ltr' | 'g' | 'Kg' | 'mg',
    prodUnit: string
  ): number => {
    if (prodUnit === 'Ltr' || prodUnit === 'ml') {
      if (packUnit === 'Ltr' || packUnit === 'Kg') return size;
      if (packUnit === 'ml' || packUnit === 'g') return size / 1000;
      if (packUnit === 'mg') return size / 1000000;
    }
    if (prodUnit === 'Kg' || prodUnit === 'Gram' || prodUnit === 'mg') {
      if (packUnit === 'Kg' || packUnit === 'Ltr') return size;
      if (packUnit === 'g' || packUnit === 'ml') return size / 1000;
      if (packUnit === 'mg') return size / 1000000;
    }
    return 1;
  };

  // Human-readable pack size display (e.g., "5 Liter" instead of "5000 ml")
  const getPackDisplayText = (size: number, unit: 'ml' | 'Ltr' | 'g' | 'Kg' | 'mg'): string => {
    if (unit === 'ml') {
      if (size >= 1000 && size % 1000 === 0) return `${size / 1000} Liter`;
      if (size >= 1000) return `${(size / 1000).toFixed(2).replace(/\.?0+$/, '')} Liter`;
      return `${size} ml`;
    }
    if (unit === 'Ltr') {
      return `${size} Liter`;
    }
    if (unit === 'g') {
      if (size >= 1000 && size % 1000 === 0) return `${size / 1000} Kg`;
      if (size >= 1000) return `${(size / 1000).toFixed(2).replace(/\.?0+$/, '')} Kg`;
      return `${size} g`;
    }
    if (unit === 'Kg') {
      return `${size} Kg`;
    }
    if (unit === 'mg') {
      return `${size} mg`;
    }
    return `${size} ${unit}`;
  };

  const calculatedPackRate =
    manualUnitRate !== ''
      ? Number(manualUnitRate)
      : isLiquidOrWeight
      ? Number((baseRate * getPackRateMultiplier(manualPackSize || 0, selectedPackUnit)).toFixed(2))
      : baseRate;

  const currentItemTotal = Number((calculatedPackRate * (itemQty || 0)).toFixed(2));

  const deductionPerPack = isLiquidOrWeight
    ? getStockDeductionPerPack(
        manualPackSize || 0,
        selectedPackUnit,
        selectedProduct?.unit || 'Ltr'
      )
    : 1;

  const currentItemStockDeduction = isLiquidOrWeight
    ? Number((deductionPerPack * (itemQty || 0)).toFixed(3))
    : Number(itemQty || 0);

  const packDisplayText = isLiquidOrWeight
    ? getPackDisplayText(manualPackSize || 0, selectedPackUnit)
    : selectedProduct?.unit || 'Pcs';

  // Real-time stock shortage & availability
  const alreadyDeducted = billItems
    .filter((item) => item.stockId === selectedProduct?.id)
    .reduce((sum, item) => sum + item.stockDeductionQty, 0);

  const availableStock = selectedProduct ? selectedProduct.stock : 0;
  const remainingStock = Math.max(0, Number((availableStock - alreadyDeducted).toFixed(3)));
  const totalNeededStock = Number((alreadyDeducted + currentItemStockDeduction).toFixed(3));
  const isStockDeficit = Boolean(selectedProduct && totalNeededStock > availableStock);
  const shortageAmount = isStockDeficit ? Number((totalNeededStock - availableStock).toFixed(3)) : 0;

  // Auto-adjust package size or quantity to maximum available remaining stock
  const handleSetMaxAvailable = () => {
    if (!selectedProduct || remainingStock <= 0) return;

    if (isLiquidOrWeight) {
      if (selectedPackUnit === 'Kg' || selectedPackUnit === 'Ltr') {
        setManualPackSize(remainingStock);
        setItemQty(1);
      } else if (selectedPackUnit === 'g' || selectedPackUnit === 'ml') {
        const remainingInSmall = Math.floor(remainingStock * 1000);
        if (remainingInSmall <= 0) return;
        if (manualPackSize > 0 && remainingInSmall >= manualPackSize) {
          setItemQty(Math.floor(remainingInSmall / manualPackSize));
        } else {
          setManualPackSize(remainingInSmall);
          setItemQty(1);
        }
      } else {
        setManualPackSize(remainingStock);
        setItemQty(1);
      }
    } else {
      setItemQty(remainingStock);
    }

    setNotificationToast({
      type: 'warning',
      message: `Adjusted quantity to max available stock (${remainingStock} ${selectedProduct.unit}).`,
    });
    setTimeout(() => setNotificationToast(null), 4000);
  };

  // Grand Total of current bill
  const grandTotal = Number(billItems.reduce((sum, item) => sum + item.total, 0).toFixed(2));
  const pendingDue = Math.max(0, Number((grandTotal - paidAmount).toFixed(2)));
  const excessReturn = Math.max(0, Number((paidAmount - grandTotal).toFixed(2)));

  // Sync paidAmount when items change if user hasn't typed custom paid
  useEffect(() => {
    if (!editingSaleId) {
      setPaidAmount(grandTotal);
    }
  }, [grandTotal, editingSaleId]);

  // Customer autofill
  const handleSelectCustomer = (name: string) => {
    setCustomerName(name);
    const found = customers.find((c) => c.name === name);
    if (found) {
      setCustomerPhone(found.phone || '');
    }
  };

  // Add Item to Bill
  const handleAddItem = () => {
    if (!selectedProduct) {
      setNotificationToast({
        type: 'error',
        message: 'Please select a product from stock.',
      });
      setTimeout(() => setNotificationToast(null), 4000);
      return;
    }
    if (!itemQty || itemQty <= 0) {
      setNotificationToast({
        type: 'error',
        message: 'Please enter a valid quantity (greater than 0).',
      });
      setTimeout(() => setNotificationToast(null), 4000);
      return;
    }
    if (isLiquidOrWeight && (!manualPackSize || manualPackSize <= 0)) {
      setNotificationToast({
        type: 'error',
        message: 'Please enter a valid package size.',
      });
      setTimeout(() => setNotificationToast(null), 4000);
      return;
    }

    // Check available stock - PROMINENT LOW STOCK ALERT
    if (isStockDeficit) {
      setStockErrorModal({
        isOpen: true,
        title: 'Insufficient Stock',
        message: '',
        available: availableStock,
        requested: totalNeededStock,
        shortage: shortageAmount,
        unit: selectedProduct.unit,
      });

      setNotificationToast({
        type: 'error',
        message: `Insufficient stock! Available: ${availableStock} ${selectedProduct.unit}`,
      });
      setTimeout(() => setNotificationToast(null), 3000);
      return;
    }

    const packageSizeMlEquivalent =
      selectedPackUnit === 'Ltr' || selectedPackUnit === 'Kg'
        ? manualPackSize * 1000
        : selectedPackUnit === 'mg'
        ? manualPackSize / 1000
        : manualPackSize;

    const newItem: BillItem = {
      id: 'item_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      productName: selectedProduct.name,
      stockId: selectedProduct.id,
      barcode: selectedProduct.barcode,
      packageSizeMl: packageSizeMlEquivalent,
      packUnit: selectedPackUnit,
      packDisplay: packDisplayText,
      qty: itemQty,
      unitType: isLiquidOrWeight ? `${packDisplayText} Bottle` : `${selectedProduct.unit}`,
      rate: calculatedPackRate,
      baseRate: baseRate,
      total: currentItemTotal,
      stockDeductionQty: currentItemStockDeduction,
    };

    setBillItems([...billItems, newItem]);
    // Reset product selection inputs for next item
    setSelectedProductId('');
    setItemQty(1);
    setManualUnitRate('');

    setNotificationToast({
      type: 'success',
      message: `Added ${newItem.productName} (${newItem.packDisplay} × ${newItem.qty}) to bill.`,
    });
    setTimeout(() => setNotificationToast(null), 3000);
  };

  const handleRemoveItem = (index: number) => {
    setBillItems(billItems.filter((_, i) => i !== index));
  };

  // Save / Update Bill
  const handleSaveBill = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim()) {
      setNotificationToast({
        type: 'error',
        message: 'Please enter or select a customer name.',
      });
      setTimeout(() => setNotificationToast(null), 4000);
      return;
    }
    if (billItems.length === 0) {
      setNotificationToast({
        type: 'error',
        message: 'Please add at least one product item to the bill before saving.',
      });
      setTimeout(() => setNotificationToast(null), 4000);
      return;
    }

    // Check customer directory
    const existingCust = customers.find(
      (c) => c.name.toLowerCase() === customerName.trim().toLowerCase()
    );
    if (!existingCust) {
      onAddCustomer({
        id: 'cust_' + Date.now(),
        name: customerName.trim().toUpperCase(),
        phone: customerPhone.trim(),
        createdAt: getTodayDateString(),
      });
    }

    const saleRecord: SaleRecord = {
      id: editingSaleId || 'sale_' + Date.now(),
      billNo: nextBillNo,
      type: 'cleaning',
      name: customerName.trim().toUpperCase(),
      phone: customerPhone.trim(),
      saleType,
      paymentMode,
      items: [...billItems],
      grandTotal,
      paidAmount: Number(paidAmount || 0),
      pendingAmount: pendingDue,
      excessAmount: excessReturn,
      date: billDate,
      createdAt: editingSaleId
        ? sales.find((s) => s.id === editingSaleId)?.createdAt || Date.now()
        : Date.now(),
    };

    if (editingSaleId) {
      onUpdateSale(saleRecord);
      setNotificationToast({
        type: 'success',
        message: `Bill #${saleRecord.billNo} updated successfully!`,
      });
    } else {
      onSaveSale(saleRecord);
      setNotificationToast({
        type: 'success',
        message: `Bill #${saleRecord.billNo} generated & saved successfully!`,
      });
    }

    // Instantly open preview invoice modal for printing or PDF download
    onViewInvoice(saleRecord);
    handleClearForm();
  };

  const handleClearForm = () => {
    setEditingSaleId(null);
    setCustomerName('');
    setCustomerPhone('');
    setSaleType('Retail');
    setPaymentMode('Cash');
    setBillItems([]);
    setPaidAmount(0);
    setSelectedProductId('');
    setManualPackSize(500);
    setSelectedPackUnit('ml');
    setItemQty(1);
    setManualUnitRate('');
    setBillDate(getTodayDateString());
    onClearEditingSale?.();
  };

  return (
    <div className="max-w-4xl mx-auto w-full space-y-6">
      {/* MAIN BILLING ENTRY (Pure POS Counter) */}
      <div className="bg-white p-6 sm:p-7 rounded-xl border border-slate-200 shadow-sm space-y-6">
        {/* Form Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold uppercase bg-indigo-100 text-indigo-800 border border-indigo-200 px-2.5 py-0.5 rounded">
                {editingSaleId ? 'EDITING BILL' : 'NEW BILL ENTRY'}
              </span>
              <span className="text-sm font-mono font-bold text-indigo-600">
                #{nextBillNo}
              </span>
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 mt-1">
              Cleaning Products Invoicing
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={billDate}
              onChange={(e) => setBillDate(e.target.value)}
              className="text-xs border border-slate-200 rounded p-1.5 font-mono text-slate-700 outline-none focus:border-indigo-500 font-semibold bg-slate-50"
            />
          </div>
        </div>

        {/* Notification Toast Banner */}
        {notificationToast && (
          <div
            className={`p-3 rounded-md flex items-center justify-between gap-2 text-xs font-semibold shadow-xs animate-in fade-in slide-in-from-top-1 duration-200 ${
              notificationToast.type === 'error'
                ? 'bg-rose-50 text-rose-800 border-2 border-rose-300'
                : notificationToast.type === 'warning'
                ? 'bg-amber-50 text-amber-900 border-2 border-amber-300'
                : 'bg-emerald-50 text-emerald-800 border-2 border-emerald-300'
            }`}
          >
            <div className="flex items-center gap-2">
              {notificationToast.type === 'error' ? (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              ) : notificationToast.type === 'warning' ? (
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              )}
              <span>{notificationToast.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setNotificationToast(null)}
              className="text-slate-400 hover:text-slate-700 p-1 rounded"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        <form onSubmit={handleSaveBill} className="space-y-6">
          {/* Customer Information */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50/90 p-4 sm:p-5 rounded-lg border border-slate-200">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">
                Select Customer from Directory
              </label>
              <select
                value={customerName}
                onChange={(e) => handleSelectCustomer(e.target.value)}
                className="w-full border-2 border-slate-200 bg-white p-2.5 rounded-md text-xs font-medium focus:border-indigo-500 outline-none"
              >
                <option value="">-- Choose Existing Customer --</option>
                {[...customers]
                  .sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }))
                  .map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name} {c.phone ? `(${c.phone})` : ''}
                    </option>
                  ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">
                Or Type New Customer Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. John Doe / Care Supermarket"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value.toUpperCase())}
                className="w-full border-2 border-slate-200 bg-white p-2.5 rounded-md text-xs font-semibold focus:border-indigo-500 outline-none"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Mobile / WhatsApp Number</label>
              <input
                type="tel"
                placeholder="e.g. 9876543210"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                className="w-full border-2 border-slate-200 bg-white p-2.5 rounded-md text-xs font-mono focus:border-indigo-500 outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Pricing Tier</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSaleType('Retail')}
                  className={`py-2 text-xs font-bold rounded-md border transition ${
                    saleType === 'Retail'
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  Retail Price
                </button>
                <button
                  type="button"
                  onClick={() => setSaleType('Wholesale')}
                  className={`py-2 text-xs font-bold rounded-md border transition ${
                    saleType === 'Wholesale'
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  Wholesale Price
                </button>
              </div>
            </div>
          </div>

          {/* Product Composition Section */}
          <div className="bg-white border-2 border-indigo-100 rounded-lg p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-indigo-50 pb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-900 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-indigo-600" />
                <span>Select Cleaning Liquid / Item</span>
              </span>
              {selectedProduct && (
                <div className="flex items-center gap-1.5">
                  {selectedProduct.stock <= 5 && (
                    <span className="text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300 px-2 py-0.5 rounded flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3 text-amber-600" />
                      Low Stock
                    </span>
                  )}
                  <span
                    className={`text-xs font-mono font-bold px-2.5 py-0.5 rounded border transition ${
                      isStockDeficit
                        ? 'bg-rose-100 text-rose-800 border-rose-400 font-black'
                        : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    }`}
                  >
                    Stock: {availableStock} {selectedProduct.unit}
                    {alreadyDeducted > 0 && ` (In Bill: ${alreadyDeducted})`}
                  </span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Select Product */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">
                  Bulk Chemical / Product <span className="text-rose-500">*</span>
                </label>
                <select
                  value={selectedProductId}
                  onChange={(e) => {
                    setSelectedProductId(e.target.value);
                  }}
                  className="w-full border-2 border-slate-200 bg-white p-2.5 rounded-md text-xs font-semibold focus:border-indigo-500 outline-none"
                >
                  <option value="">-- Choose Product from Stock --</option>
                  {[...products]
                    .sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }))
                    .map((p) => {
                      const isLow = p.stock <= 5 && p.stock > 0;
                      const isZero = p.stock <= 0;
                      return (
                        <option key={p.id} value={p.id}>
                          {p.name} — {isZero ? '⚠️ OUT OF STOCK' : isLow ? `⚠️ Low Stock: ${p.stock} ${p.unit}` : `Stock: ${p.stock} ${p.unit}`} | Base: ₹
                          {saleType === 'Wholesale' ? p.wholesalePrice : p.retailPrice}/{p.unit}
                        </option>
                      );
                    })}
                </select>
                {products.length === 0 && (
                  <p className="text-[11px] text-amber-700 bg-amber-50 p-2 rounded border border-amber-200 mt-1">
                    No cleaning products in stock yet. You can add your products in <strong>Operations &gt; Stock</strong>.
                  </p>
                )}
              </div>

              {/* Rate Override / Base Rate View */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 flex justify-between">
                  <span>Base Rate (₹ / {selectedProduct?.unit || 'Ltr'})</span>
                  <span className="text-[10px] text-slate-400 font-normal">Custom Override</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    placeholder={`₹${baseRate.toFixed(2)}`}
                    value={manualUnitRate}
                    onChange={(e) =>
                      setManualUnitRate(e.target.value === '' ? '' : parseFloat(e.target.value))
                    }
                    className="w-full border-2 border-slate-200 bg-white p-2.5 rounded-md text-xs font-mono font-bold focus:border-indigo-500 outline-none"
                  />
                  {manualUnitRate !== '' && (
                    <button
                      type="button"
                      onClick={() => setManualUnitRate('')}
                      className="px-2 bg-slate-100 border border-slate-200 rounded text-slate-500 hover:text-slate-800 text-xs"
                      title="Reset to default rate"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Package Size in ML / Gram / Liter / Kg / mg */}
              <div className="space-y-2">
                <div className="flex flex-wrap justify-between items-center gap-1.5">
                  <label className="text-xs font-bold text-slate-700">
                    Package Size & Unit
                  </label>
                  {/* Preset Buttons matching user requested: 100, 250, 300, 500, 1 Liter, 5 Liter */}
                  <div className="flex flex-wrap gap-1">
                    {(selectedProduct &&
                    (selectedProduct.unit === 'Kg' ||
                      selectedProduct.unit === 'Gram' ||
                      selectedProduct.unit === 'mg')
                      ? [
                          { label: '100g', size: 100, unit: 'g' as const },
                          { label: '250g', size: 250, unit: 'g' as const },
                          { label: '300g', size: 300, unit: 'g' as const },
                          { label: '500g', size: 500, unit: 'g' as const },
                          { label: '1 Kg', size: 1, unit: 'Kg' as const },
                          { label: '5 Kg', size: 5, unit: 'Kg' as const },
                        ]
                      : [
                          { label: '100 ml', size: 100, unit: 'ml' as const },
                          { label: '250 ml', size: 250, unit: 'ml' as const },
                          { label: '300 ml', size: 300, unit: 'ml' as const },
                          { label: '500 ml', size: 500, unit: 'ml' as const },
                          { label: '1 Liter', size: 1, unit: 'Ltr' as const },
                          { label: '5 Liter', size: 5, unit: 'Ltr' as const },
                        ]
                    ).map((preset) => {
                      const isSelected =
                        manualPackSize === preset.size && selectedPackUnit === preset.unit;
                      return (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => {
                            setManualPackSize(preset.size);
                            setSelectedPackUnit(preset.unit);
                          }}
                          className={`text-[11px] px-2.5 py-1 rounded-md font-mono font-bold transition shadow-2xs ${
                            isSelected
                              ? 'bg-indigo-600 text-white shadow-xs'
                              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          {preset.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex gap-2">
                  <input
                    type="number"
                    placeholder="Enter size"
                    value={manualPackSize || ''}
                    onChange={(e) => setManualPackSize(parseFloat(e.target.value) || 0)}
                    min="0.001"
                    step="any"
                    className="flex-1 border-2 border-indigo-200 bg-indigo-50/80 p-2.5 rounded-md focus:border-indigo-500 outline-none font-mono font-bold text-slate-900 text-xs"
                  />
                  {/* Unit Selector: ml, Ltr, g, Kg, mg */}
                  <select
                    value={selectedPackUnit}
                    onChange={(e) =>
                      setSelectedPackUnit(
                        e.target.value as 'ml' | 'Ltr' | 'g' | 'Kg' | 'mg'
                      )
                    }
                    className="px-3 bg-white border-2 border-slate-200 rounded text-slate-700 text-xs font-bold focus:border-indigo-500 outline-none cursor-pointer"
                  >
                    <option value="ml">ml (Milliliter)</option>
                    <option value="Ltr">Liter (Ltr)</option>
                    <option value="g">g (Gram)</option>
                    <option value="Kg">Kg (Kilogram)</option>
                    <option value="mg">mg (Milligram)</option>
                  </select>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium">
                  <span>
                    Selected Pack: <strong className="text-indigo-700 font-bold">{packDisplayText}</strong>
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Rate: ₹{calculatedPackRate.toFixed(2)} / pack
                  </span>
                </div>
              </div>

              {/* Quantity (Number of packs / bottles) */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Quantity (Packs / Bottles)</label>
                <input
                  type="number"
                  placeholder="e.g. 1"
                  value={itemQty || ''}
                  onChange={(e) => setItemQty(parseFloat(e.target.value) || 0)}
                  min="1"
                  step="any"
                  className="w-full border-2 border-slate-200 bg-white p-2.5 rounded-md text-xs font-mono font-bold focus:border-indigo-500 outline-none"
                />
              </div>
            </div>

            {/* Real-time Insufficient Stock Warning */}
            {isStockDeficit && (
              <div className="p-3 bg-rose-50 border-2 border-rose-400 rounded-lg text-rose-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs animate-in fade-in duration-200">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 font-black text-rose-700 text-xs sm:text-sm">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>Insufficient Stock</span>
                  </div>
                  <div className="text-xs text-rose-900 font-semibold flex items-center gap-2">
                    <span>Available: <strong className="font-mono text-slate-900">{availableStock} {selectedProduct?.unit}</strong></span>
                    <span>•</span>
                    <span>Requested: <strong className="font-mono text-rose-700">{totalNeededStock} {selectedProduct?.unit}</strong></span>
                  </div>
                </div>
                {remainingStock > 0 && (
                  <button
                    type="button"
                    onClick={handleSetMaxAvailable}
                    className="bg-rose-700 hover:bg-rose-800 text-white px-3.5 py-2 rounded-md text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-xs cursor-pointer whitespace-nowrap"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Set to Available Stock</span>
                  </button>
                )}
              </div>
            )}

            {/* LIVE CONVERSION CALCULATOR CARD */}
            <div className="bg-slate-950 text-white p-4 sm:p-5 rounded-lg shadow-inner flex flex-col gap-3 relative overflow-hidden border border-slate-800">
              <div className="flex justify-between items-center">
                <span className="text-[10px] uppercase font-mono tracking-widest text-slate-400 font-bold flex items-center gap-1.5">
                  <Calculator className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Conversion Math (Live)</span>
                </span>
                <span
                  className={`text-[10px] font-mono font-bold flex items-center gap-1.5 ${
                    isStockDeficit ? 'text-rose-400 font-black' : 'text-emerald-400'
                  }`}
                >
                  {isStockDeficit && <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />}
                  <span>
                    Stock Deduction: <strong>{currentItemStockDeduction} {selectedProduct?.unit || 'Ltr'}</strong>
                  </span>
                  {isStockDeficit && (
                    <span className="bg-rose-500/30 text-rose-200 px-1.5 py-0.2 rounded border border-rose-500/50 text-[9px] uppercase">
                      Shortage: -{shortageAmount} {selectedProduct?.unit}
                    </span>
                  )}
                </span>
              </div>

              <div className="flex flex-col sm:flex-row justify-between sm:items-end gap-3">
                <div>
                  <div className="text-2xl font-mono font-bold text-white tracking-tight">
                    {packDisplayText} × {itemQty || 0}{' '}
                    <span className="text-sm opacity-50">qty</span>
                  </div>
                  <div className="text-slate-400 text-xs mt-1 font-mono">
                    Logic: {packDisplayText} × ₹{baseRate.toFixed(2)} /{' '}
                    {selectedProduct?.unit || 'Ltr'} = ₹{calculatedPackRate.toFixed(2)} per pack
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-xs text-indigo-300 font-bold uppercase tracking-wider">
                    Item Total
                  </div>
                  <div className="text-3xl font-bold font-mono text-emerald-400">
                    {formatCurrency(currentItemTotal)}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleAddItem}
                className={`w-full mt-2 py-2.5 rounded font-bold text-xs transition shadow flex items-center justify-center gap-2 cursor-pointer ${
                  isStockDeficit
                    ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-900/30'
                    : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                }`}
              >
                {isStockDeficit ? (
                  <>
                    <AlertTriangle className="w-4 h-4 text-white" />
                    <span>Insufficient Stock</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    <span>ADD ITEM TO BILL</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Current Bill Items Table */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Current Bill Items ({billItems.length})
            </h3>

            {billItems.length === 0 ? (
              <div className="p-6 border-2 border-dashed border-slate-200 rounded-lg text-center text-xs text-slate-400">
                No items added to this bill yet. Select a product and click "Add Item to Bill".
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold">
                    <tr>
                      <th className="p-2.5">#</th>
                      <th className="p-2.5">Product</th>
                      <th className="p-2.5">Pack Size</th>
                      <th className="p-2.5 text-center">Qty</th>
                      <th className="p-2.5 text-right">Pack Rate</th>
                      <th className="p-2.5 text-right">Total</th>
                      <th className="p-2.5 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {billItems.map((item, idx) => (
                      <tr key={item.id} className="hover:bg-slate-50/60">
                        <td className="p-2.5 font-mono text-slate-400">{idx + 1}</td>
                        <td className="p-2.5 font-semibold text-slate-800">
                          {getCleanInvoiceProductName(item.productName)}
                        </td>
                        <td className="p-2.5 font-mono text-slate-600">{item.unitType}</td>
                        <td className="p-2.5 text-center font-mono font-bold">{item.qty}</td>
                        <td className="p-2.5 text-right font-mono text-slate-700">
                          ₹{item.rate.toFixed(2)}
                        </td>
                        <td className="p-2.5 text-right font-mono font-bold text-slate-900">
                          ₹{item.total.toFixed(2)}
                        </td>
                        <td className="p-2.5 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(idx)}
                            className="text-rose-500 hover:text-rose-700 p-1 rounded"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Payment & Balance Section */}
          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Grand Total</label>
                <div className="text-xl font-mono font-bold text-slate-900 bg-white p-2.5 rounded border border-slate-200">
                  {formatCurrency(grandTotal)}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Paid Amount (₹)</label>
                <input
                  type="number"
                  value={paidAmount}
                  onChange={(e) => setPaidAmount(parseFloat(e.target.value) || 0)}
                  min="0"
                  step="any"
                  className="w-full text-xl font-mono font-bold text-emerald-600 bg-white p-2.5 rounded border-2 border-slate-200 focus:border-indigo-500 outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Payment Mode</label>
                <select
                  value={paymentMode}
                  onChange={(e) => setPaymentMode(e.target.value as 'Cash' | 'Online')}
                  className="w-full p-2.5 bg-white border border-slate-200 rounded text-xs font-semibold focus:border-indigo-500 outline-none"
                >
                  <option value="Cash">💵 Cash</option>
                  <option value="Online">🌐 Online / UPI</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-200 text-xs">
              <div>
                {pendingDue > 0 ? (
                  <span className="text-rose-600 font-bold">
                    Pending Due: {formatCurrency(pendingDue)}
                  </span>
                ) : excessReturn > 0 ? (
                  <span className="text-amber-600 font-bold">
                    Excess Return: {formatCurrency(excessReturn)}
                  </span>
                ) : (
                  <span className="text-emerald-600 font-bold">Paid in Full ✓</span>
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              type="submit"
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-3.5 rounded-md font-bold text-sm tracking-wide shadow-md transition flex items-center justify-center gap-2"
            >
              <Printer className="w-4 h-4" />
              <span>{editingSaleId ? 'UPDATE INVOICE' : 'GENERATE INVOICE & SAVE'}</span>
            </button>
            <button
              type="button"
              onClick={handleClearForm}
              className="px-6 bg-slate-100 hover:bg-slate-200 text-slate-600 py-3.5 rounded-md font-bold text-xs border border-slate-200 transition"
            >
              CLEAR
            </button>
          </div>
        </form>

        {/* Stock Shortage Warning Modal */}
        {stockErrorModal && stockErrorModal.isOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full border-2 border-rose-300 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
              <div className="bg-rose-600 text-white px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-rose-100" />
                  <h3 className="font-bold text-sm sm:text-base tracking-wide">
                    Insufficient Stock
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setStockErrorModal(null)}
                  className="text-white/80 hover:text-white p-1 rounded hover:bg-rose-700 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-5 space-y-4">
                <div className="text-center">
                  <p className="text-xs text-slate-500 font-medium">Selected Product</p>
                  <p className="text-sm font-bold text-slate-900 mt-0.5">{selectedProduct?.name}</p>
                </div>

                <div className="grid grid-cols-2 gap-2 bg-rose-50 border border-rose-200 rounded-lg p-3 text-center">
                  <div className="border-r border-rose-200 pr-2">
                    <span className="text-[11px] text-slate-600 font-medium block">Available Stock</span>
                    <span className="text-base font-mono font-bold text-slate-900">
                      {stockErrorModal.available} {stockErrorModal.unit}
                    </span>
                  </div>
                  <div className="pl-2">
                    <span className="text-[11px] text-rose-700 font-medium block">Requested</span>
                    <span className="text-base font-mono font-bold text-rose-700">
                      {stockErrorModal.requested} {stockErrorModal.unit}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col gap-2 pt-1">
                  {remainingStock > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        handleSetMaxAvailable();
                        setStockErrorModal(null);
                      }}
                      className="w-full bg-rose-600 hover:bg-rose-700 text-white font-bold py-2.5 px-3 rounded-lg text-xs transition shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Set to Available Stock ({remainingStock} {stockErrorModal.unit})</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setStockErrorModal(null)}
                    className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-2 px-3 rounded-lg text-xs transition cursor-pointer text-center"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
