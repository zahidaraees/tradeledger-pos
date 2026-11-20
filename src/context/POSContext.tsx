import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { auth, db, googleProvider, handleFirestoreError, OperationType } from '../lib/firebase';
import {
  clampNumber,
  clampString,
  generateDocId,
  todayIsoDate,
} from '../lib/validation';
import { buildSeedDataset, getSeedDate } from '../data/seedCatalogs';
import type {
  Customer,
  LedgerEntry,
  Product,
  ProductVertical,
  Purchase,
  PurchaseItem,
  Sale,
  SaleItem,
  StoreProfile,
  StoreVertical,
  Supplier,
} from '../types/pos';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

export interface CreateProductInput {
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
}

export interface CreateCustomerInput {
  name: string;
  phone: string;
  email: string;
  address: string;
  creditLimit: number;
  notes: string;
}

export interface CreateSupplierInput {
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  taxId: string;
  category: string;
  paymentTerms: string;
}

export interface CompleteSaleInput {
  customerId: string;
  customerName: string;
  paymentMethod: 'cash' | 'upi' | 'card' | 'credit' | 'split';
  discountAmount: number;
  paidAmount: number;
  items: SaleItem[];
  notes: string;
}

export interface CreatePurchaseInput {
  supplierId: string;
  supplierName: string;
  status: 'ordered' | 'received';
  taxAmount: number;
  paidAmount: number;
  items: PurchaseItem[];
  notes: string;
}

interface POSContextValue {
  user: User | null;
  authLoading: boolean;
  dataLoading: boolean;
  store: StoreProfile | null;
  products: Product[];
  customers: Customer[];
  suppliers: Supplier[];
  sales: Sale[];
  purchases: Purchase[];
  ledgerEntries: LedgerEntry[];
  toasts: ToastMessage[];
  dismissToast: (id: string) => void;
  notify: (type: ToastMessage['type'], message: string) => void;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  updateStoreProfile: (updates: Partial<Pick<StoreProfile, 'storeName' | 'vertical' | 'currencySymbol' | 'defaultTaxRate' | 'phone' | 'address' | 'taxId'>>) => Promise<void>;
  seedStoreData: (vertical: StoreVertical) => Promise<void>;
  addProduct: (input: CreateProductInput) => Promise<void>;
  updateProduct: (id: string, input: CreateProductInput & { status?: 'active' | 'archived' }) => Promise<void>;
  adjustProductStock: (id: string, newQty: number) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  addCustomer: (input: CreateCustomerInput) => Promise<Customer | null>;
  updateCustomer: (id: string, input: CreateCustomerInput) => Promise<void>;
  deleteCustomer: (id: string) => Promise<void>;
  recordCustomerLedger: (params: {
    customerId: string;
    entryType: 'payment_received' | 'sale_credit' | 'adjustment';
    amount: number;
    paymentMethod: 'cash' | 'upi' | 'card' | 'bank' | 'credit';
    referenceNo: string;
    note: string;
  }) => Promise<void>;
  addSupplier: (input: CreateSupplierInput) => Promise<Supplier | null>;
  updateSupplier: (id: string, input: CreateSupplierInput) => Promise<void>;
  deleteSupplier: (id: string) => Promise<void>;
  recordSupplierPayment: (params: {
    supplierId: string;
    entryType: 'payment_made' | 'purchase_bill' | 'adjustment';
    amount: number;
    paymentMethod: 'cash' | 'upi' | 'card' | 'bank' | 'credit';
    referenceNo: string;
    note: string;
  }) => Promise<void>;
  completeSale: (input: CompleteSaleInput) => Promise<Sale | null>;
  createPurchase: (input: CreatePurchaseInput) => Promise<void>;
  receivePurchase: (purchaseId: string) => Promise<void>;
  cancelPurchase: (purchaseId: string) => Promise<void>;
  payPurchase: (purchaseId: string, amount: number, method: 'cash' | 'upi' | 'card' | 'bank') => Promise<void>;
}

const POSContext = createContext<POSContextValue | null>(null);

function sortByCreatedDesc<T extends { createdAt?: { toMillis?: () => number } | null }>(list: T[]): T[] {
  return [...list].sort((a, b) => {
    const aMs = a.createdAt && typeof a.createdAt.toMillis === 'function' ? a.createdAt.toMillis() : 0;
    const bMs = b.createdAt && typeof b.createdAt.toMillis === 'function' ? b.createdAt.toMillis() : 0;
    return bMs - aMs;
  });
}

