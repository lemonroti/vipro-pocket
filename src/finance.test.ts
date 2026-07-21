import { describe, expect, it } from 'vitest'
import { accountBalances, categoryTotals, monthlySummary, netWorth } from './finance'
import type { Account, Transaction } from './types/finance-domain'

const accounts: Account[] = [
  { id: 'bank', userId: 'user', name: 'Bank', kind: 'asset', openingBalanceMinor: 100000, color: '#000', createdAt: '', updatedAt: '' },
  { id: 'cash', userId: 'user', name: 'Cash', kind: 'asset', openingBalanceMinor: 10000, color: '#000', createdAt: '', updatedAt: '' },
  { id: 'card', userId: 'user', name: 'Card', kind: 'liability', openingBalanceMinor: 20000, color: '#000', createdAt: '', updatedAt: '' },
]
const base = { userId: 'user', merchant: '', note: '', createdAt: '2026-07-01T00:00:00Z', updatedAt: '' }
const transactions: Transaction[] = [
  { ...base, id: '1', type: 'income', amountMinor: 50000, accountId: 'bank', toAccountId: null, categoryId: 'salary', transactionDate: '2026-07-01' },
  { ...base, id: '2', type: 'expense', amountMinor: 10000, accountId: 'bank', toAccountId: null, categoryId: 'food', transactionDate: '2026-07-02' },
  { ...base, id: '3', type: 'transfer', amountMinor: 20000, accountId: 'bank', toAccountId: 'cash', categoryId: null, transactionDate: '2026-07-03' },
  { ...base, id: '4', type: 'expense', amountMinor: 5000, accountId: 'card', toAccountId: null, categoryId: 'shopping', transactionDate: '2026-07-04' },
]

describe('finance rules', () => {
  it('excludes transfers from income and expense totals', () => {
    expect(monthlySummary(transactions, '2026-07')).toEqual({ incomeMinor: 50000, expenseMinor: 15000 })
  })
  it('moves transfer value between accounts', () => {
    expect(accountBalances(accounts, transactions)).toEqual({ bank: 120000, cash: 30000, card: 15000 })
  })
  it('subtracts liabilities from net worth', () => {
    expect(netWorth(accounts, transactions)).toBe(135000)
  })
  it('groups expense totals by production category IDs', () => {
    expect(categoryTotals(transactions, '2026-07')).toEqual({ food: 10000, shopping: 5000 })
  })
})
