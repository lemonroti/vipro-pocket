# Vipro Pocket Supabase Production Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` or `superpowers:executing-plans` to implement this plan task-by-task.

## Goal

Convert the approved Vipro Pocket prototype into a public production web app backed by a brand-new Supabase project, while preserving the approved dashboard and navigation design.

## Global Constraints

- Continue directly on `feat/supabase-production`; do not create a Git worktree.
- Treat this as a one-user beta for scope and test-volume decisions, but retain production-grade data integrity, RLS, secret handling, migrations, error handling, and CI.
- Supabase is the only production data source; do not add Dexie synchronization or offline data persistence.
- Preserve the approved dashboard, navigation, responsive behavior, dark mode, CSV export, and currency display.
- Store every monetary amount as an integer in minor currency units.
- Use the browser-safe Supabase publishable key only; never expose a secret or service-role key.
- Check current official documentation or Context7 before relying on uncertain library, API, authentication, PostgreSQL, or GitHub Actions behavior.
- Use lean critical TDD: write and observe one to three focused failing tests for each material behavior before implementation, then run the relevant test file.
- Keep the existing UI regression tests, but do not multiply brittle markup-string tests unless an approved visual contract needs protection.
- Use GitHub Actions as the primary test and build environment because sustained local Node/Docker workloads can hang the development PC.
- Run lightweight targeted checks locally when practical; push meaningful checkpoints and use CI logs to diagnose failures.
- Finish with one complete verification pass covering the full automated suite, type-check, production build, database reset/tests, RLS isolation, advisors, and critical browser journeys.

## Execution and CI Strategy

1. Commit the npm lockfile, Supabase migrations, and database tests before application repository work.
2. Configure CI to use Node.js 22 and `npm ci` for deterministic frontend verification.
3. Add a separate Supabase database job using the official CLI and GitHub-hosted Docker runtime.
4. Run CI for pull requests to `main` and pushes to `feat/supabase-production`; deploy only from `main`.
5. Implement each application task with its smallest critical test first, then push a reviewed checkpoint.
6. Treat GitHub Actions as the authoritative repeatable verification result; local checks are supporting evidence.

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
- Authentication email and password reset deferred by the owner for the private single-user beta
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

Status: Complete

Completed:

- Added `@supabase/supabase-js`
- Added `.env.example`
- Added `src/env.d.ts`
- Created `feat/supabase-production`
- Added deterministic `package-lock.json`

Verified:

- GitHub Actions completed locked install, tests, type-check, and production build successfully

### Task 2 — Fresh Supabase project and schema

Status: Complete

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
- Saved the deployed migration history under `supabase/migrations/`
- Added transaction-isolated pgTAP tests for schema, provisioning, RLS, ownership, transaction shapes, constraints, and exact table privileges
- Added and deployed `20260721185613_restrict_app_table_privileges.sql` to remove `TRUNCATE`, `REFERENCES`, and `TRIGGER` access from application roles
- Verified a clean PostgreSQL 17 start, full migration replay, and all 40 pgTAP assertions in GitHub Actions
- Re-ran the hosted Security Advisor with zero findings

Advisory note:

- Performance Advisor reports only expected informational unused-index notices because the beta database currently contains no user workload

### Task 3 — Typed Supabase browser client

Status: Complete

Completed:

- Added `src/types/database.ts`
- Added `src/lib/supabase.ts`
- Added `src/lib/auth-redirect.ts`
- Added PKCE redirect tests

Verified:

- Redirect tests, TypeScript checking, and the production build pass in GitHub Actions

### Task 4 — Production data repository

Status: Complete

Required:

- Add a single repository layer for profiles, categories, accounts, transactions, and budgets
- Convert Supabase snake_case rows into frontend camelCase objects
- Add account CRUD
- Add transaction CRUD
- Add category creation
- Add budget upsert
- Add previous-month budget copy
- Map foreign-key deletion failures to user-friendly messages

Verified:

- Focused repository tests cover complete row mapping, server error behavior, account deletion FK messaging, and previous-month budget copying
- TypeScript checking and the production build pass

### Task 5 — Authentication

Status: Complete for the private-beta scope (2026-07-22)

Completed:

- Login UI
- Signup UI
- Protected application wrapper
- Supabase session store
- Hash routes for auth pages
- Added a visible, accessible Settings local sign-out action with pending protection and safe rejected-signout feedback
- Preserved the authenticated app only when sign-out is rejected before local session removal; when auth-js emits `SIGNED_OUT` before returning an API error, the protected lifecycle clears finance state, returns to login, and retains safe feedback
- Added auth mutation single-flight protection across signup, sign-in, and sign-out; retained tested recovery internals for a future email-enabled release
- Initialized auth eagerly and kept future recovery event handling reliable before, during, immediately after, and after store initialization
- Removed forgot-password and update-password routes and visible links from the private-beta surface because the owner explicitly excluded authentication email
- Kept password length/confirmation validation and disabled submission/navigation controls during pending auth work

Verified locally:

- Focused auth and protected-lifecycle tests pass (30 tests)
- Full frontend suite passes (106 tests)
- TypeScript checking and production build pass
- Recovery internals remain covered by tests but email delivery is explicitly outside this private-beta release scope

