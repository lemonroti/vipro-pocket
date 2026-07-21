import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import type { Database } from '../types/database'

vi.mock('./supabase', () => ({ supabase: {} }))

import { createFinanceRepository } from './finance-repository'

type Response = { data: unknown; error: unknown }

type RecordedQuery = {
  table: string
  operation?: string
  payload?: unknown
  options?: unknown
  filters: Array<[string, unknown]>
  orders: Array<[string, { ascending?: boolean } | undefined]>
  selected: boolean
  single: boolean
}

function fakeClient(responses: Record<string, Response[]>) {
  const queries: RecordedQuery[] = []

  const client = {
    from(table: string) {
      const response = responses[table]?.shift() ?? { data: null, error: null }
      const recorded: RecordedQuery = {
        table,
        filters: [],
        orders: [],
        selected: false,
        single: false,
      }
      queries.push(recorded)

      const builder = {
        select() {
          recorded.selected = true
          return builder
        },
        insert(payload: unknown) {
          recorded.operation = 'insert'
          recorded.payload = payload
          return builder
        },
        update(payload: unknown) {
          recorded.operation = 'update'
          recorded.payload = payload
          return builder
        },
        delete() {
          recorded.operation = 'delete'
          return builder
        },
        upsert(payload: unknown, options?: unknown) {
          recorded.operation = 'upsert'
          recorded.payload = payload
          recorded.options = options
          return builder
        },
        eq(column: string, value: unknown) {
          recorded.filters.push([column, value])
          return builder
        },
        order(column: string, options?: { ascending?: boolean }) {
          recorded.orders.push([column, options])
          return builder
        },
        single() {
          recorded.single = true
          return Promise.resolve(response)
        },
        then(resolve: (value: Response) => unknown, reject?: (reason: unknown) => unknown) {
          return Promise.resolve(response).then(resolve, reject)
        },
      }

      return builder
    },
  }

  return { client: client as unknown as SupabaseClient<Database>, queries }
}

const profileRow = {
  user_id: 'user-1',
  currency: 'MYR',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-02T00:00:00Z',
}

const categoryRow = {
  id: 'category-1',
  user_id: 'user-1',
  name: 'Food',
  type: 'expense',
  color: '#ef7b66',
  is_default: true,
  created_at: '2026-01-03T00:00:00Z',
  updated_at: '2026-01-04T00:00:00Z',
}

const accountRow = {
  id: 'account-1',
  user_id: 'user-1',
  name: 'Wallet',
  kind: 'asset',
  opening_balance_minor: 12500,
  color: '#2aa883',
  created_at: '2026-01-05T00:00:00Z',
  updated_at: '2026-01-06T00:00:00Z',
}

const transactionRow = {
  id: 'transaction-1',
  user_id: 'user-1',
  type: 'expense',
  amount_minor: 1590,
  account_id: 'account-1',
  to_account_id: null,
  category_id: 'category-1',
  merchant: 'Cafe',
  note: '',
  transaction_date: '2026-01-07',
  created_at: '2026-01-07T01:00:00Z',
  updated_at: '2026-01-07T02:00:00Z',
}

const budgetRow = {
  id: 'budget-1',
  user_id: 'user-1',
  category_id: 'category-1',
  month: '2026-01-01',
  limit_minor: 50000,
  created_at: '2026-01-08T00:00:00Z',
  updated_at: '2026-01-09T00:00:00Z',
}

