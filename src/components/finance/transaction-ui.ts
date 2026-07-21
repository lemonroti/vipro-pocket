import type {
  Account,
  Category,
  CategoryType,
  CreateCategoryInput,
  CreateTransactionInput,
  Transaction,
  TransactionType,
  UpdateTransactionInput,
} from '../../types/finance-domain'
import { isValidCalendarDate, parseMinorUnits } from './finance-ui'

export type CategoryDraft = { name: string; type: CategoryType | string; color: string }
export type TransactionDraft = {
  type: TransactionType
  amount: string
  accountId: string
  toAccountId: string
  categoryId: string
  merchant: string
  note: string
  transactionDate: string
}

type PendingLock = { tryAcquire: () => boolean; release: () => void }
type OperationResult = { status: 'success' | 'invalid' | 'pending' | 'cancelled' | 'rejected'; message?: string }
const DUPLICATE_CATEGORY_ERROR = 'A category with this name and type already exists.'

export function categoryPayloadFromDraft(
  draft: CategoryDraft,
  categories: Pick<Category, 'name' | 'type'>[],
): { payload: CreateCategoryInput | null; error: string } {
  const name = draft.name.trim()
  if (!name) return { payload: null, error: 'Category name is required.' }
  if (name.length > 50) return { payload: null, error: 'Category name must be 50 characters or fewer.' }
  if (draft.type !== 'income' && draft.type !== 'expense') {
    return { payload: null, error: 'Choose a valid category type.' }
  }
  if (!/^#[0-9a-fA-F]{6}$/.test(draft.color)) {
    return { payload: null, error: 'Enter a valid six-digit hex color.' }
  }
  const duplicate = categories.find((category) => category.type === draft.type && category.name.toLocaleLowerCase() === name.toLocaleLowerCase())
  if (duplicate) return { payload: null, error: `An ${draft.type} category named "${duplicate.name}" already exists.` }
  return { payload: { name, type: draft.type, color: draft.color }, error: '' }
}

export async function saveCategory(options: {
  draft: CategoryDraft
  categories: Pick<Category, 'name' | 'type'>[]
  createCategory: (input: CreateCategoryInput) => Promise<unknown>
  lock: PendingLock
  setPending?: (pending: boolean) => void
}): Promise<OperationResult> {
  const { payload, error } = categoryPayloadFromDraft(options.draft, options.categories)
  if (!payload) return { status: 'invalid', message: error }
  if (!options.lock.tryAcquire()) return { status: 'pending' }
  options.setPending?.(true)
  try {
    await options.createCategory(payload)
    return { status: 'success' }
  } catch (cause) {
    return {
      status: 'rejected',
      message: cause instanceof Error && cause.message === DUPLICATE_CATEGORY_ERROR
        ? DUPLICATE_CATEGORY_ERROR
        : 'Unable to create the category. Please try again.',
    }
  } finally {
    options.setPending?.(false)
    options.lock.release()
  }
}

export function transactionDraftFromTransaction(transaction: Transaction): TransactionDraft {
  return {
    type: transaction.type,
    amount: (transaction.amountMinor / 100).toFixed(2),
    accountId: transaction.accountId,
    toAccountId: transaction.toAccountId ?? '',
    categoryId: transaction.categoryId ?? '',
    merchant: transaction.merchant,
    note: transaction.note,
    transactionDate: transaction.transactionDate,
  }
}

