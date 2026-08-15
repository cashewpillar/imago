# Finance & Expenses: Import / Export Architecture & Decoupling Strategy

**Date:** 2026-08-15  
**Context:** The `imago` suite currently includes two interconnected financial tools: `savings.html` (net worth, account tracking, asset allocation, yields) and `expenses.html` (spending logs, custom expense types, recurring incomes, cashflow bar charts). Both read and write to the same shared IndexedDB instance (`FinanceTrackerV2` via Dexie.js).

---

## 1. Current State (Unified Schema - Version 3)

### Shared Database (`FinanceTrackerV2`)
Both applications connect to the same Dexie database instance containing 6 object stores:

```
FinanceTrackerV2 (IndexedDB)
├── accounts      (id, key, label, balance, rate, tags, maturity, note, updated_at)
├── history       (id, date, total, yield, accounts)
├── logs          (id, accountId, date, balance, change, note)
├── expenses      (id, date, typeId, accountId, name, amount, note, updated_at)
├── expenseTypes  (id, name)
└── incomes       (id, name, amount, frequency, payoutDays, updated_at)
```

### Current Export Format (`version: 3`)
When clicking **Export** in either `savings.html` or `expenses.html`, a single JSON snapshot is created:

```json
{
  "version": 3,
  "exported_at": "2026-08-15T12:34:56.789Z",
  "accounts": [...],
  "history": [...],
  "logs": [...],
  "expenses": [...],
  "expenseTypes": [...],
  "incomes": [...],
  "targets": {...},
  "lockedTags": {...}
}
```

### Current Coupling Points
1. **Source Account Deduction:** When logging an expense, selecting a source account deducts from `accounts[accountId].balance` and creates an audit entry in `logs`.
2. **Refund on Delete/Edit:** Editing or deleting an expense adjusts or refunds the balance of the linked source account.
3. **Dropdown Population:** `expenses.html` queries `accounts` to list spendable accounts (`savings`, `cash`, `buffer`).

---

## 2. The Architectural Dilemma: Unified vs. Modular Plug-and-Play

### Model A: Unified Full-App Backup (Current Implementation)
* **How it works:** One master JSON file backs up and restores both Savings and Expenses together.
* **Pros:**
  * **Zero orphaned records:** If an expense references `acc-maya-123`, the account is guaranteed to exist on import.
  * **Single backup artifact:** Simple 1-click backup/migration between devices or browsers.
  * **Audit integrity:** Account balance changes and the expense records that triggered them stay in sync.
* **Cons:**
  * Cannot wipe or re-import expense history without touching savings data (unless selective import is built).
  * Less modular if you want to use Expenses as a standalone throwaway budget tracker.

---

### Model B: Decoupled / Plug-and-Play Architecture (Proposed Options)

If you decide to separate or make Expenses plug-and-play, here are the viable architectural models:

### 1. Scope-Tagged Selective Import / Export (Hybrid)
Keep the shared database, but allow granular export and import options in the UI:
* **Export Options:**
  * `Full Finance Backup (All-in-One)` -> `finance_YYYY-MM-DD.json`
  * `Savings & Net Worth Only` -> `savings_YYYY-MM-DD.json` (accounts, history, logs, targets)
  * `Expenses & Incomes Only` -> `expenses_YYYY-MM-DD.json` (expenses, expenseTypes, incomes)
* **Import Rules:**
  * On importing `expenses_YYYY-MM-DD.json`, provide a checkbox:
    * `[x] Re-link and deduct from existing savings accounts if matching ID/Name is found`
    * `[ ] Import as unlinked ledger records (do not mutate savings balances)`

### 2. Standalone Database with Soft Foreign Keys (Loose Coupling)
* **Separate Databases:**
  * `SavingsDB`: stores `accounts`, `history`, `logs`, `targets`.
  * `ExpensesDB`: stores `expenses`, `expenseTypes`, `incomes`.
* **Cross-App Communication:**
  * `expenses.html` optionally queries `SavingsDB` in read-only mode to populate the source dropdown.
  * When an expense is saved with a source account:
    * If `SavingsDB` exists: write a deduction log to `SavingsDB.logs` and adjust balance.
    * If `SavingsDB` does not exist: store `sourceName: "Cash / Maya"` as a plain string instead of hard `accountId` foreign key.
* **Export / Import:**
  * Each app has its own isolated JSON file (`savings_backup.json` and `expenses_backup.json`).
  * Importing expenses into a fresh browser without `SavingsDB` works cleanly without errors.

### 3. Account-Agnostic Expense Tracking (Full Decoupling)
* Expenses are treated purely as a cash flow ledger (inflow vs. outflow) rather than a double-entry balance deduction tool.
* Savings tracker remains a net worth snapshot tool.
* **Pros:** Complete independence, zero risk of balance corruption when importing/exporting test data.
* **Cons:** Manual balance reconciliation needed when checking real bank balances.

---

## 3. Recommended Migration Path (When Ready to Decouple)

If and when you want to enable plug-and-play for Expenses without breaking current functionality:

1. **Add `accountLabel` redundancy to `expenses` records:**  
   Store both `accountId` (optional ID) and `accountLabel` (fallback string, e.g. `"Maya Savings"`). If accounts are missing or reset, the expense record still displays `"Maya Savings"` instead of `"—"`.
2. **Support Selective JSON Exports:**  
   Add a format selector in the export modal (`Full Backup`, `Expenses Only`, `Savings Only`).
3. **Smart Conflict Resolution on Import:**  
   Inspect the incoming JSON structure. If it only contains `expenses` and `expenseTypes`, merge them cleanly without touching `accounts` or `history`.
