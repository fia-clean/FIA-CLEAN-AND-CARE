import React, { useState } from 'react';
import {
  Download,
  Trash2,
  Calendar,
  FileSpreadsheet,
  ArrowDownCircle,
  ArrowUpCircle,
  Database,
  X,
  CheckCircle2,
  RotateCcw,
  AlertTriangle,
} from 'lucide-react';
import { SaleRecord, PurchaseRecord, ExpenseRecord, DayBookEntry } from '../types';
import { formatCurrency, formatDateDDMMYYYY, getTodayDateString, downloadCSV, normalizeToDateKey } from '../utils/formatters';

interface DayBookProps {
  sales: SaleRecord[];
  purchases: PurchaseRecord[];
  expenses: ExpenseRecord[];
  clearedEntryIds: string[];
  onClearDayBook: (entryIds: string[]) => void;
  onRestoreClearedDayBook?: () => void;
  onOpenBackupModal: () => void;
}

export const DayBook: React.FC<DayBookProps> = ({
  sales,
  purchases,
  expenses,
  clearedEntryIds,
  onClearDayBook,
  onRestoreClearedDayBook,
  onOpenBackupModal,
}) => {
  const today = getTodayDateString();
  const now = new Date();
  const curYear = now.getFullYear();
  const curMonth = String(now.getMonth() + 1).padStart(2, '0');
  const thisMonthStart = `${curYear}-${curMonth}-01`;
  const lastDayNum = new Date(curYear, now.getMonth() + 1, 0).getDate();
  const thisMonthEnd = `${curYear}-${curMonth}-${String(lastDayNum).padStart(2, '0')}`;

  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [showClearConfirmModal, setShowClearConfirmModal] = useState(false);
  const [actionNotification, setActionNotification] = useState<string | null>(null);

  const isTodayActive = fromDate === today && toDate === today;
  const isMonthActive = fromDate === thisMonthStart && toDate === thisMonthEnd;
  const isAllActive = !fromDate && !toDate;

  // Assemble all day book entries
  const allEntries: DayBookEntry[] = [];

  // Sales (Income from collections)
  sales.forEach((s) => {
    if (s.paidAmount > 0) {
      allEntries.push({
        id: `sale_${s.id}`,
        type: 'Income',
        category: s.type === 'cleaning' ? 'Sale' : 'Cosmetics Sale',
        desc: `${s.type === 'cleaning' ? 'Cleaning Bill' : 'Cosmetics Bill'} #${s.billNo} (${s.name})`,
        amount: s.paidAmount,
        date: s.date,
        timestamp: s.createdAt,
        paymentMode: s.paymentMode || 'Cash',
      });
    }
  });

  // Purchases (Expense)
  purchases.forEach((p) => {
    if (p.paid > 0) {
      allEntries.push({
        id: `purch_${p.id}`,
        type: 'Expense',
        category: p.type === 'cleaning' ? 'Purchase' : 'Cosmetics Purchase',
        desc: `Purchase: ${p.rawMaterial} (${p.supplierName})`,
        amount: p.paid,
        date: p.date,
        timestamp: p.savedAt,
      });
    }
  });

  // Expenses
  expenses.forEach((e) => {
    allEntries.push({
      id: `exp_${e.id}`,
      type: 'Expense',
      category: 'Expense',
      desc: e.title,
      amount: e.amount,
      date: e.date,
      timestamp: e.savedAt,
    });
  });

  // Filter by date range and exclude cleared items
  const filteredEntries = allEntries
    .filter((entry) => {
      if (clearedEntryIds.includes(entry.id)) return false;
      const entryKey = normalizeToDateKey(entry.date) || String(entry.date || '');
      if (fromDate && entryKey < fromDate) return false;
      if (toDate && entryKey > toDate) return false;
      return true;
    })
    .sort((a, b) => {
      const dateA = normalizeToDateKey(a.date) || String(a.date || '');
      const dateB = normalizeToDateKey(b.date) || String(b.date || '');
      if (dateA !== dateB) {
        return dateB.localeCompare(dateA);
      }
      return (b.timestamp || 0) - (a.timestamp || 0);
    });

  const totalIncome = filteredEntries
    .filter((e) => e.type === 'Income')
    .reduce((sum, e) => sum + e.amount, 0);

  const totalCashIncome = filteredEntries
    .filter((e) => e.type === 'Income' && (e.paymentMode || 'Cash') === 'Cash')
    .reduce((sum, e) => sum + e.amount, 0);

  const totalOnlineIncome = filteredEntries
    .filter((e) => e.type === 'Income' && e.paymentMode === 'Online')
    .reduce((sum, e) => sum + e.amount, 0);

  const totalExpense = filteredEntries
    .filter((e) => e.type === 'Expense')
    .reduce((sum, e) => sum + e.amount, 0);

  const netBalance = totalIncome - totalExpense;

  const handleExportCSV = () => {
    const headers = ['Type', 'Category', 'Description', 'Amount (INR)', 'Date'];
    const rows = filteredEntries.map((e) => [
      e.type,
      e.category,
      e.desc,
      e.amount.toFixed(2),
      e.date,
    ]);
    downloadCSV(
      `FIA_DayBook_${fromDate || 'All'}_to_${toDate || 'All'}.csv`,
      headers,
      rows
    );
  };

  const handleClearCurrentView = () => {
    if (filteredEntries.length === 0) {
      setActionNotification('No filtered transactions to clear.');
      setTimeout(() => setActionNotification(null), 3000);
      return;
    }
    setShowClearConfirmModal(true);
  };

  const handleConfirmClearFiltered = () => {
    const idsToClear = filteredEntries.map((e) => e.id);
    onClearDayBook(idsToClear);
    setShowClearConfirmModal(false);
    setActionNotification(`Cleared ${idsToClear.length} transactions from Day Book ledger.`);
    setTimeout(() => setActionNotification(null), 4000);
  };

  return (
    <div className="space-y-6">
      {/* Top Notification Toast */}
      {actionNotification && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-lg text-xs font-bold flex items-center justify-between animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{actionNotification}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionNotification(null)}
            className="text-emerald-600 hover:text-emerald-900"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Top Filter Controls */}
      <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800">
              📖 Day Book & Financial Reports
            </h3>
            <p className="text-[11px] text-slate-400">
              Date-wise ledger of collections, purchases, and expenses
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleExportCSV}
              className="bg-emerald-700 hover:bg-emerald-600 text-white px-3 py-1.5 rounded text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
            <button
              onClick={onOpenBackupModal}
              className="bg-indigo-700 hover:bg-indigo-600 text-white px-3 py-1.5 rounded text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
            >
              <Database className="w-3.5 h-3.5" />
              <span>Backup</span>
            </button>

            {/* Restore Cleared Entries if any exist */}
            {clearedEntryIds.length > 0 && onRestoreClearedDayBook && (
              <button
                type="button"
                onClick={() => {
                  onRestoreClearedDayBook();
                  setActionNotification(`Restored ${clearedEntryIds.length} cleared ledger entries.`);
                  setTimeout(() => setActionNotification(null), 3500);
                }}
                className="bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 px-3 py-1.5 rounded text-xs font-bold transition flex items-center gap-1.5 shadow-2xs"
                title="Restore all hidden transactions back to Day Book"
              >
                <RotateCcw className="w-3.5 h-3.5 text-amber-700" />
                <span>Restore ({clearedEntryIds.length})</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleClearCurrentView}
              className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 px-3 py-1.5 rounded text-xs font-bold transition flex items-center gap-1.5 shadow-2xs"
              title="Clear all currently filtered transactions from Day Book"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear Filtered</span>
            </button>
          </div>
        </div>

        {/* Date Filter & Presets */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-3 rounded border border-slate-200 text-xs">
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-600">From Date</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full bg-white border border-slate-200 p-2 rounded text-xs font-mono outline-none focus:border-indigo-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-600">To Date</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full bg-white border border-slate-200 p-2 rounded text-xs font-mono outline-none focus:border-indigo-500"
            />
          </div>

          <div className="space-y-1 flex flex-col justify-end">
            <div className="flex gap-1.5 sm:gap-2">
              <button
                type="button"
                onClick={() => {
                  setFromDate(today);
                  setToDate(today);
                }}
                className={`flex-1 py-2 px-2 rounded text-xs font-bold transition flex items-center justify-center gap-1 border ${
                  isTodayActive
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                    : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                }`}
              >
                <span>📅 Today</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setFromDate(thisMonthStart);
                  setToDate(thisMonthEnd);
                }}
                className={`flex-1 py-2 px-2 rounded text-xs font-bold transition flex items-center justify-center gap-1 border ${
                  isMonthActive
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                    : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                }`}
              >
                <span>🗓️ This Month</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setFromDate('');
                  setToDate('');
                }}
                className={`flex-1 py-2 px-2 rounded text-xs font-bold transition flex items-center justify-center gap-1 border ${
                  isAllActive
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                    : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                }`}
              >
                <span>🌐 All Time</span>
              </button>
              {(fromDate || toDate) && (
                <button
                  type="button"
                  onClick={() => {
                    setFromDate('');
                    setToDate('');
                  }}
                  className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-2.5 py-2 rounded text-xs font-bold transition"
                  title="Clear Date Filters"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Summary Metric Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="p-3.5 rounded-lg border border-emerald-200 bg-emerald-50/50 flex items-center justify-between">
            <div>
              <span className="text-[10px] uppercase font-bold text-emerald-800">
                Total Inflow (Income)
              </span>
              <div className="text-xl font-bold font-mono text-emerald-700 mt-1">
                {formatCurrency(totalIncome)}
              </div>
              <div className="text-[10px] text-emerald-800 mt-1 flex items-center gap-1.5 font-mono font-bold">
                <span>💵 Cash: {formatCurrency(totalCashIncome)}</span>
                <span>•</span>
                <span>🌐 Online: {formatCurrency(totalOnlineIncome)}</span>
              </div>
            </div>
            <ArrowDownCircle className="w-6 h-6 text-emerald-500 shrink-0" />
          </div>

          <div className="p-3.5 rounded-lg border border-rose-200 bg-rose-50/50 flex items-center justify-between">
            <div>
              <span className="text-[10px] uppercase font-bold text-rose-800">
                Total Outflow (Expenses & Purchases)
              </span>
              <div className="text-xl font-bold font-mono text-rose-700 mt-1">
                {formatCurrency(totalExpense)}
              </div>
            </div>
            <ArrowUpCircle className="w-6 h-6 text-rose-500" />
          </div>

          <div
            className={`p-3.5 rounded-lg border ${
              netBalance >= 0
                ? 'border-indigo-200 bg-indigo-50/50 text-indigo-900'
                : 'border-rose-300 bg-rose-50 text-rose-900'
            } flex items-center justify-between`}
          >
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-600">
                Net Operating Balance
              </span>
              <div
                className={`text-xl font-bold font-mono mt-1 ${
                  netBalance >= 0 ? 'text-indigo-700' : 'text-rose-700'
                }`}
              >
                {formatCurrency(netBalance)}
              </div>
            </div>
            <span
              className={`text-xs font-bold font-mono px-2 py-0.5 rounded ${
                netBalance >= 0
                  ? 'bg-indigo-200/60 text-indigo-800'
                  : 'bg-rose-200 text-rose-800'
              }`}
            >
              {netBalance >= 0 ? '+ PROFIT' : '- DEFICIT'}
            </span>
          </div>
        </div>
      </div>

      {/* Transactions Table (Descending) */}
      <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-xs space-y-4">
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800">
          Filtered Transactions ({filteredEntries.length})
        </h3>

        <div className="space-y-2.5 max-h-[600px] overflow-y-auto">
          {filteredEntries.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-10">
              No ledger entries matching the selected criteria.
            </p>
          ) : (
            filteredEntries.map((entry) => (
              <div
                key={entry.id}
                className={`p-3.5 rounded-lg border flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs ${
                  entry.type === 'Income'
                    ? 'border-emerald-200 bg-emerald-50/20'
                    : 'border-slate-200 bg-slate-50/40'
                }`}
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded ${
                        entry.type === 'Income'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      [{entry.type}] {entry.category}
                    </span>
                    {entry.paymentMode && (
                      <span
                        className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded border ${
                          entry.paymentMode === 'Online'
                            ? 'bg-sky-50 text-sky-700 border-sky-200'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        }`}
                      >
                        {entry.paymentMode === 'Online' ? '🌐 Online' : '💵 Cash'}
                      </span>
                    )}
                    <span className="text-[10px] text-slate-400 font-mono">
                      {formatDateDDMMYYYY(entry.date)}
                    </span>
                  </div>
                  <p className="font-semibold text-slate-800">{entry.desc}</p>
                </div>

                <div className="text-right sm:text-right shrink-0">
                  <div
                    className={`text-base font-bold font-mono ${
                      entry.type === 'Income' ? 'text-emerald-700' : 'text-rose-600'
                    }`}
                  >
                    {entry.type === 'Income' ? '+' : '-'} {formatCurrency(entry.amount)}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Confirmation Modal for Clear Filtered Transactions */}
      {showClearConfirmModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto shadow-inner">
                <Trash2 className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900">
                Clear Filtered Transactions?
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                You are about to clear{' '}
                <strong className="text-slate-900 font-bold">{filteredEntries.length} transactions</strong>{' '}
                from the active Day Book display.
              </p>
              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-left text-[11px] text-slate-600 space-y-1">
                <div className="flex items-center gap-1.5 text-emerald-700 font-bold">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>Your bills, invoices & purchases remain completely safe!</span>
                </div>
                <p className="text-slate-500 pl-5">
                  This only clears the ledger view. You can restore them anytime using the "Restore" button.
                </p>
              </div>
            </div>

            <div className="bg-slate-50 px-5 py-3.5 border-t border-slate-200 flex gap-2">
              <button
                type="button"
                onClick={() => setShowClearConfirmModal(false)}
                className="flex-1 py-2 px-3 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-bold transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmClearFiltered}
                className="flex-1 py-2 px-3 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 shadow"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Yes, Clear ({filteredEntries.length})</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
