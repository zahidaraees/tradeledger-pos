import type { Timestamp } from 'firebase/firestore';

export type StoreVertical = 'grocery' | 'pharmacy' | 'hardware' | 'mixed';
export type ProductVertical = 'grocery' | 'pharmacy' | 'hardware';

export type NavSection =
  | 'dashboard'
  | 'sales'
  | 'inventory'
  | 'purchases'
  | 'customers'
  | 'suppliers'
  | 'reports'
  | 'alerts'
  | 'settings';

export interface StoreProfile {
  id: string;
  ownerId: string;
  storeName: string;
  vertical: StoreVertical;
  currencySymbol: string;
  defaultTaxRate: number;
  phone: string;
  address: string;
  taxId: string;
  seeded: boolean;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface Product {
  id: string;
  ownerId: string;
  sku: string;
  barcode: string;
  name: string;
  category: string;
  vertical: ProductVertical;
  unit: string;
  costPrice: number;
  sellingPrice: number;
  taxPercent: number;
  stockQty: number;
  minStockLevel: number;
  batchNumber: string;
  expiryDate: string;
  supplierId: string;
  supplierName: string;
  status: 'active' | 'archived';
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface Customer {
  id: string;
  ownerId: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  creditLimit: number;
  balance: number; // Positive = customer owes store (Receivable / Udhaar)
  totalPurchases: number;
  notes: string;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface Supplier {
  id: string;
  ownerId: string;
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  taxId: string;
  category: string;
  payableBalance: number; // Positive = store owes supplier
  totalSupplied: number;
  paymentTerms: string;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface SaleItem {
  productId: string;
  sku: string;
  name: string;
  category: string;
  unit: string;
  qty: number;
  unitPrice: number;
  costPrice: number;
  taxPercent: number;
  lineTotal: number;
}

export interface Sale {
  id: string;
  ownerId: string;
  invoiceNumber: string;
  customerId: string;
  customerName: string;
  paymentMethod: 'cash' | 'upi' | 'card' | 'credit' | 'split';
  paymentStatus: 'paid' | 'partial' | 'credit';
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  paidAmount: number;
  dueAmount: number;
  totalCost: number;
  grossProfit: number;
  itemCount: number;
  items: SaleItem[];
  saleDate: string; // YYYY-MM-DD
  notes: string;
  createdAt?: Timestamp | null;
}

export interface PurchaseItem {
  productId: string;
  sku: string;
  name: string;
  unit: string;
  qty: number;
  unitCost: number;
  lineTotal: number;
}

export interface Purchase {
  id: string;
  ownerId: string;
  poNumber: string;
  supplierId: string;
  supplierName: string;
  status: 'ordered' | 'received' | 'cancelled';
  paymentStatus: 'paid' | 'partial' | 'unpaid';
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  paidAmount: number;
  dueAmount: number;
  itemCount: number;
  items: PurchaseItem[];
  purchaseDate: string; // YYYY-MM-DD
  notes: string;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface LedgerEntry {
  id: string;
  ownerId: string;
  partyType: 'customer' | 'supplier';
  partyId: string;
  partyName: string;
  entryType: 'sale_credit' | 'payment_received' | 'purchase_bill' | 'payment_made' | 'adjustment';
  amount: number;
  balanceAfter: number;
  paymentMethod: 'cash' | 'upi' | 'card' | 'bank' | 'credit';
  referenceNo: string;
  note: string;
  entryDate: string; // YYYY-MM-DD
  createdAt?: Timestamp | null;
}
