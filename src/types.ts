export type UnitType = 'Ltr' | 'Kg' | 'Gram' | 'ml' | 'mg' | 'Pcs' | 'Bottle' | 'General';

export interface Product {
  id: string;
  name: string;
  barcode?: string;
  stock: number;
  unit: UnitType;
  wholesalePrice: number;
  retailPrice: number;
}

export interface CosmeticProduct {
  id: string;
  name: string;
  barcode?: string;
  stock: number;
  unit: UnitType;
  costPrice: number;
  salePrice: number;
}

export interface BillItem {
  id: string;
  productName: string;
  stockId?: string;
  barcode?: string;
  packageSizeMl?: number; // numeric size in base units (ml or g)
  packUnit?: 'ml' | 'Ltr' | 'g' | 'Kg' | 'mg' | string; // selected unit
  packDisplay?: string; // e.g. '5 Ltr', '500 ml', '1 Kg', '250 g'
  qty: number; // number of bottles / packs / units
  unitType: string; // e.g. '5 Ltr Bottle', '500 ml Bottle', '1 Kg Pack'
  rate: number; // calculated rate per pack/bottle or base unit
  baseRate?: number; // base rate per Liter/Kg
  total: number;
  stockDeductionQty: number; // exact stock amount deducted in base unit (e.g. 5L = 5, 500ml = 0.5)
}

export interface SaleRecord {
  id: string;
  billNo: string;
  type: 'cleaning' | 'cosmetics';
  name: string; // Customer name
  phone?: string;
  saleType: 'Retail' | 'Wholesale';
  paymentMode: 'Cash' | 'Online';
  items: BillItem[];
  grandTotal: number;
  paidAmount: number;
  pendingAmount: number;
  excessAmount?: number;
  date: string; // YYYY-MM-DD
  createdAt: number; // timestamp for sorting
}

export interface CustomerProfile {
  id: string;
  name: string;
  phone?: string;
  createdAt: string;
}

export interface PurchaseReturn {
  id: string;
  qty: number;
  date: string;
  reason: string;
  amount: number;
  savedAt: number;
}

export interface PurchaseRecord {
  id: string;
  type: 'cleaning' | 'cosmetics';
  supplierName: string;
  supplierMobile?: string;
  rawMaterial: string;
  stockId?: string;
  rawBarcode?: string;
  rawQty: number;
  rawUnit: UnitType;
  rawUnitPrice: number;
  rawCost: number;
  paid: number;
  balance: number;
  returnedQty?: number;
  returnedAmount?: number;
  netPurchaseAmount?: number;
  netBalance?: number;
  date: string; // YYYY-MM-DD
  savedAt: number;
  returns?: PurchaseReturn[];
}

export interface Supplier {
  id: string;
  name: string;
  mobile?: string;
}

export interface ExpenseRecord {
  id: string;
  title: string;
  amount: number;
  date: string; // YYYY-MM-DD
  savedAt: number;
}

export interface StockReturnRecord {
  id: string;
  type: 'cleaning' | 'cosmetics';
  productId: string;
  productName: string;
  unit: UnitType;
  customer?: string;
  qty: number;
  condition: 'Usable' | 'Damaged';
  reason?: string;
  remarks?: string;
  date: string;
  savedAt: number;
}

export interface DayBookEntry {
  id: string;
  type: 'Income' | 'Expense';
  category: 'Sale' | 'Cosmetics Sale' | 'Purchase' | 'Cosmetics Purchase' | 'Expense';
  desc: string;
  amount: number;
  date: string;
  timestamp: number;
  paymentMode?: 'Cash' | 'Online';
}
