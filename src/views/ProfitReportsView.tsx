import React, { useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { usePOS } from '../context/POSContext';
import { useTheme } from '../context/ThemeContext';
import {
  daysAgoIsoDate,
  formatCompactCurrency,
  formatCurrency,
  todayIsoDate,
} from '../lib/validation';

type RangeKey = 'today' | '7d' | '30d' | 'all';

export function ProfitReportsView() {
  const { store, sales } = usePOS();
  const { isDark } = useTheme();
  const currency = store?.currencySymbol || '₹';
  const [range, setRange] = useState<RangeKey>('30d');

  const filteredSales = useMemo(() => {
    const today = todayIsoDate();
    if (range === 'all') return sales;
    const minDate =
      range === 'today' ? today : range === '7d' ? daysAgoIsoDate(6) : daysAgoIsoDate(29);
    return sales.filter((s) => s.saleDate >= minDate);
  }, [sales, range]);

  const kpis = useMemo(() => {
    const revenue = filteredSales.reduce((s, x) => s + x.totalAmount, 0);
    const netSales = filteredSales.reduce((s, x) => s + (x.subtotal - x.discountAmount), 0);
    const cogs = filteredSales.reduce((s, x) => s + x.totalCost, 0);
    const grossProfit = filteredSales.reduce((s, x) => s + x.grossProfit, 0);
    const taxCollected = filteredSales.reduce((s, x) => s + x.taxAmount, 0);
    const discounts = filteredSales.reduce((s, x) => s + x.discountAmount, 0);
    const marginPct = netSales > 0 ? (grossProfit / netSales) * 100 : 0;
    const avgBasket = filteredSales.length > 0 ? revenue / filteredSales.length : 0;
    return {
      revenue,
      netSales,
      cogs,
      grossProfit,
      taxCollected,
      discounts,
      marginPct,
      avgBasket,
    };
  }, [filteredSales]);

  const dailySeries = useMemo(() => {
    const map = new Map<string, { date: string; revenue: number; cost: number; profit: number }>();
    for (const s of filteredSales) {
      const slot = map.get(s.saleDate) ?? { date: s.saleDate, revenue: 0, cost: 0, profit: 0 };
      slot.revenue += s.totalAmount;
      slot.cost += s.totalCost;
      slot.profit += s.grossProfit;
      map.set(s.saleDate, slot);
    }
    return Array.from(map.values())
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((row) => ({
        ...row,
        label: row.date.slice(5),
        revenue: Math.round(row.revenue),
        cost: Math.round(row.cost),
        profit: Math.round(row.profit),
      }));
  }, [filteredSales]);

  const categoryBreakdown = useMemo(() => {
    const map = new Map<
      string,
      { category: string; units: number; revenue: number; cost: number; profit: number }
    >();
    for (const sale of filteredSales) {
      for (const item of sale.items) {
        const cat = item.category || 'Uncategorized';
        const slot = map.get(cat) ?? { category: cat, units: 0, revenue: 0, cost: 0, profit: 0 };
        const rev = item.unitPrice * item.qty;
        const cost = item.costPrice * item.qty;
        slot.units += item.qty;
        slot.revenue += rev;
        slot.cost += cost;
        slot.profit += rev - cost;
        map.set(cat, slot);
      }
    }
    return Array.from(map.values())
      .map((c) => ({
        ...c,
        margin: c.revenue > 0 ? (c.profit / c.revenue) * 100 : 0,
      }))
      .sort((a, b) => b.profit - a.profit);
  }, [filteredSales]);

  const topSkus = useMemo(() => {
    const map = new Map<
      string,
      { sku: string; name: string; units: number; revenue: number; cost: number; profit: number }
    >();
    for (const sale of filteredSales) {
      for (const item of sale.items) {
        const key = item.productId || item.sku;
        const slot = map.get(key) ?? {
          sku: item.sku,
          name: item.name,
          units: 0,
          revenue: 0,
          cost: 0,
          profit: 0,
        };
        const rev = item.unitPrice * item.qty;
        const cost = item.costPrice * item.qty;
        slot.units += item.qty;
        slot.revenue += rev;
        slot.cost += cost;
        slot.profit += rev - cost;
        map.set(key, slot);
      }
    }
    return Array.from(map.values())
      .map((row) => ({
        ...row,
        margin: row.revenue > 0 ? (row.profit / row.revenue) * 100 : 0,
      }))
      .sort((a, b) => b.profit - a.profit)
      .slice(0, 10);
  }, [filteredSales]);

  const handleExportCsv = () => {
    const headers = [
      'Invoice',
      'Date',
      'Customer',
      'PaymentMethod',
      'Subtotal',
      'Discount',
      'Tax',
      'Total',
      'COGS',
      'GrossProfit',
    ];
    const rows = filteredSales.map((s) => [
      s.invoiceNumber,
      s.saleDate,
      `"${s.customerName.replace(/"/g, '""')}"`,
      s.paymentMethod,
      s.subtotal.toFixed(2),
      s.discountAmount.toFixed(2),
      s.taxAmount.toFixed(2),
      s.totalAmount.toFixed(2),
      s.totalCost.toFixed(2),
      s.grossProfit.toFixed(2),
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `profit-report-${range}-${todayIsoDate()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const chartGridColor = isDark ? '#1e293b' : '#e2e8f0';
  const chartTickColor = isDark ? '#94a3b8' : '#64748b';

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="inline-flex items-center p-1 bg-slate-200/70 dark:bg-slate-800 rounded-lg">
          {(
            [
              ['today', 'Today'],
              ['7d', 'Last 7 Days'],
              ['30d', 'Last 30 Days'],
              ['all', 'All Time'],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setRange(k)}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-md whitespace-nowrap shrink-0 cursor-pointer ${
                range === k
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
          onClick={handleExportCsv}
          disabled={filteredSales.length === 0}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 dark:bg-emerald-600 hover:bg-slate-800 dark:hover:bg-emerald-500 disabled:bg-slate-300 dark:disabled:bg-slate-700 disabled:text-slate-500 dark:disabled:text-slate-400 text-white text-xs font-semibold rounded-lg whitespace-nowrap shrink-0 cursor-pointer disabled:cursor-not-allowed"
        >
          <Download className="w-3.5 h-3.5" />
          Download CSV
        </button>
      </div>

      {/* P&L KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Gross Revenue</div>
          <div className="mt-1.5 font-mono-num text-2xl font-bold text-slate-900 dark:text-white">
            {formatCurrency(kpis.revenue, currency)}
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400 font-mono-num">
            {filteredSales.length} invoices · Avg {formatCurrency(kpis.avgBasket, currency)}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Cost of Goods Sold (COGS)
          </div>
          <div className="mt-1.5 font-mono-num text-2xl font-bold text-slate-900 dark:text-white">
            {formatCurrency(kpis.cogs, currency)}
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400 font-mono-num">
            Discounts {formatCurrency(kpis.discounts, currency)}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Net Gross Profit
          </div>
          <div className="mt-1.5 font-mono-num text-2xl font-bold text-emerald-700 dark:text-emerald-400">
            {formatCurrency(kpis.grossProfit, currency)}
          </div>
          <div className="mt-1 text-xs text-emerald-700 dark:text-emerald-400 font-mono-num font-medium">
            {kpis.marginPct.toFixed(1)}% gross margin
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            GST / Tax Collected
          </div>
          <div className="mt-1.5 font-mono-num text-2xl font-bold text-slate-900 dark:text-white">
            {formatCurrency(kpis.taxCollected, currency)}
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Excluded from gross profit
          </div>
        </div>
      </div>

      {/* Daily Revenue vs Cost vs Profit Bar Chart */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6">
        <div className="mb-5">
          <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
            Daily Revenue, Cost & Profit Comparison
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Track margin consistency day by day across counter bills
          </p>
        </div>

        {dailySeries.length === 0 ? (
          <div className="py-16 text-center text-sm text-slate-500 dark:text-slate-400">
            No sales recorded in the selected date window.
          </div>
        ) : (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailySeries} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
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
                    String(name),
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
                <Legend wrapperStyle={{ fontSize: '12px', color: chartTickColor }} />
                <Bar
                  dataKey="revenue"
                  name="Revenue"
                  fill={isDark ? '#e2e8f0' : '#0f172a'}
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="cost"
                  name="COGS"
                  fill={isDark ? '#64748b' : '#94a3b8'}
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="profit"
                  name="Gross Profit"
                  fill={isDark ? '#10b981' : '#059669'}
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Category & Top SKU Profitability Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800">
            <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white">
              Profitability by Category
            </h3>
          </div>
          {categoryBreakdown.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500 dark:text-slate-400">
              No category data available.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/70 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-2.5 px-4 font-medium">Category</th>
                    <th className="py-2.5 px-3 font-medium text-right">Units</th>
                    <th className="py-2.5 px-3 font-medium text-right">Sales</th>
                    <th className="py-2.5 px-3 font-medium text-right">Profit</th>
                    <th className="py-2.5 px-4 font-medium text-right">Margin</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {categoryBreakdown.map((c) => (
                    <tr
                      key={c.category}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50"
                    >
                      <td className="py-2.5 px-4 font-medium text-slate-900 dark:text-slate-100">
                        {c.category}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono-num text-slate-600 dark:text-slate-400">
                        {c.units}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono-num text-slate-700 dark:text-slate-300">
                        {formatCurrency(c.revenue, currency)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono-num font-semibold text-emerald-700 dark:text-emerald-400">
                        {formatCurrency(c.profit, currency)}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono-num text-slate-700 dark:text-slate-300">
                        {c.margin.toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="lg:col-span-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800">
            <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white">
              Top 10 Most Profitable SKUs
            </h3>
          </div>
          {topSkus.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500 dark:text-slate-400">
              No SKU sales recorded.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/70 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-2.5 px-4 font-medium">Product</th>
                    <th className="py-2.5 px-3 font-medium text-right">Sold</th>
                    <th className="py-2.5 px-3 font-medium text-right">Profit</th>
                    <th className="py-2.5 px-4 font-medium text-right">Margin</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {topSkus.map((item) => (
                    <tr
                      key={item.sku}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50"
                    >
                      <td className="py-2.5 px-4">
                        <div className="font-medium text-slate-900 dark:text-slate-100 truncate max-w-[200px]">
                          {item.name}
                        </div>
                        <div className="text-[11px] text-slate-400 dark:text-slate-500 font-mono-num">
                          {item.sku}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono-num text-slate-600 dark:text-slate-400">
                        {item.units}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono-num font-semibold text-emerald-700 dark:text-emerald-400">
                        {formatCurrency(item.profit, currency)}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono-num text-slate-700 dark:text-slate-300">
                        {item.margin.toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
