# vipro-pocket Production Tech Stack

## Architecture

vipro-pocket is a **local-first personal budgeting PWA**. Transactions are saved locally first for speed and offline use, then synchronized to Supabase when a connection is available.

```text
Vue app → Dexie / IndexedDB → Sync engine → Supabase
```

## Core frontend

- **Vue 3** — application UI and components
- **TypeScript** — typed transactions, accounts, budgets, ledgers, and sync records
- **Vite** — development