# vipro-pocket Production Tech Stack

## Product Architecture

vipro-pocket will be built as a **local-first personal budgeting application**.

Transactions are saved to the device first so the app remains fast and usable without internet. When a connection is available, data is synchronized with Supabase for backup and cross-device access.

```text
Vue application
      ↓
Dexie / IndexedDB
      ↓
Synchronization engine
      ↓
Supabase
```

## Core Frontend

### Vue 3

Primary frontend framework for the dashboard, transactions, accounts, budgets, reports, settings, forms, and responsive mobile and desktop interfaces.

Development style:

```text
Vue 3 Composition API
<script setup>
Single File Components
```

### TypeScript

Used across the project to enforce consistent data structures for transactions, accounts, categories, budgets, ledgers, synchronization records, and user settings.

All financial amounts will be stored as integers in minor currency units.

```text
RM25.80 → 2580
```

### Vite

Used as the frontend development and production build system.

Responsibilities:

- Local development server
- Hot module replacement
- Vue and TypeScript compilation
- Environment variables
- Package bundling
- Production builds

```bash
npm run dev
npm run build
npm run preview
```

### Tailwind CSS

Used for the design system, including layout, spacing, typography, responsive breakpoints, dark mode, cards, buttons, forms, and mobile navigation.

## Application Structure

### Vue Router

Used for page routing.

```text
/                 Dashboard
/transactions     Transactions
/budgets          Budgets
/accounts         Accounts
/reports          Reports
/settings         Settings
```

### Pinia

Used for temporary application state, including the current user, current ledger, authentication state, theme, filters, modal state, synchronization status, and app preferences.

```text
Pinia       = temporary application state
IndexedDB   = permanent local data
Supabase    = cloud data
```

## Local Database

### IndexedDB

The browser's local database will store:

- Ledgers
- Accounts
- Categories
- Transactions
- Budgets
- Recurring transaction rules
- Settings
- Synchronization queue

### Dexie

Dexie will be used as the IndexedDB wrapper. It provides typed database tables, indexes, queries, database migrations, reactive data updates, and easier transaction handling.

```text
User saves transaction
        ↓
Save to IndexedDB
        ↓
Update interface immediately
        ↓
Add record to sync queue
        ↓
Upload when internet is available
```

## Cloud Backend

### Supabase PostgreSQL

Supabase will be the production cloud database.

Main tables:

```text
profiles
ledgers
ledger_members
accounts
categories
transactions
budgets
recurring_rules
devices
```

### Supabase Auth

Initial authentication methods:

- Email and password
- Magic link

Google login can be added later.

### Row Level Security

Supabase Row Level Security will ensure users can only access data belonging to their own account or shared ledger.

### Supabase Storage

Used later for receipt images, profile images, and export files.

### Supabase Edge Functions

Used only when server-side logic is required, such as secure third-party integrations, scheduled processing, email tasks, payment webhooks, or protected API operations.

## Synchronization Engine

vipro-pocket will use a custom synchronization layer between IndexedDB and Supabase.

Each synchronized record will include fields such as:

```text
id
created_at
updated_at
deleted_at
device_id
sync_status
```

Synchronization states:

```text
pending
syncing
synced
failed
```

The initial conflict strategy will be **last write wins**. Deleted records will use soft deletion through `deleted_at` so deletion can synchronize across devices.

## Charts and Reports

### Chart.js

Used for:

- Monthly income and expense charts
- Category spending breakdown
- Budget versus actual spending
- Account balances
- Net-worth history
- Cash-flow trends

Financial calculations will remain in separate TypeScript services rather than inside chart components.

## Progressive Web App

### vite-plugin-pwa and Workbox

Used to turn the Vue application into an installable PWA.

It will provide:

- Web App Manifest
- Service Worker
- Offline application shell
- App icons
- Splash-screen configuration
- Update notifications
- Install support
- Application shortcuts

Supported platforms:

```text
Windows
macOS
Android
iPhone and iPad
Desktop browsers
Mobile browsers
```

The PWA can be installed from Safari on iPhone through **Add to Home Screen**.

## Native Mobile Applications

### Capacitor

Capacitor will be introduced after the PWA is stable. It will package the existing Vue application as Android and iOS applications while keeping most components, business logic, authentication, and Supabase integration shared.

### Android Widget

Implemented later using Kotlin and Android App Widget APIs.

Possible widget actions:

- Add expense
- Add income
- View remaining budget
- View today's spending

### iPhone Widget

Implemented later using Swift and WidgetKit.

Native widgets are not part of the initial PWA phase.

## Testing

### Vitest

Used for unit testing financial calculations, account balances, income and expense totals, transfers, budget usage, date filtering, and synchronization logic.

### Vue Test Utils

Used to test Vue components and user-interface behavior.

### Playwright

Used for end-to-end testing, including adding, editing, and deleting transactions; retaining local data after refresh; offline usage; authentication; cross-device synchronization; and mobile layouts.

## Code Quality

- **ESLint** — JavaScript, TypeScript, and Vue code-quality checks
- **Prettier** — consistent code formatting
- **Husky** — Git hooks
- **lint-staged** — lint and format staged files
- **Commitlint** — Conventional Commit enforcement

Examples:

```text
feat: add transaction form
fix: correct account balance calculation
chore: configure pwa manifest
```

## Hosting and Deployment

### GitHub

Repository:

```text
lemonroti/vipro-pocket
```

Used for source control, issues, pull requests, release history, and automated deployment triggers.

### Cloudflare Pages

Used to deploy the Vue frontend.

```text
Push to GitHub main branch
        ↓
Cloudflare Pages runs npm build
        ↓
Vite generates dist/
        ↓
Production site is deployed
```

### Supabase

Hosted separately for authentication, PostgreSQL, Row Level Security, storage, and Edge Functions.

## Environment Variables

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
```

Local secrets will be stored in `.env` and excluded from Git. A safe template will be committed as `.env.example`.

## Final Stack Summary

```text
Frontend Framework       Vue 3
Programming Language     TypeScript
Build Tool               Vite
CSS                      Tailwind CSS
Routing                  Vue Router
State Management         Pinia
Local Database           IndexedDB
IndexedDB Wrapper        Dexie
Cloud Database           Supabase PostgreSQL
Authentication           Supabase Auth
Cloud Security           Supabase Row Level Security
File Storage             Supabase Storage
Charts                    Chart.js
PWA                       vite-plugin-pwa + Workbox
Unit Testing              Vitest + Vue Test Utils
End-to-End Testing        Playwright
Code Quality              ESLint + Prettier
Git Standards             Husky + lint-staged + Commitlint
Source Control            GitHub
Frontend Hosting          Cloudflare Pages
Android and iOS Packaging Capacitor
Android Widget            Kotlin
IPhone Widget             Swift + WidgetKit
```

## Development Phases

### Phase 1 — Production Local App

```text
Vue 3
TypeScript
Vite
Tailwind CSS
Vue Router
Pinia
Dexie
IndexedDB
Chart.js
Vitest
```

### Phase 2 — Cloud Synchronization

```text
Supabase Auth
Supabase PostgreSQL
Row Level Security
Synchronization engine
Cross-device backup
```

### Phase 3 — PWA

```text
Service Worker
Offline application shell
Install support
App shortcuts
Update handling
```

### Phase 4 — Native Mobile

```text
Capacitor
Android application
iOS application
Android widget
iPhone widget
```

This is the confirmed production stack for `vipro-pocket`.