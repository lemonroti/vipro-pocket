import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const dashboard = readFileSync(new URL('./components/finance/FinanceDashboard.vue', import.meta.url), 'utf8')
const styles = readFileSync(new URL('./category-transaction-management.css', import.meta.url), 'utf8')

describe('category and transaction management wiring', () => {
  it('connects custom categories only through the finance store', () => {
    expect(dashboard).toContain('finance.createCategory(')
    expect(dashboard).toMatch(/Add category/)
    expect(dashboard).toMatch(/Custom categories/)
    expect(dashboard).not.toMatch(/finance\.(update|delete)Category\(/)
  })

  it('connects accessible transaction edit and identified delete controls', () => {
    expect(dashboard).toContain('finance.updateTransaction(')
    expect(dashboard).toContain('openEditTransaction(item)')
    expect(dashboard).toMatch(/:aria-label="`Edit transaction/)
    expect(dashboard).toContain('deleteTransactionWithConfirmation')
  })

  it('wraps maximum-length category and transaction text on narrow screens', () => {
    expect(dashboard).toContain('<span>{{ category.name }}</span>')
    expect(styles).toMatch(/\.category-chip > span\s*{[^}]*overflow-wrap:\s*anywhere/s)
    expect(styles).toMatch(/\.transaction-row > div strong[\s\S]*overflow-wrap:\s*anywhere/s)
  })
})
