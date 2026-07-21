# Vipro Pocket Production Operations

This runbook is the source of truth for releasing and operating the private beta.

## Production services

- Web app: `https://lemonroti.github.io/vipro-pocket/`
- Frontend deployment: GitHub Pages from `main`
- Database and authentication: Supabase project `vipro-pocket` in Singapore
- Release workflow: `.github/workflows/deploy-pages.yml`

Only these public browser values belong in GitHub repository variables:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Never add a service-role key, email-provider credential, database password, or personal access token to the repository or frontend variables.

## Authentication configuration

Supabase Authentication must use:

- Site URL: `https://lemonroti.github.io/vipro-pocket/`
- Email/password provider: enabled
- New-user signup: enabled for the private beta

Email confirmation is disabled for the current single-user beta because the application intentionally requires signup to return an authenticated session immediately. Before opening registration to the public, enable email confirmation and update the signup UI to handle a confirmation-pending response instead of assuming an immediate session.

## Authentication email policy

The owner has explicitly excluded authentication email from the private-beta release. The application therefore does not expose forgot-password or update-password routes. The already tested recovery implementation is retained for a future email-enabled release, but it is not part of the reachable beta surface or release gate.

Before exposing recovery or opening registration beyond the private beta:

1. Configure a custom SMTP provider in Supabase using a verified sender domain.
2. Enable email confirmation and update signup to handle a confirmation-pending response.
3. Restore the recovery routes and links through a reviewed code change.
4. Verify delivered confirmation and recovery emails end to end in the deployed app.

## Release procedure

1. Confirm the pull request is reviewed and has no unresolved conversations.
2. Confirm required checks `frontend-checks` and `database-tests` pass.
3. Confirm Supabase Security Advisor has no findings. Review Performance Advisor findings rather than deleting new indexes merely because a low-traffic database has not used them yet.
4. Squash or rebase merge into `main`; branch protection requires linear history.
5. Wait for the `main` workflow's frontend, database, and Pages deploy jobs to pass.
6. Verify the deployed URL in desktop Chrome and Android Chrome or a Chrome Android emulator.
7. Test signup, login, logout, refresh persistence, accounts, categories, expense/income/transfer transactions, budgets, CSV export, currency, and reports/charts.

## Rollback and incident handling

- Frontend regression: revert the release commit through a pull request and let the protected workflow redeploy it.
- Authentication incident: disable new signups in Supabase while preserving existing-user access, then investigate logs.
- Database change: use a reviewed forward migration. Do not edit migration history or destructively reset the production database.
- Suspected key exposure: rotate the affected key immediately. A service-role key must never be used by this browser application.
