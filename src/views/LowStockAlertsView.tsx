import React, { useMemo, useState } from 'react';
import { AlertTriangle, CheckSquare, Clock, PackagePlus, Square } from 'lucide-react';
import { usePOS } from '../context/POSContext';
import { formatCurrency, isExpired, isExpiringSoon } from '../lib/validation';
import type { Product } from '../types/pos';

interface LowStockAlertsViewProps {
  onBulkReorder: (products: Product[]) => void;
}

export function LowStockAlertsView({ onBulkReorder }: LowStockAlertsViewProps) {
  const { store, products } = usePOS();
  const currency = store?.currencySymbol || '₹';

  const [tab, setTab] = useState<'all' | 'out' | 'low' | 'expiring'>('all');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const categorized = useMemo(() => {
    const active = products.filter((p) => p.status === 'active');
    const out = active.filter((p) => p.stockQty <= 0);
    const low = active.filter((p) => p.stockQty > 0 && p.stockQty <= p.minStockLevel);
    const expiring = active.filter((p) => isExpiringSoon(p.expiryDate, 45));
    const allMap = new Map<string, Product>();
    [...out, ...low, ...expiring].forEach((p) => allMap.set(p.id, p));
    return {
      all: Array.from(allMap.values()),
      out,
      low,
      expiring,
    };
  }, [products]);

  const displayed = categorized[tab];

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleAll = () => {
    if (selectedIds.length === displayed.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(displayed.map((p) => p.id));
    }
  };

  const selectedProducts = useMemo(
    () => products.filter((p) => selectedIds.includes(p.id)),
    [products, selectedIds]
  );

  const estimatedRestockBudget = useMemo(() => {
    return categorized.all.reduce((sum, p) => {
      const need = Math.max(p.minStockLevel * 2 - p.stockQty, 0);
      return sum + need * p.costPrice;
    }, 0);
  }, [categorized.all]);

  return (
    <div className="space-y-5">
      {/* Alert Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Out of Stock (Critical)
          </div>
          <div className="mt-1.5 font-mono-num text-2xl font-bold text-red-700 dark:text-red-400">
            {categorized.out.length} SKUs
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Below Min Threshold
          </div>
          <div className="mt-1.5 font-mono-num text-2xl font-bold text-amber-700 dark:text-amber-400">
            {categorized.low.length} SKUs
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Expiring Within 45 Days
          </div>
          <div className="mt-1.5 font-mono-num text-2xl font-bold text-slate-900 dark:text-white">
            {categorized.expiring.length} batches
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Est. Replenishment Cost
          </div>
          <div className="mt-1.5 font-mono-num text-2xl font-bold text-slate-900 dark:text-white">
            {formatCurrency(estimatedRestockBudget, currency)}
          </div>
        </div>
      </div>

      {/* Action Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-lg overflow-x-auto">
            {(
              [
                ['all', `All Alerts (${categorized.all.length})`],
                ['out', `Out of Stock (${categorized.out.length})`],
                ['low', `Low Stock (${categorized.low.length})`],
                ['expiring', `Expiring Soon (${categorized.expiring.length})`],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => {
                  setTab(k);
                  setSelectedIds([]);
                }}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md whitespace-nowrap shrink-0 cursor-pointer ${
                  tab === k
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <button
            type="button"
            disabled={selectedProducts.length === 0}
            onClick={() => onBulkReorder(selectedProducts)}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 disabled:bg-slate-300 dark:disabled:bg-slate-700 disabled:text-slate-500 dark:disabled:text-slate-400 text-white text-xs font-semibold rounded-lg whitespace-nowrap shrink-0 cursor-pointer disabled:cursor-not-allowed"
          >
            <PackagePlus className="w-4 h-4" />
            Generate Reorder PO ({selectedProducts.length})
          </button>
        </div>

        {displayed.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <AlertTriangle className="w-7 h-7 text-emerald-600 dark:text-emerald-400 mx-auto" />
            <div className="text-sm font-semibold text-slate-900 dark:text-white">
              No active alerts in this view
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              All products meet reorder safety levels and expiry windows.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/70 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-4 w-10">
                    <button
                      type="button"
                      onClick={toggleAll}
                      aria-label="Toggle select all"
                      className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                    >
                      {selectedIds.length === displayed.length && displayed.length > 0 ? (
                        <CheckSquare className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                  </th>
                  <th className="py-3 px-3 font-medium">Product & Department</th>
                  <th className="py-3 px-3 font-medium">Alert Reason</th>
                  <th className="py-3 px-3 font-medium">Preferred Supplier</th>
                  <th className="py-3 px-3 font-medium text-right">On Hand / Min</th>
                  <th className="py-3 px-3 font-medium text-right">Suggested Order</th>
                  <th className="py-3 px-4 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {displayed.map((p) => {
                  const isSelected = selectedIds.includes(p.id);
                  const out = p.stockQty <= 0;
                  const low = p.stockQty > 0 && p.stockQty <= p.minStockLevel;
                  const expired = isExpired(p.expiryDate);
                  const expSoon = !expired && isExpiringSoon(p.expiryDate, 45);
                  const suggestedQty = Math.max(p.minStockLevel * 2 - p.stockQty, 10);

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50">
                      <td className="py-3 px-4">
                        <button
                          type="button"
                          onClick={() => toggleSelect(p.id)}
                          className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-semibold text-slate-900 dark:text-slate-100">
                          {p.name}
                        </div>
                        <div className="text-slate-400 dark:text-slate-500 font-mono-num">
                          {p.sku} · {p.category}
                        </div>
                      </td>
                      <td className="py-3 px-3 space-y-0.5">
                        {out && (
                          <div className="text-red-700 dark:text-red-400 font-semibold">
                            Out of Stock
                          </div>
                        )}
                        {low && (
                          <div className="text-amber-700 dark:text-amber-400 font-semibold">
                            Low Stock
                          </div>
                        )}
                        {expired && (
                          <div className="inline-flex items-center gap-1 text-red-700 dark:text-red-400 font-semibold">
                            <Clock className="w-3 h-3" />
                            Expired {p.expiryDate}
                          </div>
                        )}
                        {expSoon && (
                          <div className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400 font-medium">
                            <Clock className="w-3 h-3" />
                            Expires {p.expiryDate}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3 text-slate-700 dark:text-slate-300">
                        {p.supplierName || 'Unassigned'}
                      </td>
                      <td className="py-3 px-3 text-right font-mono-num">
                        <span
                          className={
                            out
                              ? 'text-red-700 dark:text-red-400 font-bold'
                              : 'text-amber-700 dark:text-amber-400 font-bold'
                          }
                        >
                          {p.stockQty}
                        </span>{' '}
                        <span className="text-slate-400 dark:text-slate-500">
                          / {p.minStockLevel} {p.unit}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right font-mono-num">
                        <div className="font-semibold text-slate-900 dark:text-slate-100">
                          +{suggestedQty} {p.unit}
                        </div>
                        <div className="text-[11px] text-slate-400 dark:text-slate-500">
                          {formatCurrency(suggestedQty * p.costPrice, currency)}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => onBulkReorder([p])}
                          className="text-emerald-700 dark:text-emerald-400 hover:text-emerald-900 dark:hover:text-emerald-300 font-semibold whitespace-nowrap cursor-pointer"
                        >
                          Create PO
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
