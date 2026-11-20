# TradeLedger POS — Firestore Security Specification (Phase 0 TDD)

## 1. Data Invariants
1. **Strict Tenant Ownership & PII Isolation**: Every document across `stores`, `products`, `customers`, `suppliers`, `sales`, `purchases`, and `ledgerEntries` has an immutable `ownerId` strictly matching `request.auth.uid`, and requires `request.auth.token.email_verified == true`. No user can read, list, create, update, or delete another merchant's records or customer/supplier PII.
2. **Global Default Deny**: Any unmatched path is denied (`match /{document=**} { allow read, write: if false; }`).
3. **Referential Integrity**:
   - Creating a `Sale` with a registered customer requires `customerId == 'walk-in'` OR `existsAfter(/databases/$(database)/documents/customers/$(customerId))`.
   - Creating a `Purchase` requires `existsAfter(/databases/$(database)/documents/suppliers/$(supplierId))`.
   - Creating a `LedgerEntry` requires the referenced customer (`partyType == 'customer'`) or supplier (`partyType == 'supplier'`) to exist via `existsAfter(...)`.
4. **Accounting Immutability & Terminal State Locking**:
   - `sales` and `ledgerEntries` are strictly immutable audit records (`allow update, delete: if false;`).
   - `purchases` with `status == 'cancelled'` are locked from any further updates.
5. **Temporal Integrity**: `createdAt == request.time` on create; `updatedAt == request.time` and `createdAt == existing().createdAt` on update.
6. **Bounded Arrays & Strict String Sizes**: Every string has `.size()` bounds; `items` arrays on `sales` and `purchases` are strictly bounded to `1 <= size <= 50` with element map type verification.

## 2. The "Dirty Dozen" Adversarial Payloads (Must All Return PERMISSION_DENIED)
1. **Identity Spoofing on Product Create**: `{ ownerId: "victim_uid", sku: "SKU1", ... }` by `attacker_uid`.
2. **Shadow Field Injection (Ghost Field)**: Creating a `Customer` with extra field `isAdmin: true`.
3. **Unverified Email Bypass**: Authenticated user with `email_verified: false` creating a `StoreProfile`.
4. **Cross-Tenant PII Read**: `attacker_uid` calling `get` on `/customers/cust_victim` containing phone/email/address.
5. **Blanket List Query Scraping**: Listing `/products` or `/customers` without `where('ownerId', '==', auth.uid)`.
6. **ID Poisoning Attack**: Writing to `/products/` with a 200-char ID or invalid characters (`../hack`).
7. **Timestamp Forgery**: Creating a `Sale` with client-forged `createdAt: Timestamp(2020-01-01)` instead of `request.time`.
8. **Immutable Sale Tampering**: Updating `totalAmount` or `grossProfit` on an existing `/sales/{saleId}` invoice.
9. **Immutable Ledger Deletion**: Deleting an existing `/ledgerEntries/{entryId}` audit record.
10. **Terminal State Violation**: Updating a `Purchase` whose `existing().status == 'cancelled'`.
11. **Orphaned Purchase Order**: Creating a `Purchase` referencing a non-existent `supplierId: "ghost_supplier"`.
12. **Value Poisoning & Array Overflow**: Creating a `Sale` with `items.size() == 55` or updating `Product.stockQty` to a string `"unlimited"`.