export function transactionPayloadFromDraft(
  draft: TransactionDraft,
  accounts: Pick<Account, 'id'>[],
  categories: Pick<Category, 'id' | 'name' | 'type'>[],
): { payload: CreateTransactionInput | null; error: string } {
  const amountMinor = parseMinorUnits(draft.amount)
  if (amountMinor === null) return { payload: null, error: 'Enter a positive amount with no more than two decimal places.' }
  if (!isValidCalendarDate(draft.transactionDate)) return { payload: null, error: 'Choose a valid transaction date.' }
  if (!accounts.some(({ id }) => id === draft.accountId)) return { payload: null, error: 'Choose a valid source account.' }
  const merchant = draft.merchant.trim()
  const note = draft.note.trim()
  if (merchant.length > 120) return { payload: null, error: 'Merchant or source must be 120 characters or fewer.' }
  if (note.length > 500) return { payload: null, error: 'Note must be 500 characters or fewer.' }

  if (draft.type === 'transfer') {
    if (draft.categoryId) return { payload: null, error: 'Transfers cannot have a category.' }
    if (draft.toAccountId === draft.accountId || !accounts.some(({ id }) => id === draft.toAccountId)) {
      return { payload: null, error: 'Choose a different valid destination account.' }
    }
    return {
      payload: {
        type: 'transfer', amountMinor, accountId: draft.accountId, toAccountId: draft.toAccountId,
        merchant: merchant || 'Transfer', note, transactionDate: draft.transactionDate,
      },
      error: '',
    }
  }

  if (draft.toAccountId) return { payload: null, error: 'Income and expenses cannot have a destination account.' }
  const category = categories.find(({ id, type }) => id === draft.categoryId && type === draft.type)
  if (!category) return { payload: null, error: `Choose a valid ${draft.type} category.` }
  return {
    payload: {
      type: draft.type, amountMinor, accountId: draft.accountId, categoryId: category.id,
      merchant: merchant || category.name, note, transactionDate: draft.transactionDate,
    },
    error: '',
  }
}

export function transitionTransactionDraft(
  draft: TransactionDraft,
  type: TransactionType,
  accounts: Pick<Account, 'id'>[],
  categories: Pick<Category, 'id' | 'type'>[],
): TransactionDraft {
  if (type === 'transfer') {
    return {
      ...draft,
      type,
      categoryId: '',
      toAccountId: accounts.find(({ id }) => id !== draft.accountId)?.id ?? '',
    }
  }
  return {
    ...draft,
    type,
    toAccountId: '',
    categoryId: categories.find((category) => category.type === type)?.id ?? '',
  }
}

export async function saveTransaction(options: {
  draft: TransactionDraft
  transactionId: string | null
  accounts: Pick<Account, 'id'>[]
  categories: Pick<Category, 'id' | 'name' | 'type'>[]
  createTransaction: (input: CreateTransactionInput) => Promise<unknown>
  updateTransaction: (id: string, input: UpdateTransactionInput) => Promise<unknown>
  lock: PendingLock
  setPending?: (pending: boolean) => void
}): Promise<OperationResult> {
  const { payload, error } = transactionPayloadFromDraft(options.draft, options.accounts, options.categories)
  if (!payload) return { status: 'invalid', message: error }
  if (!options.lock.tryAcquire()) return { status: 'pending' }
  options.setPending?.(true)
  try {
    if (options.transactionId) await options.updateTransaction(options.transactionId, payload)
    else await options.createTransaction(payload)
    return { status: 'success' }
  } catch {
    return {
      status: 'rejected',
      message: options.transactionId
        ? 'Unable to update the transaction. Please try again.'
        : 'Unable to create the transaction. Please try again.',
    }
  } finally {
    options.setPending?.(false)
    options.lock.release()
  }
}

export async function deleteTransactionWithConfirmation(options: {
  transaction: Transaction
  deleteTransaction: (id: string) => Promise<unknown>
  confirmDelete: (message: string) => boolean
  lock: PendingLock
  setPending?: (pending: boolean) => void
}): Promise<OperationResult> {
  if (!options.confirmDelete(`Delete transaction "${options.transaction.merchant}" on ${options.transaction.transactionDate}?`)) {
    return { status: 'cancelled' }
  }
  if (!options.lock.tryAcquire()) return { status: 'pending' }
  options.setPending?.(true)
  try {
    await options.deleteTransaction(options.transaction.id)
    return { status: 'success' }
  } catch {
    return { status: 'rejected', message: 'Unable to delete the transaction. Please try again.' }
  } finally {
    options.setPending?.(false)
    options.lock.release()
  }
}