describe('finance repository', () => {
  it('loads and completely maps a user snapshot with scoped deterministic queries', async () => {
    const { client, queries } = fakeClient({
      profiles: [{ data: profileRow, error: null }],
      categories: [{ data: [categoryRow], error: null }],
      accounts: [{ data: [accountRow], error: null }],
      transactions: [{ data: [transactionRow], error: null }],
      budgets: [{ data: [budgetRow], error: null }],
    })

    const snapshot = await createFinanceRepository(client).loadSnapshot('user-1')

    expect(snapshot).toEqual({
      profile: {
        userId: 'user-1', currency: 'MYR', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-02T00:00:00Z',
      },
      categories: [{
        id: 'category-1', userId: 'user-1', name: 'Food', type: 'expense', color: '#ef7b66',
        isDefault: true, createdAt: '2026-01-03T00:00:00Z', updatedAt: '2026-01-04T00:00:00Z',
      }],
      accounts: [{
        id: 'account-1', userId: 'user-1', name: 'Wallet', kind: 'asset', openingBalanceMinor: 12500,
        color: '#2aa883', createdAt: '2026-01-05T00:00:00Z', updatedAt: '2026-01-06T00:00:00Z',
      }],
      transactions: [{
        id: 'transaction-1', userId: 'user-1', type: 'expense', amountMinor: 1590,
        accountId: 'account-1', toAccountId: null, categoryId: 'category-1', merchant: 'Cafe', note: '',
        transactionDate: '2026-01-07', createdAt: '2026-01-07T01:00:00Z', updatedAt: '2026-01-07T02:00:00Z',
      }],
      budgets: [{
        id: 'budget-1', userId: 'user-1', categoryId: 'category-1', month: '2026-01-01',
        limitMinor: 50000, createdAt: '2026-01-08T00:00:00Z', updatedAt: '2026-01-09T00:00:00Z',
      }],
    })
    expect(queries.map(({ table, filters, orders }) => ({ table, filters, orders }))).toEqual([
      { table: 'profiles', filters: [['user_id', 'user-1']], orders: [['user_id', { ascending: true }]] },
      { table: 'categories', filters: [['user_id', 'user-1']], orders: [['created_at', { ascending: true }], ['id', { ascending: true }]] },
      { table: 'accounts', filters: [['user_id', 'user-1']], orders: [['created_at', { ascending: true }], ['id', { ascending: true }]] },
      { table: 'transactions', filters: [['user_id', 'user-1']], orders: [['transaction_date', { ascending: false }], ['created_at', { ascending: false }], ['id', { ascending: false }]] },
      { table: 'budgets', filters: [['user_id', 'user-1']], orders: [['month', { ascending: true }], ['category_id', { ascending: true }], ['id', { ascending: true }]] },
    ])
  })

  it('returns server mutation rows and propagates useful server errors', async () => {
    const serverError = { code: '23514', message: 'amount_minor must be positive' }
    const serverAccountRow = {
      ...accountRow,
      id: 'server-account-id',
      user_id: 'user-1',
      name: 'Server Wallet',
      opening_balance_minor: 13000,
      created_at: '2026-02-01T00:00:00Z',
      updated_at: '2026-02-02T00:00:00Z',
    }
    const successful = fakeClient({ accounts: [{ data: serverAccountRow, error: null }] })
    const failing = fakeClient({ transactions: [{ data: null, error: serverError }] })

    const account = await createFinanceRepository(successful.client).createAccount('user-1', {
      name: 'Wallet', kind: 'asset', openingBalanceMinor: 12500, color: '#2aa883',
    })

    expect(account).toEqual({
      id: 'server-account-id',
      userId: 'user-1',
      name: 'Server Wallet',
      kind: 'asset',
      openingBalanceMinor: 13000,
      color: '#2aa883',
      createdAt: '2026-02-01T00:00:00Z',
      updatedAt: '2026-02-02T00:00:00Z',
    })
    expect(successful.queries[0]).toMatchObject({
      operation: 'insert', selected: true, single: true,
      payload: { user_id: 'user-1', name: 'Wallet', kind: 'asset', opening_balance_minor: 12500, color: '#2aa883' },
    })
    await expect(createFinanceRepository(failing.client).createTransaction('user-1', {
      type: 'expense', amountMinor: -1, accountId: 'account-1', categoryId: 'category-1',
      merchant: '', note: '', transactionDate: '2026-01-07',
    })).rejects.toBe(serverError)
  })

  it('converts expense create and transfer update shapes and returns mapped server rows', async () => {
    const createdExpenseRow = {
      ...transactionRow,
      id: 'server-expense-id',
      amount_minor: 1700,
      merchant: 'Server Cafe',
      updated_at: '2026-01-07T03:00:00Z',
    }
    const updatedTransferRow = {
      ...transactionRow,
      id: 'transfer-1',
      type: 'transfer',
      amount_minor: 4200,
      account_id: 'account-1',
      to_account_id: 'account-2',
      category_id: null,
      merchant: '',
      note: 'Move savings',
      transaction_date: '2026-02-10',
      created_at: '2026-02-09T00:00:00Z',
      updated_at: '2026-02-10T01:00:00Z',
    }
    const { client, queries } = fakeClient({
      transactions: [
        { data: createdExpenseRow, error: null },
        { data: updatedTransferRow, error: null },
      ],
    })
    const repository = createFinanceRepository(client)

    const created = await repository.createTransaction('user-1', {
      type: 'expense', amountMinor: 1590, accountId: 'account-1', categoryId: 'category-1',
      merchant: 'Cafe', note: '', transactionDate: '2026-01-07',
    })
    const updated = await repository.updateTransaction('user-1', 'transfer-1', {
      type: 'transfer', amountMinor: 4200, accountId: 'account-1', toAccountId: 'account-2',
      merchant: '', note: 'Move savings', transactionDate: '2026-02-10',
    })

    expect(queries[0]).toMatchObject({
      operation: 'insert', selected: true, single: true,
      payload: {
        user_id: 'user-1', type: 'expense', amount_minor: 1590, account_id: 'account-1',
        to_account_id: null, category_id: 'category-1', merchant: 'Cafe', note: '', transaction_date: '2026-01-07',
      },
    })
    expect(created).toEqual({
      id: 'server-expense-id', userId: 'user-1', type: 'expense', amountMinor: 1700,
      accountId: 'account-1', toAccountId: null, categoryId: 'category-1', merchant: 'Server Cafe', note: '',
      transactionDate: '2026-01-07', createdAt: '2026-01-07T01:00:00Z', updatedAt: '2026-01-07T03:00:00Z',
    })
    expect(queries[1]).toMatchObject({
      operation: 'update', selected: true, single: true,
      filters: [['user_id', 'user-1'], ['id', 'transfer-1']],
      payload: {
        type: 'transfer', amount_minor: 4200, account_id: 'account-1', to_account_id: 'account-2',
        category_id: null, merchant: '', note: 'Move savings', transaction_date: '2026-02-10',
      },
    })
    expect(updated).toEqual({
      id: 'transfer-1', userId: 'user-1', type: 'transfer', amountMinor: 4200,
      accountId: 'account-1', toAccountId: 'account-2', categoryId: null, merchant: '', note: 'Move savings',
      transactionDate: '2026-02-10', createdAt: '2026-02-09T00:00:00Z', updatedAt: '2026-02-10T01:00:00Z',
    })
  })

  it('maps account foreign-key deletion errors to the exact friendly message', async () => {
    const { client } = fakeClient({ accounts: [{ data: null, error: { code: '23503', message: 'sensitive detail' } }] })

    await expect(createFinanceRepository(client).deleteAccount('user-1', 'account-1'))
      .rejects.toThrow('This account is used by one or more transactions and cannot be deleted.')
  })

  it('maps duplicate categories by stable SQLSTATE without leaking database details', async () => {
    const { client } = fakeClient({
      categories: [{
        data: null,
        error: { code: '23505', message: 'duplicate key violates categories_user_name_type_unique', details: 'private', hint: null },
      }],
    })
    await expect(createFinanceRepository(client).createCategory('user-1', {
      name: 'Food', type: 'expense', color: '#ef7b66',
    })).rejects.toThrow('A category with this name and type already exists.')
  })

  it('copies January budgets from the previous December with one correctly targeted upsert', async () => {
    const sourceRows = [
      { ...budgetRow, id: 'source-a', category_id: 'category-a', month: '2025-12-01', limit_minor: 10000 },
      { ...budgetRow, id: 'source-z', category_id: 'category-z', month: '2025-12-01', limit_minor: 90000 },
    ]
    const copiedRowsInServerOrder = [
      { ...sourceRows[1], id: 'copied-z', month: '2026-01-01' },
      { ...sourceRows[0], id: 'copied-a', month: '2026-01-01' },
    ]
    const { client, queries } = fakeClient({
      budgets: [
        { data: sourceRows, error: null },
        { data: copiedRowsInServerOrder, error: null },
      ],
    })

    const copied = await createFinanceRepository(client).copyPreviousMonthBudgets('user-1', '2026-01-01')

    expect(copied.map(({ categoryId, id }) => ({ categoryId, id }))).toEqual([
      { categoryId: 'category-a', id: 'copied-a' },
      { categoryId: 'category-z', id: 'copied-z' },
    ])
    expect(queries[0].filters).toEqual([['user_id', 'user-1'], ['month', '2025-12-01']])
    expect(queries[1]).toMatchObject({
      operation: 'upsert',
      options: { onConflict: 'user_id,category_id,month' },
      payload: [
        { user_id: 'user-1', category_id: 'category-a', month: '2026-01-01', limit_minor: 10000 },
        { user_id: 'user-1', category_id: 'category-z', month: '2026-01-01', limit_minor: 90000 },
      ],
      selected: true,
    })
  })

  it('does not write when the previous month has no budgets', async () => {
    const { client, queries } = fakeClient({ budgets: [{ data: [], error: null }] })

    await expect(createFinanceRepository(client).copyPreviousMonthBudgets('user-1', '2026-03-01')).resolves.toEqual([])
    expect(queries).toHaveLength(1)
    expect(queries[0].operation).toBeUndefined()
  })
})
