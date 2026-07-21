import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const dashboard = readFileSync(new URL('./components/finance/FinanceDashboard.vue', import.meta.url), 'utf8')

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
    expect(dashboard).toContain('id="account-form-error"')
    expect(dashboard).toContain('role="alert"')
    expect(dashboard).toContain('Delete account')
  })
})
