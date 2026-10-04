import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, ChevronDown, X, User, Phone, CheckCircle2, UserPlus } from 'lucide-react';
import { CustomerProfile } from '../types';

interface CustomerAutocompleteProps {
  customers: CustomerProfile[];
  customerName: string;
  customerPhone?: string;
  onSelectCustomer: (name: string, phone?: string) => void;
  onChangeName: (name: string) => void;
  onClearCustomer?: () => void;
  accentColor?: 'indigo' | 'pink';
  required?: boolean;
  placeholder?: string;
}

export const CustomerAutocomplete: React.FC<CustomerAutocompleteProps> = ({
  customers,
  customerName,
  customerPhone,
  onSelectCustomer,
  onChangeName,
  onClearCustomer,
  accentColor = 'indigo',
  required = false,
  placeholder = 'Type name (e.g. POO for POOLA MANU)...',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  // Filter and sort customers:
  // 1. Prefix matches first (names starting with the query, e.g. "POO" -> "POOLA...")
  // 2. Substring matches second (names containing query anywhere)
  // 3. Phone matches third
  const filteredCustomers = useMemo(() => {
    const query = (customerName || '').trim().toLowerCase();
    if (!query) {
      // If query is empty, return all customers sorted A to Z
      return [...customers].sort((a, b) =>
        (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' })
      );
    }

    const prefixMatches: CustomerProfile[] = [];
    const substringMatches: CustomerProfile[] = [];
    const phoneMatches: CustomerProfile[] = [];

    customers.forEach((c) => {
      const name = (c.name || '').toLowerCase();
      const phone = (c.phone || '').toLowerCase();

      if (name.startsWith(query)) {
        prefixMatches.push(c);
      } else if (name.includes(query)) {
        substringMatches.push(c);
      } else if (phone && phone.includes(query)) {
        phoneMatches.push(c);
      }
    });

    const sortFn = (a: CustomerProfile, b: CustomerProfile) =>
      (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' });

    prefixMatches.sort(sortFn);
    substringMatches.sort(sortFn);
    phoneMatches.sort(sortFn);

    return [...prefixMatches, ...substringMatches, ...phoneMatches];
  }, [customers, customerName]);

  // Check if currently entered name matches an existing customer exactly
  const matchedExistingCustomer = useMemo(() => {
    const trimmed = (customerName || '').trim().toLowerCase();
    if (!trimmed) return null;
    return customers.find((c) => (c.name || '').trim().toLowerCase() === trimmed);
  }, [customers, customerName]);

  // Scroll active item into view
  useEffect(() => {
    if (highlightedIndex >= 0 && listRef.current) {
      const item = listRef.current.children[highlightedIndex] as HTMLElement;
      if (item) {
        item.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.toUpperCase();
    onChangeName(val);
    setIsOpen(true);
    setHighlightedIndex(-1); // don't pre-highlight to allow custom typing
  };

  const handleSelect = (c: CustomerProfile) => {
    onSelectCustomer(c.name, c.phone || '');
    setIsOpen(false);
    setHighlightedIndex(-1);
  };

  const handleClear = () => {
    if (onClearCustomer) {
      onClearCustomer();
    } else {
      onChangeName('');
    }
    setIsOpen(false);
    setHighlightedIndex(-1);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        setIsOpen(true);
        e.preventDefault();
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev < filteredCustomers.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev > 0 ? prev - 1 : filteredCustomers.length - 1
      );
    } else if (e.key === 'Enter') {
      if (highlightedIndex >= 0 && highlightedIndex < filteredCustomers.length) {
        e.preventDefault();
        handleSelect(filteredCustomers[highlightedIndex]);
      } else {
        // If Enter pressed with no selection, just close dropdown and keep entered name
        setIsOpen(false);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
      setHighlightedIndex(-1);
    }
  };

  // Helper to highlight matching text
  const highlightMatch = (text: string, query: string) => {
    if (!query.trim()) return <span>{text}</span>;
    const q = query.trim().toLowerCase();
    const idx = text.toLowerCase().indexOf(q);
    if (idx === -1) return <span>{text}</span>;

    const before = text.substring(0, idx);
    const match = text.substring(idx, idx + q.length);
    const after = text.substring(idx + q.length);

    return (
      <span>
        {before}
        <span
          className={`font-black underline px-0.5 rounded ${
            accentColor === 'pink' ? 'text-pink-700 bg-pink-100' : 'text-indigo-700 bg-indigo-100'
          }`}
        >
          {match}
        </span>
        {after}
      </span>
    );
  };

  const focusBorderClass =
    accentColor === 'pink' ? 'focus-within:border-pink-500' : 'focus-within:border-indigo-500';
  const hoverItemClass =
    accentColor === 'pink' ? 'hover:bg-pink-50' : 'hover:bg-indigo-50';
  const activeItemClass =
    accentColor === 'pink' ? 'bg-pink-100 text-pink-900' : 'bg-indigo-100 text-indigo-900';

  return (
    <div className="relative space-y-1.5" ref={wrapperRef}>
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
          <User className="w-3.5 h-3.5 text-slate-500" />
          <span>
            Customer Name <span className="text-rose-500">*</span>
          </span>
        </label>
        {matchedExistingCustomer ? (
          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            Directory Customer
          </span>
        ) : customerName.trim() ? (
          <span className="text-[10px] font-bold text-sky-700 bg-sky-50 border border-sky-200 px-1.5 py-0.5 rounded flex items-center gap-1">
            <UserPlus className="w-3 h-3 text-sky-600" />
            New Customer
          </span>
        ) : (
          <span className="text-[10px] text-slate-400">
            {customers.length} in directory
          </span>
        )}
      </div>

      {/* Input Box with live search and clear/dropdown buttons */}
      <div
        className={`flex items-center bg-white border-2 border-slate-200 rounded-md transition shadow-2xs ${focusBorderClass}`}
      >
        <div className="pl-3 text-slate-400">
          <Search className="w-4 h-4" />
        </div>
        <input
          ref={inputRef}
          type="text"
          value={customerName}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          required={required}
          className="w-full p-2.5 text-xs font-semibold text-slate-900 outline-none bg-transparent"
          autoComplete="off"
        />

        {/* Clear Button */}
        {customerName && (
          <button
            type="button"
            onClick={handleClear}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full mr-1 transition cursor-pointer"
            title="Clear customer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Dropdown Toggle Button */}
        <button
          type="button"
          onClick={() => {
            setIsOpen(!isOpen);
            if (!isOpen) {
              inputRef.current?.focus();
            }
          }}
          className="p-2 text-slate-400 hover:text-slate-700 border-l border-slate-100 pr-2.5 transition cursor-pointer"
          title={isOpen ? 'Close customer list' : 'Browse all customers'}
        >
          <ChevronDown
            className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          />
        </button>
      </div>

      {/* Dropdown Suggestions Menu */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
          {/* Header Bar */}
          <div className="bg-slate-50 px-3 py-1.5 border-b border-slate-200 flex items-center justify-between text-[11px] text-slate-500 font-semibold">
            <span>
              {customerName.trim()
                ? `Matching Customers (${filteredCustomers.length})`
                : `All Directory Customers (${customers.length})`}
            </span>
            <span className="text-[10px] text-slate-400">
              {filteredCustomers.length > 0 ? 'Click to select or use ↑↓' : ''}
            </span>
          </div>

          {/* Customer Items List */}
          <ul
            ref={listRef}
            className="max-h-60 overflow-y-auto divide-y divide-slate-100 text-xs"
          >
            {filteredCustomers.length === 0 ? (
              <li className="p-4 text-center text-slate-400 space-y-1">
                <p className="font-semibold text-slate-600">
                  No existing customer found matching "{customerName}".
                </p>
                <p className="text-[11px] text-slate-400">
                  Press Tab or Enter to continue adding <strong>"{customerName}"</strong> as a new customer.
                </p>
              </li>
            ) : (
              filteredCustomers.map((c, index) => {
                const isSelected =
                  c.name.trim().toLowerCase() === customerName.trim().toLowerCase();
                const isHighlighted = highlightedIndex === index;

                return (
                  <li
                    key={c.id}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleSelect(c);
                    }}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    className={`px-3 py-2.5 cursor-pointer flex items-center justify-between transition ${
                      isHighlighted
                        ? activeItemClass
                        : isSelected
                        ? 'bg-slate-50 font-bold'
                        : hoverItemClass
                    }`}
                  >
                    <div className="space-y-0.5">
                      <div className="font-bold text-slate-900 flex items-center gap-1.5">
                        {highlightMatch(c.name, customerName)}
                        {isSelected && (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 inline shrink-0" />
                        )}
                      </div>
                      {c.phone ? (
                        <div className="text-[11px] font-mono text-slate-500 flex items-center gap-1">
                          <Phone className="w-3 h-3 text-slate-400 inline" />
                          <span>{highlightMatch(c.phone, customerName)}</span>
                        </div>
                      ) : (
                        <div className="text-[10px] text-slate-400 italic">No phone recorded</div>
                      )}
                    </div>

                    <div className="shrink-0 text-right">
                      <span className="text-[10px] bg-white border border-slate-200 px-2 py-0.5 rounded font-medium text-slate-600 shadow-2xs">
                        Select ↵
                      </span>
                    </div>
                  </li>
                );
              })
            )}
          </ul>

          {/* Quick info footer */}
          {customerName.trim() && !matchedExistingCustomer && (
            <div className="bg-sky-50/80 px-3 py-2 border-t border-sky-100 flex items-center justify-between text-[11px] text-sky-900">
              <span className="flex items-center gap-1.5 font-medium">
                <UserPlus className="w-3.5 h-3.5 text-sky-600" />
                <span>
                  Adding <strong>"{customerName}"</strong> as a new customer
                </span>
              </span>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  setIsOpen(false);
                }}
                className="font-bold text-sky-700 hover:underline cursor-pointer"
              >
                Done
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
