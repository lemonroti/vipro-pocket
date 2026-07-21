import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js'
import { supabase } from './supabase'
import type { Database, Tables, TablesInsert, TablesUpdate } from '../types/database'
import type {
  Account,
  Budget,
  Category,
  CreateAccountInput,
  CreateCategoryInput,
  CreateTransactionInput,
  FinanceSnapshot,
  Profile,
  Transaction,
  UpdateAccountInput,
  UpdateTransactionInput,
  UpsertBudgetInput,
} from '../types/finance-domain'

type ProfileRow = Tables<'profiles'>
type CategoryRow = Tables<'categories'>
type AccountRow = Tables<'accounts'>
type TransactionRow = Tables<'transactions'>
type BudgetRow = Tables<'budgets'>

function throwIfError(error: PostgrestError | null): void {
  if (error) throw error
}

function requireData<T>(data: T | null): T {
  if (data === null) throw new Error('The server did not return the requested row.')
  return data
}

function mapProfile(row: ProfileRow): Profile {
  return {
    userId: row.user_id,
    currency: row.currency,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapCategory(row: CategoryRow): Category {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    type: row.type,
    color: row.color,
    isDefault: row.is_default,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapAccount(row: AccountRow): Account {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    kind: row.kind,
    openingBalanceMinor: row.opening_balance_minor,
    color: row.color,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapTransaction(row: TransactionRow): Transaction {
  const base = {
    id: row.id,
    userId: row.user_id,
    amountMinor: row.amount_minor,
    accountId: row.account_id,
    merchant: row.merchant,
    note: row.note,
    transactionDate: row.transaction_date,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }

  if (row.type === 'transfer') {
    if (row.to_account_id === null) throw new Error('Transfer is missing its destination account.')
    return { ...base, type: row.type, toAccountId: row.to_account_id, categoryId: null }
  }

  if (row.category_id === null) throw new Error('Income or expense is missing its category.')
  return { ...base, type: row.type, toAccountId: null, categoryId: row.category_id }
}

function mapBudget(row: BudgetRow): Budget {
  return {
    id: row.id,
    userId: row.user_id,
    categoryId: row.category_id,
    month: row.month,
    limitMinor: row.limit_minor,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function toAccountUpdate(input: UpdateAccountInput): TablesUpdate<'accounts'> {
  return {
    ...(input.name === undefined ? {} : { name: input.name }),
    ...(input.kind === undefined ? {} : { kind: input.kind }),
    ...(input.openingBalanceMinor === undefined ? {} : { opening_balance_minor: input.openingBalanceMinor }),
    ...(input.color === undefined ? {} : { color: input.color }),
  }
}

function toTransactionUpdate(input: UpdateTransactionInput): TablesUpdate<'transactions'> {
  const common = {
    ...(input.amountMinor === undefined ? {} : { amount_minor: input.amountMinor }),
    ...(input.accountId === undefined ? {} : { account_id: input.accountId }),
    ...(input.merchant === undefined ? {} : { merchant: input.merchant }),
    ...(input.note === undefined ? {} : { note: input.note }),
    ...(input.transactionDate === undefined ? {} : { transaction_date: input.transactionDate }),
  }

  return input.type === 'transfer'
    ? { ...common, type: input.type, to_account_id: input.toAccountId, category_id: null }
    : { ...common, type: input.type, to_account_id: null, category_id: input.categoryId }
}

function toTransactionInsert(userId: string, input: CreateTransactionInput): TablesInsert<'transactions'> {
  const common = {
    user_id: userId,
    amount_minor: input.amountMinor,
    account_id: input.accountId,
    merchant: input.merchant,
    note: input.note,
    transaction_date: input.transactionDate,
  }

  return input.type === 'transfer'
    ? { ...common, type: input.type, to_account_id: input.toAccountId, category_id: null }
    : { ...common, type: input.type, to_account_id: null, category_id: input.categoryId }
}

function previousMonth(month: string): string {
  const match = /^(\d{4})-(\d{2})-01$/.exec(month)
  if (!match) throw new Error('Month must use YYYY-MM-01 format.')
  const year = Number(match[1])
  const monthIndex = Number(match[2]) - 1
  if (monthIndex < 0 || monthIndex > 11) throw new Error('Month must use YYYY-MM-01 format.')
  const date = new Date(Date.UTC(year, monthIndex - 1, 1))
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-01`
}

export function createFinanceRepository(
  client: SupabaseClient<Database> = supabase,
) {
  return {
    async loadSnapshot(userId: string): Promise<FinanceSnapshot> {
      const [profileResult, categoriesResult, accountsResult, transactionsResult, budgetsResult] = await Promise.all([
        client.from('profiles').select('*').eq('user_id', userId).order('user_id', { ascending: true }).single(),
        client.from('categories').select('*').eq('user_id', userId).order('created_at', { ascending: true }).order('id', { ascending: true }),
        client.from('accounts').select('*').eq('user_id', userId).order('created_at', { ascending: true }).order('id', { ascending: true }),
        client.from('transactions').select('*').eq('user_id', userId).order('transaction_date', { ascending: false }).order('created_at', { ascending: false }).order('id', { ascending: false }),
        client.from('budgets').select('*').eq('user_id', userId).order('month', { ascending: true }).order('category_id', { ascending: true }).order('id', { ascending: true }),
      ])

      throwIfError(profileResult.error)
      throwIfError(categoriesResult.error)
      throwIfError(accountsResult.error)
      throwIfError(transactionsResult.error)
      throwIfError(budgetsResult.error)

      return {
        profile: mapProfile(requireData(profileResult.data)),
        categories: (categoriesResult.data ?? []).map(mapCategory),
        accounts: (accountsResult.data ?? []).map(mapAccount),
        transactions: (transactionsResult.data ?? []).map(mapTransaction),
        budgets: (budgetsResult.data ?? []).map(mapBudget),
      }
    },

    async updateProfileCurrency(userId: string, currency: string): Promise<Profile> {
      const { data, error } = await client.from('profiles').update({ currency }).eq('user_id', userId).select('*').single()
      throwIfError(error)
      return mapProfile(requireData(data))
    },

    async createAccount(userId: string, input: CreateAccountInput): Promise<Account> {
      const { data, error } = await client.from('accounts').insert({
        user_id: userId,
        name: input.name,
        kind: input.kind,
        opening_balance_minor: input.openingBalanceMinor,
        color: input.color,
      }).select('*').single()
      throwIfError(error)
      return mapAccount(requireData(data))
    },

    async updateAccount(userId: string, accountId: string, input: UpdateAccountInput): Promise<Account> {
      const { data, error } = await client.from('accounts').update(toAccountUpdate(input)).eq('user_id', userId).eq('id', accountId).select('*').single()
      throwIfError(error)
      return mapAccount(requireData(data))
    },

    async deleteAccount(userId: string, accountId: string): Promise<Account> {
      const { data, error } = await client.from('accounts').delete().eq('user_id', userId).eq('id', accountId).select('*').single()
      if (error?.code === '23503') {
        throw new Error('This account is used by one or more transactions and cannot be deleted.')
      }
      throwIfError(error)
      return mapAccount(requireData(data))
    },

    async createCategory(userId: string, input: CreateCategoryInput): Promise<Category> {
      const { data, error } = await client.from('categories').insert({
        user_id: userId,
        name: input.name,
        type: input.type,
        color: input.color,
        is_default: false,
      }).select('*').single()
      throwIfError(error)
      return mapCategory(requireData(data))
    },

    async createTransaction(userId: string, input: CreateTransactionInput): Promise<Transaction> {
      const { data, error } = await client.from('transactions').insert(toTransactionInsert(userId, input)).select('*').single()
      throwIfError(error)
      return mapTransaction(requireData(data))
    },

    async updateTransaction(userId: string, transactionId: string, input: UpdateTransactionInput): Promise<Transaction> {
      const { data, error } = await client.from('transactions').update(toTransactionUpdate(input)).eq('user_id', userId).eq('id', transactionId).select('*').single()
      throwIfError(error)
      return mapTransaction(requireData(data))
    },

    async deleteTransaction(userId: string, transactionId: string): Promise<Transaction> {
      const { data, error } = await client.from('transactions').delete().eq('user_id', userId).eq('id', transactionId).select('*').single()
      throwIfError(error)
      return mapTransaction(requireData(data))
    },

    async upsertBudget(userId: string, input: UpsertBudgetInput): Promise<Budget> {
      const { data, error } = await client.from('budgets').upsert({
        user_id: userId,
        category_id: input.categoryId,
        month: input.month,
        limit_minor: input.limitMinor,
      }, { onConflict: 'user_id,category_id,month' }).select('*').single()
      throwIfError(error)
      return mapBudget(requireData(data))
    },

    async copyPreviousMonthBudgets(userId: string, targetMonth: string): Promise<Budget[]> {
      const sourceResult = await client.from('budgets').select('*').eq('user_id', userId).eq('month', previousMonth(targetMonth)).order('category_id', { ascending: true }).order('id', { ascending: true })
      throwIfError(sourceResult.error)
      const source = sourceResult.data ?? []
      if (source.length === 0) return []

      const payload = source.map((budget) => ({
        user_id: userId,
        category_id: budget.category_id,
        month: targetMonth,
        limit_minor: budget.limit_minor,
      }))
      const { data, error } = await client.from('budgets').upsert(payload, { onConflict: 'user_id,category_id,month' }).select('*')
      throwIfError(error)
      return (data ?? []).map(mapBudget)
    },
  }
}

export type FinanceRepository = ReturnType<typeof createFinanceRepository>
