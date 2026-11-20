import React, { useMemo, useRef, useState } from 'react';
import {
  Barcode,
  CheckCircle2,
  Minus,
  Plus,
  Printer,
  Receipt,
  Search,
  ShoppingCart,
  Trash2,
  UserCheck,
  X,
} from 'lucide-react';
import { usePOS } from '../context/POSContext';
import { formatCurrency } from '../lib/validation';
import type { Product, ProductVertical, Sale, SaleItem } from '../types/pos';

export function SalesTerminalView() {
  const { store, products, customers, sales, completeSale, notify } = usePOS();
  const currency = store?.currencySymbol || '₹';

  const [tab, setTab] = useState<'terminal' | 'history'>('terminal');
  const [search, setSearch] = useState('');
  const [verticalFilter, setVerticalFilter] = useState<'all' | ProductVertical>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const [cart, setCart] = useState<SaleItem[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('walk-in');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'upi' | 'card' | 'credit' | 'split'>('cash');
  const [discountType, setDiscountType] = useState<'flat' | 'percent'>('flat');
  const [discountInput, setDiscountInput] = useState<string>('0');
  const [paidInput, setPaidInput] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  const [receiptSale, setReceiptSale] = useState<Sale | null>(null);
  const [historySearch, setHistorySearch] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  const activeProducts = useMemo(() => products.filter((p) => p.status === 'active'), [products]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    activeProducts.forEach((p) => {
      if (verticalFilter === 'all' || p.vertical === verticalFilter) {
        set.add(p.category);
      }
    });
    return ['all', ...Array.from(set).sort()];
  }, [activeProducts, verticalFilter]);

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return activeProducts.filter((p) => {
      if (verticalFilter !== 'all' && p.vertical !== verticalFilter) return false;
      if (categoryFilter !== 'all' && p.category !== categoryFilter) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.barcode.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
      );
    });
  }, [activeProducts, verticalFilter, categoryFilter, search]);

  const addToCart = (product: Product) => {
    if (product.stockQty <= 0) {
      notify('error', `"${product.name}" is out of stock. Restock via Purchases first.`);
      return;
    }
    setCart((prev) => {
      const existing = prev.find((i) => i.productId === product.id);
      if (existing) {
        if (existing.qty >= product.stockQty) {
          notify('info', `Maximum available stock (${product.stockQty}) reached for ${product.name}.`);
          return prev;
        }
        return prev.map((i) =>
          i.productId === product.id
            ? { ...i, qty: i.qty + 1, lineTotal: (i.qty + 1) * i.unitPrice }
            : i
        );
      }
      if (prev.length >= 50) {
        notify('error', 'Maximum 50 distinct line items per invoice.');
        return prev;
      }
      return [
        ...prev,
        {
          productId: product.id,
          sku: product.sku,
          name: product.name,
          category: product.category,
          unit: product.unit,
          qty: 1,
          unitPrice: product.sellingPrice,
          costPrice: product.costPrice,
          taxPercent: product.taxPercent,
          lineTotal: product.sellingPrice,
        },
      ];
    });
  };

  const handleBarcodeEnter = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    const q = search.trim().toLowerCase();
    if (!q) return;
    const exact = activeProducts.find(
      (p) => p.barcode.toLowerCase() === q || p.sku.toLowerCase() === q
    );
    if (exact) {
      addToCart(exact);
      setSearch('');
    } else if (filteredProducts.length === 1) {
      addToCart(filteredProducts[0]);
      setSearch('');
    }
  };

  const updateCartQty = (productId: string, nextQty: number) => {
    const prod = products.find((p) => p.id === productId);
    if (nextQty <= 0) {
      setCart((prev) => prev.filter((i) => i.productId !== productId));
      return;
    }
    const maxAllowed = prod ? prod.stockQty : nextQty;
    const clamped = Math.min(nextQty, maxAllowed);
    if (prod && nextQty > prod.stockQty) {
      notify('info', `Only ${prod.stockQty} ${prod.unit} available in stock.`);
    }
    setCart((prev) =>
      prev.map((i) =>
        i.productId === productId
          ? { ...i, qty: clamped, lineTotal: Math.round(clamped * i.unitPrice * 100) / 100 }
          : i
      )
    );
  };

  const totals = useMemo(() => {
    const subtotal = cart.reduce((sum, i) => sum + i.unitPrice * i.qty, 0);
    const rawDisc = parseFloat(discountInput) || 0;
    const discountAmount =
      discountType === 'percent'
        ? Math.min(subtotal, Math.max(0, (subtotal * rawDisc) / 100))
        : Math.min(subtotal, Math.max(0, rawDisc));
    const ratio = subtotal > 0 ? (subtotal - discountAmount) / subtotal : 1;
    const taxAmount = cart.reduce(
      (sum, i) => sum + (i.unitPrice * i.qty * ratio * i.taxPercent) / 100,
      0
    );
    const grandTotal = Math.round((subtotal - discountAmount + taxAmount) * 100) / 100;
    const totalCost = cart.reduce((sum, i) => sum + i.costPrice * i.qty, 0);
    const estProfit = Math.round((subtotal - discountAmount - totalCost) * 100) / 100;
    return {
      subtotal: Math.round(subtotal * 100) / 100,
      discountAmount: Math.round(discountAmount * 100) / 100,
      taxAmount: Math.round(taxAmount * 100) / 100,
      grandTotal,
      estProfit,
    };
  }, [cart, discountInput, discountType]);

  const effectivePaid = useMemo(() => {
    if (paymentMethod === 'credit') return 0;
    if (paidInput.trim() === '') return totals.grandTotal;
    const parsed = parseFloat(paidInput);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : totals.grandTotal;
  }, [paymentMethod, paidInput, totals.grandTotal]);

  const dueAmount = Math.max(0, Math.round((totals.grandTotal - effectivePaid) * 100) / 100);
  const changeReturn = Math.max(0, Math.round((effectivePaid - totals.grandTotal) * 100) / 100);

  const selectedCustomer = useMemo(
    () => customers.find((c) => c.id === selectedCustomerId) ?? null,
    [customers, selectedCustomerId]
  );

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    if (dueAmount > 0 && selectedCustomerId === 'walk-in') {
      notify('error', 'Select a registered customer to post a Credit / Khata balance.');
      return;
    }
    setSubmitting(true);
    try {
      const completed = await completeSale({
        customerId: selectedCustomer ? selectedCustomer.id : 'walk-in',
        customerName: selectedCustomer ? selectedCustomer.name : 'Walk-in Customer',
        paymentMethod,
        discountAmount: totals.discountAmount,
        paidAmount: Math.min(effectivePaid, totals.grandTotal),
        items: cart,
        notes,
      });
      if (completed) {
        setReceiptSale(completed);
        setCart([]);
        setDiscountInput('0');
        setPaidInput('');
        setNotes('');
        setPaymentMethod('cash');
        setSelectedCustomerId('walk-in');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const filteredHistory = useMemo(() => {
    const q = historySearch.trim().toLowerCase();
    if (!q) return sales;
    return sales.filter(
      (s) =>
        s.invoiceNumber.toLowerCase().includes(q) ||
        s.customerName.toLowerCase().includes(q) ||
        s.paymentMethod.toLowerCase().includes(q)
    );
  }, [sales, historySearch]);

  return (
    <div className="space-y-4">
      {/* Mode Switcher Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="inline-flex items-center p-1 bg-slate-200/70 dark:bg-slate-800 rounded-lg">
          <button
            type="button"
            onClick={() => setTab('terminal')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              tab === 'terminal'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            POS Billing Counter
          </button>
          <button
            type="button"
            onClick={() => setTab('history')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              tab === 'history'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Invoices History ({sales.length})
          </button>
        </div>

        {tab === 'terminal' && (
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <Barcode className="w-4 h-4 text-slate-400 dark:text-slate-500" />
            <span>Scan barcode or type SKU and press Enter to add instantly</span>
          </div>
        )}
      </div>

      {tab === 'terminal' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Left Product Catalog Selector */}
          <div className="lg:col-span-7 xl:col-span-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  ref={searchRef}
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={handleBarcodeEnter}
                  placeholder="Search product name, SKU, or scan barcode..."
                  className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-lg focus:outline-none focus:bg-white dark:focus:bg-slate-800 focus:border-emerald-600 dark:focus:border-emerald-500"
                />
              </div>

              <div className="inline-flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-lg shrink-0">
                {(['all', 'grocery', 'pharmacy', 'hardware'] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => {
                      setVerticalFilter(v);
                      setCategoryFilter('all');
                    }}
                    className={`px-2.5 py-1.5 text-xs font-medium rounded-md capitalize whitespace-nowrap shrink-0 cursor-pointer ${
                      verticalFilter === v
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>

            {categories.length > 2 && (
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategoryFilter(cat)}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      categoryFilter === cat
                        ? 'bg-slate-900 dark:bg-emerald-600 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    {cat === 'all' ? 'All Categories' : cat}
                  </button>
                ))}
              </div>
            )}

            {filteredProducts.length === 0 ? (
              <div className="py-16 text-center text-sm text-slate-500 dark:text-slate-400">
                No matching products found. Clear filters or add items in Inventory.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 max-h-[calc(100vh-280px)] overflow-y-auto pr-1">
                {filteredProducts.map((p) => {
                  const inCart = cart.find((i) => i.productId === p.id);
                  const isOut = p.stockQty <= 0;
                  const isLow = p.stockQty > 0 && p.stockQty <= p.minStockLevel;

                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => addToCart(p)}
                      disabled={isOut}
                      className={`text-left p-3.5 rounded-lg border transition-colors flex flex-col justify-between gap-2.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                        inCart
                          ? 'border-emerald-600 dark:border-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/40'
                          : 'border-slate-200 dark:border-slate-800 hover:border-slate-400 dark:hover:border-slate-600 bg-white dark:bg-slate-900'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400 font-mono-num">
                          <span>{p.sku}</span>
                          <span>GST {p.taxPercent}%</span>
                        </div>
                        <div className="font-medium text-sm text-slate-900 dark:text-slate-100 mt-1 line-clamp-2 leading-snug">
                          {p.name}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 truncate">
                          {p.category}
                          {p.batchNumber ? ` · Batch ${p.batchNumber}` : ''}
                        </div>
                      </div>

                      <div className="flex items-end justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                        <div>
                          <div className="font-mono-num text-base font-bold text-slate-900 dark:text-white">
                            {formatCurrency(p.sellingPrice, currency)}
                          </div>
                          <div className="text-[11px] text-slate-400 dark:text-slate-500">
                            per {p.unit}
                          </div>
                        </div>

                        <div className="text-right">
                          <div
                            className={`text-xs font-mono-num font-semibold ${
                              isOut
                                ? 'text-red-700 dark:text-red-400'
                                : isLow
                                ? 'text-amber-700 dark:text-amber-400'
                                : 'text-emerald-700 dark:text-emerald-400'
                            }`}
                          >
                            {isOut ? 'Out of Stock' : `${p.stockQty} left`}
                          </div>
                          {inCart && (
                            <div className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-300 font-mono-num">
                              In cart: {inCart.qty}
                            </div>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right Live Billing Cart & Checkout Panel */}
          <div className="lg:col-span-5 xl:col-span-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex flex-col">
            {/* Customer Selector */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="pos-customer"
                  className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5"
                >
                  <UserCheck className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                  Customer Account
                </label>
                {cart.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setCart([])}
                    className="text-xs text-red-700 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 font-medium cursor-pointer"
                  >
                    Clear Cart
                  </button>
                )}
              </div>
              <select
                id="pos-customer"
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg focus:outline-none focus:bg-white dark:focus:bg-slate-800 focus:border-emerald-600 dark:focus:border-emerald-500"
              >
                <option value="walk-in">Walk-in Customer (Cash / Instant)</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.balance > 0 ? `(Due ${formatCurrency(c.balance, currency)})` : ''}
                  </option>
                ))}
              </select>
              {selectedCustomer && (
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                  <span>
                    Khata Due:{' '}
                    <strong className="font-mono-num text-slate-800 dark:text-slate-200">
                      {formatCurrency(selectedCustomer.balance, currency)}
                    </strong>
                  </span>
                  <span>
                    Limit:{' '}
                    <strong className="font-mono-num text-slate-800 dark:text-slate-200">
                      {formatCurrency(selectedCustomer.creditLimit, currency)}
                    </strong>
                  </span>
                </div>
              )}
            </div>

            {/* Cart Items List */}
            <div className="p-4 max-h-72 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
              {cart.length === 0 ? (
                <div className="py-10 text-center space-y-2">
                  <ShoppingCart className="w-7 h-7 text-slate-300 dark:text-slate-700 mx-auto" />
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Cart is empty
                  </p>
                  <p className="text-xs text-slate-400 dark:text-slate-500">
                    Click items on the left or scan a barcode to start billing.
                  </p>
                </div>
              ) : (
                cart.map((item) => (
                  <div
                    key={item.productId}
                    className="py-2.5 first:pt-0 last:pb-0 flex items-center gap-3"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                        {item.name}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono-num">
                        {formatCurrency(item.unitPrice, currency)} × {item.qty} {item.unit}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => updateCartQty(item.productId, item.qty - 1)}
                        aria-label="Decrease quantity"
                        className="w-7 h-7 flex items-center justify-center rounded border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 cursor-pointer"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-8 text-center font-mono-num text-xs font-semibold text-slate-900 dark:text-slate-100">
                        {item.qty}
                      </span>
                      <button
                        type="button"
                        onClick={() => updateCartQty(item.productId, item.qty + 1)}
                        aria-label="Increase quantity"
                        className="w-7 h-7 flex items-center justify-center rounded border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    <div className="w-20 text-right font-mono-num text-xs font-semibold text-slate-900 dark:text-slate-100 shrink-0">
                      {formatCurrency(item.lineTotal, currency)}
                    </div>

                    <button
                      type="button"
                      onClick={() => updateCartQty(item.productId, 0)}
                      aria-label="Remove item"
                      className="text-slate-400 hover:text-red-600 dark:hover:text-red-400 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Discount, Totals & Payment Section */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 rounded-b-xl space-y-4">
              {/* Discount Row */}
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                  Discount
                </span>
                <div className="flex items-center gap-1.5">
                  <div className="inline-flex rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setDiscountType('flat')}
                      className={`px-2 py-1 text-xs font-mono-num cursor-pointer ${
                        discountType === 'flat'
                          ? 'bg-slate-900 dark:bg-emerald-600 text-white'
                          : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {currency}
                    </button>
                    <button
                      type="button"
                      onClick={() => setDiscountType('percent')}
                      className={`px-2 py-1 text-xs font-mono-num cursor-pointer ${
                        discountType === 'percent'
                          ? 'bg-slate-900 dark:bg-emerald-600 text-white'
                          : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      %
                    </button>
                  </div>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={discountInput}
                    onChange={(e) => setDiscountInput(e.target.value)}
                    className="w-24 px-2.5 py-1 text-right text-xs font-mono-num bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-md focus:outline-none focus:border-emerald-600 dark:focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Financial Breakdown */}
              <div className="space-y-1.5 text-xs border-t border-slate-200 dark:border-slate-800 pt-3">
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Subtotal</span>
                  <span className="font-mono-num">{formatCurrency(totals.subtotal, currency)}</span>
                </div>
                {totals.discountAmount > 0 && (
                  <div className="flex justify-between text-emerald-700 dark:text-emerald-400">
                    <span>Discount</span>
                    <span className="font-mono-num">
                      -{formatCurrency(totals.discountAmount, currency)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Tax (GST)</span>
                  <span className="font-mono-num">{formatCurrency(totals.taxAmount, currency)}</span>
                </div>
                <div className="flex justify-between items-baseline pt-2 border-t border-slate-200 dark:border-slate-800">
                  <span className="font-display text-sm font-bold text-slate-900 dark:text-white">
                    Grand Total
                  </span>
                  <span className="font-mono-num text-xl font-bold text-slate-900 dark:text-white">
                    {formatCurrency(totals.grandTotal, currency)}
                  </span>
                </div>
                {cart.length > 0 && (
                  <div className="flex justify-between text-[11px] text-slate-500 dark:text-slate-400">
                    <span>Estimated Gross Margin</span>
                    <span className="font-mono-num text-emerald-700 dark:text-emerald-400 font-medium">
                      +{formatCurrency(totals.estProfit, currency)}
                    </span>
                  </div>
                )}
              </div>

              {/* Payment Method */}
              <div className="space-y-2">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                  Payment Mode
                </span>
                <div className="grid grid-cols-5 gap-1">
                  {(
                    [
                      ['cash', 'Cash'],
                      ['upi', 'UPI'],
                      ['card', 'Card'],
                      ['credit', 'Khata'],
                      ['split', 'Split'],
                    ] as const
                  ).map(([val, label]) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => {
                        setPaymentMethod(val);
                        if (val === 'credit') setPaidInput('0');
                        else setPaidInput('');
                      }}
                      className={`py-1.5 text-xs font-medium rounded-md border transition-colors cursor-pointer ${
                        paymentMethod === val
                          ? 'bg-slate-900 dark:bg-emerald-600 text-white border-slate-900 dark:border-emerald-600'
                          : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {paymentMethod !== 'credit' && (
                <div className="flex items-center justify-between gap-3">
                  <label
                    htmlFor="pos-paid"
                    className="text-xs font-medium text-slate-600 dark:text-slate-400"
                  >
                    Amount Tendered
                  </label>
                  <input
                    id="pos-paid"
                    type="number"
                    min={0}
                    step="0.01"
                    value={paidInput}
                    onChange={(e) => setPaidInput(e.target.value)}
                    placeholder={totals.grandTotal.toFixed(2)}
                    className="w-32 px-2.5 py-1.5 text-right text-xs font-mono-num bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-md focus:outline-none focus:border-emerald-600 dark:focus:border-emerald-500"
                  />
                </div>
              )}

              {dueAmount > 0 && (
                <div className="flex items-center justify-between text-xs text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
                  <span>Posted to Customer Khata</span>
                  <strong className="font-mono-num">{formatCurrency(dueAmount, currency)}</strong>
                </div>
              )}

              {changeReturn > 0 && (
                <div className="flex items-center justify-between text-xs text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 rounded-lg px-3 py-2">
                  <span>Change to Return</span>
                  <strong className="font-mono-num">{formatCurrency(changeReturn, currency)}</strong>
                </div>
              )}

              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional bill note (prescription ref, delivery site...)"
                maxLength={200}
                className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-lg focus:outline-none focus:border-emerald-600 dark:focus:border-emerald-500"
              />

              <button
                type="button"
                disabled={cart.length === 0 || submitting}
                onClick={handleCheckout}
                className="w-full py-3 px-4 bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 disabled:bg-slate-300 dark:disabled:bg-slate-700 disabled:text-slate-500 dark:disabled:text-slate-400 text-white text-sm font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
              >
                <Receipt className="w-4 h-4" />
                <span>
                  {submitting
                    ? 'Processing Invoice...'
                    : `Complete Sale · ${formatCurrency(totals.grandTotal, currency)}`}
                </span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Sales History View */
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative max-w-sm w-full">
              <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                placeholder="Search invoice #, customer, or payment mode..."
                className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-lg focus:outline-none focus:bg-white dark:focus:bg-slate-800 focus:border-emerald-600 dark:focus:border-emerald-500"
              />
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 font-mono-num">
              Showing {filteredHistory.length} of {sales.length} invoices
            </div>
          </div>

          {filteredHistory.length === 0 ? (
            <div className="p-12 text-center text-sm text-slate-500 dark:text-slate-400">
              No sales invoices match your filter.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/70 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-4 font-medium">Invoice #</th>
                    <th className="py-3 px-3 font-medium">Date</th>
                    <th className="py-3 px-3 font-medium">Customer</th>
                    <th className="py-3 px-3 font-medium">Mode / Status</th>
                    <th className="py-3 px-3 font-medium text-right">Items</th>
                    <th className="py-3 px-3 font-medium text-right">Total</th>
                    <th className="py-3 px-3 font-medium text-right">Profit</th>
                    <th className="py-3 px-4 font-medium text-right">Receipt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredHistory.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50">
                      <td className="py-3 px-4 font-mono-num font-semibold text-slate-900 dark:text-slate-100">
                        {s.invoiceNumber}
                      </td>
                      <td className="py-3 px-3 font-mono-num text-slate-600 dark:text-slate-400">
                        {s.saleDate}
                      </td>
                      <td className="py-3 px-3 text-slate-800 dark:text-slate-200 font-medium">
                        {s.customerName}
                      </td>
                      <td className="py-3 px-3 text-slate-600 dark:text-slate-400">
                        <span className="uppercase font-mono-num">{s.paymentMethod}</span>
                        <span aria-hidden="true"> · </span>
                        <span
                          className={
                            s.paymentStatus === 'paid'
                              ? 'text-emerald-700 dark:text-emerald-400 font-medium'
                              : s.paymentStatus === 'partial'
                              ? 'text-amber-700 dark:text-amber-400 font-medium'
                              : 'text-red-700 dark:text-red-400 font-medium'
                          }
                        >
                          {s.paymentStatus === 'paid'
                            ? 'Paid'
                            : s.paymentStatus === 'partial'
                            ? `Due ${formatCurrency(s.dueAmount, currency)}`
                            : `Credit ${formatCurrency(s.dueAmount, currency)}`}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right font-mono-num text-slate-600 dark:text-slate-400">
                        {s.itemCount}
                      </td>
                      <td className="py-3 px-3 text-right font-mono-num font-semibold text-slate-900 dark:text-slate-100">
                        {formatCurrency(s.totalAmount, currency)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono-num text-emerald-700 dark:text-emerald-400 font-medium">
                        {formatCurrency(s.grossProfit, currency)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => setReceiptSale(s)}
                          className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 hover:text-emerald-900 dark:hover:text-emerald-300 font-semibold cursor-pointer"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Printable Receipt Modal */}
      {receiptSale && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-md w-full overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between no-print">
              <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-semibold text-sm">
                <CheckCircle2 className="w-4 h-4" />
                <span>Tax Invoice Ready</span>
              </div>
              <button
                type="button"
                onClick={() => setReceiptSale(null)}
                aria-label="Close receipt"
                className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="text-center border-b border-dashed border-slate-300 dark:border-slate-700 pb-4">
                <div className="font-display text-lg font-bold text-slate-900 dark:text-white">
                  {store?.storeName || 'TradeLedger Store'}
                </div>
                {store?.address && (
                  <div className="text-slate-500 dark:text-slate-400 mt-0.5">{store.address}</div>
                )}
                <div className="text-slate-500 dark:text-slate-400 mt-0.5 font-mono-num">
                  {[store?.phone, store?.taxId ? `GSTIN: ${store.taxId}` : '']
                    .filter(Boolean)
                    .join(' · ')}
                </div>
              </div>

              <div className="flex justify-between text-slate-600 dark:text-slate-400 font-mono-num">
                <div>
                  <div>Invoice: {receiptSale.invoiceNumber}</div>
                  <div>Customer: {receiptSale.customerName}</div>
                </div>
                <div className="text-right">
                  <div>Date: {receiptSale.saleDate}</div>
                  <div className="uppercase">Mode: {receiptSale.paymentMethod}</div>
                </div>
              </div>

              <table className="w-full text-left border-t border-b border-dashed border-slate-300 dark:border-slate-700 py-2">
                <thead>
                  <tr className="text-slate-500 dark:text-slate-400">
                    <th className="py-1.5 font-medium">Item</th>
                    <th className="py-1.5 font-medium text-right">Qty</th>
                    <th className="py-1.5 font-medium text-right">Rate</th>
                    <th className="py-1.5 font-medium text-right">Amt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {receiptSale.items.map((it, idx) => (
                    <tr key={`${it.productId}-${idx}`}>
                      <td className="py-1.5 pr-2 text-slate-900 dark:text-slate-100">{it.name}</td>
                      <td className="py-1.5 text-right font-mono-num text-slate-700 dark:text-slate-300">
                        {it.qty}
                      </td>
                      <td className="py-1.5 text-right font-mono-num text-slate-700 dark:text-slate-300">
                        {formatCurrency(it.unitPrice, currency)}
                      </td>
                      <td className="py-1.5 text-right font-mono-num font-medium text-slate-900 dark:text-slate-100">
                        {formatCurrency(it.lineTotal, currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="space-y-1 font-mono-num">
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Subtotal</span>
                  <span>{formatCurrency(receiptSale.subtotal, currency)}</span>
                </div>
                {receiptSale.discountAmount > 0 && (
                  <div className="flex justify-between text-emerald-700 dark:text-emerald-400">
                    <span>Discount</span>
                    <span>-{formatCurrency(receiptSale.discountAmount, currency)}</span>
                  </div>
                )}
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Tax (GST)</span>
                  <span>{formatCurrency(receiptSale.taxAmount, currency)}</span>
                </div>
                <div className="flex justify-between text-sm font-bold text-slate-900 dark:text-white pt-2 border-t border-slate-200 dark:border-slate-800">
                  <span>Grand Total</span>
                  <span>{formatCurrency(receiptSale.totalAmount, currency)}</span>
                </div>
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Paid</span>
                  <span>{formatCurrency(receiptSale.paidAmount, currency)}</span>
                </div>
                {receiptSale.dueAmount > 0 && (
                  <div className="flex justify-between text-amber-700 dark:text-amber-400 font-semibold">
                    <span>Balance Added to Khata</span>
                    <span>{formatCurrency(receiptSale.dueAmount, currency)}</span>
                  </div>
                )}
              </div>

              <div className="text-center text-[11px] text-slate-400 dark:text-slate-500 pt-2 border-t border-dashed border-slate-300 dark:border-slate-700">
                Thank you for shopping with us!
              </div>
            </div>

            <div className="px-5 py-3.5 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2.5 no-print">
              <button
                type="button"
                onClick={() => setReceiptSale(null)}
                className="px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 rounded-lg cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                Print Receipt
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
