import { defineStore } from 'pinia'
import { ref } from 'vue'
import { createFinanceRepository } from '../lib/finance-repository'
import type {
  Account,
  Budget,
  Category,
  CreateAccountInput,
  CreateCategoryInput,
  CreateTransactionInput,
  Profile,
  Transaction,
  UpdateAccountInput,
  UpdateTransactionInput,
  UpsertBudgetInput,
} from '../types/finance-domain'

const repository = createFinanceRepository()

function compareById<T extends { id: string }>(left: T, right: T): number {
  return left.id.localeCompare(right.id)
}

function compareBudgets(left: Budget, right: Budget): number {
  return left.month.localeCompare(right.month)
    || left.categoryId.localeCompare(right.categoryId)
    || left.id.localeCompare(right.id)
}

function mergeById<T extends { id: string }>(rows: T[], row: T): T[] {
  return [...rows.filter(({ id }) => id !== row.id), row].sort(compareById)
}

function mergeBudget(rows: Budget[], row: Budget): Budget[] {
  return [
    ...rows.filter((candidate) => !(
      candidate.userId === row.userId
      && candidate.categoryId === row.categoryId
      && candidate.month === row.month
    )),
    row,
  ].sort(compareBudgets)
}

export const useFinanceStore = defineStore('finance', () => {
  const profile = ref<Profile | null>(null)
  const categories = ref<Category[]>([])
  const accounts = ref<Account[]>([])
  const transactions = ref<Transaction[]>([])
  const budgets = ref<Budget[]>([])
  const userId = ref<string | null>(null)
  const loading = ref(false)
  const initialized = ref(false)
  const error = ref('')
  let loadGeneration = 0

  function requireUserId(): string {
    if (!userId.value) throw new Error('Finance data is not initialized for an authenticated user.')
    return userId.value
  }

  async function mutate<T>(ownerUserId: string, message: string, request: () => Promise<T>, reconcile: (row: T) => void): Promise<T> {
    const generation = loadGeneration
    error.value = ''
    try {
      const row = await request()
      if (generation === loadGeneration && userId.value === ownerUserId) reconcile(row)
      return row
    } catch (cause) {
      if (generation === loadGeneration && userId.value === ownerUserId) error.value = message
      throw cause
    }
  }

  async function load(authenticatedUserId: string): Promise<void> {
    const generation = ++loadGeneration
    loading.value = true
    error.value = ''
    try {
      const snapshot = await repository.loadSnapshot(authenticatedUserId)
      if (generation !== loadGeneration) return
      profile.value = snapshot.profile
      categories.value = [...snapshot.categories]
      accounts.value = [...snapshot.accounts]
      transactions.value = [...snapshot.transactions]
      budgets.value = [...snapshot.budgets]
      userId.value = authenticatedUserId
      initialized.value = true
    } catch (cause) {
      if (generation === loadGeneration) error.value = 'Unable to load your finance data. Please try again.'
      throw cause
    } finally {
      if (generation === loadGeneration) loading.value = false
    }
  }

  function updateProfileCurrency(currency: string) {
    const id = requireUserId()
    return mutate(id, 'Unable to update the currency. Please try again.',
      () => repository.updateProfileCurrency(id, currency),
      (row) => { profile.value = row })
  }

  function createAccount(input: CreateAccountInput) {
    const id = requireUserId()
    return mutate(id, 'Unable to create the account. Please try again.',
      () => repository.createAccount(id, input),
      (row) => { accounts.value = mergeById(accounts.value, row) })
  }

  function updateAccount(accountId: string, input: UpdateAccountInput) {
    const id = requireUserId()
    return mutate(id, 'Unable to update the account. Please try again.',
      () => repository.updateAccount(id, accountId, input),
      (row) => { accounts.value = mergeById(accounts.value, row) })
  }

  function deleteAccount(accountId: string) {
    const id = requireUserId()
    return mutate(id, 'Unable to delete the account. Please try again.',
      () => repository.deleteAccount(id, accountId),
      (row) => { accounts.value = accounts.value.filter(({ id: candidateId }) => candidateId !== row.id) })
  }

  function createCategory(input: CreateCategoryInput) {
    const id = requireUserId()
    return mutate(id, 'Unable to create the category. Please try again.',
      () => repository.createCategory(id, input),
      (row) => { categories.value = mergeById(categories.value, row) })
  }

  function createTransaction(input: CreateTransactionInput) {
    const id = requireUserId()
    return mutate(id, 'Unable to create the transaction. Please try again.',
      () => repository.createTransaction(id, input),
      (row) => { transactions.value = mergeById(transactions.value, row) })
  }

  function updateTransaction(transactionId: string, input: UpdateTransactionInput) {
    const id = requireUserId()
    return mutate(id, 'Unable to update the transaction. Please try again.',
      () => repository.updateTransaction(id, transactionId, input),
      (row) => { transactions.value = mergeById(transactions.value, row) })
  }

  function deleteTransaction(transactionId: string) {
    const id = requireUserId()
    return mutate(id, 'Unable to delete the transaction. Please try again.',
      () => repository.deleteTransaction(id, transactionId),
      (row) => { transactions.value = transactions.value.filter(({ id: candidateId }) => candidateId !== row.id) })
  }

  function upsertBudget(input: UpsertBudgetInput) {
    const id = requireUserId()
    return mutate(id, 'Unable to save the budget. Please try again.',
      () => repository.upsertBudget(id, input),
      (row) => { budgets.value = mergeBudget(budgets.value, row) })
  }

  function copyPreviousMonthBudgets(targetMonth: string) {
    const id = requireUserId()
    return mutate(id, 'Unable to copy the previous month budgets. Please try again.',
      () => repository.copyPreviousMonthBudgets(id, targetMonth),
      (rows) => { budgets.value = rows.reduce(mergeBudget, budgets.value) })
  }

  function reset(): void {
    loadGeneration += 1
    profile.value = null
    categories.value = []
    accounts.value = []
    transactions.value = []
    budgets.value = []
    userId.value = null
    loading.value = false
    initialized.value = false
    error.value = ''
  }

  return {
    profile, categories, accounts, transactions, budgets, userId, loading, initialized, error,
    load, updateProfileCurrency, createAccount, updateAccount, deleteAccount, createCategory,
    createTransaction, updateTransaction, deleteTransaction, upsertBudget, copyPreviousMonthBudgets, reset,
  }
})
