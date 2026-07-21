import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const dashboard = readFileSync(new URL('./components/finance/FinanceDashboard.vue', import.meta.url), 'utf8')

describe('monthly budget management wiring', () => {
  it('provides an accessible native month selector and the copy action', () => {
    expect(dashboard).toMatch(/<label[^>]*>\s*<span>Budget month<\/span>\s*<input[^>]*v-model="selectedBudgetMonth"[^>]*type="month"/s)
    expect(dashboard).toContain('Copy previous month')
    expect(dashboard).toContain('copyPreviousMonthBudgets')
  })

  it('coordinates copy and inline-write disabled states', () => {
    expect(dashboard).toContain(':disabled="budgetCopyPending || pendingBudgetIds.size > 0"')
    expect(dashboard).toContain(':disabled="budgetCopyPending || pendingBudgetIds.has(row.category.id)"')
  })

  it('shows clear empty, success, and safe rejection feedback', () => {
    expect(dashboard).toContain('No budgets found in')
    expect(dashboard).toContain('Budgets copied from')
    expect(dashboard).toContain('Unable to copy the previous month budgets. Please try again.')
  })
})
