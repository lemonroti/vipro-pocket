# Mobile Bottom Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore complete, accessible navigation on mobile viewports without changing the accepted desktop experience.

**Architecture:** Render a second presentation of the existing `navigation` model as a fixed mobile bottom bar. Keep `activePage` and `switchPage()` as the single source of navigation state, and use responsive CSS to make the sidebar and bottom bar mutually exclusive.

**Tech Stack:** Vue 3, TypeScript, Lucide Vue, CSS media queries, Vitest, Playwright CLI

## Global Constraints

- Continue directly on `feat/supabase-production`; do not create a Git worktree.
- Add no dependency and do not change Supabase or finance state behavior.
- Preserve the desktop sidebar at and above `760px`.
- Support the existing `320px` minimum viewport and device safe-area inset.
- Use lean critical TDD and GitHub Actions as the authoritative full verification environment.

---

### Task 1: Accessible mobile navigation

**Files:**
- Modify: `src/dashboard-markup.test.js`
- Modify: `src/layout.test.js`
- Modify: `src/components/finance/FinanceDashboard.vue`
- Modify: `src/style.css`
- Modify: `docs/superpowers/plans/2026-07-22-vipro-pocket-supabase-production.md`

**Interfaces:**
- Consumes: existing `navigation`, `activePage`, and `switchPage(page: Page)` from `FinanceDashboard.vue`
- Produces: `.mobile-nav`, `.mobile-nav-link`, and active-page `aria-current="page"` behavior

- [ ] **Step 1: Write focused failing tests**

Add assertions that require a labeled mobile navigation rendered with `v-for="item in navigation"`, calls `switchPage(item.id)`, exposes `:aria-current="activePage === item.id ? 'page' : undefined"`, and has responsive CSS for six equal columns, safe-area padding, desktop hiding, and FAB clearance.

- [ ] **Step 2: Run the focused tests and confirm RED**

Run: `npm test -- src/dashboard-markup.test.js src/layout.test.js`

Expected: FAIL because `.mobile-nav` markup and styling do not exist.

- [ ] **Step 3: Implement the minimal navigation**

Render the shared navigation model after `<main>`, using semantic buttons with the existing icons and labels. Add mobile-first fixed-bar styles, active/focus-visible states, safe-area spacing, main-content clearance, and move the FAB above the bar. Hide the bar in the existing `@media(min-width:760px)` block.

- [ ] **Step 4: Verify GREEN and regression safety**

Run: `npm test -- src/dashboard-markup.test.js src/layout.test.js`

Expected: both focused files pass.

Run: `npm test`

Expected: all frontend tests pass.

Run with production Supabase browser variables: `npm run build`

Expected: TypeScript and Vite production build pass without chunk warnings.

- [ ] **Step 5: Record and publish the repair**

Mark the mobile portion of Task 12 complete only after browser verification. Commit the focused repair, push `feat/supabase-production`, open a reviewed pull request to `main`, and merge only after required `frontend-checks` and `database-tests` pass.

- [ ] **Step 6: Verify the deployed production site**

At `390 x 844`, create a disposable account, navigate through all six destinations, verify Settings contains Sign out, reload to prove session persistence, inspect the console, and delete the exact temporary Supabase user. Re-run the Supabase Security Advisor and confirm zero findings.
