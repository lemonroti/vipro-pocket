# Prototype Dashboard Markup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Restore the original prototype dashboard and sidebar structure in the production Vue app.

**Architecture:** Keep all existing Dexie and finance logic in `src/App.vue`. Add presentation-only computed data and replace dashboard/sidebar markup. Extend `src/style.css` with matching component classes and responsive layouts.

**Tech Stack:** Vue 3, TypeScript, Dexie, Chart.js, Lucide Vue, CSS, Vitest.

## Global Constraints

- Do not change IndexedDB name, schema, or version.
- Do not change financial calculations or seed-data values.
- Keep all non-dashboard pages functional.
- Preserve GitHub Pages base-path behavior.

### Task 1: Add markup regression test

**Files:**
- Create: `src/dashboard-markup.test.js`

- [ ] Assert that `src/App.vue` contains the prototype sidebar, circular budget gauge, four metric cards, top-spending list, and recent-transactions section.
- [ ] Run `npm test` and verify the new test fails before implementation.

### Task 2: Restore sidebar and dashboard markup

**Files:**
- Modify: `src/App.vue`

- [ ] Add Lucide icon imports and navigation metadata.
- [ ] Add computed top-category rows without changing stored data.
- [ ] Replace simplified sidebar markup with the prototype sidebar structure.
- [ ] Replace simplified dashboard markup with hero, circular gauge, four metrics, cash-flow chart, top-spending rows, and recent transactions.
- [ ] Preserve all other page and modal markup.

### Task 3: Align component styling

**Files:**
- Modify: `src/style.css`

- [ ] Add sidebar icon/indicator/badge/profile styles.
- [ ] Add circular budget gauge and summary-box styles.
- [ ] Add four-card metric layout and icon treatments.
- [ ] Add top-spending rows and prototype recent-transaction styles.
- [ ] Verify mobile and desktop responsive layouts do not overflow.

### Task 4: Verify and publish

- [ ] Run `npm test` and expect all tests to pass.
- [ ] Run `npm run build` and expect a successful Vite production build.
- [ ] Open a PR, verify GitHub Actions, squash merge to `main`, and confirm GitHub Pages redeploys.
