import type { Account, Transaction } from './types/finance-domain'

export function monthKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export function monthlySummary(transactions: Transaction[], month: string) {
  return transactions.reduce((summary, transaction) => {
    if (!transaction.transactionDate.startsWith(month)) return summary
    if (transaction.type === 'income') summary.incomeMinor += transaction.amountMinor
    if (transaction.type === 'expense') summary.expenseMinor += transaction.amountMinor
    return summary
  }, { incomeMinor: 0, expenseMinor: 0 })
}

export function accountBalances(accounts: Account[], transactions: Transaction[]): Record<string, number> {
  const balances = Object.fromEntries(accounts.map((account) => [account.id, account.openingBalanceMinor])) as Record<string, number>
  for (const transaction of transactions) {
    if (transaction.type === 'income') balances[transaction.accountId] += transaction.amountMinor
    if (transaction.type === 'expense') balances[transaction.accountId] -= transaction.amountMinor
    if (transaction.type === 'transfer' && transaction.toAccountId) {
      balances[transaction.accountId] -= transaction.amountMinor
      balances[transaction.toAccountId] += transaction.amountMinor
    }
  }
  return balances
}

export function netWorth(accounts: Account[], transactions: Transaction[]): number {
  const balances = accountBalances(accounts, transactions)
  return accounts.reduce((total, account) => total + (account.kind === 'asset' ? balances[account.id] : -balances[account.id]), 0)
}

export function categoryTotals(transactions: Transaction[], month: string): Record<string, number> {
  return transactions.reduce<Record<string, number>>((totals, transaction) => {
    if (transaction.type === 'expense' && transaction.transactionDate.startsWith(month)) {
      totals[transaction.categoryId] = (totals[transaction.categoryId] ?? 0) + transaction.amountMinor
    }
    return totals
  }, {})
}

export function money(minor: number, currency = 'MYR'): string {
  return new Intl.NumberFormat('en-MY', { style: 'currency', currency, minimumFractionDigits: 2 }).format(minor / 100)
}
