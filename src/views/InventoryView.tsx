import React, { useMemo, useState } from 'react';
import { Edit2, Minus, Plus, Search, Trash2, X } from 'lucide-react';
import { usePOS, type CreateProductInput } from '../context/POSContext';
import { formatCurrency, isExpired, isExpiringSoon } from '../lib/validation';
import type { Product, ProductVertical } from '../types/pos';

const EMPTY_FORM: CreateProductInput = {
  sku: '',
  barcode: '',
  name: '',
  category: '',
  vertical: 'grocery',
  unit: 'pcs',
  costPrice: 0,
  sellingPrice: 0,
  taxPercent: 5,
  stockQty: 0,
  minStockLevel: 10,
  batchNumber: '',
  expiryDate: '',
  supplierId: '',
  supplierName: '',
};

const INPUT_CLASS =
  'w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-lg focus:outline-none focus:bg-white dark:focus:bg-slate-800 focus:border-emerald-600 dark:focus:border-emerald-500';

export function InventoryView() {
  const {
    store,
    products,
    suppliers,
    addProduct,
    updateProduct,
    adjustProductStock,
    deleteProduct,
  } = usePOS();
  const currency = store?.currencySymbol || '₹';

  const [search, setSearch] = useState('');
  const [verticalFilter, setVerticalFilter] = useState<'all' | ProductVertical>('all');
  const [stockFilter, setStockFilter] = useState<'all' | 'in' | 'low' | 'out' | 'expiring'>('all');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CreateProductInput>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (verticalFilter !== 'all' && p.vertical !== verticalFilter) return false;
      if (stockFilter === 'out' && p.stockQty > 0) return false;
      if (stockFilter === 'low' && !(p.stockQty > 0 && p.stockQty <= p.minStockLevel)) return false;
      if (stockFilter === 'in' && p.stockQty <= p.minStockLevel) return false;
      if (stockFilter === 'expiring' && !isExpiringSoon(p.expiryDate, 45)) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.barcode.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.batchNumber.toLowerCase().includes(q)
      );
    });
  }, [products, verticalFilter, stockFilter, search]);

  const summary = useMemo(() => {
    const costVal = products.reduce((s, p) => s + p.costPrice * p.stockQty, 0);
    const retailVal = products.reduce((s, p) => s + p.sellingPrice * p.stockQty, 0);
    const totalUnits = products.reduce((s, p) => s + p.stockQty, 0);
    return { costVal, retailVal, totalUnits };
  }, [products]);

  const openAdd = () => {
    setEditingId(null);
    setForm({
      ...EMPTY_FORM,
      vertical:
        store?.vertical && store.vertical !== 'mixed' ? store.vertical : 'grocery',
      taxPercent: store?.defaultTaxRate ?? 5,
    });
    setModalOpen(true);
  };

  const openEdit = (p: Product) => {
    setEditingId(p.id);
    setForm({
      sku: p.sku,
      barcode: p.barcode,
      name: p.name,
      category: p.category,
      vertical: p.vertical,
      unit: p.unit,
      costPrice: p.costPrice,
      sellingPrice: p.sellingPrice,
      taxPercent: p.taxPercent,
      stockQty: p.stockQty,
      minStockLevel: p.minStockLevel,
      batchNumber: p.batchNumber,
      expiryDate: p.expiryDate,
      supplierId: p.supplierId,
      supplierName: p.supplierName,
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const sup = suppliers.find((s) => s.id === form.supplierId);
      const payload: CreateProductInput = {
        ...form,
        supplierName: sup ? sup.name : form.supplierName,
      };
      if (editingId) {
        await updateProduct(editingId, payload);
      } else {
        await addProduct(payload);
      }
      setModalOpen(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Valuation Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Stock Valuation (Cost)
          </div>
          <div className="mt-1.5 font-mono-num text-xl font-bold text-slate-900 dark:text-white">
            {formatCurrency(summary.costVal, currency)}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Potential Retail Value
          </div>
          <div className="mt-1.5 font-mono-num text-xl font-bold text-emerald-700 dark:text-emerald-400">
            {formatCurrency(summary.retailVal, currency)}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Catalog SKUs & Units
          </div>
          <div className="mt-1.5 font-mono-num text-xl font-bold text-slate-900 dark:text-white">
            {products.length} SKUs{' '}
            <span className="text-sm font-normal text-slate-500 dark:text-slate-400">
              · {summary.totalUnits.toLocaleString('en-IN')} units
            </span>
          </div>
        </div>
      </div>

      {/* Filters & Action Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex flex-col sm:flex-row gap-2.5 flex-1">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search SKU, name, barcode, batch..."
                className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-lg focus:outline-none focus:bg-white dark:focus:bg-slate-800 focus:border-emerald-600 dark:focus:border-emerald-500"
              />
            </div>

            <div className="inline-flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-lg shrink-0">
              {(['all', 'grocery', 'pharmacy', 'hardware'] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setVerticalFilter(v)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md capitalize cursor-pointer ${
                    verticalFilter === v
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>

            <select
              value={stockFilter}
              onChange={(e) => setStockFilter(e.target.value as typeof stockFilter)}
              className="px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg focus:outline-none focus:border-emerald-600 dark:focus:border-emerald-500"
            >
              <option value="all">All Stock States</option>
              <option value="in">Healthy Stock</option>
              <option value="low">Low Stock</option>
              <option value="out">Out of Stock</option>
              <option value="expiring">Expiring Within 45d</option>
            </select>
          </div>

          <button
            type="button"
            onClick={openAdd}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Add Product
          </button>
        </div>

        {/* High-Density Inventory Grid */}
        {filtered.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              No inventory products match your current filter.
            </p>
            <button
              type="button"
              onClick={openAdd}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 dark:bg-emerald-600 text-white text-xs font-semibold rounded-lg cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Create First Product
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/70 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-4 font-medium">Product & SKU</th>
                  <th className="py-3 px-3 font-medium">Department</th>
                  <th className="py-3 px-3 font-medium">Batch / Expiry</th>
                  <th className="py-3 px-3 font-medium text-right">Cost</th>
                  <th className="py-3 px-3 font-medium text-right">Selling</th>
                  <th className="py-3 px-3 font-medium text-right">Margin</th>
                  <th className="py-3 px-3 font-medium text-center">Stock Qty</th>
                  <th className="py-3 px-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filtered.map((p) => {
                  const marginPct =
                    p.sellingPrice > 0
                      ? ((p.sellingPrice - p.costPrice) / p.sellingPrice) * 100
                      : 0;
                  const out = p.stockQty <= 0;
                  const low = p.stockQty > 0 && p.stockQty <= p.minStockLevel;
                  const expired = isExpired(p.expiryDate);
                  const expSoon = !expired && isExpiringSoon(p.expiryDate, 45);

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900 dark:text-slate-100">
                          {p.name}
                        </div>
                        <div className="text-slate-400 dark:text-slate-500 font-mono-num mt-0.5">
                          {p.sku}
                          {p.barcode ? ` · ${p.barcode}` : ''}
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <div className="text-slate-800 dark:text-slate-200">{p.category}</div>
                        <div className="text-slate-400 dark:text-slate-500 capitalize">
                          {p.vertical}
                        </div>
                      </td>
                      <td className="py-3 px-3 font-mono-num">
                        {p.batchNumber ? (
                          <div className="text-slate-700 dark:text-slate-300">{p.batchNumber}</div>
                        ) : (
                          <div className="text-slate-400 dark:text-slate-600">—</div>
                        )}
                        {p.expiryDate && (
                          <div
                            className={
                              expired
                                ? 'text-red-700 dark:text-red-400 font-semibold'
                                : expSoon
                                ? 'text-amber-700 dark:text-amber-400 font-medium'
                                : 'text-slate-400 dark:text-slate-500'
                            }
                          >
                            {expired ? 'Expired ' : expSoon ? 'Exp soon ' : 'Exp '}
                            {p.expiryDate}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right font-mono-num text-slate-600 dark:text-slate-400">
                        {formatCurrency(p.costPrice, currency)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono-num font-semibold text-slate-900 dark:text-slate-100">
                        {formatCurrency(p.sellingPrice, currency)}
                        <div className="text-[10px] font-normal text-slate-400 dark:text-slate-500">
                          GST {p.taxPercent}%
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right font-mono-num text-emerald-700 dark:text-emerald-400 font-medium">
                        {marginPct.toFixed(1)}%
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => adjustProductStock(p.id, Math.max(0, p.stockQty - 1))}
                            aria-label="Decrement stock"
                            className="w-6 h-6 flex items-center justify-center rounded border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 cursor-pointer"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <div className="w-16 text-center font-mono-num">
                            <div
                              className={`font-semibold ${
                                out
                                  ? 'text-red-700 dark:text-red-400'
                                  : low
                                  ? 'text-amber-700 dark:text-amber-400'
                                  : 'text-slate-900 dark:text-slate-100'
                              }`}
                            >
                              {p.stockQty} {p.unit}
                            </div>
                            <div className="text-[10px] text-slate-400 dark:text-slate-500">
                              min {p.minStockLevel}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => adjustProductStock(p.id, p.stockQty + 1)}
                            aria-label="Increment stock"
                            className="w-6 h-6 flex items-center justify-center rounded border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 cursor-pointer"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        {confirmDeleteId === p.id ? (
                          <div className="inline-flex items-center gap-2">
                            <button
                              type="button"
                              onClick={async () => {
                                await deleteProduct(p.id);
                                setConfirmDeleteId(null);
                              }}
                              className="text-red-700 dark:text-red-400 font-semibold cursor-pointer"
                            >
                              Confirm
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="text-slate-500 dark:text-slate-400 cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-2.5">
                            <button
                              type="button"
                              onClick={() => openEdit(p)}
                              aria-label={`Edit ${p.name}`}
                              className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(p.id)}
                              aria-label={`Delete ${p.name}`}
                              className="text-slate-400 dark:text-slate-500 hover:text-red-700 dark:hover:text-red-400 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Product Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
                {editingId ? 'Edit Product' : 'Add New Product'}
              </h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Product Name *
                  </label>
                  <input
                    required
                    type="text"
                    maxLength={140}
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="e.g. Paracetamol 650mg Strip, Basmati Rice 5kg, Copper Wire Coil"
                    className={INPUT_CLASS}
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    SKU Code *
                  </label>
                  <input
                    required
                    type="text"
                    maxLength={48}
                    value={form.sku}
                    onChange={(e) => setForm({ ...form, sku: e.target.value })}
                    placeholder="GRC-109"
                    className={`${INPUT_CLASS} font-mono-num`}
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Barcode / EAN
                  </label>
                  <input
                    type="text"
                    maxLength={64}
                    value={form.barcode}
                    onChange={(e) => setForm({ ...form, barcode: e.target.value })}
                    placeholder="8901491101011"
                    className={`${INPUT_CLASS} font-mono-num`}
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Department
                  </label>
                  <select
                    value={form.vertical}
                    onChange={(e) =>
                      setForm({ ...form, vertical: e.target.value as ProductVertical })
                    }
                    className={INPUT_CLASS}
                  >
                    <option value="grocery">Grocery</option>
                    <option value="pharmacy">Pharmacy</option>
                    <option value="hardware">Hardware</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Category *
                  </label>
                  <input
                    required
                    type="text"
                    maxLength={64}
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    placeholder="Staples, Antibiotics, Electrical..."
                    className={INPUT_CLASS}
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Unit
                  </label>
                  <input
                    required
                    type="text"
                    maxLength={24}
                    value={form.unit}
                    onChange={(e) => setForm({ ...form, unit: e.target.value })}
                    placeholder="pcs, kg, strip, bottle, coil"
                    className={INPUT_CLASS}
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Primary Supplier
                  </label>
                  <select
                    value={form.supplierId}
                    onChange={(e) => setForm({ ...form, supplierId: e.target.value })}
                    className={INPUT_CLASS}
                  >
                    <option value="">None / Multiple</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Purchase Cost ({currency}) *
                  </label>
                  <input
                    required
                    type="number"
                    min={0}
                    step="0.01"
                    value={form.costPrice}
                    onChange={(e) => setForm({ ...form, costPrice: Number(e.target.value) })}
                    className={`${INPUT_CLASS} font-mono-num`}
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Selling Price ({currency}) *
                  </label>
                  <input
                    required
                    type="number"
                    min={0}
                    step="0.01"
                    value={form.sellingPrice}
                    onChange={(e) => setForm({ ...form, sellingPrice: Number(e.target.value) })}
                    className={`${INPUT_CLASS} font-mono-num`}
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    GST / Tax (%)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={40}
                    step="0.5"
                    value={form.taxPercent}
                    onChange={(e) => setForm({ ...form, taxPercent: Number(e.target.value) })}
                    className={`${INPUT_CLASS} font-mono-num`}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Opening Stock
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={form.stockQty}
                      onChange={(e) => setForm({ ...form, stockQty: Number(e.target.value) })}
                      className={`${INPUT_CLASS} font-mono-num`}
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Min Alert Level
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={form.minStockLevel}
                      onChange={(e) => setForm({ ...form, minStockLevel: Number(e.target.value) })}
                      className={`${INPUT_CLASS} font-mono-num`}
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Batch Number (Pharmacy / FMCG)
                  </label>
                  <input
                    type="text"
                    maxLength={48}
                    value={form.batchNumber}
                    onChange={(e) => setForm({ ...form, batchNumber: e.target.value })}
                    placeholder="Optional batch #"
                    className={`${INPUT_CLASS} font-mono-num`}
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Expiry Date
                  </label>
                  <input
                    type="date"
                    value={form.expiryDate}
                    onChange={(e) => setForm({ ...form, expiryDate: e.target.value })}
                    className={`${INPUT_CLASS} font-mono-num`}
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 rounded-lg cursor-pointer disabled:opacity-60"
                >
                  {saving ? 'Saving...' : editingId ? 'Save Changes' : 'Add Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
