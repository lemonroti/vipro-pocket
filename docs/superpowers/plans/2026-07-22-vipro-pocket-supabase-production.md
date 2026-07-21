# Vipro Pocket Supabase Production Implementation Plan

## Goal

Convert the approved Vipro Pocket prototype into a public production web app backed by a brand-new Supabase project, while preserving the approved dashboard and navigation design.

## Active Development

- Development branch: `feat/supabase-production`
- Pull request: `#5`
- Supabase project: `vipro-pocket`
- Supabase project ref: `prhyegodslvkpnehzzif`
- Region: Singapore (`ap-southeast-1`)
- Production branch: `main` remains unchanged until review and verification pass

## Product Decisions

- Public registration
- Email and password authentication
- Immediate access after signup
- Email confirmation disabled for v1
- Password reset supported
- Supabase is the only production data source
- No offline mode or Dexie synchronization in v1
- New users receive default categories only
- No default accounts, sample transactions, or sample budgets
- Users can create custom categories
- Accounts support create, edit, and delete
- Referenced accounts cannot be deleted
- Transactions support create, edit, and delete
- Income, expense, and transfer are supported
- Monthly category budgets are supported
- Previous month budgets can be copied
- GitHub Pages remains the frontend host
- All user-owned data is protected by RLS

## Progress

### Task 1 — Dependencies and environment

Status: In progress

Completed:

- Added `@supabase/supabase-js`
- Added `.env.example`
- Added `src/env.d.ts`
- Created `feat/supabase-production`

Remaining:

- Update and verify `package-lock.json`
- Run full install, test, and production build

### Task 2 — Fresh Supabase project and schema

Status: Database deployed; repository files remaining

Completed:

- Created fresh `vipro-pocket` Supabase project
- Created profiles, categories, accounts, transactions, and budgets tables
- Added ownership constraints
- Added transaction shape constraints
- Enabled RLS on all user data tables
- Added default-category signup trigger
- Revoked public execution of the security-definer trigger function
- Supabase Security Advisor is clean
- Added missing foreign-key indexes

Remaining:

- Save migration SQL under `supabase/migrations/`
- Save database tests under `supabase/tests/database/`

### Task 3 — Typed Supabase browser client

Status: Mostly complete

Completed:

- Added `src/types/database.ts`
- Added `src/lib/supabase.ts`
- Added `src/lib/auth-redirect.ts`
- Added PKCE redirect tests

Remaining:

- Run tests and production build in a real repository workspace or CI

### Task 4 — Production data repository

Status: Not started

Required:

- Add a single repository layer for profiles, categories, accounts, transactions, and budgets
- Convert Supabase snake_case rows into frontend camelCase objects
- Add account CRUD
- Add transaction CRUD
- Add category creation
- Add budget upsert
- Add previous-month budget copy
- Map foreign-key deletion failures to user-friendly messages

### Task 5 — Authentication

Status: Partially implemented

Completed:

- Login UI
- Signup UI
- Forgot-password UI
- Update-password UI
- Protected application wrapper
- Supabase session store
- Hash routes for auth pages

Remaining:

- Verify signup configuration and immediate session behavior
- Verify password recovery end to end
- Add or complete automated auth tests
- Configure production Auth redirect URLs

### Task 6 — Authenticated Pocket state store

Status: Not started

Required:

- Load one authenticated user’s full finance snapshot
- Hold profiles, categories, accounts, transactions, and budgets in Pinia
- Use server-first mutations
- Reset all finance state on sign-out
- Preserve state when a server mutation fails

### Task 7 — Remove Dexie while preserving approved UI

Status: Not started

Required:

- Move the accepted finance UI into a dedicated component
- Keep `App.vue` as the authentication/loading gate
- Remove Dexie imports and database class
- Remove all prototype seed data
- Replace local arrays with the authenticated Pocket store
- Preserve dashboard, sidebar, charts, responsiveness, and dark mode
- Add empty states for new users

### Task 8 — Account management UI

Status: Not started

Required:

- Create account
- Edit account
- Delete account
- Block deletion when transactions reference the account

### Task 9 — Category and transaction management

Status: Not started

Required:

- Add custom income and expense categories
- Create, edit, and delete transactions
- Validate transfer source and destination accounts
- Filter categories by transaction type

### Task 10 — Monthly budgets

Status: Not started

Required:

- Save monthly category budgets to Supabase
- Copy the previous month’s budgets
- Prevent duplicate month/category rows

### Task 11 — GitHub Pages production configuration

Status: Not started

Required:

- Configure `VITE_SUPABASE_URL`
- Configure `VITE_SUPABASE_PUBLISHABLE_KEY`
- Use only the publishable key in the browser
- Update GitHub Actions to run install, tests, type-check, build, and deploy
- Configure Supabase Site URL and redirect URLs
- Configure production SMTP for password recovery

### Task 12 — Production verification and release

Status: Not started

Required:

- Run automated tests and production build
- Re-run Supabase Security and Performance Advisors
- Test two separate users for RLS isolation
- Test desktop Chrome and Android Chrome
- Test signup, login, logout, recovery, accounts, transactions, transfers, budgets, CSV, currency, charts, and refresh behavior
- Review PR #5
- Merge only after all checks pass

## Acceptance Criteria

- Visitors can register and immediately receive an authenticated session
- New users see default categories but no sample financial data
- The same user sees the same data across PC and Android
- Different users cannot access each other’s records
- Accounts, transactions, categories, and budgets persist in Supabase
- Password reset works through the GitHub Pages hash route
- Existing approved UI remains visually consistent
- No secret or service-role key appears in frontend code
- GitHub Actions passes before merge
