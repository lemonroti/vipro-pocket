import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { FinanceSnapshot } from '../types/finance-domain'

const repository = vi.hoisted(() => ({
  loadSnapshot: vi.fn(),
  updateProfileCurrency: vi.fn(),
  createAccount: vi.fn(),
  updateAccount: vi.fn(),
  deleteAccount: vi.fn(),
  createCategory: vi.fn(),
  createTransaction: vi.fn(),
  updateTransaction: vi.fn(),
  deleteTransaction: vi.fn(),
  upsertBudget: vi.fn(),
  copyPreviousMonthBudgets: vi.fn(),
}))

vi.mock('../lib/finance-repository', () => ({
  createFinanceRepository: () => repository,
}))

import { useFinanceStore } from './finance'

const snapshot: FinanceSnapshot = {
  profile: { userId: 'user-1', currency: 'MYR', createdAt: '1', updatedAt: '1' },
  categories: [
    { id: 'category-b', userId: 'user-1', name: 'Food', type: 'expense', color: '#b', isDefault: true, createdAt: '1', updatedAt: '1' },
  ],
  accounts: [
    { id: 'account-b', userId: 'user-1', name: 'Wallet', kind: 'asset', openingBalanceMinor: 0, color: '#b', createdAt: '1', updatedAt: '1' },
  ],
  transactions: [
    { id: 'transaction-b', userId: 'user-1', type: 'expense', amountMinor: 100, accountId: 'account-b', categoryId: 'category-b', toAccountId: null, merchant: '', note: '', transactionDate: '2026-01-01', createdAt: '1', updatedAt: '1' },
  ],
  budgets: [
    { id: 'budget-old', userId: 'user-1', categoryId: 'category-b', month: '2026-01-01', limitMinor: 1000, createdAt: '1', updatedAt: '1' },
  ],
}

