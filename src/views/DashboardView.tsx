import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  Clock,
  Package,
  Plus,
  Receipt,
  RefreshCw,
  ShoppingCart,
  TrendingUp,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { usePOS } from '../context/POSContext';
import { useTheme } from '../context/ThemeContext';
import { VERTICAL_OPTIONS } from '../data/seedCatalogs';
import {
  daysAgoIsoDate,
  formatCompactCurrency,
  formatCurrency,
  isExpiringSoon,
  todayIsoDate,
} from '../lib/validation';
import type { NavSection, Product, StoreVertical } from '../types/pos';

interface DashboardViewProps {
  onNavigate: (section: NavSection) => void;
  onQuickReorder: (products: Product[]) => void;
}

export function DashboardView({ onNavigate, onQuickReorder }: DashboardViewProps) {
  const { store, products, customers, suppliers, sales, purchases, seedStoreData } = usePOS();
  const { isDark } = useTheme();
  const [seedingVertical, setSeedingVertical] = useState<StoreVertical | null>(null);

  const currency = store?.currencySymbol || '₹';
  const today = todayIsoDate();

  const metrics = useMemo(() => {
    const todaySales = sales.filter((s) => s.saleDate === today);
    const todayRevenue = todaySales.reduce((sum, s) => sum + s.totalAmount, 0);
    const todayProfit = todaySales.reduce((sum, s) => sum + s.grossProfit, 0);

    const totalRevenue = sales.reduce((sum, s) => sum + s.totalAmount, 0);
    const totalProfit = sales.reduce((sum, s) => sum + s.grossProfit, 0);
    const totalSubtotal = sales.reduce((sum, s) => sum + (s.subtotal - s.discountAmount), 0);
    const avgMargin = totalSubtotal > 0 ? (totalProfit / totalSubtotal) * 100 : 0;

    const activeProducts = products.filter((p) => p.status === 'active');
    const outOfStock = activeProducts.filter((p) => p.stockQty <= 0);
    const lowStock = activeProducts.filter((p) => p.stockQty > 0 && p.stockQty <= p.minStockLevel);
    const expiring = activeProducts.filter((p) => isExpiringSoon(p.expiryDate, 45));

    const inventoryValue = activeProducts.reduce((sum, p) => sum + p.costPrice * p.stockQty, 0);
    const customerReceivables = customers.reduce((sum, c) => sum + Math.max(0, c.balance), 0);
    const supplierPayables = suppliers.reduce((sum, s) => sum + Math.max(0, s.payableBalance), 0);
    const pendingPOs = purchases.filter((p) => p.status === 'ordered').length;

    return {
      todayCount: todaySales.length,
      todayRevenue,
      todayProfit,
      totalRevenue,
      totalProfit,
      avgMargin,
      activeCount: activeProducts.length,
      outOfStock,
      lowStock,
      expiring,
      inventoryValue,
      customerReceivables,
      supplierPayables,
      pendingPOs,
    };
  }, [sales, products, customers, suppliers, purchases, today]);

  const chartData = useMemo(() => {
    const days: { date: string; label: string; revenue: number; profit: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const iso = daysAgoIsoDate(i);
      const d = new Date(iso + 'T00:00:00');
      const label = d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric' });
      const daySales = sales.filter((s) => s.saleDate === iso);
      days.push({
        date: iso,
        label,
        revenue: Math.round(daySales.reduce((acc, s) => acc + s.totalAmount, 0)),
        profit: Math.round(daySales.reduce((acc, s) => acc + s.grossProfit, 0)),
      });
    }
    return days;
  }, [sales]);

  const paymentMix = useMemo(() => {
    const map: Record<string, { label: string; total: number; count: number }> = {
      cash: { label: 'Cash', total: 0, count: 0 },
      upi: { label: 'UPI / QR', total: 0, count: 0 },
      card: { label: 'Card', total: 0, count: 0 },
      credit: { label: 'Khata Credit', total: 0, count: 0 },
      split: { label: 'Split', total: 0, count: 0 },
    };
    for (const s of sales) {
      const slot = map[s.paymentMethod] || map.cash;
      slot.total += s.totalAmount;
      slot.count += 1;
    }
    const grand = Object.values(map).reduce((a, b) => a + b.total, 0) || 1;
    return Object.values(map)
      .filter((m) => m.count > 0)
      .sort((a, b) => b.total - a.total)
      .map((m) => ({ ...m, pct: Math.round((m.total / grand) * 100) }));
  }, [sales]);

  const urgentStockItems = useMemo(() => {
    return [...metrics.outOfStock, ...metrics.lowStock].slice(0, 6);
  }, [metrics.outOfStock, metrics.lowStock]);

  const handleSeed = async (vertical: StoreVertical) => {
    setSeedingVertical(vertical);
    try {
      await seedStoreData(vertical);
    } finally {
      setSeedingVertical(null);
    }
  };

  const chartGridColor = isDark ? '#1e293b' : '#e2e8f0';
  const chartTickColor = isDark ? '#94a3b8' : '#64748b';
  const revenueStroke = isDark ? '#e2e8f0' : '#0f172a';
  const profitStroke = isDark ? '#10b981' : '#059669';

  return (
    <div className="space-y-6">
      {/* First-Time Store Setup Banner (Inline, non-blocking) */}
      {products.length === 0 && (
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-5 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                Initialize your store catalog in one click
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                Choose a retail preset to populate realistic SKUs, suppliers, customer khata accounts, and 7-day sales history—or add your first item manually.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('inventory')}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Add Manually
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-5">
            {VERTICAL_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                disabled={seedingVertical !== null}
                onClick={() => handleSeed(opt.id)}
                className="text-left p-4 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-emerald-600 dark:hover:border-emerald-500 hover:bg-emerald-50/40 dark:hover:bg-emerald-950/40 transition-colors cursor-pointer disabled:opacity-50"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {opt.label}
                  </span>
                  {seedingVertical === opt.id ? (
                    <RefreshCw className="w-4 h-4 text-emerald-700 dark:text-emerald-400 animate-spin shrink-0" />
                  ) : (
                    <ArrowUpRight className="w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0" />
                  )}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
                  {opt.subtitle}
                </p>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Primary 4-Column KPI Strip */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>Total Revenue</span>
            <Receipt className="w-4 h-4 text-slate-400 dark:text-slate-500" />
          </div>
          <div className="mt-2 font-mono-num text-2xl font-bold text-slate-900 dark:text-white">
            {formatCurrency(metrics.totalRevenue, currency)}
          </div>
          <div className="mt-2 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span className="text-emerald-700 dark:text-emerald-400 font-medium font-mono-num">
              Today {formatCurrency(metrics.todayRevenue, currency)}
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono-num">{metrics.todayCount} bills</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>Gross Profit</span>
            <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="mt-2 font-mono-num text-2xl font-bold text-slate-900 dark:text-white">
            {formatCurrency(metrics.totalProfit, currency)}
          </div>
          <div className="mt-2 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span className="text-emerald-700 dark:text-emerald-400 font-medium font-mono-num">
              {metrics.avgMargin.toFixed(1)}% avg margin
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono-num">{sales.length} invoices</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>Inventory & Stock Alerts</span>
            <Package className="w-4 h-4 text-slate-400 dark:text-slate-500" />
          </div>
          <div className="mt-2 font-mono-num text-2xl font-bold text-slate-900 dark:text-white">
            {formatCompactCurrency(metrics.inventoryValue, currency)}
          </div>
          <div className="mt-2 flex items-center gap-2 text-xs">
            <span
              className={
                metrics.outOfStock.length + metrics.lowStock.length > 0
                  ? 'text-amber-700 dark:text-amber-400 font-medium font-mono-num'
                  : 'text-emerald-700 dark:text-emerald-400 font-medium'
              }
            >
              {metrics.outOfStock.length} out · {metrics.lowStock.length} low
            </span>
            <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">
              ·
            </span>
            <span className="text-slate-500 dark:text-slate-400 font-mono-num">
              {metrics.activeCount} SKUs
            </span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>Khata Receivables / Payables</span>
            <BarChart3 className="w-4 h-4 text-slate-400 dark:text-slate-500" />
          </div>
          <div className="mt-2 font-mono-num text-2xl font-bold text-slate-900 dark:text-white">
            {formatCurrency(metrics.customerReceivables, currency)}
          </div>
          <div className="mt-2 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span className="text-amber-700 dark:text-amber-400 font-medium font-mono-num">
              Payable {formatCurrency(metrics.supplierPayables, currency)}
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono-num">{metrics.pendingPOs} open POs</span>
          </div>
        </div>
      </section>

      {/* Revenue Chart + Payment Mix Split */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 flex flex-col">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
            <div>
              <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
                7-Day Sales & Gross Profit Trend
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Daily invoiced revenue compared against net product margin
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('reports')}
              className="text-xs font-medium text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 whitespace-nowrap shrink-0 cursor-pointer"
            >
              Open Profit Reports →
            </button>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={revenueStroke} stopOpacity={isDark ? 0.16 : 0.12} />
                    <stop offset="95%" stopColor={revenueStroke} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="profitFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={profitStroke} stopOpacity={0.25} />
                    <stop offset="95%" stopColor={profitStroke} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={chartGridColor} vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 12, fill: chartTickColor }}
                  axisLine={{ stroke: chartGridColor }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: chartTickColor }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => formatCompactCurrency(Number(v), currency)}
                  width={62}
                />
                <Tooltip
                  formatter={(value: unknown, name: unknown) => [
                    formatCurrency(Number(value ?? 0), currency),
                    name === 'revenue' ? 'Revenue' : 'Gross Profit',
                  ]}
                  contentStyle={{
                    backgroundColor: isDark ? '#0f172a' : '#ffffff',
                    borderRadius: '8px',
                    border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                    color: isDark ? '#f1f5f9' : '#0f172a',
                    fontSize: '12px',
                    boxShadow: 'none',
                  }}
                  labelStyle={{ color: isDark ? '#cbd5e1' : '#334155', fontWeight: 600 }}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke={revenueStroke}
                  strokeWidth={2}
                  fill="url(#revFill)"
                />
                <Area
                  type="monotone"
                  dataKey="profit"
                  stroke={profitStroke}
                  strokeWidth={2}
                  fill="url(#profitFill)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="lg:col-span-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 flex flex-col justify-between">
          <div>
            <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
              Payment Collections Mix
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Tender split across counter invoices
            </p>

            {paymentMix.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-500 dark:text-slate-400">
                Complete a sale on the POS Terminal to see payment distribution.
              </div>
            ) : (
              <div className="mt-5 space-y-4">
                {paymentMix.map((item) => (
                  <div key={item.label} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-700 dark:text-slate-300">
                        {item.label}
                      </span>
                      <span className="font-mono-num text-slate-900 dark:text-slate-100 font-semibold">
                        {formatCurrency(item.total, currency)}{' '}
                        <span className="text-slate-400 dark:text-slate-500 font-normal">
                          ({item.pct}%)
                        </span>
                      </span>
                    </div>
                    <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-600 dark:bg-emerald-500 rounded-full"
                        style={{ width: `${Math.max(4, item.pct)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-5 mt-5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {metrics.expiring.length > 0 ? (
                <span className="inline-flex items-center gap-1.5 text-amber-700 dark:text-amber-400 font-medium">
                  <Clock className="w-3.5 h-3.5" />
                  {metrics.expiring.length} batch expiring within 45d
                </span>
              ) : (
                <span>All pharmacy & grocery batches healthy</span>
              )}
            </div>
            <button
              type="button"
              onClick={() => onNavigate('sales')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <ShoppingCart className="w-3.5 h-3.5" />
              New Bill
            </button>
          </div>
        </div>
      </section>

      {/* Bottom Operational Tables: Low Stock Alerts + Recent Sales */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <h2 className="font-display text-sm font-bold text-slate-900 dark:text-white">
                Urgent Restock Alerts
              </h2>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('alerts')}
              className="text-xs font-medium text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 whitespace-nowrap shrink-0 cursor-pointer"
            >
              View All ({metrics.outOfStock.length + metrics.lowStock.length}) →
            </button>
          </div>

          {urgentStockItems.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
              All active SKUs are above minimum reorder thresholds.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/70 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-2.5 px-4 font-medium">Product</th>
                    <th className="py-2.5 px-3 font-medium text-right">Stock</th>
                    <th className="py-2.5 px-3 font-medium text-right">Min</th>
                    <th className="py-2.5 px-4 font-medium text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {urgentStockItems.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50">
                      <td className="py-2.5 px-4">
                        <div className="font-medium text-slate-900 dark:text-slate-100 truncate max-w-[200px]">
                          {p.name}
                        </div>
                        <div className="text-slate-400 dark:text-slate-500 font-mono-num">
                          {p.sku} · {p.category}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono-num font-semibold">
                        <span
                          className={
                            p.stockQty <= 0
                              ? 'text-red-700 dark:text-red-400'
                              : 'text-amber-700 dark:text-amber-400'
                          }
                        >
                          {p.stockQty} {p.unit}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono-num text-slate-500 dark:text-slate-400">
                        {p.minStockLevel}
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => onQuickReorder([p])}
                          className="text-emerald-700 dark:text-emerald-400 hover:text-emerald-900 dark:hover:text-emerald-300 font-semibold whitespace-nowrap cursor-pointer"
                        >
                          Reorder
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="lg:col-span-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
            <h2 className="font-display text-sm font-bold text-slate-900 dark:text-white">
              Recent Counter Invoices
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('sales')}
              className="text-xs font-medium text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 whitespace-nowrap shrink-0 cursor-pointer"
            >
              Open Terminal →
            </button>
          </div>

          {sales.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
              No sales recorded yet. Open the Sales Terminal to create your first bill.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/70 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-2.5 px-4 font-medium">Invoice</th>
                    <th className="py-2.5 px-3 font-medium">Customer</th>
                    <th className="py-2.5 px-3 font-medium">Status</th>
                    <th className="py-2.5 px-4 font-medium text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {sales.slice(0, 6).map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50">
                      <td className="py-2.5 px-4">
                        <div className="font-mono-num font-semibold text-slate-900 dark:text-slate-100">
                          {s.invoiceNumber}
                        </div>
                        <div className="text-slate-400 dark:text-slate-500 font-mono-num">
                          {s.saleDate}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300 truncate max-w-[150px]">
                        {s.customerName}
                      </td>
                      <td className="py-2.5 px-3">
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
                            ? 'Partial Due'
                            : 'Credit Khata'}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono-num font-semibold text-slate-900 dark:text-slate-100">
                        {formatCurrency(s.totalAmount, currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
