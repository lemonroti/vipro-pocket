import { describe, expect, it, vi } from 'vitest'
import * as ui from './finance-ui'

const accounts = [
  { id: 'bank', name: 'Bank', kind: 'asset', userId: 'private-user' },
  { id: 'cash', name: 'Cash', kind: 'asset', userId: 'private-user' },
]
const categories = [
  { id: 'food-id', name: 'Food', type: 'expense', color: '#123456', userId: 'private-user' },
  { id: 'salary-id', name: 'Salary', type: 'income', color: '#654321', userId: 'private-user' },
]

describe('finance UI boundary', () => {
  it('canonicalizes the selected display month for production-shaped budgets', () => {
    expect(ui.canonicalBudgetMonth).toBeTypeOf('function')
    expect(ui.canonicalBudgetMonth('2026-07')).toBe('2026-07-01')
    const budgets = [{ id: 'budget', categoryId: 'food-id', month: '2026-07-01', limitMinor: 12345 }]
    expect(ui.budgetForMonth(budgets, 'food-id', '2026-07')?.limitMinor).toBe(12345)
    expect(ui.createBudgetInput('food-id', '2026-07', 12345)).toEqual({
      categoryId: 'food-id', month: '2026-07-01', limitMinor: 12345,
    })
  })

  it('accepts only finite safe amounts with at most two decimals', () => {
    expect(ui.parseMinorUnits).toBeTypeOf('function')
    expect(ui.parseMinorUnits('12.34')).toBe(1234)
    expect(ui.parseMinorUnits('0', { allowZero: true })).toBe(0)
    for (const value of ['', '0', '-1', '1.001', '1e3', 'Infinity', 'NaN', '900719925474099.99']) {
      expect(ui.parseMinorUnits(value)).toBeNull()
    }
  })

  it('validates dates and current account/category membership by transaction type', () => {
    expect(ui.isValidTransactionDraft).toBeTypeOf('function')
    const base = { type: 'expense', amount: '10.00', accountId: 'bank', toAccountId: '', categoryId: 'food-id', transactionDate: '2026-07-22' }
    expect(ui.isValidTransactionDraft(base, accounts, categories)).toBe(true)
    expect(ui.isValidTransactionDraft({ ...base, transactionDate: '2026-02-30' }, accounts, categories)).toBe(false)
    expect(ui.isValidTransactionDraft({ ...base, accountId: 'missing' }, accounts, categories)).toBe(false)
    expect(ui.isValidTransactionDraft({ ...base, categoryId: 'salary-id' }, accounts, categories)).toBe(false)
    expect(ui.isValidTransactionDraft({ ...base, type: 'transfer', categoryId: '', toAccountId: 'cash' }, accounts, categories)).toBe(true)
    expect(ui.isValidTransactionDraft({ ...base, type: 'transfer', categoryId: '', toAccountId: 'bank' }, accounts, categories)).toBe(false)
    expect(ui.isValidTransactionDraft({ ...base, type: 'transfer', categoryId: '', toAccountId: 'missing' }, accounts, categories)).toBe(false)
  })

  it('prevents a second acquisition until a pending submission completes', () => {
    expect(ui.createPendingLock).toBeTypeOf('function')
    const lock = ui.createPendingLock()
    expect(lock.tryAcquire()).toBe(true)
    expect(lock.tryAcquire()).toBe(false)
    lock.release()
    expect(lock.tryAcquire()).toBe(true)
  })

  it('rolls rejected currency and budget controls back to server-backed values', async () => {
    expect(ui.runControlMutation).toBeTypeOf('function')
    const currencyControl = { value: 'USD' }
    const budgetControl = { value: '99.99' }
    await expect(ui.runControlMutation(currencyControl, 'MYR', () => Promise.reject(new Error('offline')))).resolves.toBe(false)
    await expect(ui.runControlMutation(budgetControl, '12.34', () => Promise.reject(new Error('offline')))).resolves.toBe(false)
    expect(currencyControl.value).toBe('MYR')
    expect(budgetControl.value).toBe('12.34')
  })

  it('exports resolved names without user IDs or internal entity IDs', () => {
    expect(ui.buildTransactionsCsv).toBeTypeOf('function')
    const transactions = [{
      id: 'private-transaction', userId: 'private-user', type: 'transfer', amountMinor: 1234,
      accountId: 'bank', toAccountId: 'cash', categoryId: null, merchant: 'Move money', note: '',
      transactionDate: '2026-07-22', createdAt: '', updatedAt: '',
    }]
    const csv = ui.buildTransactionsCsv(transactions, accounts, categories)
    expect(csv).toContain('Bank')
    expect(csv).toContain('Cash')
    expect(csv).toContain('Transfer')
    expect(csv).not.toMatch(/private-user|private-transaction|food-id|salary-id/)
  })

  it('neutralizes spreadsheet formulas while preserving CSV quote escaping', () => {
    const dangerous = ['=SUM(A1:A2)', '+cmd', '-2+3', '@name', '\tformula', '\rformula']
    const transactions = dangerous.map((merchant, index) => ({
      id: `transaction-${index}`, userId: 'private-user', type: 'expense', amountMinor: 100,
      accountId: 'bank', toAccountId: null, categoryId: 'food-id', merchant, note: '',
      transactionDate: '2026-07-22', createdAt: '', updatedAt: '',
    }))
    const quoted = ui.buildTransactionsCsv([
      ...transactions,
      { ...transactions[0], id: 'quoted', merchant: '=1"2' },
    ], accounts, categories)
    dangerous.forEach((value) => expect(quoted).toContain(`"'${value}"`))
    expect(quoted).toContain('"\'=1""2"')
  })

  it('destroys every mounted chart before replacement or unmount', () => {
    expect(ui.destroyCharts).toBeTypeOf('function')
    const first = { destroy: vi.fn() }
    const second = { destroy: vi.fn() }
    ui.destroyCharts(first, second)
    expect(first.destroy).toHaveBeenCalledOnce()
    expect(second.destroy).toHaveBeenCalledOnce()
  })
})
