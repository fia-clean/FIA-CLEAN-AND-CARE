import React, { useState, useMemo } from 'react';
import {
  Search,
  Calendar,
  Filter,
  Download,
  Printer,
  Share2,
  Trash2,
  Edit3,
  Eye,
  FileText,
  ArrowUpDown,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Receipt,
  Layers,
  TrendingUp,
} from 'lucide-react';
import { SaleRecord } from '../types';
import {
  formatCurrency,
  formatDateDDMMYYYY,
  getTodayDateString,
  downloadCSV,
  createWhatsAppBillMessage,
} from '../utils/formatters';

interface BillingHistoryProps {
  sales: SaleRecord[];
  onViewInvoice: (sale: SaleRecord) => void;
  onEditSale: (sale: SaleRecord) => void;
  onDeleteSale: (saleId: string) => void;
  onNavigateToBilling: (type: 'cleaning' | 'cosmetics') => void;
}

export const BillingHistory: React.FC<BillingHistoryProps> = ({
  sales,
  onViewInvoice,
  onEditSale,
  onDeleteSale,
  onNavigateToBilling,
}) => {
  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState<'all' | 'cleaning' | 'cosmetics'>('all');
  const [saleTypeFilter, setSaleTypeFilter] = useState<'all' | 'Retail' | 'Wholesale'>('all');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<'all' | 'paid' | 'pending' | 'excess'>('all');
  const [paymentModeFilter, setPaymentModeFilter] = useState<'all' | 'Cash' | 'Online'>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');

  // In-app Delete Confirmation Modal State
  const [saleToDelete, setSaleToDelete] = useState<SaleRecord | null>(null);

  // Quick Date Presets
  const setDatePreset = (preset: 'today' | 'yesterday' | 'this_month' | 'all') => {
    const today = new Date();
    const todayStr = getTodayDateString();

    if (preset === 'today') {
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (preset === 'yesterday') {
      const yest = new Date(today);
      yest.setDate(yest.getDate() - 1);
      const yestStr = yest.toISOString().split('T')[0];
      setStartDate(yestStr);
      setEndDate(yestStr);
    } else if (preset === 'this_month') {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
      setStartDate(firstDay);
      setEndDate(todayStr);
    } else if (preset === 'all') {
      setStartDate('');
      setEndDate('');
    }
  };

  // Filter & Sort Sales
  const filteredSales = useMemo(() => {
    return sales
      .filter((sale) => {
        // Department Filter
        if (departmentFilter !== 'all' && sale.type !== departmentFilter) return false;

        // Sale Type Filter
        if (saleTypeFilter !== 'all' && sale.saleType !== saleTypeFilter) return false;

        // Payment Status Filter
        if (paymentStatusFilter === 'pending' && sale.pendingAmount <= 0) return false;
        if (paymentStatusFilter === 'paid' && sale.pendingAmount > 0) return false;
        if (paymentStatusFilter === 'excess' && (sale.excessAmount || 0) <= 0) return false;

        // Payment Mode Filter (Cash / Online)
        if (paymentModeFilter === 'Cash' && (sale.paymentMode || 'Cash') !== 'Cash') return false;
        if (paymentModeFilter === 'Online' && sale.paymentMode !== 'Online') return false;

        // Date Range Filter
        if (startDate && sale.date < startDate) return false;
        if (endDate && sale.date > endDate) return false;

        // Text Search
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchBill = sale.billNo.toLowerCase().includes(q);
          const matchName = sale.name.toLowerCase().includes(q);
          const matchPhone = sale.phone && sale.phone.toLowerCase().includes(q);
          const matchItem = sale.items.some((item) =>
            item.productName.toLowerCase().includes(q)
          );
          if (!matchBill && !matchName && !matchPhone && !matchItem) return false;
        }

        return true;
      })
      .sort((a, b) => {
        const timeA = a.createdAt || (a.date ? new Date(a.date).getTime() : 0);
        const timeB = b.createdAt || (b.date ? new Date(b.date).getTime() : 0);
        return sortOrder === 'desc' ? timeB - timeA : timeA - timeB;
      });
  }, [
    sales,
    departmentFilter,
    saleTypeFilter,
    paymentStatusFilter,
    paymentModeFilter,
    startDate,
    endDate,
    searchQuery,
    sortOrder,
  ]);

  // Aggregate Stats
  const totalAmount = filteredSales.reduce((sum, s) => sum + (s.grandTotal || 0), 0);
  const totalPaid = filteredSales.reduce((sum, s) => sum + (s.paidAmount || 0), 0);
  const totalCashPaid = filteredSales
    .filter((s) => (s.paymentMode || 'Cash') === 'Cash')
    .reduce((sum, s) => sum + (s.paidAmount || 0), 0);
  const totalOnlinePaid = filteredSales
    .filter((s) => s.paymentMode === 'Online')
    .reduce((sum, s) => sum + (s.paidAmount || 0), 0);
  const totalPending = filteredSales.reduce((sum, s) => sum + (s.pendingAmount || 0), 0);
  const cleaningCount = filteredSales.filter((s) => s.type === 'cleaning').length;
  const cosmeticsCount = filteredSales.filter((s) => s.type === 'cosmetics').length;

  // Export to CSV
  const handleExportCSV = () => {
    const headers = [
      'Bill No',
      'Date',
      'Department',
      'Customer Name',
      'Phone',
      'Sale Type',
      'Payment Mode',
      'Items Summary',
      'Grand Total',
      'Paid Amount',
      'Pending Due',
      'Excess Return',
    ];

    const rows = filteredSales.map((sale) => [
      sale.billNo,
      formatDateDDMMYYYY(sale.date),
      sale.type === 'cleaning' ? 'Cleaning' : 'Cosmetics',
      sale.name,
      sale.phone || '',
      sale.saleType,
      sale.paymentMode,
      sale.items.map((i) => `${i.productName} (${i.qty})`).join('; '),
      sale.grandTotal,
      sale.paidAmount,
      sale.pendingAmount,
      sale.excessAmount || 0,
    ]);

    downloadCSV(
      `FIA_Invoice_History_${getTodayDateString()}.csv`,
      headers,
      rows
    );
  };

  const handleShareWhatsApp = (sale: SaleRecord) => {
    const text = createWhatsAppBillMessage(sale);
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleConfirmDeleteSale = () => {
    if (!saleToDelete) return;
    onDeleteSale(saleToDelete.id);
    setSaleToDelete(null);
  };

  return (
    <div className="space-y-6">
      {/* Header & Quick Action Buttons */}
      <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold uppercase bg-indigo-100 text-indigo-800 px-2.5 py-0.5 rounded border border-indigo-200">
              ALL INVOICES
            </span>
            <span className="text-xs text-slate-500 font-medium">
              Sorted {sortOrder === 'desc' ? 'Descending (Newest First)' : 'Ascending (Oldest First)'}
            </span>
          </div>
          <h1 className="text-xl font-black text-slate-900 mt-1 tracking-tight">
            Billing & Invoices History
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            View, search, download PDF, print, edit, and export all generated customer bills.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => onNavigateToBilling('cleaning')}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-2 rounded text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
          >
            <Receipt className="w-4 h-4" />
            <span>+ New Cleaning Bill</span>
          </button>
          <button
            onClick={() => onNavigateToBilling('cosmetics')}
            className="bg-pink-600 hover:bg-pink-700 text-white px-3.5 py-2 rounded text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
          >
            <Sparkles className="w-4 h-4" />
            <span>+ New Cosmetics Bill</span>
          </button>
          <button
            onClick={handleExportCSV}
            disabled={filteredSales.length === 0}
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 px-3.5 py-2 rounded text-xs font-bold transition flex items-center gap-1.5 disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Total Invoices
            </span>
            <span className="p-2 rounded bg-indigo-50 text-indigo-600">
              <FileText className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black font-mono text-slate-900">
              {filteredSales.length}
            </div>
            <div className="text-[11px] text-slate-500 mt-1 flex gap-2 font-mono">
              <span className="text-indigo-600">{cleaningCount} Cleaning</span>
              <span>•</span>
              <span className="text-pink-600">{cosmeticsCount} Cosmetics</span>
            </div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Total Invoiced Value
            </span>
            <span className="p-2 rounded bg-indigo-50 text-indigo-600">
              <TrendingUp className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black font-mono text-slate-900">
              {formatCurrency(totalAmount)}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">Sum of selected bills</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Total Collected
            </span>
            <span className="p-2 rounded bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black font-mono text-emerald-600">
              {formatCurrency(totalPaid)}
            </div>
            <div className="text-[11px] text-slate-600 mt-1 flex items-center gap-1.5 font-mono font-bold">
              <span className="text-emerald-700">💵 {formatCurrency(totalCashPaid)}</span>
              <span>•</span>
              <span className="text-sky-700">🌐 {formatCurrency(totalOnlinePaid)}</span>
            </div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Pending Dues
            </span>
            <span className="p-2 rounded bg-rose-50 text-rose-600">
              <AlertTriangle className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black font-mono text-rose-600">
              {formatCurrency(totalPending)}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">Outstanding customer balance</p>
          </div>
        </div>
      </div>

      {/* Payment Collection Breakdown (Cash in Hand vs Online / UPI) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-emerald-50/90 border-2 border-emerald-300 p-4 rounded-xl flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-lg bg-emerald-600 text-white flex items-center justify-center text-xl font-bold shrink-0 shadow-xs">
              💵
            </div>
            <div>
              <div className="text-xs font-black uppercase tracking-wider text-emerald-950">
                Cash in Hand
              </div>
              <div className="text-[11px] text-emerald-700 font-medium">
                Direct Cash ({filteredSales.filter((s) => (s.paymentMode || 'Cash') === 'Cash' && s.paidAmount > 0).length} bills)
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-black font-mono text-emerald-800">
              {formatCurrency(totalCashPaid)}
            </div>
            <div className="text-[10px] text-emerald-600 font-bold uppercase">
              Cash Inflow
            </div>
          </div>
        </div>

        <div className="bg-sky-50/90 border-2 border-sky-300 p-4 rounded-xl flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-lg bg-sky-600 text-white flex items-center justify-center text-xl font-bold shrink-0 shadow-xs">
              🌐
            </div>
            <div>
              <div className="text-xs font-black uppercase tracking-wider text-sky-950">
                Online / UPI
              </div>
              <div className="text-[11px] text-sky-700 font-medium">
                GPay / Bank ({filteredSales.filter((s) => s.paymentMode === 'Online' && s.paidAmount > 0).length} bills)
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-black font-mono text-sky-800">
              {formatCurrency(totalOnlinePaid)}
            </div>
            <div className="text-[10px] text-sky-600 font-bold uppercase">
              Bank / UPI Inflow
            </div>
          </div>
        </div>
      </div>

      {/* Search & Filter Controller */}
      <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-xs space-y-4">
        {/* Search Bar & Date Presets */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="relative w-full md:flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Search by Bill No, Customer Name, Phone, or Item..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded p-2 pl-9 text-xs text-slate-800 outline-none focus:border-indigo-500 focus:bg-white transition"
            />
          </div>

          <div className="flex items-center gap-1 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
            <span className="text-[11px] font-bold text-slate-400 mr-1 uppercase">Date:</span>
            <button
              type="button"
              onClick={() => setDatePreset('today')}
              className={`px-2.5 py-1 text-xs rounded border transition ${
                startDate === getTodayDateString() && endDate === getTodayDateString()
                  ? 'bg-indigo-600 text-white border-indigo-600 font-bold'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => setDatePreset('yesterday')}
              className="px-2.5 py-1 text-xs rounded border bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 transition"
            >
              Yesterday
            </button>
            <button
              type="button"
              onClick={() => setDatePreset('this_month')}
              className="px-2.5 py-1 text-xs rounded border bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 transition"
            >
              This Month
            </button>
            <button
              type="button"
              onClick={() => setDatePreset('all')}
              className={`px-2.5 py-1 text-xs rounded border transition ${
                !startDate && !endDate
                  ? 'bg-indigo-600 text-white border-indigo-600 font-bold'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              All Time
            </button>
          </div>
        </div>

        {/* Filter Dropdowns */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3 pt-3 border-t border-slate-100">
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">Department</label>
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value as any)}
              className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-xs font-medium outline-none focus:border-indigo-500"
            >
              <option value="all">All Departments</option>
              <option value="cleaning">Cleaning Only</option>
              <option value="cosmetics">Cosmetics Only</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">Tier</label>
            <select
              value={saleTypeFilter}
              onChange={(e) => setSaleTypeFilter(e.target.value as any)}
              className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-xs font-medium outline-none focus:border-indigo-500"
            >
              <option value="all">All Tiers (Retail & Wholesale)</option>
              <option value="Retail">Retail</option>
              <option value="Wholesale">Wholesale</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">Payment Mode</label>
            <select
              value={paymentModeFilter}
              onChange={(e) => setPaymentModeFilter(e.target.value as any)}
              className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-xs font-medium outline-none focus:border-indigo-500"
            >
              <option value="all">All Modes (Cash & Online)</option>
              <option value="Cash">💵 Cash Only</option>
              <option value="Online">🌐 Online / UPI Only</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">Payment Status</label>
            <select
              value={paymentStatusFilter}
              onChange={(e) => setPaymentStatusFilter(e.target.value as any)}
              className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-xs font-medium outline-none focus:border-indigo-500"
            >
              <option value="all">All Payment Statuses</option>
              <option value="paid">Paid in Full</option>
              <option value="pending">Pending Due Only</option>
              <option value="excess">Excess / Return</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">From Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded p-1.5 text-xs font-mono outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">To Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded p-1.5 text-xs font-mono outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">Sort Order</label>
            <button
              type="button"
              onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
              className="w-full bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded p-2 text-xs font-bold text-slate-700 flex items-center justify-center gap-1 transition"
            >
              <ArrowUpDown className="w-3.5 h-3.5 text-indigo-600" />
              <span>{sortOrder === 'desc' ? 'Newest First' : 'Oldest First'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Invoice List / Table */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Invoices List ({filteredSales.length} records found)
            </h3>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setViewMode('table')}
              className={`px-2.5 py-1 text-xs rounded font-bold transition ${
                viewMode === 'table' ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-700'
              }`}
            >
              Table View
            </button>
            <button
              onClick={() => setViewMode('cards')}
              className={`px-2.5 py-1 text-xs rounded font-bold transition ${
                viewMode === 'cards' ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-700'
              }`}
            >
              Card View
            </button>
          </div>
        </div>

        {filteredSales.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <FileText className="w-6 h-6" />
            </div>
            <p className="text-sm font-bold text-slate-700">No invoices match your search or filter</p>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Try adjusting the date range, clearing filters, or create a new invoice from the billing tabs.
            </p>
          </div>
        ) : viewMode === 'table' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-100 border-b border-slate-200 text-slate-600 uppercase font-bold">
                <tr>
                  <th className="p-3">Bill No</th>
                  <th className="p-3">Date</th>
                  <th className="p-3">Customer & Contact</th>
                  <th className="p-3">Dept / Tier</th>
                  <th className="p-3">Items Summary</th>
                  <th className="p-3 text-right">Grand Total</th>
                  <th className="p-3 text-right">Paid</th>
                  <th className="p-3 text-right">Balance Due</th>
                  <th className="p-3 text-center min-w-[180px]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSales.map((sale) => (
                  <tr key={sale.id} className="hover:bg-slate-50/80 transition">
                    <td className="p-3">
                      <span className="font-mono font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded">
                        #{sale.billNo}
                      </span>
                    </td>
                    <td className="p-3 font-mono text-slate-600">
                      {formatDateDDMMYYYY(sale.date)}
                    </td>
                    <td className="p-3">
                      <div className="font-bold text-slate-900">{sale.name}</div>
                      {sale.phone && (
                        <div className="text-[11px] font-mono text-slate-500">{sale.phone}</div>
                      )}
                    </td>
                    <td className="p-3">
                      <div className="flex flex-col gap-1">
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded w-max uppercase ${
                            sale.type === 'cleaning'
                              ? 'bg-indigo-100 text-indigo-800'
                              : 'bg-pink-100 text-pink-800'
                          }`}
                        >
                          {sale.type === 'cleaning' ? 'Cleaning' : 'Cosmetics'}
                        </span>
                        <span className="text-[10px] text-slate-500 font-semibold">
                          {sale.saleType} • {sale.paymentMode}
                        </span>
                      </div>
                    </td>
                    <td className="p-3 max-w-xs">
                      <p className="text-[11px] text-slate-600 truncate" title={sale.items.map((i) => `${i.productName} (${i.packageSizeMl ? `${i.packageSizeMl}ml ` : ''}x ${i.qty})`).join(', ')}>
                        {sale.items
                          .map((i) => `${i.productName} (${i.packageSizeMl ? `${i.packageSizeMl}ml ` : ''}x ${i.qty})`)
                          .join(', ')}
                      </p>
                    </td>
                    <td className="p-3 text-right">
                      <div className="font-mono font-bold text-slate-900">
                        {formatCurrency(sale.grandTotal)}
                      </div>
                      {sale.returns && sale.returns.length > 0 && (
                        <div className="text-[10px] text-rose-600 font-bold font-mono">
                          ↩️ Ret: -{formatCurrency(sale.returnedAmount || 0)}
                        </div>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      <div className="font-mono font-bold text-emerald-600">
                        {formatCurrency(sale.paidAmount)}
                      </div>
                      <div className="mt-0.5">
                        {sale.paymentMode === 'Online' ? (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-bold bg-sky-50 text-sky-700 border border-sky-200 px-1.5 py-0.2 rounded font-mono">
                            🌐 Online/UPI
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 px-1.5 py-0.2 rounded font-mono">
                            💵 Cash
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-3 text-right font-mono">
                      {sale.pendingAmount > 0 ? (
                        <span className="text-rose-600 font-bold bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                          {formatCurrency(sale.pendingAmount)}
                        </span>
                      ) : (sale.excessAmount || 0) > 0 ? (
                        <span className="text-amber-600 font-bold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                          +{formatCurrency(sale.excessAmount || 0)}
                        </span>
                      ) : (
                        <span className="text-emerald-700 font-semibold text-[11px]">Paid ✓</span>
                      )}
                    </td>
                    <td className="p-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {/* 1. VIEW */}
                        <button
                          type="button"
                          onClick={() => onViewInvoice(sale)}
                          title="View Invoice & Print/PDF"
                          className="bg-indigo-600 hover:bg-indigo-700 text-white px-2 py-1.5 rounded text-xs font-bold transition flex items-center gap-1 shadow-2xs"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span className="hidden xl:inline">View</span>
                        </button>

                        {/* 2. SHARE */}
                        <button
                          type="button"
                          onClick={() => handleShareWhatsApp(sale)}
                          title="Share on WhatsApp"
                          className="bg-emerald-600 hover:bg-emerald-700 text-white px-2 py-1.5 rounded text-xs font-bold transition flex items-center gap-1 shadow-2xs"
                        >
                          <Share2 className="w-3.5 h-3.5" />
                          <span className="hidden xl:inline">Share</span>
                        </button>

                        {/* 3. EDIT */}
                        <button
                          type="button"
                          onClick={() => onEditSale(sale)}
                          title="Edit Bill"
                          className="bg-amber-500 hover:bg-amber-600 text-white px-2 py-1.5 rounded text-xs font-bold transition flex items-center gap-1 shadow-2xs"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span className="hidden xl:inline">Edit</span>
                        </button>

                        {/* 4. DELETE */}
                        <button
                          type="button"
                          onClick={() => setSaleToDelete(sale)}
                          title="Delete Bill"
                          className="bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 px-2 py-1.5 rounded text-xs font-bold transition flex items-center gap-1 shadow-2xs"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span className="hidden xl:inline">Delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          /* CARD VIEW FOR MOBILE & TOUCH DEVICES */
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredSales.map((sale) => (
              <div
                key={sale.id}
                className="bg-white p-4 rounded-xl border border-slate-200 hover:border-indigo-300 transition space-y-3 shadow-xs"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-xs font-mono font-bold text-indigo-800 bg-indigo-100 border border-indigo-200 px-2 py-0.5 rounded">
                      #{sale.billNo}
                    </span>
                    <h4 className="font-bold text-slate-900 text-sm mt-1">{sale.name}</h4>
                    {sale.phone && <p className="text-xs font-mono text-slate-500">{sale.phone}</p>}
                  </div>
                  <div className="text-right">
                    <span className="text-[11px] font-mono text-slate-500">
                      {formatDateDDMMYYYY(sale.date)}
                    </span>
                    <div className="text-base font-mono font-black text-slate-900 mt-1">
                      {formatCurrency(sale.grandTotal)}
                    </div>
                    {sale.returns && sale.returns.length > 0 && (
                      <div className="text-[10px] text-rose-600 font-bold font-mono">
                        ↩️ Ret: -{formatCurrency(sale.returnedAmount || 0)}
                      </div>
                    )}
                  </div>
                </div>

                <div className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-100 space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Dept & Tier:</span>
                    <span className="font-semibold text-slate-800">
                      {sale.type === 'cleaning' ? 'Cleaning' : 'Cosmetics'} ({sale.saleType})
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Items:</span>
                    <span className="font-medium text-slate-700 truncate max-w-[180px]">
                      {sale.items.map((i) => i.productName).join(', ')}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Payment:</span>
                    <div className="flex items-center gap-1.5">
                      {sale.paymentMode === 'Online' ? (
                        <span className="text-[10px] font-bold bg-sky-100 text-sky-800 border border-sky-300 px-1.5 py-0.5 rounded font-mono">
                          🌐 Online
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 px-1.5 py-0.5 rounded font-mono">
                          💵 Cash
                        </span>
                      )}
                      <span className="font-mono font-bold text-slate-800">
                        Paid: {formatCurrency(sale.paidAmount)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex justify-between items-center pt-1 border-t border-slate-100">
                  <div>
                    {sale.pendingAmount > 0 ? (
                      <span className="text-xs font-bold text-rose-600 font-mono bg-rose-50 border border-rose-200 px-2 py-0.5 rounded">
                        Due: {formatCurrency(sale.pendingAmount)}
                      </span>
                    ) : (sale.excessAmount || 0) > 0 ? (
                      <span className="text-xs font-bold text-amber-600 font-mono bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                        +{formatCurrency(sale.excessAmount || 0)}
                      </span>
                    ) : (
                      <span className="text-xs font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                        Paid in Full ✓
                      </span>
                    )}
                  </div>
                </div>

                {/* 4 Clean Action Buttons in Card View */}
                <div className="grid grid-cols-4 gap-1.5 pt-1">
                  {/* View */}
                  <button
                    type="button"
                    onClick={() => onViewInvoice(sale)}
                    className="py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 shadow-2xs"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>View</span>
                  </button>

                  {/* Share */}
                  <button
                    type="button"
                    onClick={() => handleShareWhatsApp(sale)}
                    className="py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 shadow-2xs"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span>Share</span>
                  </button>

                  {/* Edit */}
                  <button
                    type="button"
                    onClick={() => onEditSale(sale)}
                    className="py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 shadow-2xs"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Edit</span>
                  </button>

                  {/* Delete */}
                  <button
                    type="button"
                    onClick={() => setSaleToDelete(sale)}
                    className="py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* In-App Delete Invoice Confirmation Modal (Guaranteed iframe & mobile support) */}
      {saleToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">Delete Invoice #{saleToDelete.billNo}?</h4>
                <p className="text-xs text-slate-500">Customer: {saleToDelete.name}</p>
              </div>
            </div>

            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">Invoice Amount:</span>
                <span className="font-mono font-bold text-slate-800">{formatCurrency(saleToDelete.grandTotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Date:</span>
                <span className="font-mono text-slate-700">{formatDateDDMMYYYY(saleToDelete.date)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Items Count:</span>
                <span className="font-semibold text-slate-800">{saleToDelete.items.length} items</span>
              </div>
            </div>

            <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-[11px] text-amber-900">
              ✓ <strong>Inventory Auto-Restored:</strong> All {saleToDelete.items.length} product quantities from this bill will be automatically added back to your stock inventory.
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={handleConfirmDeleteSale}
                className="flex-1 bg-rose-600 hover:bg-rose-700 text-white py-2.5 rounded-lg text-xs font-bold shadow transition flex items-center justify-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                <span>Yes, Delete Invoice</span>
              </button>
              <button
                type="button"
                onClick={() => setSaleToDelete(null)}
                className="px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2.5 rounded-lg text-xs font-bold border border-slate-200 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
