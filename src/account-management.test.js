import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const dashboard = readFileSync(new URL('./components/finance/FinanceDashboard.vue', import.meta.url), 'utf8')
const accountStyles = readFileSync(new URL('./account-management.css', import.meta.url), 'utf8')

describe('Task 8 account management UI', () => {
  it('wires visible and empty-state account creation CTAs to the account form', () => {
    expect(dashboard.match(/Add account/g)?.length ?? 0).toBeGreaterThanOrEqual(2)
    expect(dashboard).toContain('openCreateAccount')
  })

  it('uses only server-first account store actions', () => {
    expect(dashboard).toContain('finance.createAccount')
    expect(dashboard).toContain('finance.updateAccount')
    expect(dashboard).toContain('finance.deleteAccount')
    expect(dashboard).not.toMatch(/accounts\.value\.(push|splice)|accounts\.value\s*=/)
  })

  it('exposes accessible edit, form error, and destructive controls', () => {
    expect(dashboard).toContain(':aria-label="`Edit ${account.name}`"')
    expect(dashboard).toContain(":aria-describedby=\"accountError ? 'account-form-error' : undefined\"")
    expect(dashboard).not.toContain('novalidate aria-describedby="account-form-error"')
    expect(dashboard).toContain('id="account-form-error"')
    expect(dashboard).toContain('role="alert"')
    expect(dashboard).toContain('Delete account')
  })

  it('allows unbroken account names to shrink without squeezing balance controls', () => {
    expect(accountStyles).toMatch(/\.account-card\s*>\s*div\s*{[^}]*min-width:\s*0[^}]*}/s)
    expect(accountStyles).toMatch(/\.account-card h3\s*{[^}]*overflow-wrap:\s*anywhere[^}]*}/s)
    expect(accountStyles).toMatch(/\.account-card\s*>\s*strong\s*{[^}]*flex:\s*0 0 auto[^}]*}/s)
  })
})
