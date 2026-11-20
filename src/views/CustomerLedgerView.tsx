import React, { useMemo, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  BookOpen,
  Edit2,
  Phone,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { usePOS, type CreateCustomerInput } from '../context/POSContext';
import { formatCurrency } from '../lib/validation';
import type { Customer } from '../types/pos';

const EMPTY_CUST: CreateCustomerInput = {
  name: '',
  phone: '',
  email: '',
  address: '',
  creditLimit: 15000,
  notes: '',
};

const INPUT_CLASS =
  'w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-lg focus:outline-none focus:bg-white dark:focus:bg-slate-800 focus:border-emerald-600 dark:focus:border-emerald-500';

export function CustomerLedgerView() {
  const {
    store,
    customers,
    sales,
    ledgerEntries,
    addCustomer,
    updateCustomer,
    deleteCustomer,
    recordCustomerLedger,
  } = usePOS();
  const currency = store?.currencySymbol || '₹';

  const [search, setSearch] = useState('');
  const [filterDue, setFilterDue] = useState<'all' | 'due' | 'settled'>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [custModalOpen, setCustModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CreateCustomerInput>(EMPTY_CUST);
  const [saving, setSaving] = useState(false);

  const [entryModalType, setEntryModalType] = useState<'payment_received' | 'sale_credit' | null>(
    null
  );
  const [entryAmount, setEntryAmount] = useState('');
  const [entryMethod, setEntryMethod] = useState<'cash' | 'upi' | 'card' | 'bank' | 'credit'>('upi');
  const [entryRef, setEntryRef] = useState('');
  const [entryNote, setEntryNote] = useState('');
  const [submittingEntry, setSubmittingEntry] = useState(false);

  const filteredCustomers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return customers.filter((c) => {
      if (filterDue === 'due' && c.balance <= 0) return false;
      if (filterDue === 'settled' && c.balance > 0) return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q) ||
        c.address.toLowerCase().includes(q)
      );
    });
  }, [customers, filterDue, search]);

  const activeCustomer: Customer | null = useMemo(() => {
    if (selectedId) {
      const found = customers.find((c) => c.id === selectedId);
      if (found) return found;
    }
    return filteredCustomers[0] ?? null;
  }, [customers, filteredCustomers, selectedId]);

  const customerLedger = useMemo(() => {
    if (!activeCustomer) return [];
    return ledgerEntries.filter(
      (e) => e.partyType === 'customer' && e.partyId === activeCustomer.id
    );
  }, [ledgerEntries, activeCustomer]);

  const customerInvoices = useMemo(() => {
    if (!activeCustomer) return [];
    return sales.filter((s) => s.customerId === activeCustomer.id).slice(0, 8);
  }, [sales, activeCustomer]);

  const totals = useMemo(() => {
    const totalReceivable = customers.reduce((s, c) => s + Math.max(0, c.balance), 0);
    const dueCount = customers.filter((c) => c.balance > 0).length;
    const totalLifetime = customers.reduce((s, c) => s + c.totalPurchases, 0);
    return { totalReceivable, dueCount, totalLifetime };
  }, [customers]);

  const openAdd = () => {
    setEditingId(null);
    setForm(EMPTY_CUST);
    setCustModalOpen(true);
  };

  const openEdit = (c: Customer) => {
    setEditingId(c.id);
    setForm({
      name: c.name,
      phone: c.phone,
      email: c.email,
      address: c.address,
      creditLimit: c.creditLimit,
      notes: c.notes,
    });
    setCustModalOpen(true);
  };

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      if (editingId) {
        await updateCustomer(editingId, form);
      } else {
        const created = await addCustomer(form);
        if (created) setSelectedId(created.id);
      }
      setCustModalOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitLedger = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCustomer || !entryModalType) return;
    const amt = parseFloat(entryAmount);
    if (!Number.isFinite(amt) || amt <= 0) return;

    setSubmittingEntry(true);
    try {
      await recordCustomerLedger({
        customerId: activeCustomer.id,
        entryType: entryModalType,
        amount: amt,
        paymentMethod: entryModalType === 'sale_credit' ? 'credit' : entryMethod,
        referenceNo: entryRef,
        note:
          entryNote ||
          (entryModalType === 'payment_received' ? 'Khata payment received' : 'Manual khata debit'),
      });
      setEntryModalType(null);
      setEntryAmount('');
      setEntryRef('');
      setEntryNote('');
    } finally {
      setSubmittingEntry(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Khata Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Total Customer Receivables
          </div>
          <div className="mt-1.5 font-mono-num text-xl font-bold text-amber-700 dark:text-amber-400">
            {formatCurrency(totals.totalReceivable, currency)}
          </div>
          <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 font-mono-num">
            {totals.dueCount} accounts with open balance
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Registered Customers
          </div>
          <div className="mt-1.5 font-mono-num text-xl font-bold text-slate-900 dark:text-white">
            {customers.length}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Lifetime Customer Billing
          </div>
          <div className="mt-1.5 font-mono-num text-xl font-bold text-emerald-700 dark:text-emerald-400">
            {formatCurrency(totals.totalLifetime, currency)}
          </div>
        </div>
      </div>

      {/* Master-Detail Khata Ledger Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Directory */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-sm font-bold text-slate-900 dark:text-white">
                Customer Directory
              </h2>
              <button
                type="button"
                onClick={openAdd}
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Customer
              </button>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, phone, address..."
                className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-lg focus:outline-none focus:bg-white dark:focus:bg-slate-800 focus:border-emerald-600 dark:focus:border-emerald-500"
              />
            </div>

            <div className="inline-flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-lg w-full">
              {(
                [
                  ['all', 'All'],
                  ['due', 'Balance Due'],
                  ['settled', 'Settled'],
                ] as const
              ).map(([val, label]) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setFilterDue(val)}
                  className={`flex-1 py-1 text-xs font-medium rounded-md cursor-pointer ${
                    filterDue === val
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[540px] overflow-y-auto">
            {filteredCustomers.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500 dark:text-slate-400">
                No customers found. Add a customer to start tracking credit khata.
              </div>
            ) : (
              filteredCustomers.map((c) => {
                const isSelected = activeCustomer?.id === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedId(c.id)}
                    className={`w-full text-left px-4 py-3.5 flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-slate-900 dark:bg-slate-800 text-white'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-900 dark:text-slate-100'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="font-semibold text-sm truncate">{c.name}</div>
                      <div
                        className={`text-xs font-mono-num mt-0.5 truncate ${
                          isSelected ? 'text-slate-300' : 'text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        {c.phone || 'No phone'} · Spent {formatCurrency(c.totalPurchases, currency)}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div
                        className={`font-mono-num text-sm font-bold ${
                          isSelected
                            ? c.balance > 0
                              ? 'text-amber-300'
                              : 'text-emerald-300'
                            : c.balance > 0
                            ? 'text-amber-700 dark:text-amber-400'
                            : 'text-emerald-700 dark:text-emerald-400'
                        }`}
                      >
                        {formatCurrency(c.balance, currency)}
                      </div>
                      <div className="text-[11px] text-slate-400 dark:text-slate-500">
                        {c.balance > 0 ? 'Receivable' : 'Settled'}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Khata Detail & Passbook */}
        <div className="lg:col-span-7 space-y-5">
          {!activeCustomer ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-12 text-center space-y-2">
              <BookOpen className="w-8 h-8 text-slate-300 dark:text-slate-700 mx-auto" />
              <div className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Select a Customer Account
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Choose a customer on the left to inspect their running khata passbook and collect dues.
              </p>
            </div>
          ) : (
            <>
              {/* Account Header & Quick Settlement Actions */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                      {activeCustomer.name}
                    </h2>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-1">
                      {activeCustomer.phone && (
                        <span className="inline-flex items-center gap-1 font-mono-num">
                          <Phone className="w-3 h-3" />
                          {activeCustomer.phone}
                        </span>
                      )}
                      {activeCustomer.address && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>{activeCustomer.address}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openEdit(activeCustomer)}
                      className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-700 rounded-lg cursor-pointer"
                      aria-label="Edit customer"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        await deleteCustomer(activeCustomer.id);
                        setSelectedId(null);
                      }}
                      className="p-2 text-slate-400 dark:text-slate-500 hover:text-red-700 dark:hover:text-red-400 border border-slate-200 dark:border-slate-700 rounded-lg cursor-pointer"
                      aria-label="Delete customer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Balance & Credit Utilization */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 py-4 border-y border-slate-100 dark:border-slate-800">
                  <div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      Current Khata Due
                    </div>
                    <div
                      className={`font-mono-num text-xl font-bold mt-0.5 ${
                        activeCustomer.balance > 0
                          ? 'text-amber-700 dark:text-amber-400'
                          : 'text-emerald-700 dark:text-emerald-400'
                      }`}
                    >
                      {formatCurrency(activeCustomer.balance, currency)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">Credit Limit</div>
                    <div className="font-mono-num text-xl font-bold text-slate-900 dark:text-white mt-0.5">
                      {formatCurrency(activeCustomer.creditLimit, currency)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      Lifetime Purchases
                    </div>
                    <div className="font-mono-num text-xl font-bold text-slate-900 dark:text-white mt-0.5">
                      {formatCurrency(activeCustomer.totalPurchases, currency)}
                    </div>
                  </div>
                </div>

                {activeCustomer.creditLimit > 0 && (
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
                      <span>Credit Limit Utilization</span>
                      <span className="font-mono-num font-medium text-slate-700 dark:text-slate-300">
                        {Math.min(
                          100,
                          Math.round(
                            (Math.max(0, activeCustomer.balance) / activeCustomer.creditLimit) * 100
                          )
                        )}
                        %
                      </span>
                    </div>
                    <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          activeCustomer.balance > activeCustomer.creditLimit * 0.85
                            ? 'bg-red-600 dark:bg-red-500'
                            : 'bg-emerald-600 dark:bg-emerald-500'
                        }`}
                        style={{
                          width: `${Math.min(
                            100,
                            Math.round(
                              (Math.max(0, activeCustomer.balance) / activeCustomer.creditLimit) *
                                100
                            )
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setEntryModalType('payment_received');
                      setEntryAmount(
                        activeCustomer.balance > 0 ? String(activeCustomer.balance) : ''
                      );
                      setEntryMethod('upi');
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg cursor-pointer"
                  >
                    <ArrowDownLeft className="w-4 h-4" />
                    Record Payment Received
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEntryModalType('sale_credit');
                      setEntryAmount('');
                      setEntryMethod('credit');
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold rounded-lg cursor-pointer"
                  >
                    <ArrowUpRight className="w-4 h-4" />
                    Add Credit Debit
                  </button>
                </div>
              </div>

              {/* Ledger Passbook Table */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white">
                    Khata Ledger Transactions
                  </h3>
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-mono-num">
                    {customerLedger.length} entries
                  </span>
                </div>

                {customerLedger.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-500 dark:text-slate-400">
                    No ledger transactions posted yet for this customer.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 dark:bg-slate-800/70 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                        <tr>
                          <th className="py-2.5 px-4 font-medium">Date & Ref</th>
                          <th className="py-2.5 px-3 font-medium">Type & Note</th>
                          <th className="py-2.5 px-3 font-medium text-right">Amount</th>
                          <th className="py-2.5 px-4 font-medium text-right">Balance After</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {customerLedger.map((entry) => {
                          const isPayment = entry.entryType === 'payment_received';
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
                                    isPayment
                                      ? 'text-emerald-700 dark:text-emerald-400 font-semibold'
                                      : 'text-amber-700 dark:text-amber-400 font-semibold'
                                  }
                                >
                                  {isPayment ? 'Payment Received' : 'Credit Posted'} ·{' '}
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
                                  isPayment
                                    ? 'text-emerald-700 dark:text-emerald-400'
                                    : 'text-amber-700 dark:text-amber-400'
                                }`}
                              >
                                {isPayment ? '-' : '+'}
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

              {/* Recent Invoices for this Customer */}
              {customerInvoices.length > 0 && (
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                  <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800">
                    <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white">
                      Recent POS Invoices
                    </h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 dark:bg-slate-800/70 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                        <tr>
                          <th className="py-2 px-4 font-medium">Invoice</th>
                          <th className="py-2 px-3 font-medium">Date</th>
                          <th className="py-2 px-3 font-medium text-right">Bill Total</th>
                          <th className="py-2 px-4 font-medium text-right">Paid</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {customerInvoices.map((inv) => (
                          <tr key={inv.id}>
                            <td className="py-2 px-4 font-mono-num font-semibold text-slate-900 dark:text-slate-100">
                              {inv.invoiceNumber}
                            </td>
                            <td className="py-2 px-3 font-mono-num text-slate-500 dark:text-slate-400">
                              {inv.saleDate}
                            </td>
                            <td className="py-2 px-3 text-right font-mono-num font-medium text-slate-900 dark:text-slate-100">
                              {formatCurrency(inv.totalAmount, currency)}
                            </td>
                            <td className="py-2 px-4 text-right font-mono-num text-emerald-700 dark:text-emerald-400">
                              {formatCurrency(inv.paidAmount, currency)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Add / Edit Customer Modal */}
      {custModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-lg w-full">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
                {editingId ? 'Edit Customer' : 'Add Customer Account'}
              </h2>
              <button
                type="button"
                onClick={() => setCustModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCustomer} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Full Name / Firm *
                </label>
                <input
                  required
                  type="text"
                  maxLength={120}
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Customer or contractor name"
                  className={INPUT_CLASS}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Phone
                  </label>
                  <input
                    type="text"
                    maxLength={30}
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="+91 98..."
                    className={`${INPUT_CLASS} font-mono-num`}
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Credit Limit ({currency})
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={form.creditLimit}
                    onChange={(e) => setForm({ ...form, creditLimit: Number(e.target.value) })}
                    className={`${INPUT_CLASS} font-mono-num`}
                  />
                </div>
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
                  Address
                </label>
                <input
                  type="text"
                  maxLength={240}
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  className={INPUT_CLASS}
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Account Notes
                </label>
                <input
                  type="text"
                  maxLength={280}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Billing cycle, preferred settlement day..."
                  className={INPUT_CLASS}
                />
              </div>
              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCustModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-lg font-medium text-slate-700 dark:text-slate-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white rounded-lg font-semibold cursor-pointer disabled:opacity-60"
                >
                  {saving ? 'Saving...' : editingId ? 'Save Changes' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Khata Entry Modal */}
      {entryModalType && activeCustomer && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                {entryModalType === 'payment_received'
                  ? 'Record Customer Payment'
                  : 'Add Khata Credit Entry'}
              </h3>
              <button
                type="button"
                onClick={() => setEntryModalType(null)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Account: <strong className="text-slate-900 dark:text-slate-100">{activeCustomer.name}</strong> (Current Due:{' '}
              <strong className="font-mono-num text-slate-900 dark:text-slate-100">
                {formatCurrency(activeCustomer.balance, currency)}
              </strong>
              )
            </p>
            <form onSubmit={handleSubmitLedger} className="space-y-4 text-xs">
              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Amount ({currency}) *
                </label>
                <input
                  required
                  type="number"
                  min={0.01}
                  step="0.01"
                  value={entryAmount}
                  onChange={(e) => setEntryAmount(e.target.value)}
                  className={`${INPUT_CLASS} font-mono-num`}
                />
              </div>
              {entryModalType === 'payment_received' && (
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Payment Mode
                  </label>
                  <select
                    value={entryMethod}
                    onChange={(e) => setEntryMethod(e.target.value as typeof entryMethod)}
                    className={INPUT_CLASS}
                  >
                    <option value="upi">UPI / QR</option>
                    <option value="cash">Cash</option>
                    <option value="card">Card</option>
                    <option value="bank">Bank Transfer</option>
                  </select>
                </div>
              )}
              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Reference / Receipt #
                </label>
                <input
                  type="text"
                  maxLength={48}
                  value={entryRef}
                  onChange={(e) => setEntryRef(e.target.value)}
                  placeholder="Optional UTR or receipt number"
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
                  value={entryNote}
                  onChange={(e) => setEntryNote(e.target.value)}
                  placeholder="Optional remarks..."
                  className={INPUT_CLASS}
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEntryModalType(null)}
                  className="px-3.5 py-2 border border-slate-300 dark:border-slate-700 rounded-lg font-medium text-slate-700 dark:text-slate-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingEntry}
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white rounded-lg font-semibold cursor-pointer disabled:opacity-60"
                >
                  {submittingEntry ? 'Posting...' : 'Post Ledger Entry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
