import { describe, expect, it, vi } from 'vitest'
import { createPendingLock } from './finance-ui'
import * as ui from './transaction-ui'

const accounts = [{ id: 'bank', name: 'Bank' }, { id: 'cash', name: 'Cash' }]
const categories = [
  { id: 'food', name: 'Food', type: 'expense' },
  { id: 'salary', name: 'Salary', type: 'income' },
]
const expense = {
  id: 'expense-1', userId: 'user-1', type: 'expense', amountMinor: 12345,
  accountId: 'bank', toAccountId: null, categoryId: 'food', merchant: 'Cafe', note: 'Lunch',
  transactionDate: '2026-07-21', createdAt: '', updatedAt: '',
}
const draft = (overrides = {}) => ({
  type: 'expense', amount: '123.45', accountId: 'bank', toAccountId: '', categoryId: 'food',
  merchant: ' Cafe ', note: ' Lunch ', transactionDate: '2026-07-21', ...overrides,
})

describe('category management boundary', () => {
  it('validates category fields and same-type names case-insensitively', () => {
    expect(ui.categoryPayloadFromDraft({ name: '  Travel  ', type: 'expense', color: '#Aa33Ff' }, categories))
      .toEqual({ payload: { name: 'Travel', type: 'expense', color: '#Aa33Ff' }, error: '' })
    expect(ui.categoryPayloadFromDraft({ name: ' fOoD ', type: 'expense', color: '#123456' }, categories).error)
      .toBe('An expense category named "Food" already exists.')
    expect(ui.categoryPayloadFromDraft({ name: 'Food', type: 'income', color: '#123456' }, categories).payload).not.toBeNull()
    for (const invalid of [
      { name: '', type: 'expense', color: '#123456' },
      { name: 'x'.repeat(51), type: 'expense', color: '#123456' },
      { name: 'Travel', type: 'transfer', color: '#123456' },
      { name: 'Travel', type: 'expense', color: 'green' },
    ]) expect(ui.categoryPayloadFromDraft(invalid, categories).payload).toBeNull()
  })

  it('locks duplicates and returns safe rejected feedback', async () => {
    let finish
    const createCategory = vi.fn().mockReturnValue(new Promise((resolve) => { finish = resolve }))
    const options = { draft: { name: 'Travel', type: 'expense', color: '#123456' }, categories, createCategory, lock: createPendingLock() }
    const first = ui.saveCategory(options)
    expect((await ui.saveCategory(options)).status).toBe('pending')
    expect(createCategory).toHaveBeenCalledOnce()
    finish({})
    await expect(first).resolves.toEqual({ status: 'success' })
    createCategory.mockRejectedValueOnce(new Error('A category with this name and type already exists.'))
    await expect(ui.saveCategory({ ...options, lock: createPendingLock() })).resolves.toEqual({
      status: 'rejected', message: 'A category with this name and type already exists.',
    })
  })
})

describe('transaction management boundary', () => {
  it('starts edits from persisted values and builds trimmed full payloads', () => {
    expect(ui.transactionDraftFromTransaction(expense)).toEqual({
      type: 'expense', amount: '123.45', accountId: 'bank', toAccountId: '', categoryId: 'food',
      merchant: 'Cafe', note: 'Lunch', transactionDate: '2026-07-21',
    })
    expect(ui.transactionPayloadFromDraft(draft(), accounts, categories).payload).toEqual({
      type: 'expense', amountMinor: 12345, accountId: 'bank', categoryId: 'food',
      merchant: 'Cafe', note: 'Lunch', transactionDate: '2026-07-21',
    })
    expect(ui.transactionPayloadFromDraft(draft({ merchant: ' ' }), accounts, categories).payload.merchant).toBe('Food')
    expect(ui.transactionPayloadFromDraft(draft({ type: 'transfer', categoryId: '', toAccountId: 'cash', merchant: ' ' }), accounts, categories).payload)
      .toMatchObject({ type: 'transfer', toAccountId: 'cash', merchant: 'Transfer' })
  })

  it('rejects invalid money, date, membership, shape, and text lengths', () => {
    const invalid = [
      draft({ amount: '0' }), draft({ amount: '1.001' }), draft({ transactionDate: '2026-02-30' }),
      draft({ accountId: 'missing' }), draft({ categoryId: 'salary' }), draft({ toAccountId: 'cash' }),
      draft({ type: 'transfer', categoryId: 'food', toAccountId: 'cash' }),
      draft({ type: 'transfer', categoryId: '', toAccountId: 'bank' }),
      draft({ merchant: 'x'.repeat(121) }), draft({ note: 'x'.repeat(501) }),
    ]
    invalid.forEach((item) => expect(ui.transactionPayloadFromDraft(item, accounts, categories).payload).toBeNull())
  })

  it('clears incompatible fields and selects valid defaults on type changes', () => {
    expect(ui.transitionTransactionDraft(draft(), 'transfer', accounts, categories)).toMatchObject({ type: 'transfer', categoryId: '', toAccountId: 'cash' })
    expect(ui.transitionTransactionDraft(draft({ toAccountId: 'cash' }), 'income', accounts, categories)).toMatchObject({ type: 'income', categoryId: 'salary', toAccountId: '' })
  })

  it('routes create versus update once and preserves rejection context', async () => {
    const createTransaction = vi.fn().mockResolvedValue({})
    const updateTransaction = vi.fn().mockResolvedValue({})
    const base = { draft: draft(), accounts, categories, createTransaction, updateTransaction }
    await ui.saveTransaction({ ...base, transactionId: null, lock: createPendingLock() })
    await ui.saveTransaction({ ...base, transactionId: 'expense-1', lock: createPendingLock() })
    expect(createTransaction).toHaveBeenCalledOnce()
    expect(updateTransaction).toHaveBeenCalledWith('expense-1', expect.objectContaining({ amountMinor: 12345 }))
    updateTransaction.mockRejectedValueOnce(new Error('database details'))
    await expect(ui.saveTransaction({ ...base, transactionId: 'expense-1', lock: createPendingLock() })).resolves.toEqual({
      status: 'rejected', message: 'Unable to update the transaction. Please try again.',
    })
  })

  it('identifies delete confirmation and preserves a rejected row', async () => {
    const confirmDelete = vi.fn().mockReturnValue(true)
    const deleteTransaction = vi.fn().mockRejectedValue(new Error('database details'))
    await expect(ui.deleteTransactionWithConfirmation({ transaction: expense, deleteTransaction, confirmDelete, lock: createPendingLock() }))
      .resolves.toEqual({ status: 'rejected', message: 'Unable to delete the transaction. Please try again.' })
    expect(confirmDelete).toHaveBeenCalledWith('Delete transaction "Cafe" on 2026-07-21?')
  })
})