describe('finance store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('atomically replaces the full snapshot only after a successful load', async () => {
    let resolveLoad!: (value: FinanceSnapshot) => void
    repository.loadSnapshot.mockReturnValue(new Promise((resolve) => { resolveLoad = resolve }))
    const store = useFinanceStore()
    const pending = store.load('user-1')

    expect(store.loading).toBe(true)
    expect(store.userId).toBeNull()
    expect(store.profile).toBeNull()

    resolveLoad(snapshot)
    await pending

    expect(store.$state).toMatchObject({ ...snapshot, userId: 'user-1', loading: false, initialized: true, error: '' })
  })

  it('does not restore finance data when reset invalidates an in-flight load', async () => {
    let resolveLoad!: (value: FinanceSnapshot) => void
    repository.loadSnapshot.mockReturnValue(new Promise((resolve) => { resolveLoad = resolve }))
    const store = useFinanceStore()
    const pending = store.load('user-1')

    store.reset()
    resolveLoad(snapshot)
    await pending

    expect(store.userId).toBeNull()
    expect(store.profile).toBeNull()
    expect(store.initialized).toBe(false)
    expect(store.loading).toBe(false)
  })

  it('preserves prior finance data when a load or mutation fails', async () => {
    repository.loadSnapshot.mockResolvedValue(snapshot)
    const store = useFinanceStore()
    await store.load('user-1')
    const prior = JSON.parse(JSON.stringify(store.$state)) as typeof store.$state

    repository.loadSnapshot.mockRejectedValueOnce(new Error('database hostname leaked'))
    await expect(store.load('user-2')).rejects.toThrow('database hostname leaked')
    expect(store.$state).toMatchObject({ ...prior, loading: false, error: 'Unable to load your finance data. Please try again.' })

    repository.createAccount.mockRejectedValueOnce(new Error('insert detail leaked'))
    await expect(store.createAccount({ name: 'Bank', kind: 'asset', openingBalanceMinor: 0, color: '#a' }))
      .rejects.toThrow('insert detail leaked')
    expect(store.accounts).toEqual(prior.accounts)
    expect(store.error).toBe('Unable to create the account. Please try again.')
  })

  it('reconciles server-returned account and category rows by ID', async () => {
    repository.loadSnapshot.mockResolvedValue(snapshot)
    const store = useFinanceStore()
    await store.load('user-1')
    const accountA = { ...snapshot.accounts[0], id: 'account-a', name: 'Server A' }
    const accountB = { ...snapshot.accounts[0], name: 'Server B' }
    const categoryA = { ...snapshot.categories[0], id: 'category-a', name: 'Server category' }
    repository.createAccount.mockResolvedValue(accountA)
    repository.updateAccount.mockResolvedValue(accountB)
    repository.createCategory.mockResolvedValue(categoryA)
    repository.deleteAccount.mockResolvedValue(accountA)

    await store.createAccount({ name: 'Client A', kind: 'asset', openingBalanceMinor: 0, color: '#a' })
    await store.updateAccount('account-b', { name: 'Client B' })
    await store.createCategory({ name: 'Client category', type: 'expense', color: '#a' })
    expect(store.accounts.map(({ id, name }) => ({ id, name }))).toEqual([
      { id: 'account-a', name: 'Server A' },
      { id: 'account-b', name: 'Server B' },
    ])
    expect(store.categories.map(({ id }) => id)).toEqual(['category-a', 'category-b'])

    await store.deleteAccount('account-a')
    expect(store.accounts.map(({ id }) => id)).toEqual(['account-b'])
  })

  it('reconciles server-returned transaction create, update, and delete rows', async () => {
    repository.loadSnapshot.mockResolvedValue(snapshot)
    const store = useFinanceStore()
    await store.load('user-1')
    const transactionA = { ...snapshot.transactions[0], id: 'transaction-a', amountMinor: 200 }
    const transactionB = { ...snapshot.transactions[0], amountMinor: 300 }
    repository.createTransaction.mockResolvedValue(transactionA)
    repository.updateTransaction.mockResolvedValue(transactionB)
    repository.deleteTransaction.mockResolvedValue(transactionA)

    await store.createTransaction({ type: 'expense', amountMinor: 1, accountId: 'account-b', categoryId: 'category-b', merchant: '', note: '', transactionDate: '2026-01-01' })
    await store.updateTransaction('transaction-b', { type: 'expense', categoryId: 'category-b', amountMinor: 2 })
    expect(store.transactions.map(({ id, amountMinor }) => ({ id, amountMinor }))).toEqual([
      { id: 'transaction-a', amountMinor: 200 },
      { id: 'transaction-b', amountMinor: 300 },
    ])

    await store.deleteTransaction('transaction-a')
    expect(store.transactions.map(({ id }) => id)).toEqual(['transaction-b'])
  })

  it('replaces budget upserts and copies by user/category/month identity in deterministic order', async () => {
    repository.loadSnapshot.mockResolvedValue(snapshot)
    const store = useFinanceStore()
    await store.load('user-1')
    const replacement = { ...snapshot.budgets[0], id: 'budget-new', limitMinor: 2000 }
    const copiedA = { ...replacement, id: 'copy-a', categoryId: 'category-a', month: '2026-02-01' }
    const copiedB = { ...replacement, id: 'copy-b', categoryId: 'category-b', month: '2026-02-01' }
    repository.upsertBudget.mockResolvedValue(replacement)
    repository.copyPreviousMonthBudgets.mockResolvedValue([copiedB, copiedA])

    await store.upsertBudget({ categoryId: 'category-b', month: '2026-01-01', limitMinor: 1500 })
    expect(store.budgets).toEqual([replacement])
    await store.copyPreviousMonthBudgets('2026-02-01')
    expect(store.budgets.map(({ id }) => id)).toEqual(['budget-new', 'copy-a', 'copy-b'])
  })

  it('updates profile from the server and reset clears every user-owned state field', async () => {
    repository.loadSnapshot.mockResolvedValue(snapshot)
    repository.updateProfileCurrency.mockResolvedValue({ ...snapshot.profile, currency: 'USD', updatedAt: '2' })
    const store = useFinanceStore()
    await store.load('user-1')
    await store.updateProfileCurrency('USD')
    expect(store.profile?.currency).toBe('USD')

    store.reset()
    expect(store.$state).toEqual({
      profile: null, categories: [], accounts: [], transactions: [], budgets: [], userId: null,
      loading: false, initialized: false, error: '',
    })
  })
})
