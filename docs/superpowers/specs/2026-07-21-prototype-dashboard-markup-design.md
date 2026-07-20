# Prototype Dashboard Markup Design

## Goal

Replace the simplified production dashboard and desktop sidebar markup with the original prototype structure while preserving the current Vue, Dexie, Chart.js, and finance behavior.

## Scope

- Restore the desktop sidebar with Lucide icons, active indicator, transaction count, monthly-budget panel, and profile row.
- Restore the dashboard hero with total net worth, monthly net result, account shortcut, and expense/income actions.
- Replace the horizontal budget card with the prototype circular budget gauge and spent/limit boxes.
- Restore four metric cards: income, expense, saved, and active accounts.
- Keep the two-column cash-flow/top-spending section and prototype-style recent-transactions list.
- Preserve Transactions, Budgets, Accounts, Reports, Settings, modal behavior, IndexedDB schema, seed data, calculations, and export behavior.

## Architecture

`src/App.vue` remains the application composition root. Existing data and finance functions remain unchanged; only presentation-level computed data and markup are expanded. `src/style.css` receives dashboard/sidebar component classes and responsive rules. A source-level regression test checks for the required prototype sections and metric count.

## Responsive Behavior

- Desktop at 760px and above: fixed 250px sidebar and centered content up to 1500px.
- Large desktop at 1180px and above: prototype dashboard column ratios and four metric cards.
- Mobile: sidebar hidden, top actions remain usable, dashboard sections collapse to one column, and the floating add button remains available.

## Acceptance Criteria

1. No horizontal page overflow at desktop widths.
2. Sidebar visually contains icons, active indicator, transaction badge, budget panel, and profile row.
3. Dashboard contains circular budget gauge, four metric cards, top-spending progress rows, and recent transactions.
4. Existing tests and production build pass.
5. No change to stored user data or IndexedDB version.
