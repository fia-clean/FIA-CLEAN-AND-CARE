import React, { useState, useEffect } from 'react';
import {
  Plus,
  Trash2,
  Sparkles,
  Printer,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  X,
} from 'lucide-react';
import { CosmeticProduct, CustomerProfile, BillItem, SaleRecord } from '../types';
import {
  formatCurrency,
  generateNextBillNo,
  getTodayDateString,
} from '../utils/formatters';

interface CosmeticsBillingProps {
  products: CosmeticProduct[];
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

export const CosmeticsBilling: React.FC<CosmeticsBillingProps> = ({
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
  const [editingSaleId, setEditingSaleId] = useState<string | null>(null);

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [saleType, setSaleType] = useState<'Retail' | 'Wholesale'>('Retail');
  const [paymentMode, setPaymentMode] = useState<'Cash' | 'Online'>('Cash');
  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [billDate, setBillDate] = useState(getTodayDateString());

  // Composition
  const [selectedProductId, setSelectedProductId] = useState('');
  const [itemQty, setItemQty] = useState<number>(1);
  const [manualRate, setManualRate] = useState<number | ''>('');

  const [billItems, setBillItems] = useState<BillItem[]>([]);

  // Non-blocking toast notifications & stock error modal
  const [notificationToast, setNotificationToast] = useState<{
    type: 'success' | 'warning' | 'error';
    message: string;
  } | null>(null);

  const [stockErrorModal, setStockErrorModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    productName: string;
    available: number;
    requested: number;
    shortage: number;
    unit: string;
  } | null>(null);

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

  const cosmeticsSales = sales.filter((s) => s.type === 'cosmetics');
  const nextBillNo = editingSaleId
    ? sales.find((s) => s.id === editingSaleId)?.billNo || 'COS-0001'
    : generateNextBillNo('COS', cosmeticsSales);

  const selectedProduct = products.find((p) => p.id === selectedProductId);
  const baseRate = selectedProduct
    ? saleType === 'Wholesale'
      ? selectedProduct.costPrice
      : selectedProduct.salePrice
    : 0;

  const effectiveRate = manualRate !== '' ? Number(manualRate) : baseRate;
  const currentItemTotal = Number((effectiveRate * (itemQty || 0)).toFixed(2));

  // Dynamic stock verification for selected cosmetic item
  const alreadyDeducted = selectedProduct
    ? billItems
        .filter((item) => item.stockId === selectedProduct.id)
        .reduce((sum, item) => sum + item.qty, 0)
    : 0;

  const availableStock = selectedProduct ? selectedProduct.stock : 0;
  const remainingStock = Math.max(0, availableStock - alreadyDeducted);
  const requestedQty = Number(itemQty || 0);
  const totalNeededStock = alreadyDeducted + requestedQty;
  const isStockDeficit = Boolean(selectedProduct && requestedQty > 0 && totalNeededStock > availableStock);
  const shortageAmount = isStockDeficit ? Number((totalNeededStock - availableStock).toFixed(2)) : 0;

  const grandTotal = Number(billItems.reduce((sum, item) => sum + item.total, 0).toFixed(2));
  const pendingDue = Math.max(0, Number((grandTotal - paidAmount).toFixed(2)));
  const excessReturn = Math.max(0, Number((paidAmount - grandTotal).toFixed(2)));

  useEffect(() => {
    if (!editingSaleId) {
      setPaidAmount(grandTotal);
    }
  }, [grandTotal, editingSaleId]);

  const handleSelectCustomer = (name: string) => {
    setCustomerName(name);
    const found = customers.find((c) => c.name === name);
    if (found) setCustomerPhone(found.phone || '');
  };

  const handleSetMaxAvailable = () => {
    if (remainingStock > 0) {
      setItemQty(remainingStock);
      setNotificationToast({
        type: 'warning',
        message: `Quantity adjusted to maximum available stock: ${remainingStock} ${selectedProduct?.unit || 'Units'}`,
      });
      setTimeout(() => setNotificationToast(null), 3500);
    }
  };

  const handleAddItem = () => {
    if (!selectedProduct) {
      setNotificationToast({
        type: 'warning',
        message: 'Please select a cosmetic product from stock.',
      });
      setTimeout(() => setNotificationToast(null), 3000);
      return;
    }
    if (!itemQty || itemQty <= 0) {
      setNotificationToast({
        type: 'warning',
        message: 'Please enter a valid quantity (minimum 1).',
      });
      setTimeout(() => setNotificationToast(null), 3000);
      return;
    }

    // STRICT STOCK DEFICIT CHECK
    if (isStockDeficit) {
      setStockErrorModal({
        isOpen: true,
        title: 'Insufficient Stock',
        message: '',
        productName: selectedProduct.name,
        available: availableStock,
        requested: totalNeededStock,
        shortage: shortageAmount,
        unit: selectedProduct.unit || 'Units',
      });

      setNotificationToast({
        type: 'error',
        message: `Insufficient stock! Available: ${availableStock} ${selectedProduct.unit || 'Units'}`,
      });
      setTimeout(() => setNotificationToast(null), 3000);
      return;
    }

    const newItem: BillItem = {
      id: 'cos_item_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      productName: selectedProduct.name,
      stockId: selectedProduct.id,
      barcode: selectedProduct.barcode,
      qty: itemQty,
      unitType: selectedProduct.unit || 'Pcs',
      packDisplay: selectedProduct.unit || 'Pcs',
      rate: effectiveRate,
      baseRate: baseRate,
      total: currentItemTotal,
      stockDeductionQty: itemQty,
    };

    setBillItems([...billItems, newItem]);
    setSelectedProductId('');
    setItemQty(1);
    setManualRate('');

    setNotificationToast({
      type: 'success',
      message: `Added ${newItem.productName} (${newItem.qty} ${newItem.unitType}) to bill.`,
    });
    setTimeout(() => setNotificationToast(null), 3000);
  };

  const handleRemoveItem = (index: number) => {
    setBillItems(billItems.filter((_, i) => i !== index));
  };

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
        message: 'Please add at least one cosmetic item to the bill.',
      });
      setTimeout(() => setNotificationToast(null), 4000);
      return;
    }

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
      id: editingSaleId || 'sale_cos_' + Date.now(),
      billNo: nextBillNo,
      type: 'cosmetics',
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
        message: `Cosmetics Bill #${saleRecord.billNo} updated successfully!`,
      });
    } else {
      onSaveSale(saleRecord);
      setNotificationToast({
        type: 'success',
        message: `Cosmetics Bill #${saleRecord.billNo} saved successfully!`,
      });
    }

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
    setItemQty(1);
    setManualRate('');
    setBillDate(getTodayDateString());
    onClearEditingSale?.();
  };

  return (
    <div className="max-w-4xl mx-auto w-full space-y-6">
      {/* MAIN BILLING ENTRY (Pure POS Counter) */}
      <div className="bg-white p-6 sm:p-7 rounded-xl border border-slate-200 shadow-sm space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold uppercase bg-pink-100 text-pink-800 border border-pink-200 px-2.5 py-0.5 rounded">
                {editingSaleId ? 'EDITING COSMETICS BILL' : 'NEW COSMETICS BILL'}
              </span>
              <span className="text-sm font-mono font-bold text-pink-600">
                #{nextBillNo}
              </span>
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 mt-1">
              Cosmetics Products Invoicing
            </h2>
          </div>
          <div>
            <input
              type="date"
              value={billDate}
              onChange={(e) => setBillDate(e.target.value)}
              className="text-xs border border-slate-200 rounded p-1.5 font-mono text-slate-700 outline-none focus:border-pink-500 font-semibold bg-slate-50"
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
          {/* Customer Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50/90 p-4 sm:p-5 rounded-lg border border-slate-200">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">
                Select Customer from Directory
              </label>
              <select
                value={customerName}
                onChange={(e) => handleSelectCustomer(e.target.value)}
                className="w-full border-2 border-slate-200 bg-white p-2.5 rounded-md text-xs font-medium focus:border-pink-500 outline-none"
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
                placeholder="e.g. Anjali / Beauty Parlour"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value.toUpperCase())}
                className="w-full border-2 border-slate-200 bg-white p-2.5 rounded-md text-xs font-semibold focus:border-pink-500 outline-none"
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
                className="w-full border-2 border-slate-200 bg-white p-2.5 rounded-md text-xs font-mono focus:border-pink-500 outline-none"
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
                      ? 'bg-pink-600 text-white border-pink-600 shadow-xs'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  Retail Sale Price
                </button>
                <button
                  type="button"
                  onClick={() => setSaleType('Wholesale')}
                  className={`py-2 text-xs font-bold rounded-md border transition ${
                    saleType === 'Wholesale'
                      ? 'bg-pink-600 text-white border-pink-600 shadow-xs'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  Wholesale Price
                </button>
              </div>
            </div>
          </div>

          {/* Product Pick */}
          <div className="bg-white border-2 border-pink-100 rounded-lg p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-pink-50 pb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-pink-900 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-pink-600" />
                <span>Select Cosmetic Product</span>
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
                        : 'bg-pink-50 text-pink-700 border-pink-200'
                    }`}
                  >
                    Stock: {availableStock} {selectedProduct.unit || 'Units'}
                    {alreadyDeducted > 0 && ` (In Bill: ${alreadyDeducted})`}
                  </span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2 space-y-1.5">
                <label className="text-xs font-bold text-slate-700">
                  Select Product <span className="text-rose-500">*</span>
                </label>
                <select
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(e.target.value)}
                  className="w-full border-2 border-slate-200 bg-white p-2.5 rounded-md text-xs font-semibold focus:border-pink-500 outline-none"
                >
                  <option value="">-- Choose Cosmetic Item from Stock --</option>
                  {[...products]
                    .sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }))
                    .map((p) => {
                      const isLow = p.stock <= 5 && p.stock > 0;
                      const isZero = p.stock <= 0;
                      return (
                        <option key={p.id} value={p.id}>
                          {p.name} — {isZero ? '⚠️ OUT OF STOCK' : isLow ? `⚠️ Low Stock: ${p.stock} ${p.unit || 'Units'}` : `Stock: ${p.stock} ${p.unit || 'Units'}`} | ₹{saleType === 'Wholesale' ? p.costPrice : p.salePrice}
                        </option>
                      );
                    })}
                </select>
                {products.length === 0 && (
                  <p className="text-[11px] text-pink-700 bg-pink-50 p-2 rounded border border-pink-200 mt-1">
                    No cosmetic products in stock yet. You can add your products in <strong>Operations &gt; Stock</strong>.
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Quantity</label>
                <input
                  type="number"
                  placeholder="1"
                  value={itemQty || ''}
                  onChange={(e) => setItemQty(parseFloat(e.target.value) || 0)}
                  min="1"
                  className="w-full border-2 border-slate-200 bg-white p-2.5 rounded-md text-xs font-mono font-bold focus:border-pink-500 outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Rate per Unit (₹)</label>
                <input
                  type="number"
                  placeholder={`₹${baseRate.toFixed(2)}`}
                  value={manualRate}
                  onChange={(e) =>
                    setManualRate(e.target.value === '' ? '' : parseFloat(e.target.value))
                  }
                  className="w-full border-2 border-slate-200 bg-white p-2.5 rounded-md text-xs font-mono font-bold focus:border-pink-500 outline-none"
                />
              </div>

              <div className="sm:col-span-2 flex items-end">
                <button
                  type="button"
                  onClick={handleAddItem}
                  className={`w-full p-2.5 rounded-md font-bold text-xs transition shadow flex items-center justify-center gap-1.5 h-[42px] cursor-pointer ${
                    isStockDeficit
                      ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-900/30'
                      : 'bg-pink-600 hover:bg-pink-700 text-white'
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
                      <span>ADD TO BILL (₹{currentItemTotal.toFixed(2)})</span>
                    </>
                  )}
                </button>
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
                    <span>Available: <strong className="font-mono text-slate-900">{availableStock} {selectedProduct?.unit || 'Units'}</strong></span>
                    <span>•</span>
                    <span>Requested: <strong className="font-mono text-rose-700">{totalNeededStock} {selectedProduct?.unit || 'Units'}</strong></span>
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
          </div>

          {/* Current Items List */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Cosmetics in Bill ({billItems.length})
            </h3>

            {billItems.length === 0 ? (
              <div className="p-6 border-2 border-dashed border-slate-200 rounded-lg text-center text-xs text-slate-400">
                No cosmetic items in this bill. Select a product and click "Add to Bill".
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold">
                    <tr>
                      <th className="p-2.5">#</th>
                      <th className="p-2.5">Product</th>
                      <th className="p-2.5 text-center">Qty</th>
                      <th className="p-2.5 text-right">Rate</th>
                      <th className="p-2.5 text-right">Total</th>
                      <th className="p-2.5 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {billItems.map((item, idx) => (
                      <tr key={item.id} className="hover:bg-slate-50/60">
                        <td className="p-2.5 font-mono text-slate-400">{idx + 1}</td>
                        <td className="p-2.5 font-semibold text-slate-800">{item.productName}</td>
                        <td className="p-2.5 text-center font-mono font-bold">{item.qty}</td>
                        <td className="p-2.5 text-right font-mono text-slate-700">₹{item.rate.toFixed(2)}</td>
                        <td className="p-2.5 text-right font-mono font-bold text-slate-900">₹{item.total.toFixed(2)}</td>
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

          {/* Payment & Balance */}
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
                  className="w-full text-xl font-mono font-bold text-emerald-600 bg-white p-2.5 rounded border-2 border-slate-200 focus:border-pink-500 outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Payment Mode</label>
                <select
                  value={paymentMode}
                  onChange={(e) => setPaymentMode(e.target.value as 'Cash' | 'Online')}
                  className="w-full p-2.5 bg-white border border-slate-200 rounded text-xs font-semibold focus:border-pink-500 outline-none"
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
              className="flex-1 bg-pink-600 hover:bg-pink-700 text-white py-3.5 rounded-md font-bold text-sm tracking-wide shadow-md transition flex items-center justify-center gap-2"
            >
              <Printer className="w-4 h-4" />
              <span>{editingSaleId ? 'UPDATE COSMETICS BILL' : 'SAVE & PREVIEW BILL'}</span>
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
