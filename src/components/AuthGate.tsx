import React, { useState } from 'react';
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  Boxes,
  Moon,
  Pill,
  Receipt,
  ShoppingBasket,
  Sun,
  Wrench,
} from 'lucide-react';
import { usePOS } from '../context/POSContext';
import { useTheme } from '../context/ThemeContext';

export function AuthGate() {
  const { signInWithGoogle } = usePOS();
  const { isDark, toggleTheme } = useTheme();
  const [signingIn, setSigningIn] = useState(false);

  const handleLogin = async () => {
    setSigningIn(true);
    try {
      await signInWithGoogle();
    } finally {
      setSigningIn(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col transition-colors">
      {/* Clean 3-zone Top Bar */}
      <header className="w-full bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 lg:px-10 h-16 flex items-center justify-between gap-8">
        <span className="font-display text-lg font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap shrink-0">
          TradeLedger
        </span>
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600 dark:text-slate-300">
          <span className="whitespace-nowrap shrink-0">Sales Terminal</span>
          <span className="whitespace-nowrap shrink-0">Inventory Control</span>
          <span className="whitespace-nowrap shrink-0">Customer Khata</span>
          <span className="whitespace-nowrap shrink-0">Profit Analytics</span>
        </nav>
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          <button
            type="button"
            onClick={handleLogin}
            disabled={signingIn}
            className="px-4 py-2 text-sm font-medium text-white bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
          >
            {signingIn ? 'Signing in...' : 'Sign in with Google'}
          </button>
        </div>
      </header>

      {/* Main Split Workspace Welcome */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-6 lg:px-10 py-12 lg:py-20 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        <div className="lg:col-span-7 space-y-6">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>Grocery Stores</span>
            <span aria-hidden="true">·</span>
            <span>Pharmacies</span>
            <span aria-hidden="true">·</span>
            <span>Hardware Shops</span>
          </div>

          <h1 className="font-display text-4xl lg:text-5xl font-bold tracking-tight text-slate-900 dark:text-white leading-[1.12]">
            Fast billing, live stock control, and khata ledger in one terminal.
          </h1>

          <p className="text-base text-slate-600 dark:text-slate-300 leading-relaxed max-w-xl">
            Built for high-velocity retail counters. Ring up barcode bills in seconds, track credit balances and supplier payables, catch low-stock and expiring batches early, and monitor real net margins every day.
          </p>

          <div className="pt-2 flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={handleLogin}
              disabled={signingIn}
              className="inline-flex items-center gap-2.5 px-6 py-3 bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white text-sm font-semibold rounded-lg transition-colors cursor-pointer disabled:opacity-60"
            >
              <span>{signingIn ? 'Connecting workspace...' : 'Launch Your Store Workspace'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Cloud-synced to your private store database via Google Account
            </span>
          </div>

          {/* Built-for verticals strip */}
          <div className="pt-8 border-t border-slate-200 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-slate-900 dark:text-slate-100 font-semibold text-sm">
                <ShoppingBasket className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
                <span>Grocery & Supermart</span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Barcode checkout, weight/pack units, fast walk-in billing, and daily reorder lists.
              </p>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-slate-900 dark:text-slate-100 font-semibold text-sm">
                <Pill className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
                <span>Pharmacy & Medical</span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Batch numbers, expiry-soon warnings, strip pricing, and patient credit accounts.
              </p>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-slate-900 dark:text-slate-100 font-semibold text-sm">
                <Wrench className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
                <span>Hardware & Electrical</span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Contractor khata limits, supplier purchase orders, GST bills, and SKU margins.
              </p>
            </div>
          </div>
        </div>

        {/* Right Side Feature Specification Panel */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-7 space-y-6">
          <div className="border-b border-slate-100 dark:border-slate-800 pb-4">
            <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
              Complete Retail Operations Suite
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Every module syncs atomically with your inventory and financial books.
            </p>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            <div className="py-3.5 first:pt-0 flex items-start gap-3.5">
              <Receipt className="w-5 h-5 text-slate-700 dark:text-slate-300 mt-0.5 shrink-0" />
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  POS Sales Terminal & Print Receipts
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Instant barcode/SKU search, Cash/UPI/Card/Credit split payments, discounts, and printable thermal receipts.
                </p>
              </div>
            </div>

            <div className="py-3.5 flex items-start gap-3.5">
              <Boxes className="w-5 h-5 text-slate-700 dark:text-slate-300 mt-0.5 shrink-0" />
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Purchase Orders & Low Stock Alerts
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Receive supplier shipments into stock automatically and generate 1-click reorder POs for low-stock SKUs.
                </p>
              </div>
            </div>

            <div className="py-3.5 flex items-start gap-3.5">
              <BookOpen className="w-5 h-5 text-slate-700 dark:text-slate-300 mt-0.5 shrink-0" />
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Customer Khata & Supplier Payables
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Full debit/credit passbooks with running balances, credit limits, and partial payment settlements.
                </p>
              </div>
            </div>

            <div className="py-3.5 last:pb-0 flex items-start gap-3.5">
              <BarChart3 className="w-5 h-5 text-slate-700 dark:text-slate-300 mt-0.5 shrink-0" />
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Profit & Margin Reports
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Real-time COGS, gross profit, category profitability, payment mix, and CSV financial export.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
