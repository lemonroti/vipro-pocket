# Mobile Bottom Navigation Design

## Context

The production dashboard hides its fixed sidebar below `760px`. The deployed `390 x 844` verification showed that no equivalent navigation is rendered, leaving mobile users unable to reach Transactions, Budgets, Accounts, Reports, or Settings. The existing floating transaction button is not a navigation substitute.

## Approved Design

Add a fixed mobile bottom navigation that reuses the existing `navigation` array and `switchPage()` behavior. It exposes all six existing destinations—Dashboard, Transactions, Budgets, Accounts, Reports, and Settings—without creating a second page model or router.

Each destination is a semantic `button` containing the existing Lucide icon and a compact visible label. The active destination uses `aria-current="page"` and a visually distinct state. The navigation has an accessible label and respects the device safe-area inset.

## Responsive Behavior

- Show the bottom navigation only below `760px`.
- Keep the current sidebar unchanged at and above `760px`.
- Reserve enough bottom padding on the main content so the fixed navigation does not cover content.
- Move the existing mobile transaction FAB above the navigation and safe-area inset.
- Fit six equal-width destinations at the supported `320px` minimum viewport without horizontal scrolling.

## Scope

This is a navigation accessibility and responsive-layout repair only. It does not change finance state, routes, Supabase behavior, page content, desktop navigation, or the accepted visual language. It adds no dependency.

## Verification

- A focused markup test proves that all destinations are rendered from the shared navigation model and that active-page semantics are present.
- A focused CSS test proves mobile visibility, desktop hiding, six-column sizing, safe-area handling, and FAB clearance.
- The full frontend suite, type-check, and production build must pass locally and in GitHub Actions.
- The deployed site must be checked at `390 x 844`: every destination is reachable, Settings exposes Sign out, refresh preserves the session, and the console has zero errors and warnings.
