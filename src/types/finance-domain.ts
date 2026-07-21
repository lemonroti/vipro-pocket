export type CategoryType = 'income' | 'expense'
export type AccountKind = 'asset' | 'liability'
export type TransactionType = CategoryType | 'transfer'

export type Profile = {
  userId: string
  currency: string
  createdAt: string
  updatedAt: string
}

export type Category = {
  id: string
  userId: string
  name: string
  type: CategoryType
  color: string
  isDefault: boolean
  createdAt: string
  updatedAt: string
}

export type Account = {
  id: string
  userId: string
  name: string
  kind: AccountKind
  openingBalanceMinor: number
  color: string
  createdAt: string
  updatedAt: string
}

type TransactionBase = {
  id: string
  userId: string
  amountMinor: number
  accountId: string
  merchant: string
  note: string
  transactionDate: string
  createdAt: string
  updatedAt: string
}

export type IncomeOrExpenseTransaction = TransactionBase & {
  type: CategoryType
  toAccountId: null
  categoryId: string
}

export type TransferTransaction = TransactionBase & {
  type: 'transfer'
  toAccountId: string
  categoryId: null
}

export type Transaction = IncomeOrExpenseTransaction | TransferTransaction

export type Budget = {
  id: string
  userId: string
  categoryId: string
  month: string
  limitMinor: number
  createdAt: string
  updatedAt: string
}

export type FinanceSnapshot = {
  profile: Profile
  categories: Category[]
  accounts: Account[]
  transactions: Transaction[]
  budgets: Budget[]
}

export type CreateCategoryInput = {
  name: string
  type: CategoryType
  color: string
}

export type CreateAccountInput = {
  name: string
  kind: AccountKind
  openingBalanceMinor: number
  color: string
}

export type UpdateAccountInput = Partial<CreateAccountInput>

type TransactionInputBase = {
  amountMinor: number
  accountId: string
  merchant: string
  note: string
  transactionDate: string
}

export type CreateIncomeOrExpenseTransactionInput = TransactionInputBase & {
  type: CategoryType
  categoryId: string
}

export type CreateTransferTransactionInput = TransactionInputBase & {
  type: 'transfer'
  toAccountId: string
}

export type CreateTransactionInput =
  | CreateIncomeOrExpenseTransactionInput
  | CreateTransferTransactionInput

export type UpdateTransactionInput =
  | ({ type: CategoryType; categoryId: string } & Partial<TransactionInputBase>)
  | ({ type: 'transfer'; toAccountId: string } & Partial<TransactionInputBase>)

export type UpsertBudgetInput = {
  categoryId: string
  month: string
  limitMinor: number
}
