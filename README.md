# vipro-pocket

A personal budgeting web application backed by Supabase.

## Current version

The production web app includes:

- Dashboard with income, expenses, cash flow, budgets, net worth, and charts
- Add expense, income, and transfer transactions
- Searchable transaction history
- Editable monthly category budgets
- Asset and liability accounts
- Reports and CSV export
- Dark mode and currency display settings
- Authenticated persistence through Supabase PostgreSQL with Row Level Security
- Responsive desktop, Android browser, and iPhone Safari layouts

## Tech stack

- Vue 3
- TypeScript
- Vite
- Tailwind CSS
- Vue Router
- Pinia
- Supabase Auth and PostgreSQL
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

Production configuration, release, verification, and rollback procedures are documented in [`docs/production-operations.md`](docs/production-operations.md).

## Prototype archive

The original single-file prototype remains available at:

```text
prototype/personal-budget-prototype.html
```

## Deferred phases

- Offline support
- Installable PWA service worker
- Android and iOS packaging
- Native home-screen widgets
