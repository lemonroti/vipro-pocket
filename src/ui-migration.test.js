import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const root = new URL('.', import.meta.url)
const app = readFileSync(new URL('./App.vue', root), 'utf8')
const main = readFileSync(new URL('./main.ts', root), 'utf8')
const packageJson = readFileSync(new URL('../package.json', root), 'utf8')
const dashboardUrl = new URL('./components/finance/FinanceDashboard.vue', root)
const dashboard = existsSync(dashboardUrl) ? readFileSync(dashboardUrl, 'utf8') : ''

describe('Task 7 finance UI migration', () => {
  it('splits the approved finance UI from the authenticated App gate', () => {
    expect(dashboard).toContain('class="app-shell"')
    expect(app).toContain('createProtectedFinanceLifecycle')
    expect(app).toContain('<FinanceDashboard')
    expect(main).toContain("{ path: '/', component: App }")
    expect(main).not.toContain('ProtectedApp')
  })

  it('has no Dexie, seed data, reset-data, or IndexedDB runtime dependency', () => {
    const runtime = `${app}\n${dashboard}\n${packageJson}`
    expect(runtime).not.toMatch(/dexie|PocketDb|seedAccounts|seedTransactions|seedBudgets|resetData|IndexedDB/i)
  })

  it('binds mutations and profile currency to the finance store', () => {
    expect(dashboard).toContain('useFinanceStore()')
    expect(dashboard).toContain('finance.createTransaction(')
    expect(dashboard).toContain('finance.deleteTransaction(')
    expect(dashboard).toContain('finance.upsertBudget(')
    expect(dashboard).toContain('finance.updateProfileCurrency(')
  })

  it('resolves category labels and colors from store category IDs', () => {
    expect(dashboard).toContain('transactionCategoryName(item)')
    expect(dashboard).toContain('categoryById.value.get(categoryId)?.color')
    expect(dashboard).toContain('{{ largestCategoryName }}')
  })

  it('marks empty accounts, transactions, and budgets with account guidance', () => {
    expect(dashboard).toContain('No accounts yet')
    expect(dashboard).toContain('No transactions yet')
    expect(dashboard).toContain('No budgets yet')
    expect(dashboard).toContain('Add an account before creating a transaction')
  })

  it('uses safe controls and contains no prototype identity', () => {
    expect(dashboard).toContain('step="0.01"')
    expect(dashboard).toContain(':disabled="transactionPending || !canSubmit"')
    expect(dashboard).toMatch(/runControlMutation\(\s*control,\s*rollbackValue,/)
    expect(dashboard).toMatch(/runControlMutation\(\s*control,\s*previousCurrency,/)
    expect(dashboard).not.toContain('activePage.value = page\n  nextTick(renderCharts)')
    expect(dashboard).not.toMatch(/Lemon Roti|class="avatar">LR/)
  })
})
