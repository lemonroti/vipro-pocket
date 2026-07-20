import { describe, expect, it } from 'vitest'
import { accountBalances, monthlySummary, netWorth, type Account, type Transaction } from './finance'

const accounts: Account[] = [
  { id: 'bank', name: 'Bank', kind: 'asset', openingBalanceMinor: 100000, color: '#000' },
  { id: 'cash', name: 'Cash', kind: 'asset', openingBalanceMinor: 10000, color: '#000' },
  { id: 'card', name: 'Card', kind: 'liability', openingBalanceMinor: 20000, color: '#000' },
]
const base = { merchant: '', note: '', createdAt: '2026-07-01T00:00:00Z' }
const transactions: Transaction[] = [
  { ...base, id: '1', type: 'income', amountMinor: 50000, accountId: 'bank', category: 'Salary', date: '2026-07-01' },
  { ...base, id: '2', type: 'expense', amountMinor: 10000, accountId: 'bank', category: 'Food', date: '2026-07-02' },
  { ...base, id: '3', type: 'transfer', amountMinor: 20000, accountId: 'bank', toAccountId: 'cash', category: 'Transfer', date: '2026-07-03' },
  { ...base, id: '4', type: 'expense', amountMinor: 5000, accountId: 'card', category: 'Shopping', date: '2026-07-04' },
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
})