export function POSProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);

  const [store, setStore] = useState<StoreProfile | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const notify = useCallback((type: ToastMessage['type'], message: string) => {
    const id = generateDocId('toast');
    setToasts((prev) => [...prev.slice(-3), { id, type, message }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setAuthLoading(false);
    });
    return () => unsub();
  }, []);

  // Ensure store document exists & attach realtime listeners when authenticated
  useEffect(() => {
    if (!user) {
      setStore(null);
      setProducts([]);
      setCustomers([]);
      setSuppliers([]);
      setSales([]);
      setPurchases([]);
      setLedgerEntries([]);
      setDataLoading(false);
      return;
    }

    let cancelled = false;
    setDataLoading(true);
    const uid = user.uid;

    const ensureStore = async () => {
      const storeRef = doc(db, 'stores', uid);
      try {
        const snap = await getDoc(storeRef);
        if (!snap.exists() && !cancelled) {
          await setDoc(storeRef, {
            ownerId: uid,
            storeName: clampString(user.displayName ? `${user.displayName}'s Store` : 'My Retail Store', 100),
            vertical: 'mixed',
            currencySymbol: '₹',
            defaultTaxRate: 5,
            phone: '',
            address: '',
            taxId: '',
            seeded: false,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `stores/${uid}`);
      }
    };

    void ensureStore();

    const unsubStore = onSnapshot(
      doc(db, 'stores', uid),
      (snap) => {
        if (snap.exists()) {
          setStore({ id: snap.id, ...(snap.data() as Omit<StoreProfile, 'id'>) });
        }
        setDataLoading(false);
      },
      (err) => handleFirestoreError(err, OperationType.GET, `stores/${uid}`)
    );

    const unsubProducts = onSnapshot(
      query(collection(db, 'products'), where('ownerId', '==', uid)),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Product, 'id'>) }));
        setProducts(sortByCreatedDesc(list));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'products')
    );

    const unsubCustomers = onSnapshot(
      query(collection(db, 'customers'), where('ownerId', '==', uid)),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Customer, 'id'>) }));
        setCustomers(sortByCreatedDesc(list));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'customers')
    );

    const unsubSuppliers = onSnapshot(
      query(collection(db, 'suppliers'), where('ownerId', '==', uid)),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Supplier, 'id'>) }));
        setSuppliers(sortByCreatedDesc(list));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'suppliers')
    );

    const unsubSales = onSnapshot(
      query(collection(db, 'sales'), where('ownerId', '==', uid)),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Sale, 'id'>) }));
        setSales(sortByCreatedDesc(list));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'sales')
    );

    const unsubPurchases = onSnapshot(
      query(collection(db, 'purchases'), where('ownerId', '==', uid)),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Purchase, 'id'>) }));
        setPurchases(sortByCreatedDesc(list));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'purchases')
    );

    const unsubLedger = onSnapshot(
      query(collection(db, 'ledgerEntries'), where('ownerId', '==', uid)),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<LedgerEntry, 'id'>) }));
        setLedgerEntries(sortByCreatedDesc(list));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'ledgerEntries')
    );

    return () => {
      cancelled = true;
      unsubStore();
      unsubProducts();
      unsubCustomers();
      unsubSuppliers();
      unsubSales();
      unsubPurchases();
      unsubLedger();
    };
  }, [user]);

  const signInWithGoogle = useCallback(async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Sign-in failed';
      if (!msg.includes('popup-closed-by-user')) {
        notify('error', `Google Sign-In failed: ${msg}`);
      }
    }
  }, [notify]);

  const logout = useCallback(async () => {
    await signOut(auth);
  }, []);

  const updateStoreProfile = useCallback(
    async (
      updates: Partial<
        Pick<
          StoreProfile,
          'storeName' | 'vertical' | 'currencySymbol' | 'defaultTaxRate' | 'phone' | 'address' | 'taxId'
        >
      >
    ) => {
      if (!user || !store) return;
      const storeRef = doc(db, 'stores', user.uid);
      try {
        await updateDoc(storeRef, {
          storeName: clampString(updates.storeName ?? store.storeName, 100) || 'My Retail Store',
          vertical: updates.vertical ?? store.vertical,
          currencySymbol: clampString(updates.currencySymbol ?? store.currencySymbol, 8) || '₹',
          defaultTaxRate: clampNumber(updates.defaultTaxRate ?? store.defaultTaxRate, 0, 40),
          phone: clampString(updates.phone ?? store.phone, 30),
          address: clampString(updates.address ?? store.address, 240),
          taxId: clampString(updates.taxId ?? store.taxId, 40),
          updatedAt: serverTimestamp(),
        });
        notify('success', 'Store profile updated.');
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `stores/${user.uid}`);
      }
    },
    [user, store, notify]
  );

  const seedStoreData = useCallback(
    async (vertical: StoreVertical) => {
      if (!user) return;
      const uid = user.uid;
      const dataset = buildSeedDataset(vertical);
      const batch = writeBatch(db);

      const supplierIdMap: Record<string, { id: string; name: string }> = {};
      for (const s of dataset.suppliers) {
        const id = generateDocId('sup');
        supplierIdMap[s.key] = { id, name: s.name };
        batch.set(doc(db, 'suppliers', id), {
          ownerId: uid,
          name: clampString(s.name, 120),
          contactPerson: clampString(s.contactPerson, 100),
          phone: clampString(s.phone, 30),
          email: clampString(s.email, 120),
          address: clampString(s.address, 240),
          taxId: clampString(s.taxId, 40),
          category: clampString(s.category, 64),
          payableBalance: clampNumber(s.payableBalance, 0, 100000000),
          totalSupplied: clampNumber(s.totalSupplied, 0, 1000000000),
          paymentTerms: clampString(s.paymentTerms, 64),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        if (s.payableBalance > 0) {
          const ledId = generateDocId('led');
          batch.set(doc(db, 'ledgerEntries', ledId), {
            ownerId: uid,
            partyType: 'supplier',
            partyId: id,
            partyName: clampString(s.name, 120),
            entryType: 'purchase_bill',
            amount: clampNumber(s.payableBalance, 1, 100000000),
            balanceAfter: clampNumber(s.payableBalance, 0, 100000000),
            paymentMethod: 'credit',
            referenceNo: `OB-${id.slice(-4).toUpperCase()}`,
            note: 'Opening supplier payable balance',
            entryDate: getSeedDate(7),
            createdAt: serverTimestamp(),
          });
        }
      }

      const customerIdMap: Record<string, { id: string; name: string }> = {};
      for (const c of dataset.customers) {
        const id = generateDocId('cust');
        customerIdMap[c.key] = { id, name: c.name };
        batch.set(doc(db, 'customers', id), {
          ownerId: uid,
          name: clampString(c.name, 120),
          phone: clampString(c.phone, 30),
          email: clampString(c.email, 120),
          address: clampString(c.address, 240),
          creditLimit: clampNumber(c.creditLimit, 0, 100000000),
          balance: clampNumber(c.balance, -100000000, 100000000),
          totalPurchases: clampNumber(c.totalPurchases, 0, 1000000000),
          notes: clampString(c.notes, 300),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        if (c.balance > 0) {
          const ledId = generateDocId('led');
          batch.set(doc(db, 'ledgerEntries', ledId), {
            ownerId: uid,
            partyType: 'customer',
            partyId: id,
            partyName: clampString(c.name, 120),
            entryType: 'sale_credit',
            amount: clampNumber(c.balance, 1, 100000000),
            balanceAfter: clampNumber(c.balance, 0, 100000000),
            paymentMethod: 'credit',
            referenceNo: `KH-${id.slice(-4).toUpperCase()}`,
            note: 'Opening customer khata credit balance',
            entryDate: getSeedDate(5),
            createdAt: serverTimestamp(),
          });
        }
      }

      const productMap: Record<
        string,
        {
          id: string;
          sku: string;
          name: string;
          category: string;
          unit: string;
          costPrice: number;
          sellingPrice: number;
          taxPercent: number;
        }
      > = {};

      for (const p of dataset.products) {
        const id = generateDocId('prd');
        const sup = supplierIdMap[p.supplierKey];
        productMap[p.key] = {
          id,
          sku: p.sku,
          name: p.name,
          category: p.category,
          unit: p.unit,
          costPrice: p.costPrice,
          sellingPrice: p.sellingPrice,
          taxPercent: p.taxPercent,
        };
        batch.set(doc(db, 'products', id), {
          ownerId: uid,
          sku: clampString(p.sku, 48),
          barcode: clampString(p.barcode, 64),
          name: clampString(p.name, 140),
          category: clampString(p.category, 64),
          vertical: p.vertical,
          unit: clampString(p.unit, 24),
          costPrice: clampNumber(p.costPrice, 0, 10000000),
          sellingPrice: clampNumber(p.sellingPrice, 0, 10000000),
          taxPercent: clampNumber(p.taxPercent, 0, 40),
          stockQty: clampNumber(p.stockQty, 0, 10000000),
          minStockLevel: clampNumber(p.minStockLevel, 0, 1000000),
          batchNumber: clampString(p.batchNumber, 48),
          expiryDate: clampString(p.expiryDate, 20),
          supplierId: sup?.id ?? '',
          supplierName: sup?.name ?? '',
          status: 'active',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      dataset.historicalSales.forEach((hs, idx) => {
        const saleId = generateDocId('sale');
        const items: SaleItem[] = hs.items
          .map((it) => {
            const p = productMap[it.productKey];
            if (!p) return null;
            const lineSub = p.sellingPrice * it.qty;
            return {
              productId: p.id,
              sku: p.sku,
              name: p.name,
              category: p.category,
              unit: p.unit,
              qty: it.qty,
              unitPrice: p.sellingPrice,
              costPrice: p.costPrice,
              taxPercent: p.taxPercent,
              lineTotal: clampNumber(lineSub, 0, 100000000),
            };
          })
          .filter((x): x is SaleItem => x !== null);

        if (items.length === 0) return;

        const subtotal = clampNumber(
          items.reduce((acc, i) => acc + i.unitPrice * i.qty, 0),
          0,
          100000000
        );
        const taxAmount = clampNumber(
          items.reduce((acc, i) => acc + (i.unitPrice * i.qty * i.taxPercent) / 100, 0),
          0,
          100000000
        );
        const totalAmount = clampNumber(subtotal + taxAmount, 0, 100000000);
        const totalCost = clampNumber(
          items.reduce((acc, i) => acc + i.costPrice * i.qty, 0),
          0,
          100000000
        );
        const grossProfit = clampNumber(subtotal - totalCost, -100000000, 100000000);
        const paidAmount = clampNumber(totalAmount * hs.paidRatio, 0, totalAmount);
        const dueAmount = clampNumber(totalAmount - paidAmount, 0, totalAmount);
        const cust = hs.customerKey === 'walk-in' ? null : customerIdMap[hs.customerKey];

        batch.set(doc(db, 'sales', saleId), {
          ownerId: uid,
          invoiceNumber: `INV-${2026}${String(101 + idx)}`,
          customerId: cust ? cust.id : 'walk-in',
          customerName: cust ? cust.name : 'Walk-in Customer',
          paymentMethod: hs.paymentMethod,
          paymentStatus: dueAmount <= 0 ? 'paid' : paidAmount > 0 ? 'partial' : 'credit',
          subtotal,
          discountAmount: 0,
          taxAmount,
          totalAmount,
          paidAmount,
          dueAmount,
          totalCost,
          grossProfit,
          itemCount: items.reduce((a, b) => a + b.qty, 0),
          items,
          saleDate: getSeedDate(hs.daysAgo),
          notes: 'Counter sale',
          createdAt: serverTimestamp(),
        });
      });

      dataset.initialPurchases.forEach((po, idx) => {
        const poId = generateDocId('po');
        const sup = supplierIdMap[po.supplierKey] ?? Object.values(supplierIdMap)[0];
        const items: PurchaseItem[] = po.items
          .map((it) => {
            const p = productMap[it.productKey];
            if (!p) return null;
            return {
              productId: p.id,
              sku: p.sku,
              name: p.name,
              unit: p.unit,
              qty: it.qty,
              unitCost: p.costPrice,
              lineTotal: clampNumber(p.costPrice * it.qty, 0, 100000000),
            };
          })
          .filter((x): x is PurchaseItem => x !== null);

        if (items.length === 0 || !sup) return;

        const subtotal = clampNumber(
          items.reduce((acc, i) => acc + i.lineTotal, 0),
          0,
          100000000
        );
        const taxAmount = clampNumber(subtotal * 0.05, 0, 100000000);
        const totalAmount = clampNumber(subtotal + taxAmount, 0, 100000000);
        const paidAmount = clampNumber(totalAmount * po.paidRatio, 0, totalAmount);
        const dueAmount = clampNumber(totalAmount - paidAmount, 0, totalAmount);

        batch.set(doc(db, 'purchases', poId), {
          ownerId: uid,
          poNumber: `PO-${2026}${String(501 + idx)}`,
          supplierId: sup.id,
          supplierName: sup.name,
          status: po.status,
          paymentStatus: po.paymentStatus,
          subtotal,
          taxAmount,
          totalAmount,
          paidAmount,
          dueAmount,
          itemCount: items.reduce((a, b) => a + b.qty, 0),
          items,
          purchaseDate: getSeedDate(po.daysAgo),
          notes: po.status === 'received' ? 'Verified and stocked in warehouse' : 'Awaiting delivery van',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });

      batch.update(doc(db, 'stores', uid), {
        seeded: true,
        vertical: dataset.vertical,
        storeName: clampString(dataset.storeName, 100),
        updatedAt: serverTimestamp(),
      });

      try {
        await batch.commit();
        notify('success', `Loaded ${dataset.storeName} sample catalog, customers, suppliers & sales.`);
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, 'batch/seedStoreData');
      }
    },
    [user, notify]
  );

  const addProduct = useCallback(
    async (input: CreateProductInput) => {
      if (!user) return;
      const id = generateDocId('prd');
      try {
        await setDoc(doc(db, 'products', id), {
          ownerId: user.uid,
          sku: clampString(input.sku, 48) || `SKU-${id.slice(-5).toUpperCase()}`,
          barcode: clampString(input.barcode, 64),
          name: clampString(input.name, 140),
          category: clampString(input.category, 64) || 'General',
          vertical: input.vertical,
          unit: clampString(input.unit, 24) || 'pcs',
          costPrice: clampNumber(input.costPrice, 0, 10000000),
          sellingPrice: clampNumber(input.sellingPrice, 0, 10000000),
          taxPercent: clampNumber(input.taxPercent, 0, 40),
          stockQty: clampNumber(input.stockQty, 0, 10000000),
          minStockLevel: clampNumber(input.minStockLevel, 0, 1000000),
          batchNumber: clampString(input.batchNumber, 48),
          expiryDate: clampString(input.expiryDate, 20),
          supplierId: clampString(input.supplierId, 128),
          supplierName: clampString(input.supplierName, 120),
          status: 'active',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        notify('success', `Added "${input.name}" to inventory.`);
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `products/${id}`);
      }
    },
    [user, notify]
  );

  const updateProduct = useCallback(
    async (id: string, input: CreateProductInput & { status?: 'active' | 'archived' }) => {
      if (!user) return;
      try {
        await updateDoc(doc(db, 'products', id), {
          sku: clampString(input.sku, 48),
          barcode: clampString(input.barcode, 64),
          name: clampString(input.name, 140),
          category: clampString(input.category, 64),
          vertical: input.vertical,
          unit: clampString(input.unit, 24),
          costPrice: clampNumber(input.costPrice, 0, 10000000),
          sellingPrice: clampNumber(input.sellingPrice, 0, 10000000),
          taxPercent: clampNumber(input.taxPercent, 0, 40),
          stockQty: clampNumber(input.stockQty, 0, 10000000),
          minStockLevel: clampNumber(input.minStockLevel, 0, 1000000),
          batchNumber: clampString(input.batchNumber, 48),
          expiryDate: clampString(input.expiryDate, 20),
          supplierId: clampString(input.supplierId, 128),
          supplierName: clampString(input.supplierName, 120),
          status: input.status ?? 'active',
          updatedAt: serverTimestamp(),
        });
        notify('success', `Updated "${input.name}".`);
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `products/${id}`);
      }
    },
    [user, notify]
  );

  const adjustProductStock = useCallback(
    async (id: string, newQty: number) => {
      if (!user) return;
      try {
        await updateDoc(doc(db, 'products', id), {
          stockQty: clampNumber(newQty, 0, 10000000),
          updatedAt: serverTimestamp(),
        });
        notify('success', 'Stock quantity updated.');
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `products/${id}`);
      }
    },
    [user, notify]
  );

  const deleteProduct = useCallback(
    async (id: string) => {
      if (!user) return;
      try {
        await deleteDoc(doc(db, 'products', id));
        notify('info', 'Product removed from catalog.');
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `products/${id}`);
      }
    },
    [user, notify]
  );

  const addCustomer = useCallback(
    async (input: CreateCustomerInput): Promise<Customer | null> => {
      if (!user) return null;
      const id = generateDocId('cust');
      const payload = {
        ownerId: user.uid,
        name: clampString(input.name, 120),
        phone: clampString(input.phone, 30),
        email: clampString(input.email, 120),
        address: clampString(input.address, 240),
        creditLimit: clampNumber(input.creditLimit, 0, 100000000),
        balance: 0,
        totalPurchases: 0,
        notes: clampString(input.notes, 300),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      try {
        await setDoc(doc(db, 'customers', id), payload);
        notify('success', `Added customer "${payload.name}".`);
        return {
          id,
          ownerId: user.uid,
          name: payload.name,
          phone: payload.phone,
          email: payload.email,
          address: payload.address,
          creditLimit: payload.creditLimit,
          balance: 0,
          totalPurchases: 0,
          notes: payload.notes,
        };
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `customers/${id}`);
      }
    },
    [user, notify]
  );

  const updateCustomer = useCallback(
    async (id: string, input: CreateCustomerInput) => {
      if (!user) return;
      try {
        await updateDoc(doc(db, 'customers', id), {
          name: clampString(input.name, 120),
          phone: clampString(input.phone, 30),
          email: clampString(input.email, 120),
          address: clampString(input.address, 240),
          creditLimit: clampNumber(input.creditLimit, 0, 100000000),
          notes: clampString(input.notes, 300),
          updatedAt: serverTimestamp(),
        });
        notify('success', `Updated customer "${input.name}".`);
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `customers/${id}`);
      }
    },
    [user, notify]
  );

  const deleteCustomer = useCallback(
    async (id: string) => {
      if (!user) return;
      try {
        await deleteDoc(doc(db, 'customers', id));
        notify('info', 'Customer deleted.');
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `customers/${id}`);
      }
    },
    [user, notify]
  );

  const recordCustomerLedger = useCallback(
    async (params: {
      customerId: string;
      entryType: 'payment_received' | 'sale_credit' | 'adjustment';
      amount: number;
      paymentMethod: 'cash' | 'upi' | 'card' | 'bank' | 'credit';
      referenceNo: string;
      note: string;
    }) => {
      if (!user) return;
      const customer = customers.find((c) => c.id === params.customerId);
      if (!customer) return;

      const amt = clampNumber(params.amount, 0.01, 100000000);
      const delta = params.entryType === 'payment_received' ? -amt : amt;
      const nextBalance = clampNumber(customer.balance + delta, -100000000, 100000000);

      const batch = writeBatch(db);
      const entryId = generateDocId('led');

      batch.update(doc(db, 'customers', customer.id), {
        balance: nextBalance,
        updatedAt: serverTimestamp(),
      });

      batch.set(doc(db, 'ledgerEntries', entryId), {
        ownerId: user.uid,
        partyType: 'customer',
        partyId: customer.id,
        partyName: clampString(customer.name, 120),
        entryType: params.entryType,
        amount: amt,
        balanceAfter: nextBalance,
        paymentMethod: params.paymentMethod,
        referenceNo: clampString(params.referenceNo, 48) || `PAY-${entryId.slice(-4).toUpperCase()}`,
        note: clampString(params.note, 300),
        entryDate: todayIsoDate(),
        createdAt: serverTimestamp(),
      });

      try {
        await batch.commit();
        notify(
          'success',
          params.entryType === 'payment_received'
            ? `Payment recorded for ${customer.name}.`
            : `Khata debit recorded for ${customer.name}.`
        );
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `ledgerEntries/${entryId}`);
      }
    },
    [user, customers, notify]
  );

  const addSupplier = useCallback(
    async (input: CreateSupplierInput): Promise<Supplier | null> => {
      if (!user) return null;
      const id = generateDocId('sup');
      const payload = {
        ownerId: user.uid,
        name: clampString(input.name, 120),
        contactPerson: clampString(input.contactPerson, 100),
        phone: clampString(input.phone, 30),
        email: clampString(input.email, 120),
        address: clampString(input.address, 240),
        taxId: clampString(input.taxId, 40),
        category: clampString(input.category, 64) || 'General Wholesale',
        payableBalance: 0,
        totalSupplied: 0,
        paymentTerms: clampString(input.paymentTerms, 64) || 'Net 15 Days',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      try {
        await setDoc(doc(db, 'suppliers', id), payload);
        notify('success', `Added supplier "${payload.name}".`);
        return {
          id,
          ...payload,
          createdAt: null,
          updatedAt: null,
        };
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `suppliers/${id}`);
      }
    },
    [user, notify]
  );

  const updateSupplier = useCallback(
    async (id: string, input: CreateSupplierInput) => {
      if (!user) return;
      try {
        await updateDoc(doc(db, 'suppliers', id), {
          name: clampString(input.name, 120),
          contactPerson: clampString(input.contactPerson, 100),
          phone: clampString(input.phone, 30),
          email: clampString(input.email, 120),
          address: clampString(input.address, 240),
          taxId: clampString(input.taxId, 40),
          category: clampString(input.category, 64),
          paymentTerms: clampString(input.paymentTerms, 64),
          updatedAt: serverTimestamp(),
        });
        notify('success', `Updated supplier "${input.name}".`);
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `suppliers/${id}`);
      }
    },
    [user, notify]
  );

  const deleteSupplier = useCallback(
    async (id: string) => {
      if (!user) return;
      try {
        await deleteDoc(doc(db, 'suppliers', id));
        notify('info', 'Supplier removed.');
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `suppliers/${id}`);
      }
    },
    [user, notify]
  );

  const recordSupplierPayment = useCallback(
    async (params: {
      supplierId: string;
      entryType: 'payment_made' | 'purchase_bill' | 'adjustment';
      amount: number;
      paymentMethod: 'cash' | 'upi' | 'card' | 'bank' | 'credit';
      referenceNo: string;
      note: string;
    }) => {
      if (!user) return;
      const supplier = suppliers.find((s) => s.id === params.supplierId);
      if (!supplier) return;

      const amt = clampNumber(params.amount, 0.01, 100000000);
      const delta = params.entryType === 'payment_made' ? -amt : amt;
      const nextBalance = clampNumber(supplier.payableBalance + delta, -100000000, 100000000);

      const batch = writeBatch(db);
      const entryId = generateDocId('led');

      batch.update(doc(db, 'suppliers', supplier.id), {
        payableBalance: nextBalance,
        updatedAt: serverTimestamp(),
      });

      batch.set(doc(db, 'ledgerEntries', entryId), {
        ownerId: user.uid,
        partyType: 'supplier',
        partyId: supplier.id,
        partyName: clampString(supplier.name, 120),
        entryType: params.entryType,
        amount: amt,
        balanceAfter: nextBalance,
        paymentMethod: params.paymentMethod,
        referenceNo: clampString(params.referenceNo, 48) || `SPAY-${entryId.slice(-4).toUpperCase()}`,
        note: clampString(params.note, 300),
        entryDate: todayIsoDate(),
        createdAt: serverTimestamp(),
      });

      try {
        await batch.commit();
        notify('success', `Supplier ledger updated for ${supplier.name}.`);
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `ledgerEntries/${entryId}`);
      }
    },
    [user, suppliers, notify]
  );

  const completeSale = useCallback(
    async (input: CompleteSaleInput): Promise<Sale | null> => {
      if (!user || input.items.length === 0) return null;
      const boundedItems = input.items.slice(0, 50);

      const subtotal = clampNumber(
        boundedItems.reduce((sum, item) => sum + item.unitPrice * item.qty, 0),
        0,
        100000000
      );
      const discountAmount = clampNumber(input.discountAmount, 0, subtotal);
      const discountedRatio = subtotal > 0 ? (subtotal - discountAmount) / subtotal : 1;
      const taxAmount = clampNumber(
        boundedItems.reduce(
          (sum, item) => sum + (item.unitPrice * item.qty * discountedRatio * item.taxPercent) / 100,
          0
        ),
        0,
        100000000
      );
      const totalAmount = clampNumber(subtotal - discountAmount + taxAmount, 0, 100000000);
      const paidAmount = clampNumber(input.paidAmount, 0, totalAmount);
      const dueAmount = clampNumber(totalAmount - paidAmount, 0, totalAmount);
      const totalCost = clampNumber(
        boundedItems.reduce((sum, item) => sum + item.costPrice * item.qty, 0),
        0,
        100000000
      );
      const grossProfit = clampNumber(subtotal - discountAmount - totalCost, -100000000, 100000000);
      const itemCount = boundedItems.reduce((sum, item) => sum + item.qty, 0);

      const paymentStatus: Sale['paymentStatus'] =
        dueAmount <= 0 ? 'paid' : paidAmount > 0 ? 'partial' : 'credit';

      const saleId = generateDocId('sale');
      const invoiceNumber = `INV-${new Date().getFullYear()}-${String(sales.length + 1001)}`;
      const saleDate = todayIsoDate();

      const batch = writeBatch(db);

      const saleDocData = {
        ownerId: user.uid,
        invoiceNumber,
        customerId: input.customerId || 'walk-in',
        customerName: clampString(input.customerName || 'Walk-in Customer', 120),
        paymentMethod: input.paymentMethod,
        paymentStatus,
        subtotal,
        discountAmount,
        taxAmount,
        totalAmount,
        paidAmount,
        dueAmount,
        totalCost,
        grossProfit,
        itemCount,
        items: boundedItems,
        saleDate,
        notes: clampString(input.notes, 300),
        createdAt: serverTimestamp(),
      };

      batch.set(doc(db, 'sales', saleId), saleDocData);

      // Deduct stock quantities
      for (const item of boundedItems) {
        const prod = products.find((p) => p.id === item.productId);
        if (prod) {
          const nextStock = clampNumber(Math.max(0, prod.stockQty - item.qty), 0, 10000000);
          batch.update(doc(db, 'products', prod.id), {
            stockQty: nextStock,
            updatedAt: serverTimestamp(),
          });
        }
      }

      // Update customer khata & purchase total if registered customer
      if (input.customerId && input.customerId !== 'walk-in') {
        const cust = customers.find((c) => c.id === input.customerId);
        if (cust) {
          const nextBalance = clampNumber(cust.balance + dueAmount, -100000000, 100000000);
          const nextTotalPurchases = clampNumber(cust.totalPurchases + totalAmount, 0, 1000000000);
          batch.update(doc(db, 'customers', cust.id), {
            balance: nextBalance,
            totalPurchases: nextTotalPurchases,
            updatedAt: serverTimestamp(),
          });

          if (dueAmount > 0) {
            const ledId = generateDocId('led');
            batch.set(doc(db, 'ledgerEntries', ledId), {
              ownerId: user.uid,
              partyType: 'customer',
              partyId: cust.id,
              partyName: clampString(cust.name, 120),
              entryType: 'sale_credit',
              amount: dueAmount,
              balanceAfter: nextBalance,
              paymentMethod: 'credit',
              referenceNo: invoiceNumber,
              note: `Credit balance from invoice ${invoiceNumber}`,
              entryDate: saleDate,
              createdAt: serverTimestamp(),
            });
          }
        }
      }

      try {
        await batch.commit();
        notify('success', `Invoice ${invoiceNumber} completed.`);
        return {
          id: saleId,
          ...saleDocData,
          createdAt: null,
        };
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `sales/${saleId}`);
      }
    },
    [user, sales.length, products, customers, notify]
  );

  const createPurchase = useCallback(
    async (input: CreatePurchaseInput) => {
      if (!user || input.items.length === 0) return;
      const supplier = suppliers.find((s) => s.id === input.supplierId);
      if (!supplier) return;

      const boundedItems = input.items.slice(0, 50);
      const subtotal = clampNumber(
        boundedItems.reduce((sum, i) => sum + i.unitCost * i.qty, 0),
        0,
        100000000
      );
      const taxAmount = clampNumber(input.taxAmount, 0, 100000000);
      const totalAmount = clampNumber(subtotal + taxAmount, 0, 100000000);
      const paidAmount = clampNumber(input.paidAmount, 0, totalAmount);
      const dueAmount = clampNumber(totalAmount - paidAmount, 0, totalAmount);
      const paymentStatus: Purchase['paymentStatus'] =
        dueAmount <= 0 ? 'paid' : paidAmount > 0 ? 'partial' : 'unpaid';

      const poId = generateDocId('po');
      const poNumber = `PO-${new Date().getFullYear()}-${String(purchases.length + 501)}`;
      const purchaseDate = todayIsoDate();

      const batch = writeBatch(db);

      batch.set(doc(db, 'purchases', poId), {
        ownerId: user.uid,
        poNumber,
        supplierId: supplier.id,
        supplierName: clampString(supplier.name, 120),
        status: input.status,
        paymentStatus,
        subtotal,
        taxAmount,
        totalAmount,
        paidAmount,
        dueAmount,
        itemCount: boundedItems.reduce((sum, i) => sum + i.qty, 0),
        items: boundedItems,
        purchaseDate,
        notes: clampString(input.notes, 300),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // If marked received immediately, add stock and update unit cost
      if (input.status === 'received') {
        for (const item of boundedItems) {
          const prod = products.find((p) => p.id === item.productId);
          if (prod) {
            batch.update(doc(db, 'products', prod.id), {
              stockQty: clampNumber(prod.stockQty + item.qty, 0, 10000000),
              costPrice: clampNumber(item.unitCost, 0, 10000000),
              updatedAt: serverTimestamp(),
            });
          }
        }
      }

      // Update supplier payables & supplied total
      const nextPayable = clampNumber(supplier.payableBalance + dueAmount, -100000000, 100000000);
      const nextSupplied = clampNumber(supplier.totalSupplied + totalAmount, 0, 1000000000);
      batch.update(doc(db, 'suppliers', supplier.id), {
        payableBalance: nextPayable,
        totalSupplied: nextSupplied,
        updatedAt: serverTimestamp(),
      });

      if (dueAmount > 0) {
        const ledId = generateDocId('led');
        batch.set(doc(db, 'ledgerEntries', ledId), {
          ownerId: user.uid,
          partyType: 'supplier',
          partyId: supplier.id,
          partyName: clampString(supplier.name, 120),
          entryType: 'purchase_bill',
          amount: dueAmount,
          balanceAfter: nextPayable,
          paymentMethod: 'credit',
          referenceNo: poNumber,
          note: `Payable from purchase order ${poNumber}`,
          entryDate: purchaseDate,
          createdAt: serverTimestamp(),
        });
      }

      try {
        await batch.commit();
        notify(
          'success',
          input.status === 'received'
            ? `${poNumber} received and stock updated.`
            : `Purchase Order ${poNumber} created.`
        );
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `purchases/${poId}`);
      }
    },
    [user, suppliers, purchases.length, products, notify]
  );

  const receivePurchase = useCallback(
    async (purchaseId: string) => {
      if (!user) return;
      const po = purchases.find((p) => p.id === purchaseId);
      if (!po || po.status !== 'ordered') return;

      const batch = writeBatch(db);
      batch.update(doc(db, 'purchases', po.id), {
        status: 'received',
        updatedAt: serverTimestamp(),
      });

      for (const item of po.items) {
        const prod = products.find((p) => p.id === item.productId);
        if (prod) {
          batch.update(doc(db, 'products', prod.id), {
            stockQty: clampNumber(prod.stockQty + item.qty, 0, 10000000),
            costPrice: clampNumber(item.unitCost, 0, 10000000),
            updatedAt: serverTimestamp(),
          });
        }
      }

      try {
        await batch.commit();
        notify('success', `${po.poNumber} marked received — inventory replenished.`);
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `purchases/${po.id}`);
      }
    },
    [user, purchases, products, notify]
  );

  const cancelPurchase = useCallback(
    async (purchaseId: string) => {
      if (!user) return;
      const po = purchases.find((p) => p.id === purchaseId);
      if (!po || po.status !== 'ordered') return;
      try {
        await updateDoc(doc(db, 'purchases', po.id), {
          status: 'cancelled',
          updatedAt: serverTimestamp(),
        });
        notify('info', `${po.poNumber} cancelled.`);
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `purchases/${po.id}`);
      }
    },
    [user, purchases, notify]
  );

  const payPurchase = useCallback(
    async (purchaseId: string, amount: number, method: 'cash' | 'upi' | 'card' | 'bank') => {
      if (!user) return;
      const po = purchases.find((p) => p.id === purchaseId);
      if (!po || po.dueAmount <= 0 || po.status === 'cancelled') return;

      const payAmt = clampNumber(amount, 0.01, po.dueAmount);
      const nextPaid = clampNumber(po.paidAmount + payAmt, 0, po.totalAmount);
      const nextDue = clampNumber(po.totalAmount - nextPaid, 0, po.totalAmount);
      const nextPayStatus: Purchase['paymentStatus'] = nextDue <= 0 ? 'paid' : 'partial';

      const batch = writeBatch(db);
      batch.update(doc(db, 'purchases', po.id), {
        paidAmount: nextPaid,
        dueAmount: nextDue,
        paymentStatus: nextPayStatus,
        updatedAt: serverTimestamp(),
      });

      const sup = suppliers.find((s) => s.id === po.supplierId);
      if (sup) {
        const nextPayable = clampNumber(sup.payableBalance - payAmt, -100000000, 100000000);
        batch.update(doc(db, 'suppliers', sup.id), {
          payableBalance: nextPayable,
          updatedAt: serverTimestamp(),
        });

        const ledId = generateDocId('led');
        batch.set(doc(db, 'ledgerEntries', ledId), {
          ownerId: user.uid,
          partyType: 'supplier',
          partyId: sup.id,
          partyName: clampString(sup.name, 120),
          entryType: 'payment_made',
          amount: payAmt,
          balanceAfter: nextPayable,
          paymentMethod: method,
          referenceNo: po.poNumber,
          note: `Settlement against ${po.poNumber}`,
          entryDate: todayIsoDate(),
          createdAt: serverTimestamp(),
        });
      }

      try {
        await batch.commit();
        notify('success', `Recorded payment for ${po.poNumber}.`);
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `purchases/${po.id}`);
      }
    },
    [user, purchases, suppliers, notify]
  );

  const value = useMemo<POSContextValue>(
    () => ({
      user,
      authLoading,
      dataLoading,
      store,
      products,
      customers,
      suppliers,
      sales,
      purchases,
      ledgerEntries,
      toasts,
      dismissToast,
      notify,
      signInWithGoogle,
      logout,
      updateStoreProfile,
      seedStoreData,
      addProduct,
      updateProduct,
      adjustProductStock,
      deleteProduct,
      addCustomer,
      updateCustomer,
      deleteCustomer,
      recordCustomerLedger,
      addSupplier,
      updateSupplier,
      deleteSupplier,
      recordSupplierPayment,
      completeSale,
      createPurchase,
      receivePurchase,
      cancelPurchase,
      payPurchase,
    }),
    [
      user,
      authLoading,
      dataLoading,
      store,
      products,
      customers,
      suppliers,
      sales,
      purchases,
      ledgerEntries,
      toasts,
      dismissToast,
      notify,
      signInWithGoogle,
      logout,
      updateStoreProfile,
      seedStoreData,
      addProduct,
      updateProduct,
      adjustProductStock,
      deleteProduct,
      addCustomer,
      updateCustomer,
      deleteCustomer,
      recordCustomerLedger,
      addSupplier,
      updateSupplier,
      deleteSupplier,
      recordSupplierPayment,
      completeSale,
      createPurchase,
      receivePurchase,
      cancelPurchase,
      payPurchase,
    ]
  );

  return <POSContext.Provider value={value}>{children}</POSContext.Provider>;
}

export function usePOS(): POSContextValue {
  const ctx = useContext(POSContext);
  if (!ctx) throw new Error('usePOS must be used inside POSProvider');
  return ctx;
}
