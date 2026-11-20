/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  BookOpen,
  Boxes,
  Building2,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  PackagePlus,
  Receipt,
  Settings,
  ShoppingCart,
  Sun,
  X,
} from 'lucide-react';
import { AuthGate } from './components/AuthGate';
import { ErrorBoundary } from './components/ErrorBoundary';
import { POSProvider, usePOS } from './context/POSContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { isExpiringSoon } from './lib/validation';
import type { NavSection, Product } from './types/pos';
import { CustomerLedgerView } from './views/CustomerLedgerView';
import { DashboardView } from './views/DashboardView';
import { InventoryView } from './views/InventoryView';
import { LowStockAlertsView } from './views/LowStockAlertsView';
import { ProfitReportsView } from './views/ProfitReportsView';
import { PurchasesView } from './views/PurchasesView';
import { SalesTerminalView } from './views/SalesTerminalView';
import { SettingsView } from './views/SettingsView';
import { SupplierManagementView } from './views/SupplierManagementView';

const NAV_ITEMS: {
  id: NavSection;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'sales', label: 'Sales Terminal', icon: ShoppingCart },
  { id: 'inventory', label: 'Inventory', icon: Boxes },
  { id: 'purchases', label: 'Purchases', icon: PackagePlus },
  { id: 'customers', label: 'Customer Ledger', icon: BookOpen },
  { id: 'suppliers', label: 'Suppliers', icon: Building2 },
  { id: 'reports', label: 'Profit Reports', icon: BarChart3 },
  { id: 'alerts', label: 'Low Stock Alerts', icon: AlertTriangle },
  { id: 'settings', label: 'Store Settings', icon: Settings },
];

function WorkspaceShell() {
  const { user, authLoading, dataLoading, store, products, toasts, dismissToast, logout } =
    usePOS();
  const { isDark, toggleTheme } = useTheme();

  const [section, setSection] = useState<NavSection>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [reorderPrefill, setReorderPrefill] = useState<Product[]>([]);

  const alertCount = useMemo(() => {
    const active = products.filter((p) => p.status === 'active');
    return active.filter(
      (p) => p.stockQty <= p.minStockLevel || isExpiringSoon(p.expiryDate, 45)
    ).length;
  }, [products]);

  const handleQuickReorder = (items: Product[]) => {
    setReorderPrefill(items);
    setSection('purchases');
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="text-sm font-medium text-slate-500 dark:text-slate-400">
          Loading workspace...
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthGate />;
  }

  const currentNav = NAV_ITEMS.find((n) => n.id === section) ?? NAV_ITEMS[0];

  const handleSelectNav = (id: NavSection) => {
    setSection(id);
    setMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex transition-colors">
      {/* Mobile Sidebar Backdrop */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/60 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Left Dark Slate Navigation Rail */}
      <aside
        className={`fixed lg:sticky top-0 left-0 z-50 h-screen w-64 bg-slate-900 dark:bg-slate-950 border-r border-slate-800 text-slate-100 flex flex-col shrink-0 transition-transform duration-200 no-print ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="h-16 px-5 border-b border-slate-800 flex items-center justify-between">
          <button
            type="button"
            onClick={() => handleSelectNav('dashboard')}
            className="font-display text-lg font-bold tracking-tight text-white whitespace-nowrap cursor-pointer"
          >
            TradeLedger
          </button>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            className="lg:hidden text-slate-400 hover:text-white cursor-pointer"
            aria-label="Close navigation"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = section === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelectNav(item.id)}
                className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                  active
                    ? 'bg-emerald-700 dark:bg-emerald-600 text-white'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <span className="flex items-center gap-3 min-w-0">
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate whitespace-nowrap">{item.label}</span>
                </span>
                {item.id === 'alerts' && alertCount > 0 && (
                  <span
                    className={`font-mono-num text-xs font-semibold shrink-0 ${
                      active ? 'text-emerald-100' : 'text-amber-400'
                    }`}
                  >
                    {alertCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-800 space-y-3">
          <div className="min-w-0">
            <div className="text-xs font-semibold text-white truncate">
              {store?.storeName || user.displayName || 'Merchant Store'}
            </div>
            <div className="text-[11px] text-slate-400 truncate">{user.email}</div>
          </div>
          <button
            type="button"
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Contextual Top Bar */}
        <header className="sticky top-0 z-30 h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-6 no-print transition-colors">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 -ml-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white cursor-pointer"
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 text-sm min-w-0">
              <span className="text-slate-400 dark:text-slate-500 hidden sm:inline truncate max-w-[180px]">
                {store?.storeName || 'TradeLedger'}
              </span>
              <span className="text-slate-300 dark:text-slate-700 hidden sm:inline" aria-hidden="true">
                /
              </span>
              <h1 className="font-display font-bold text-slate-900 dark:text-white whitespace-nowrap truncate">
                {currentNav.label}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{isDark ? 'Light' : 'Dark'}</span>
            </button>

            {section !== 'sales' ? (
              <button
                type="button"
                onClick={() => setSection('sales')}
                className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Receipt className="w-3.5 h-3.5" />
                Open Sales Counter
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setSection('dashboard')}
                className="inline-flex items-center gap-2 px-3.5 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Back to Dashboard
              </button>
            )}
          </div>
        </header>

        {/* Active View Viewport */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1600px] w-full mx-auto">
          {dataLoading && !store ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                {[0, 1, 2, 3].map((k) => (
                  <div
                    key={k}
                    className="h-28 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl animate-pulse"
                  />
                ))}
              </div>
              <div className="h-72 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl animate-pulse" />
            </div>
          ) : (
            <>
              {section === 'dashboard' && (
                <DashboardView
                  onNavigate={setSection}
                  onQuickReorder={handleQuickReorder}
                />
              )}
              {section === 'sales' && <SalesTerminalView />}
              {section === 'inventory' && <InventoryView />}
              {section === 'purchases' && (
                <PurchasesView
                  prefillProducts={reorderPrefill}
                  onClearPrefill={() => setReorderPrefill([])}
                />
              )}
              {section === 'customers' && <CustomerLedgerView />}
              {section === 'suppliers' && <SupplierManagementView />}
              {section === 'reports' && <ProfitReportsView />}
              {section === 'alerts' && (
                <LowStockAlertsView onBulkReorder={handleQuickReorder} />
              )}
              {section === 'settings' && <SettingsView />}
            </>
          )}
        </main>
      </div>

      {/* Toast Stack */}
      {toasts.length > 0 && (
        <div className="fixed bottom-5 right-5 z-50 space-y-2 max-w-sm w-full no-print">
          {toasts.map((t) => (
            <div
              key={t.id}
              className={`px-4 py-3 rounded-lg border text-xs font-medium flex items-center justify-between gap-3 bg-white dark:bg-slate-900 ${
                t.type === 'error'
                  ? 'border-red-300 dark:border-red-800 text-red-800 dark:text-red-300'
                  : t.type === 'success'
                  ? 'border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-300'
                  : 'border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200'
              }`}
            >
              <span>{t.message}</span>
              <button
                type="button"
                onClick={() => dismissToast(t.id)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 shrink-0 cursor-pointer"
                aria-label="Dismiss notification"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <ErrorBoundary>
        <POSProvider>
          <WorkspaceShell />
        </POSProvider>
      </ErrorBoundary>
    </ThemeProvider>
  );
}
