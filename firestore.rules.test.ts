/**
 * Phase 0 Security TDD Specification Tests for TradeLedger POS Firestore Rules.
 * Verifies all 12 "Dirty Dozen" adversarial payloads are rejected by firestore.rules.
 */

export interface DirtyDozenCase {
  id: number;
  name: string;
  collection: string;
  operation: 'create' | 'update' | 'delete' | 'get' | 'list';
  expected: 'PERMISSION_DENIED';
  payload: Record<string, unknown>;
}

export const DIRTY_DOZEN_CASES: DirtyDozenCase[] = [
  {
    id: 1,
    name: 'Identity Spoofing on Product Create',
    collection: 'products',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    payload: { ownerId: 'victim_uid', sku: 'GRC-001', name: 'Spoofed Item' },
  },
  {
    id: 2,
    name: 'Shadow Field Injection on Customer Create',
    collection: 'customers',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    payload: { ownerId: 'attacker_uid', name: 'Ghost', isAdmin: true },
  },
  {
    id: 3,
    name: 'Unverified Email Write Attempt',
    collection: 'stores',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    payload: { ownerId: 'unverified_uid', storeName: 'Unverified Store' },
  },
  {
    id: 4,
    name: 'Cross-Tenant Customer PII Read',
    collection: 'customers',
    operation: 'get',
    expected: 'PERMISSION_DENIED',
    payload: { targetDocId: 'victim_customer_01' },
  },
  {
    id: 5,
    name: 'Unscoped Blanket Collection List',
    collection: 'products',
    operation: 'list',
    expected: 'PERMISSION_DENIED',
    payload: { query: 'collection(db, "products") without ownerId filter' },
  },
  {
    id: 6,
    name: 'Document ID Poisoning (>128 chars / invalid charset)',
    collection: 'products',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    payload: { docId: 'a'.repeat(200) },
  },
  {
    id: 7,
    name: 'Client-Forged Timestamp on Sale Create',
    collection: 'sales',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    payload: { invoiceNumber: 'INV-FAKE', createdAt: '2020-01-01T00:00:00Z' },
  },
  {
    id: 8,
    name: 'Immutable Sale Invoice Update',
    collection: 'sales',
    operation: 'update',
    expected: 'PERMISSION_DENIED',
    payload: { totalAmount: 0, grossProfit: 0 },
  },
  {
    id: 9,
    name: 'Immutable Ledger Entry Delete',
    collection: 'ledgerEntries',
    operation: 'delete',
    expected: 'PERMISSION_DENIED',
    payload: { targetDocId: 'ledger_01' },
  },
  {
    id: 10,
    name: 'Terminal State Update on Cancelled Purchase',
    collection: 'purchases',
    operation: 'update',
    expected: 'PERMISSION_DENIED',
    payload: { status: 'received' },
  },
  {
    id: 11,
    name: 'Orphaned Purchase Without Existing Supplier',
    collection: 'purchases',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    payload: { supplierId: 'nonexistent_supplier_999' },
  },
  {
    id: 12,
    name: 'Value Poisoning & Oversized Items Array',
    collection: 'products',
    operation: 'update',
    expected: 'PERMISSION_DENIED',
    payload: { stockQty: 'unlimited' },
  },
];
