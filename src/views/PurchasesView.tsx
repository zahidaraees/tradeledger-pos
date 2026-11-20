import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CreditCard,
  PackageCheck,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { usePOS } from '../context/POSContext';
import { formatCurrency } from '../lib/validation';
import type { Product, Purchase, PurchaseItem } from '../types/pos';

interface PurchasesViewProps {
  prefillProducts: Product[];
  onClearPrefill: () => void;
}

const INPUT_CLASS =
  'w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-lg focus:outline-none focus:bg-white dark:focus:bg-slate-800 focus:border-emerald-600 dark:focus:border-emerald-500';

export function PurchasesView({ prefillProducts, onClearPrefill }: PurchasesViewProps) {
  const {
    store,
    products,
    suppliers,
    purchases,
    createPurchase,
    receivePurchase,
    cancelPurchase,
    payPurchase,
    notify,
  } = usePOS();
  const currency = store?.currencySymbol || '₹';

  const [statusFilter, setStatusFilter] = useState<'all' | 'ordered' | 'received' | 'cancelled'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // New PO Builder state
  const [builderOpen, setBuilderOpen] = useState(false);
  const [supplierId, setSupplierId] = useState('');
  const [poStatus, setPoStatus] = useState<'received' | 'ordered'>('received');
  const [poItems, setPoItems] = useState<PurchaseItem[]>([]);
  const [selectedProdId, setSelectedProdId] = useState('');
  const [taxInput, setTaxInput] = useState('0');
  const [paidInput, setPaidInput] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Payment Settlement Modal
  const [payingPO, setPayingPO] = useState<Purchase | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState<'bank' | 'upi' | 'cash' | 'card'>('bank');

  // Auto-open PO builder if triggered from Low Stock Alerts / Dashboard Reorder
  useEffect(() => {
    if (prefillProducts.length > 0) {
      const firstSup =
        prefillProducts.find((p) => p.supplierId)?.supplierId || suppliers[0]?.id || '';
      setSupplierId(firstSup);
      setPoStatus('ordered');
      setPoItems(
        prefillProducts.slice(0, 50).map((p) => {
          const suggestedQty = Math.max(p.minStockLevel * 2 - p.stockQty, 10);
          return {
            productId: p.id,
            sku: p.sku,
            name: p.name,
            unit: p.unit,
            qty: suggestedQty,
            unitCost: p.costPrice,
            lineTotal: Math.round(suggestedQty * p.costPrice * 100) / 100,
          };
        })
      );
      setNotes('Auto-generated reorder from Low Stock Alerts');
      setBuilderOpen(true);
      onClearPrefill();
    }
  }, [prefillProducts, suppliers, onClearPrefill]);

  const metrics = useMemo(() => {
    const valid = purchases.filter((p) => p.status !== 'cancelled');
    const totalSpend = valid.reduce((s, p) => s + p.totalAmount, 0);
    const pendingDelivery = purchases.filter((p) => p.status === 'ordered').length;
    const unpaidTotal = valid.reduce((s, p) => s + p.dueAmount, 0);
    return { totalSpend, pendingDelivery, unpaidTotal };
  }, [purchases]);

  const filtered = useMemo(() => {
    if (statusFilter === 'all') return purchases;
    return purchases.filter((p) => p.status === statusFilter);
  }, [purchases, statusFilter]);

  const addItemToPO = () => {
    const prod = products.find((p) => p.id === selectedProdId);
    if (!prod) return;
    setPoItems((prev) => {
      if (prev.some((i) => i.productId === prod.id)) {
        return prev.map((i) =>
          i.productId === prod.id
            ? { ...i, qty: i.qty + 10, lineTotal: (i.qty + 10) * i.unitCost }
            : i
        );
      }
      return [
        ...prev,
        {
          productId: prod.id,
          sku: prod.sku,
          name: prod.name,
          unit: prod.unit,
          qty: 10,
          unitCost: prod.costPrice,
          lineTotal: Math.round(10 * prod.costPrice * 100) / 100,
        },
      ];
    });
    setSelectedProdId('');
  };

  const poSubtotal = poItems.reduce((s, i) => s + i.qty * i.unitCost, 0);
  const poTax = Math.max(0, parseFloat(taxInput) || 0);
  const poTotal = Math.round((poSubtotal + poTax) * 100) / 100;

  const handleCreatePO = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierId) {
      notify('error', 'Please select a supplier first (add one in Suppliers if needed).');
      return;
    }
    if (poItems.length === 0) {
      notify('error', 'Add at least one product line item to the purchase order.');
      return;
    }
    const sup = suppliers.find((s) => s.id === supplierId);
    if (!sup) return;

    const paidVal = paidInput.trim() === '' ? poTotal : Math.max(0, parseFloat(paidInput) || 0);

    setSubmitting(true);
    try {
      await createPurchase({
        supplierId: sup.id,
        supplierName: sup.name,
        status: poStatus,
        taxAmount: poTax,
        paidAmount: Math.min(paidVal, poTotal),
        items: poItems,
        notes,
      });
      setBuilderOpen(false);
      setPoItems([]);
      setTaxInput('0');
      setPaidInput('');
      setNotes('');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSettlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingPO) return;
    const amt = parseFloat(payAmount);
    if (!Number.isFinite(amt) || amt <= 0) return;
    await payPurchase(payingPO.id, amt, payMethod);
    setPayingPO(null);
    setPayAmount('');
  };

  return (
    <div className="space-y-5">
      {/* KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Total Purchase Volume
          </div>
          <div className="mt-1.5 font-mono-num text-xl font-bold text-slate-900 dark:text-white">
            {formatCurrency(metrics.totalSpend, currency)}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Awaiting Delivery (Open POs)
          </div>
          <div className="mt-1.5 font-mono-num text-xl font-bold text-amber-700 dark:text-amber-400">
            {metrics.pendingDelivery} orders
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Unpaid Purchase Bills
          </div>
          <div className="mt-1.5 font-mono-num text-xl font-bold text-red-700 dark:text-red-400">
            {formatCurrency(metrics.unpaidTotal, currency)}
          </div>
        </div>
      </div>

      {/* Purchase Orders Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
            {(['all', 'ordered', 'received', 'cancelled'] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1 text-xs font-medium rounded-md capitalize cursor-pointer ${
                  statusFilter === st
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => {
              setSupplierId(suppliers[0]?.id || '');
              setPoItems([]);
              setPoStatus('received');
              setBuilderOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            New Purchase Order
          </button>
        </div>

        {filtered.length === 0 ? (
          <div className="p-12 text-center text-sm text-slate-500 dark:text-slate-400">
            No purchase orders found. Create a Purchase Order to receive supplier stock into inventory.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/70 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-4 font-medium">PO Number</th>
                  <th className="py-3 px-3 font-medium">Supplier</th>
                  <th className="py-3 px-3 font-medium">Delivery Status</th>
                  <th className="py-3 px-3 font-medium">Payment</th>
                  <th className="py-3 px-3 font-medium text-right">Total</th>
                  <th className="py-3 px-3 font-medium text-right">Balance Due</th>
                  <th className="py-3 px-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filtered.map((po) => {
                  const isExpanded = expandedId === po.id;
                  return (
                    <React.Fragment key={po.id}>
                      <tr className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50">
                        <td className="py-3 px-4">
                          <button
                            type="button"
                            onClick={() => setExpandedId(isExpanded ? null : po.id)}
                            className="inline-flex items-center gap-1.5 font-mono-num font-semibold text-slate-900 dark:text-slate-100 cursor-pointer"
                          >
                            {isExpanded ? (
                              <ChevronUp className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                            )}
                            {po.poNumber}
                          </button>
                          <div className="text-slate-400 dark:text-slate-500 font-mono-num pl-5">
                            {po.purchaseDate}
                          </div>
                        </td>
                        <td className="py-3 px-3 font-medium text-slate-800 dark:text-slate-200">
                          {po.supplierName}
                          <div className="text-slate-400 dark:text-slate-500 font-normal font-mono-num">
                            {po.itemCount} units · {po.items.length} lines
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={
                              po.status === 'received'
                                ? 'text-emerald-700 dark:text-emerald-400 font-semibold'
                                : po.status === 'ordered'
                                ? 'text-amber-700 dark:text-amber-400 font-semibold'
                                : 'text-slate-400 dark:text-slate-500 line-through'
                            }
                          >
                            {po.status === 'received'
                              ? 'Received in Stock'
                              : po.status === 'ordered'
                              ? 'Ordered / In Transit'
                              : 'Cancelled'}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={
                              po.paymentStatus === 'paid'
                                ? 'text-emerald-700 dark:text-emerald-400 font-medium'
                                : po.paymentStatus === 'partial'
                                ? 'text-amber-700 dark:text-amber-400 font-medium'
                                : 'text-red-700 dark:text-red-400 font-medium'
                            }
                          >
                            {po.paymentStatus === 'paid'
                              ? 'Paid'
                              : po.paymentStatus === 'partial'
                              ? 'Partial'
                              : 'Unpaid'}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right font-mono-num font-semibold text-slate-900 dark:text-slate-100">
                          {formatCurrency(po.totalAmount, currency)}
                        </td>
                        <td className="py-3 px-3 text-right font-mono-num font-semibold">
                          <span
                            className={
                              po.dueAmount > 0
                                ? 'text-red-700 dark:text-red-400'
                                : 'text-slate-400 dark:text-slate-500'
                            }
                          >
                            {formatCurrency(po.dueAmount, currency)}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="inline-flex items-center gap-3">
                            {po.status === 'ordered' && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => receivePurchase(po.id)}
                                  className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 hover:text-emerald-900 dark:hover:text-emerald-300 font-semibold whitespace-nowrap cursor-pointer"
                                >
                                  <PackageCheck className="w-3.5 h-3.5" />
                                  Receive Stock
                                </button>
                                <button
                                  type="button"
                                  onClick={() => cancelPurchase(po.id)}
                                  className="text-slate-400 dark:text-slate-500 hover:text-red-700 dark:hover:text-red-400 cursor-pointer"
                                >
                                  Cancel
                                </button>
                              </>
                            )}
                            {po.status !== 'cancelled' && po.dueAmount > 0 && (
                              <button
                                type="button"
                                onClick={() => {
                                  setPayingPO(po);
                                  setPayAmount(String(po.dueAmount));
                                }}
                                className="inline-flex items-center gap-1 text-slate-800 dark:text-slate-200 hover:text-emerald-700 dark:hover:text-emerald-400 font-semibold whitespace-nowrap cursor-pointer"
                              >
                                <CreditCard className="w-3.5 h-3.5" />
                                Pay Due
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="bg-slate-50/80 dark:bg-slate-800/40">
                          <td colSpan={7} className="px-6 py-4">
                            <div className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-2">
                              Line Items Breakdown {po.notes ? `· ${po.notes}` : ''}
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                              {po.items.map((it, i) => (
                                <div
                                  key={`${it.productId}-${i}`}
                                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 flex items-center justify-between gap-2"
                                >
                                  <div className="min-w-0">
                                    <div className="font-medium text-slate-900 dark:text-slate-100 truncate">
                                      {it.name}
                                    </div>
                                    <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono-num">
                                      {it.qty} {it.unit} × {formatCurrency(it.unitCost, currency)}
                                    </div>
                                  </div>
                                  <div className="font-mono-num font-semibold text-slate-900 dark:text-slate-100 shrink-0">
                                    {formatCurrency(it.lineTotal, currency)}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Purchase Order Modal */}
      {builderOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
                Create Purchase Order / Stock-In Bill
              </h2>
              <button
                type="button"
                onClick={() => setBuilderOpen(false)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreatePO} className="p-6 space-y-5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Supplier *
                  </label>
                  <select
                    required
                    value={supplierId}
                    onChange={(e) => setSupplierId(e.target.value)}
                    className={INPUT_CLASS}
                  >
                    <option value="">Select supplier...</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.paymentTerms})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Stock Action
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setPoStatus('received')}
                      className={`py-2 px-3 rounded-lg border font-semibold cursor-pointer ${
                        poStatus === 'received'
                          ? 'bg-emerald-700 dark:bg-emerald-600 text-white border-emerald-700 dark:border-emerald-600'
                          : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      Receive Stock Now
                    </button>
                    <button
                      type="button"
                      onClick={() => setPoStatus('ordered')}
                      className={`py-2 px-3 rounded-lg border font-semibold cursor-pointer ${
                        poStatus === 'ordered'
                          ? 'bg-slate-900 dark:bg-slate-700 text-white border-slate-900 dark:border-slate-600'
                          : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      Save as Ordered
                    </button>
                  </div>
                </div>
              </div>

              {/* Add Product Row */}
              <div className="flex gap-2">
                <select
                  value={selectedProdId}
                  onChange={(e) => setSelectedProdId(e.target.value)}
                  className={`flex-1 ${INPUT_CLASS}`}
                >
                  <option value="">Select product to add to PO...</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.sku} — {p.name} (Stock: {p.stockQty} · Cost: {formatCurrency(p.costPrice, currency)})
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={addItemToPO}
                  className="px-4 py-2 bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 dark:hover:bg-slate-600 text-white font-semibold rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Add Line
                </button>
              </div>

              {/* PO Line Items Table */}
              {poItems.length > 0 && (
                <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 dark:bg-slate-800/70 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="py-2 px-3 font-medium">Product</th>
                        <th className="py-2 px-3 font-medium text-right w-24">Qty</th>
                        <th className="py-2 px-3 font-medium text-right w-28">Unit Cost</th>
                        <th className="py-2 px-3 font-medium text-right w-28">Line Total</th>
                        <th className="py-2 px-2 w-8"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {poItems.map((it) => (
                        <tr key={it.productId}>
                          <td className="py-2 px-3">
                            <div className="font-medium text-slate-900 dark:text-slate-100">
                              {it.name}
                            </div>
                            <div className="text-[11px] text-slate-400 dark:text-slate-500 font-mono-num">
                              {it.sku}
                            </div>
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="number"
                              min={1}
                              value={it.qty}
                              onChange={(e) => {
                                const qty = Math.max(1, Number(e.target.value));
                                setPoItems((prev) =>
                                  prev.map((row) =>
                                    row.productId === it.productId
                                      ? { ...row, qty, lineTotal: Math.round(qty * row.unitCost * 100) / 100 }
                                      : row
                                  )
                                );
                              }}
                              className="w-full px-2 py-1 text-right font-mono-num bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="number"
                              min={0}
                              step="0.01"
                              value={it.unitCost}
                              onChange={(e) => {
                                const unitCost = Math.max(0, Number(e.target.value));
                                setPoItems((prev) =>
                                  prev.map((row) =>
                                    row.productId === it.productId
                                      ? { ...row, unitCost, lineTotal: Math.round(row.qty * unitCost * 100) / 100 }
                                      : row
                                  )
                                );
                              }}
                              className="w-full px-2 py-1 text-right font-mono-num bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded"
                            />
                          </td>
                          <td className="py-2 px-3 text-right font-mono-num font-semibold text-slate-900 dark:text-slate-100">
                            {formatCurrency(it.lineTotal, currency)}
                          </td>
                          <td className="py-2 px-2 text-center">
                            <button
                              type="button"
                              onClick={() =>
                                setPoItems((prev) => prev.filter((r) => r.productId !== it.productId))
                              }
                              className="text-slate-400 hover:text-red-700 dark:hover:text-red-400 cursor-pointer"
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

              {/* Totals & Payment */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-200 dark:border-slate-800">
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Tax / Freight ({currency})
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={taxInput}
                    onChange={(e) => setTaxInput(e.target.value)}
                    className={`${INPUT_CLASS} font-mono-num`}
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Paid Now ({currency})
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={paidInput}
                    onChange={(e) => setPaidInput(e.target.value)}
                    placeholder={`Full (${poTotal.toFixed(2)}) or 0 for credit`}
                    className={`${INPUT_CLASS} font-mono-num`}
                  />
                </div>
                <div className="flex flex-col justify-end text-right">
                  <div className="text-slate-500 dark:text-slate-400">Grand PO Total</div>
                  <div className="font-mono-num text-xl font-bold text-slate-900 dark:text-white">
                    {formatCurrency(poTotal, currency)}
                  </div>
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Notes / Vendor Invoice #
                </label>
                <input
                  type="text"
                  maxLength={250}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Supplier bill reference, delivery vehicle, batch remarks..."
                  className={INPUT_CLASS}
                />
              </div>

              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setBuilderOpen(false)}
                  className="px-4 py-2 font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || poItems.length === 0}
                  className="inline-flex items-center gap-1.5 px-4 py-2 font-semibold text-white bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 rounded-lg cursor-pointer disabled:opacity-60"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {submitting
                    ? 'Saving...'
                    : poStatus === 'received'
                    ? 'Confirm Stock-In'
                    : 'Create Purchase Order'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Pay Purchase Due Modal */}
      {payingPO && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                Record Supplier Payment
              </h3>
              <button
                type="button"
                onClick={() => setPayingPO(null)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="text-xs text-slate-600 dark:text-slate-400">
              Settling <strong className="font-mono-num text-slate-900 dark:text-slate-100">{payingPO.poNumber}</strong> for{' '}
              <strong className="text-slate-900 dark:text-slate-100">{payingPO.supplierName}</strong> (Balance Due:{' '}
              <strong className="font-mono-num text-red-700 dark:text-red-400">
                {formatCurrency(payingPO.dueAmount, currency)}
              </strong>
              )
            </div>
            <form onSubmit={handleSettlePayment} className="space-y-4 text-xs">
              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Payment Amount ({currency})
                </label>
                <input
                  required
                  type="number"
                  min={0.01}
                  max={payingPO.dueAmount}
                  step="0.01"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className={`${INPUT_CLASS} font-mono-num`}
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Payment Mode
                </label>
                <select
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value as typeof payMethod)}
                  className={INPUT_CLASS}
                >
                  <option value="bank">Bank Transfer / NEFT</option>
                  <option value="upi">UPI</option>
                  <option value="cash">Cash</option>
                  <option value="card">Card</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPayingPO(null)}
                  className="px-3.5 py-2 border border-slate-300 dark:border-slate-700 rounded-lg font-medium text-slate-700 dark:text-slate-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white rounded-lg font-semibold cursor-pointer"
                >
                  Confirm Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
