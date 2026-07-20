# vipro-pocket

A modern local-first personal budgeting web application.

## Current version

The production web app includes:

- Dashboard with income, expenses, cash flow, budgets, net worth, and charts
- Add expense, income, and transfer transactions
- Searchable transaction history
- Editable monthly category budgets
- Asset and liability accounts
- Reports and CSV export
- Dark mode and currency display settings
- Browser persistence through Dexie and IndexedDB
- Responsive desktop, Android browser, and iPhone Safari layouts

## Tech stack

- Vue 3
- TypeScript
- Vite
- Tailwind CSS
- Vue Router
- Pinia
- Dexie / IndexedDB
- Chart.js
- Vitest
- GitHub Actions and GitHub Pages

## Local development

```bash
npm install
npm run dev
```

## Verification

```bash
npm test
npm run build
```

## Deployment

Pushes to `main` are tested, built, and deployed through `.github/workflows/deploy-pages.yml`.

Expected URL:

```text
https://lemonroti.github.io/vipro-pocket/
```

## Prototype archive

The original single-file prototype remains available at:

```text
prototype/personal-budget-prototype.html
```

## Deferred phases

- Supabase authentication and cross-device synchronization
- Installable PWA service worker
- Android and iOS packaging
- Native home-screen widgets
