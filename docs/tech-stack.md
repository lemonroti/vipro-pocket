# vipro-pocket Production Tech Stack

## Product architecture

vipro-pocket is an authenticated personal budgeting web application. Supabase is the only runtime source of financial data; the application does not persist accounts, transactions, budgets, categories, or currency in IndexedDB or local storage.

```text
Vue application
      ↓
Authenticated Pinia finance store
      ↓
Typed repository
      ↓
Supabase Auth + PostgreSQL + Row Level Security
```

Dark-mode preference is device-local presentation state. Financial writes are server-first: the store updates only after the repository returns the saved server row, and failed writes preserve the last confirmed state.

## Frontend

- **Vue 3 Composition API** for the authenticated gate, finance dashboard, and authentication views.
- **TypeScript** for generated database types, production finance-domain types, repository inputs, stores, and calculations.
- **Vite** for local development and production builds.
- **Tailwind CSS and project CSS** for layout, responsive behavior, dark mode, and component styling.
- **Vue Router** for authentication routes and the protected application route. Finance dashboard sections use local presentation navigation.
- **Pinia** for authenticated user and finance state.
- **Chart.js** for cash-flow and category charts; instances are destroyed before replacement and on component unmount.
- **Lucide Vue** for interface icons.

All financial amounts use integer minor units.

```text
RM25.80 → 2580
```

## Backend

### Supabase PostgreSQL

The production finance repository reads and writes these user-owned tables:

```text
profiles
categories
accounts
transactions
budgets
```

Budget months use the canonical SQL date form `YYYY-MM-01`. Transactions use `YYYY-MM-DD` dates. The repository maps snake_case database rows to the camelCase production domain.

### Supabase Auth

The current authentication flow supports email/password signup, login, password recovery, and password updates. The protected lifecycle initializes the session, loads the authenticated user's finance snapshot, resets state on sign-out, and redirects unauthenticated users.

### Row Level Security

Supabase Row Level Security and owner-scoped repository filters ensure users access only their own profile and finance rows.

## Local presentation state

Local component state is limited to presentation concerns such as:

- Active finance page
- Search and type filters
- Modal drafts and pending flags
- Toast messages
- Selected display month
- Chart instances
- Dark-mode preference

There is no offline finance database or synchronization queue in the current production architecture.

## Testing and verification

- **Vitest** covers finance calculations, repository mapping and mutations, authenticated stores/lifecycle, UI boundary validation, CSV safety, budget month normalization, and approved markup contracts.
- **vue-tsc** validates TypeScript and Vue templates as part of the production build.
- **Vite build** generates the deployable `dist/` output.

```bash
npm test
npm run build
```

## Hosting and deployment

GitHub Actions tests and builds the app, then deploys the production bundle to GitHub Pages. Supabase is hosted separately for authentication, PostgreSQL, and Row Level Security.

Required client environment variables:

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
```

Local secrets belong in `.env`; `.env.example` documents the required keys without credentials.

## Current stack summary

```text
Frontend Framework    Vue 3
Programming Language  TypeScript
Build Tool            Vite
CSS                    Tailwind CSS + project CSS
Routing                Vue Router
State Management       Pinia
Cloud Database         Supabase PostgreSQL
Authentication         Supabase Auth
Cloud Security         Supabase Row Level Security
Charts                 Chart.js
Unit Testing           Vitest
Source Control         GitHub
Frontend Hosting       GitHub Pages
```

## Deferred work

- Transaction editing and category creation
- Budget copy workflows
- Installable PWA and offline support
- Native Android/iOS packaging and widgets
