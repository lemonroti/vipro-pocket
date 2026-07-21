import type { Account, Budget, Category, Transaction, TransactionType, UpsertBudgetInput } from '../../types/finance-domain'

type TransactionDraft = {
  type: TransactionType
  amount: string
  accountId: string
  toAccountId: string
  categoryId: string
  transactionDate: string
}

type ValueControl = { value: string }
type Destroyable = { destroy: () => void } | null
type PendingLock = ReturnType<typeof createPendingLock>

type CopyPreviousMonthOptions = {
  displayMonth: string
  hasTargetBudgets: boolean
  copy: (canonicalTargetMonth: string) => Promise<unknown[]>
  confirmOverwrite: (message: string) => boolean
  lock: PendingLock
  setPending: (pending: boolean) => void
}

export type CopyPreviousMonthResult =
  | { status: 'success' | 'empty'; sourceMonth: string }
  | { status: 'invalid' | 'cancelled' | 'locked' | 'rejected' }

export function canonicalBudgetMonth(displayMonth: string): string {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(displayMonth)) throw new Error('Month must use YYYY-MM format.')
  return `${displayMonth}-01`
}

export function validatedBudgetMonth(control: ValueControl, currentMonth: string): string {
  try {
    canonicalBudgetMonth(control.value)
    return control.value
  } catch {
    control.value = currentMonth
    return currentMonth
  }
}

export function previousDisplayMonth(displayMonth: string): string {
  const canonical = canonicalBudgetMonth(displayMonth)
  const date = new Date(`${canonical}T00:00:00Z`)
  date.setUTCMonth(date.getUTCMonth() - 1)
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

function displayMonthLabel(displayMonth: string): string {
  return new Date(`${canonicalBudgetMonth(displayMonth)}T00:00:00Z`).toLocaleDateString('en-MY', {
    month: 'long', year: 'numeric', timeZone: 'UTC',
  })
}

export async function copyPreviousMonthBudgets(
  options: CopyPreviousMonthOptions,
): Promise<CopyPreviousMonthResult> {
  let canonicalTargetMonth: string
  let sourceMonth: string
  try {
    canonicalTargetMonth = canonicalBudgetMonth(options.displayMonth)
    sourceMonth = previousDisplayMonth(options.displayMonth)
  } catch {
    return { status: 'invalid' }
  }

  if (!options.lock.tryAcquire()) return { status: 'locked' }
  let pending = false
  try {
    if (options.hasTargetBudgets && !options.confirmOverwrite(
      `${displayMonthLabel(sourceMonth)} budgets will be copied into ${displayMonthLabel(options.displayMonth)}. `
      + `Matching category limits will be overwritten; other ${displayMonthLabel(options.displayMonth)} budgets will stay.`,
    )) return { status: 'cancelled' }
    options.setPending(true)
    pending = true
    const copied = await options.copy(canonicalTargetMonth)
    return copied.length ? { status: 'success', sourceMonth } : { status: 'empty', sourceMonth }
  } catch {
    return { status: 'rejected' }
  } finally {
    if (pending) options.setPending(false)
    options.lock.release()
  }
}

export function budgetForMonth(budgets: Budget[], categoryId: string, displayMonth: string): Budget | undefined {
  const month = canonicalBudgetMonth(displayMonth)
  return budgets.find((budget) => budget.categoryId === categoryId && budget.month === month)
}

export function createBudgetInput(categoryId: string, displayMonth: string, limitMinor: number): UpsertBudgetInput {
  return { categoryId, month: canonicalBudgetMonth(displayMonth), limitMinor }
}

export function parseMinorUnits(value: string, { allowZero = false }: { allowZero?: boolean } = {}): number | null {
  if (!/^\d+(?:\.\d{1,2})?$/.test(value)) return null
  const amount = Number(value)
  const minor = Math.round(amount * 100)
  if (!Number.isFinite(amount) || !Number.isSafeInteger(minor) || minor < 0 || (!allowZero && minor === 0)) return null
  return minor
}

export function isValidCalendarDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return false
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

export function isValidTransactionDraft(
  draft: TransactionDraft,
  accounts: Pick<Account, 'id'>[],
  categories: Pick<Category, 'id' | 'type'>[],
): boolean {
  if (parseMinorUnits(draft.amount) === null || !isValidCalendarDate(draft.transactionDate)) return false
  if (!accounts.some(({ id }) => id === draft.accountId)) return false
  if (draft.type === 'transfer') {
    return draft.toAccountId !== draft.accountId && accounts.some(({ id }) => id === draft.toAccountId)
  }
  return categories.some(({ id, type }) => id === draft.categoryId && type === draft.type)
}

export function createPendingLock() {
  let pending = false
  return {
    tryAcquire(): boolean {
      if (pending) return false
      pending = true
      return true
    },
    release(): void {
      pending = false
    },
  }
}

export async function runControlMutation(
  control: ValueControl,
  rollbackValue: string,
  mutation: () => Promise<unknown>,
): Promise<boolean> {
  try {
    await mutation()
    return true
  } catch {
    control.value = rollbackValue
    return false
  }
}

function csvCell(value: string | number): string {
  const text = String(value)
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text
  return `"${safe.replaceAll('"', '""')}"`
}

export function buildTransactionsCsv(
  transactions: Transaction[],
  accounts: Pick<Account, 'id' | 'name'>[],
  categories: Pick<Category, 'id' | 'name'>[],
): string {
  const accountNames = new Map(accounts.map(({ id, name }) => [id, name]))
  const categoryNames = new Map(categories.map(({ id, name }) => [id, name]))
  const rows = [
    ['Date', 'Type', 'Category', 'Merchant', 'Amount', 'Account', 'Destination account'],
    ...transactions.map((transaction) => [
      transaction.transactionDate,
      transaction.type,
      transaction.type === 'transfer' ? 'Transfer' : categoryNames.get(transaction.categoryId) ?? 'Unknown',
      transaction.merchant,
      (transaction.amountMinor / 100).toFixed(2),
      accountNames.get(transaction.accountId) ?? '',
      transaction.toAccountId ? accountNames.get(transaction.toAccountId) ?? '' : '',
    ]),
  ]
  return rows.map((row) => row.map(csvCell).join(',')).join('\n')
}

export function destroyCharts(...charts: Destroyable[]): void {
  charts.forEach((chart) => chart?.destroy())
}
