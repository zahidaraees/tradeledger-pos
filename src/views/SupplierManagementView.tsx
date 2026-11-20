import React, { useMemo, useState } from 'react';
import {
  ArrowUpRight,
  Building2,
  Edit2,
  Mail,
  Phone,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { usePOS, type CreateSupplierInput } from '../context/POSContext';
import { formatCurrency } from '../lib/validation';
import type { Supplier } from '../types/pos';

const EMPTY_SUP: CreateSupplierInput = {
  name: '',
  contactPerson: '',
  phone: '',
  email: '',
  address: '',
  taxId: '',
  category: '',
  paymentTerms: 'Net 15 Days',
};

const INPUT_CLASS =
  'w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-lg focus:outline-none focus:bg-white dark:focus:bg-slate-800 focus:border-emerald-600 dark:focus:border-emerald-500';

export function SupplierManagementView() {
  const {
    store,
    suppliers,
    purchases,
    ledgerEntries,
    addSupplier,
    updateSupplier,
    deleteSupplier,
    recordSupplierPayment,
  } = usePOS();
  const currency = store?.currencySymbol || '₹';

  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CreateSupplierInput>(EMPTY_SUP);
  const [saving, setSaving] = useState(false);

  const [payModalType, setPayModalType] = useState<'payment_made' | 'purchase_bill' | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState<'bank' | 'upi' | 'cash' | 'card' | 'credit'>('bank');
  const [payRef, setPayRef] = useState('');
  const [payNote, setPayNote] = useState('');
  const [posting, setPosting] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return suppliers;
    return suppliers.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.contactPerson.toLowerCase().includes(q) ||
        s.category.toLowerCase().includes(q) ||
        s.phone.toLowerCase().includes(q)
    );
  }, [suppliers, search]);

  const activeSupplier: Supplier | null = useMemo(() => {
    if (selectedId) {
      const found = suppliers.find((s) => s.id === selectedId);
      if (found) return found;
    }
    return filtered[0] ?? null;
  }, [suppliers, filtered, selectedId]);

  const supplierLedger = useMemo(() => {
    if (!activeSupplier) return [];
    return ledgerEntries.filter(
      (e) => e.partyType === 'supplier' && e.partyId === activeSupplier.id
    );
  }, [ledgerEntries, activeSupplier]);

  const supplierPOs = useMemo(() => {
    if (!activeSupplier) return [];
    return purchases.filter((p) => p.supplierId === activeSupplier.id);
  }, [purchases, activeSupplier]);

  const totals = useMemo(() => {
    const totalPayables = suppliers.reduce((s, x) => s + Math.max(0, x.payableBalance), 0);
    const totalSupplied = suppliers.reduce((s, x) => s + x.totalSupplied, 0);
    return { totalPayables, totalSupplied };
  }, [suppliers]);

  const openAdd = () => {
    setEditingId(null);
    setForm(EMPTY_SUP);
    setModalOpen(true);
  };

  const openEdit = (s: Supplier) => {
    setEditingId(s.id);
    setForm({
      name: s.name,
      contactPerson: s.contactPerson,
      phone: s.phone,
      email: s.email,
      address: s.address,
      taxId: s.taxId,
      category: s.category,
      paymentTerms: s.paymentTerms,
    });
    setModalOpen(true);
  };

  const handleSaveSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      if (editingId) {
        await updateSupplier(editingId, form);
      } else {
        const created = await addSupplier(form);
        if (created) setSelectedId(created.id);
      }
      setModalOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const handlePostEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSupplier || !payModalType) return;
    const amt = parseFloat(payAmount);
    if (!Number.isFinite(amt) || amt <= 0) return;

    setPosting(true);
    try {
      await recordSupplierPayment({
        supplierId: activeSupplier.id,
        entryType: payModalType,
        amount: amt,
        paymentMethod: payModalType === 'purchase_bill' ? 'credit' : payMethod,
        referenceNo: payRef,
        note:
          payNote ||
          (payModalType === 'payment_made' ? 'Supplier payable settlement' : 'Vendor bill entry'),
      });
      setPayModalType(null);
      setPayAmount('');
      setPayRef('');
      setPayNote('');
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Total Supplier Payables
          </div>
          <div className="mt-1.5 font-mono-num text-xl font-bold text-red-700 dark:text-red-400">
            {formatCurrency(totals.totalPayables, currency)}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Active Vendors & Distributors
          </div>
          <div className="mt-1.5 font-mono-num text-xl font-bold text-slate-900 dark:text-white">
            {suppliers.length}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Total Goods Supplied
          </div>
          <div className="mt-1.5 font-mono-num text-xl font-bold text-slate-900 dark:text-white">
            {formatCurrency(totals.totalSupplied, currency)}
          </div>
        </div>
      </div>

      {/* Master-Detail Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-sm font-bold text-slate-900 dark:text-white">
                Supplier Directory
              </h2>
              <button
                type="button"
                onClick={openAdd}
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Supplier
              </button>
            </div>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search vendor name, category, contact..."
                className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-lg focus:outline-none focus:bg-white dark:focus:bg-slate-800 focus:border-emerald-600 dark:focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[540px] overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500 dark:text-slate-400">
                No suppliers found. Add wholesale vendors to manage purchase orders and payables.
              </div>
            ) : (
              filtered.map((s) => {
                const isSelected = activeSupplier?.id === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSelectedId(s.id)}
                    className={`w-full text-left px-4 py-3.5 flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-slate-900 dark:bg-slate-800 text-white'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-900 dark:text-slate-100'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="font-semibold text-sm truncate">{s.name}</div>
                      <div
                        className={`text-xs mt-0.5 truncate ${
                          isSelected ? 'text-slate-300' : 'text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        {s.category} · {s.paymentTerms}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div
                        className={`font-mono-num text-sm font-bold ${
                          isSelected
                            ? s.payableBalance > 0
                              ? 'text-red-300'
                              : 'text-emerald-300'
                            : s.payableBalance > 0
                            ? 'text-red-700 dark:text-red-400'
                            : 'text-emerald-700 dark:text-emerald-400'
                        }`}
                      >
                        {formatCurrency(s.payableBalance, currency)}
                      </div>
                      <div className="text-[11px] text-slate-400 dark:text-slate-500">
                        {s.payableBalance > 0 ? 'Payable' : 'Clear'}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Supplier Detail & Ledger */}
        <div className="lg:col-span-7 space-y-5">
          {!activeSupplier ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-12 text-center space-y-2">
              <Building2 className="w-8 h-8 text-slate-300 dark:text-slate-700 mx-auto" />
              <div className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Select a Supplier
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Inspect vendor contact details, GSTIN, payables balance, and purchase order history.
              </p>
            </div>
          ) : (
            <>
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                      {activeSupplier.name}
                    </h2>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-1">
                      <span>{activeSupplier.category}</span>
                      <span aria-hidden="true">·</span>
                      <span>Terms: {activeSupplier.paymentTerms}</span>
                      {activeSupplier.taxId && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono-num">GSTIN {activeSupplier.taxId}</span>
                        </>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 dark:text-slate-300 mt-2.5">
                      {activeSupplier.contactPerson && (
                        <span>Contact: {activeSupplier.contactPerson}</span>
                      )}
                      {activeSupplier.phone && (
                        <span className="inline-flex items-center gap-1 font-mono-num">
                          <Phone className="w-3 h-3 text-slate-400 dark:text-slate-500" />
                          {activeSupplier.phone}
                        </span>
                      )}
                      {activeSupplier.email && (
                        <span className="inline-flex items-center gap-1">
                          <Mail className="w-3 h-3 text-slate-400 dark:text-slate-500" />
                          {activeSupplier.email}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openEdit(activeSupplier)}
                      className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-700 rounded-lg cursor-pointer"
                      aria-label="Edit supplier"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        await deleteSupplier(activeSupplier.id);
                        setSelectedId(null);
                      }}
                      className="p-2 text-slate-400 dark:text-slate-500 hover:text-red-700 dark:hover:text-red-400 border border-slate-200 dark:border-slate-700 rounded-lg cursor-pointer"
                      aria-label="Delete supplier"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 py-4 border-y border-slate-100 dark:border-slate-800">
                  <div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      Outstanding Payable
                    </div>
                    <div
                      className={`font-mono-num text-xl font-bold mt-0.5 ${
                        activeSupplier.payableBalance > 0
                          ? 'text-red-700 dark:text-red-400'
                          : 'text-emerald-700 dark:text-emerald-400'
                      }`}
                    >
                      {formatCurrency(activeSupplier.payableBalance, currency)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      Total Volume Supplied
                    </div>
                    <div className="font-mono-num text-xl font-bold text-slate-900 dark:text-white mt-0.5">
                      {formatCurrency(activeSupplier.totalSupplied, currency)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      Purchase Orders
                    </div>
                    <div className="font-mono-num text-xl font-bold text-slate-900 dark:text-white mt-0.5">
                      {supplierPOs.length} POs
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setPayModalType('payment_made');
                      setPayAmount(
                        activeSupplier.payableBalance > 0
                          ? String(activeSupplier.payableBalance)
                          : ''
                      );
                      setPayMethod('bank');
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg cursor-pointer"
                  >
                    <ArrowUpRight className="w-4 h-4" />
                    Record Payout to Supplier
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPayModalType('purchase_bill');
                      setPayAmount('');
                      setPayMethod('credit');
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold rounded-lg cursor-pointer"
                  >
                    Log Manual Bill
                  </button>
                </div>
              </div>

              {/* Payables Ledger */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white">
                    Supplier Payables Statement
                  </h3>
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-mono-num">
                    {supplierLedger.length} entries
                  </span>
                </div>
                {supplierLedger.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-500 dark:text-slate-400">
                    No payable transactions logged yet for this supplier.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 dark:bg-slate-800/70 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                        <tr>
                          <th className="py-2.5 px-4 font-medium">Date & Ref</th>
                          <th className="py-2.5 px-3 font-medium">Description</th>
                          <th className="py-2.5 px-3 font-medium text-right">Amount</th>
                          <th className="py-2.5 px-4 font-medium text-right">Payable After</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {supplierLedger.map((entry) => {
                          const isPayout = entry.entryType === 'payment_made';
                          return (
                            <tr
                              key={entry.id}
                              className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50"
                            >
                              <td className="py-2.5 px-4 font-mono-num">
                                <div className="text-slate-900 dark:text-slate-100 font-medium">
                                  {entry.entryDate}
                                </div>
                                <div className="text-slate-400 dark:text-slate-500">
                                  {entry.referenceNo}
                                </div>
                              </td>
                              <td className="py-2.5 px-3">
                                <div
                                  className={
                                    isPayout
                                      ? 'text-emerald-700 dark:text-emerald-400 font-semibold'
                                      : 'text-red-700 dark:text-red-400 font-semibold'
                                  }
                                >
                                  {isPayout ? 'Payout Sent' : 'Purchase Bill'} ·{' '}
                                  <span className="uppercase font-mono-num font-normal text-slate-500 dark:text-slate-400">
                                    {entry.paymentMethod}
                                  </span>
                                </div>
                                {entry.note && (
                                  <div className="text-slate-500 dark:text-slate-400 mt-0.5">
                                    {entry.note}
                                  </div>
                                )}
                              </td>
                              <td
                                className={`py-2.5 px-3 text-right font-mono-num font-semibold ${
                                  isPayout
                                    ? 'text-emerald-700 dark:text-emerald-400'
                                    : 'text-red-700 dark:text-red-400'
                                }`}
                              >
                                {isPayout ? '-' : '+'}
                                {formatCurrency(entry.amount, currency)}
                              </td>
                              <td className="py-2.5 px-4 text-right font-mono-num font-semibold text-slate-900 dark:text-slate-100">
                                {formatCurrency(entry.balanceAfter, currency)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Add / Edit Supplier Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-xl w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
                {editingId ? 'Edit Supplier' : 'Add Wholesale Supplier'}
              </h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveSupplier} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Company / Agency Name *
                  </label>
                  <input
                    required
                    type="text"
                    maxLength={120}
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className={INPUT_CLASS}
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Contact Person
                  </label>
                  <input
                    type="text"
                    maxLength={100}
                    value={form.contactPerson}
                    onChange={(e) => setForm({ ...form, contactPerson: e.target.value })}
                    className={INPUT_CLASS}
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Category
                  </label>
                  <input
                    type="text"
                    maxLength={64}
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    placeholder="Grocery FMCG, Pharma, Electrical..."
                    className={INPUT_CLASS}
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Phone
                  </label>
                  <input
                    type="text"
                    maxLength={30}
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className={`${INPUT_CLASS} font-mono-num`}
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    maxLength={120}
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className={INPUT_CLASS}
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    GSTIN / Tax ID
                  </label>
                  <input
                    type="text"
                    maxLength={40}
                    value={form.taxId}
                    onChange={(e) => setForm({ ...form, taxId: e.target.value })}
                    className={`${INPUT_CLASS} font-mono-num`}
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Payment Terms
                  </label>
                  <input
                    type="text"
                    maxLength={64}
                    value={form.paymentTerms}
                    onChange={(e) => setForm({ ...form, paymentTerms: e.target.value })}
                    placeholder="Net 15 Days, Cash on Delivery..."
                    className={INPUT_CLASS}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Warehouse / Billing Address
                  </label>
                  <input
                    type="text"
                    maxLength={240}
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                    className={INPUT_CLASS}
                  />
                </div>
              </div>
              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-lg font-medium text-slate-700 dark:text-slate-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white rounded-lg font-semibold cursor-pointer disabled:opacity-60"
                >
                  {saving ? 'Saving...' : editingId ? 'Save Changes' : 'Add Supplier'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Supplier Payout / Bill Modal */}
      {payModalType && activeSupplier && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                {payModalType === 'payment_made' ? 'Record Supplier Payout' : 'Log Vendor Bill'}
              </h3>
              <button
                type="button"
                onClick={() => setPayModalType(null)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Vendor: <strong className="text-slate-900 dark:text-slate-100">{activeSupplier.name}</strong> (Current Payable:{' '}
              <strong className="font-mono-num text-slate-900 dark:text-slate-100">
                {formatCurrency(activeSupplier.payableBalance, currency)}
              </strong>
              )
            </p>
            <form onSubmit={handlePostEntry} className="space-y-4 text-xs">
              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Amount ({currency}) *
                </label>
                <input
                  required
                  type="number"
                  min={0.01}
                  step="0.01"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className={`${INPUT_CLASS} font-mono-num`}
                />
              </div>
              {payModalType === 'payment_made' && (
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Payout Method
                  </label>
                  <select
                    value={payMethod}
                    onChange={(e) => setPayMethod(e.target.value as typeof payMethod)}
                    className={INPUT_CLASS}
                  >
                    <option value="bank">Bank Transfer / NEFT / RTGS</option>
                    <option value="upi">UPI</option>
                    <option value="cash">Cash</option>
                    <option value="card">Card</option>
                  </select>
                </div>
              )}
              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Reference / Invoice #
                </label>
                <input
                  type="text"
                  maxLength={48}
                  value={payRef}
                  onChange={(e) => setPayRef(e.target.value)}
                  placeholder="UTR / Cheque / Bill #"
                  className={`${INPUT_CLASS} font-mono-num`}
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Note
                </label>
                <input
                  type="text"
                  maxLength={240}
                  value={payNote}
                  onChange={(e) => setPayNote(e.target.value)}
                  className={INPUT_CLASS}
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPayModalType(null)}
                  className="px-3.5 py-2 border border-slate-300 dark:border-slate-700 rounded-lg font-medium text-slate-700 dark:text-slate-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={posting}
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white rounded-lg font-semibold cursor-pointer disabled:opacity-60"
                >
                  {posting ? 'Posting...' : 'Confirm Entry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