### Task 6 — Authenticated Pocket state store

Status: Complete (2026-07-22; 40 tests passing and production build verified)

Required:

- Load one authenticated user’s full finance snapshot
- Hold profiles, categories, accounts, transactions, and budgets in Pinia
- Use server-first mutations
- Reset all finance state on sign-out
- Preserve state when a server mutation fails

### Task 7 — Remove Dexie while preserving approved UI

Status: Complete (2026-07-22; 55 tests passing and production build verified)

Required:

- Move the accepted finance UI into a dedicated component
- Keep `App.vue` as the authentication/loading gate
- Remove Dexie imports and database class
- Remove all prototype seed data
- Replace local arrays with the authenticated Pocket store
- Preserve dashboard, sidebar, charts, responsiveness, and dark mode
- Add empty states for new users

### Task 8 — Account management UI

Status: Complete (2026-07-22; 11 focused tests passing and production build verified)

Required:

- Create account
- Edit account
- Delete account
- Block deletion when transactions reference the account

### Task 9 — Category and transaction management

Status: Complete (2026-07-22; 74 tests passing and production build verified locally; awaiting independent review and GitHub Actions)

Required:

- Add custom income and expense categories
- Create, edit, and delete transactions
- Validate transfer source and destination accounts
- Filter categories by transaction type

### Task 10 — Monthly budgets

Status: Complete (2026-07-22; 30 focused tests, 82 full-suite tests, and production build verified locally)

Required:

- Save monthly category budgets to Supabase
- Copy the previous month’s budgets
- Prevent duplicate month/category rows

Completed:

- Added an accessible `YYYY-MM` month selector with canonical `YYYY-MM-01` store calls
- Added guarded previous-month copying with overwrite confirmation, pending locks, empty-source feedback, and safe rejection handling
- Kept budget values server-backed, zero-safe, and deterministic across repeated copies
- Kept dashboard and report calculations on the current month while allowing independent budget-month selection

Verified:

- Focused UI boundary, wiring, store, and repository tests pass (30 tests)
- Full frontend suite passes (82 tests)
- TypeScript checking and the production build pass locally
- Final mounted browser journeys remain part of Task 12 verification

### Task 11 — GitHub Pages production configuration

Status: Complete for the private-beta scope

Completed:

- Updated GitHub Actions to use Node.js 22 and `npm ci`
- Added a pinned Supabase CLI database-test job on GitHub-hosted Docker
- Runs feature-branch CI once through pull requests to `main`, avoiding duplicate push runs
- Restricted GitHub Pages deployment to pushes on `main`
- Scoped Pages and OIDC write permissions to the deploy job only
- Uses maintained official action majors and bounded job timeouts
- Reads and validates the production Supabase URL and publishable key from GitHub repository variables
- Configured the Supabase Auth Site URL for GitHub Pages
- Configured the exact GitHub Pages password-recovery hash redirect
- Disabled email confirmation for this private single-user beta so signup immediately returns a session
- Confirmed the hardened frontend and GitHub-hosted Docker/pgTAP jobs pass

Deferred:

- Custom SMTP, email confirmation, and public password recovery for a future email-enabled release

### Task 12 — Production verification and release

Status: In progress (PR #5 is deployed; mobile-navigation follow-up is locally verified and awaiting reviewed deployment)

Completed:

- Full frontend suite passes (108 tests) and the production build/type-check passes
- Security Advisor reports no findings; Performance Advisor reports only expected unused-index informational notices on the new low-traffic database
- Two independently signed-up live Supabase users see isolated finance data
- Production build browser journeys pass for signup, login, logout, refresh persistence, accounts, categories, expense/income/transfer transactions, budgets, CSV export, currency, and charts
- Desktop Chromium and an Android-sized 390 x 844 responsive viewport render without console errors during the verified journeys
- Fixed a production-only blank root caused by a runtime template and split route bundles below Vite's warning threshold
- Fixed stale authentication feedback leaking between authentication forms
- PR #5 was reviewed, merged, and deployed after the required frontend and Docker/pgTAP checks passed
- Added a safe-area-aware six-destination bottom navigation after live `390 x 844` verification exposed that the hidden mobile sidebar had no replacement
- Verified the mobile navigation at `320 x 844` and `390 x 844`, every destination, Settings sign-out, refresh persistence, desktop sidebar preservation, and zero browser console errors or warnings against a production build
- Removed the exact disposable verification user and confirmed its profile/category rows cascaded to zero; the hosted Security Advisor remains clean

Required:

- Review and merge the mobile-navigation follow-up only after required checks pass
- Verify the follow-up GitHub Pages deployment on desktop Chrome and Android-sized Chrome emulation

## Acceptance Criteria

- Visitors can register and immediately receive an authenticated session
- New users see default categories but no sample financial data
- The same user sees the same data across PC and Android
- Different users cannot access each other’s records
- Accounts, transactions, categories, and budgets persist in Supabase
- Existing approved UI remains visually consistent
- No secret or service-role key appears in frontend code
- GitHub Actions passes before merge
