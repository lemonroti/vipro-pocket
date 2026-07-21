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

Never add a service-role key, SMTP password, database password, or personal access token to the repository or frontend variables.

## Authentication configuration

Supabase Authentication must use:

- Site URL: `https://lemonroti.github.io/vipro-pocket/`
- Password recovery redirect: `https://lemonroti.github.io/vipro-pocket/#/update-password`
- Email/password provider: enabled
- New-user signup: enabled for the private beta

Email confirmation is disabled for the current single-user beta because the application intentionally requires signup to return an authenticated session immediately. Before opening registration to the public, enable email confirmation and update the signup UI to handle a confirmation-pending response instead of assuming an immediate session.

## Production SMTP gate

Configure custom SMTP in **Supabase Dashboard → Authentication → Emails → SMTP Settings**. Keep the credentials only in Supabase. Required provider values are:

- SMTP host and port
- SMTP username and password/API credential
- Sender email from a verified domain
- Sender name

After saving, verify the complete recovery journey with a real inbox:

1. Open the deployed login page and select **Forgot password?**
2. Request a reset for the beta account.
3. Confirm the email arrives and the sender/domain are correct.
4. Open the link and confirm it lands on `#/update-password`.
5. Set a new password, sign out, and sign in with the new password.
6. Confirm the old password no longer works and no provider error details appear in the UI.

Do not merge a release described as production-ready until this journey passes. Supabase's built-in mailer is suitable only for limited testing and is not the production mail transport.

## Release procedure

1. Confirm the pull request is reviewed and has no unresolved conversations.
2. Confirm required checks `frontend-checks` and `database-tests` pass.
3. Confirm Supabase Security Advisor has no findings. Review Performance Advisor findings rather than deleting new indexes merely because a low-traffic database has not used them yet.
4. Squash or rebase merge into `main`; branch protection requires linear history.
5. Wait for the `main` workflow's frontend, database, and Pages deploy jobs to pass.
6. Verify the deployed URL in desktop Chrome and Android Chrome or a Chrome Android emulator.
7. Test login, logout, refresh persistence, accounts, categories, expense/income/transfer transactions, budgets, CSV export, currency, reports/charts, and password recovery.

## Rollback and incident handling

- Frontend regression: revert the release commit through a pull request and let the protected workflow redeploy it.
- Authentication incident: disable new signups in Supabase while preserving existing-user access, then investigate logs.
- Database change: use a reviewed forward migration. Do not edit migration history or destructively reset the production database.
- Suspected key exposure: rotate the affected key immediately. A service-role key must never be used by this browser application.

