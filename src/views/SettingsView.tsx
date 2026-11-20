import React, { useEffect, useState } from 'react';
import { Moon, RefreshCw, Save, Sun } from 'lucide-react';
import { usePOS } from '../context/POSContext';
import { useTheme } from '../context/ThemeContext';
import { VERTICAL_OPTIONS } from '../data/seedCatalogs';
import type { StoreVertical } from '../types/pos';

const INPUT_CLASS =
  'w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-lg focus:outline-none focus:bg-white dark:focus:bg-slate-800 focus:border-emerald-600 dark:focus:border-emerald-500';

export function SettingsView() {
  const { store, updateStoreProfile, seedStoreData } = usePOS();
  const { theme, setTheme } = useTheme();

  const [storeName, setStoreName] = useState(store?.storeName || '');
  const [vertical, setVertical] = useState<StoreVertical>(store?.vertical || 'mixed');
  const [currencySymbol, setCurrencySymbol] = useState(store?.currencySymbol || '₹');
  const [defaultTaxRate, setDefaultTaxRate] = useState(store?.defaultTaxRate ?? 5);
  const [phone, setPhone] = useState(store?.phone || '');
  const [taxId, setTaxId] = useState(store?.taxId || '');
  const [address, setAddress] = useState(store?.address || '');
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState<StoreVertical | null>(null);

  useEffect(() => {
    if (!store) return;
    setStoreName(store.storeName);
    setVertical(store.vertical);
    setCurrencySymbol(store.currencySymbol);
    setDefaultTaxRate(store.defaultTaxRate);
    setPhone(store.phone);
    setTaxId(store.taxId);
    setAddress(store.address);
  }, [store]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateStoreProfile({
        storeName,
        vertical,
        currencySymbol,
        defaultTaxRate,
        phone,
        taxId,
        address,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleLoadSample = async (v: StoreVertical) => {
    setSeeding(v);
    try {
      await seedStoreData(v);
    } finally {
      setSeeding(null);
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      {/* Appearance / Theme Switcher Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
        <div>
          <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
            Interface Appearance
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Choose between bright counter daylight mode or low-glare dark mode for evening shifts.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setTheme('light')}
            className={`text-left p-4 rounded-lg border transition-colors flex items-center gap-3 cursor-pointer ${
              theme === 'light'
                ? 'border-emerald-600 bg-emerald-50/40 dark:bg-emerald-950/40'
                : 'border-slate-200 dark:border-slate-800 hover:border-slate-400 dark:hover:border-slate-600'
            }`}
          >
            <Sun className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
            <div>
              <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                Light Mode
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Crisp white workspace with dark slate navigation rail
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setTheme('dark')}
            className={`text-left p-4 rounded-lg border transition-colors flex items-center gap-3 cursor-pointer ${
              theme === 'dark'
                ? 'border-emerald-500 bg-emerald-950/40'
                : 'border-slate-200 dark:border-slate-800 hover:border-slate-400 dark:hover:border-slate-600'
            }`}
          >
            <Moon className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <div>
              <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                Dark Mode
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Deep slate surfaces with high-contrast tabular figures
              </div>
            </div>
          </button>
        </div>
      </div>

      {/* Store Profile Form */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
            Store Profile & Tax Receipt Settings
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Printed on POS invoices and used across currency & GST calculations
          </p>
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Store / Business Name
              </label>
              <input
                required
                type="text"
                maxLength={100}
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                className={INPUT_CLASS}
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Store Type
              </label>
              <select
                value={vertical}
                onChange={(e) => setVertical(e.target.value as StoreVertical)}
                className={INPUT_CLASS}
              >
                <option value="mixed">Multi-Department (Grocery + Pharmacy + Hardware)</option>
                <option value="grocery">Grocery & Supermart</option>
                <option value="pharmacy">Pharmacy & Medical Store</option>
                <option value="hardware">Hardware & Building Supply</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Currency
                </label>
                <select
                  value={currencySymbol}
                  onChange={(e) => setCurrencySymbol(e.target.value)}
                  className={`${INPUT_CLASS} font-mono-num`}
                >
                  <option value="₹">₹ (INR)</option>
                  <option value="Rs ">Rs (PKR/NPR)</option>
                  <option value="$">$ (USD)</option>
                  <option value="£">£ (GBP)</option>
                  <option value="€">€ (EUR)</option>
                </select>
              </div>
              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Default Tax (%)
                </label>
                <input
                  type="number"
                  min={0}
                  max={40}
                  step="0.5"
                  value={defaultTaxRate}
                  onChange={(e) => setDefaultTaxRate(Number(e.target.value))}
                  className={`${INPUT_CLASS} font-mono-num`}
                />
              </div>
            </div>

            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Store Phone
              </label>
              <input
                type="text"
                maxLength={30}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98..."
                className={`${INPUT_CLASS} font-mono-num`}
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                GSTIN / Tax Registration
              </label>
              <input
                type="text"
                maxLength={40}
                value={taxId}
                onChange={(e) => setTaxId(e.target.value)}
                placeholder="27AABCU9603R1ZM"
                className={`${INPUT_CLASS} font-mono-num`}
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Receipt Address
              </label>
              <input
                type="text"
                maxLength={240}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Shop #, Street, City, PIN"
                className={INPUT_CLASS}
              />
            </div>
          </div>

          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white font-semibold rounded-lg cursor-pointer disabled:opacity-60"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </form>
      </div>

      {/* Add Additional Vertical Demo Catalog */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
        <div>
          <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white">
            Load Industry Sample Catalog
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Append curated SKUs, vendors, customer khata balances, and sample bills for any store type.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {VERTICAL_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              disabled={seeding !== null}
              onClick={() => handleLoadSample(opt.id)}
              className="text-left p-3.5 border border-slate-200 dark:border-slate-800 hover:border-emerald-600 dark:hover:border-emerald-500 hover:bg-emerald-50/40 dark:hover:bg-emerald-950/30 rounded-lg transition-colors flex items-center justify-between gap-3 cursor-pointer disabled:opacity-50"
            >
              <div>
                <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                  {opt.label}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  {opt.subtitle}
                </div>
              </div>
              {seeding === opt.id && (
                <RefreshCw className="w-4 h-4 text-emerald-700 dark:text-emerald-400 animate-spin shrink-0" />
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
