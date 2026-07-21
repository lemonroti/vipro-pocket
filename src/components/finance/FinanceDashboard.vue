<script setup lang="ts">
import Chart from 'chart.js/auto'
import {
  ArrowDownLeft,
  ArrowUpRight,
  BarChart3,
  ChevronRight,
  Download,
  Eye,
  LayoutDashboard,
  Minus,
  Moon,
  Pencil,
  PiggyBank,
  Plus,
  ReceiptText,
  Settings,
  Sun,
  Trash2,
  TrendingUp,
  WalletCards,
} from 'lucide-vue-next'
import { storeToRefs } from 'pinia'
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import {
  accountBalances,
  categoryTotals,
  money,
  monthKey,
  monthlySummary,
  netWorth,
} from '../../finance'
import { useFinanceStore } from '../../stores/finance'
import type { Account, Category, Transaction, TransactionType } from '../../types/finance-domain'
import {
  accountDraftFromAccount,
  deleteAccountWithConfirmation,
  saveAccount,
  type AccountDraft,
} from './account-ui'
import {
  budgetForMonth,
  buildTransactionsCsv,
  canonicalBudgetMonth,
  createBudgetInput,
  createPendingLock,
  destroyCharts,
  isValidTransactionDraft,
  parseMinorUnits,
  runControlMutation,
} from './finance-ui'

const finance = useFinanceStore()
const { accounts, budgets, categories, profile, transactions } = storeToRefs(finance)
const categoryById = computed(() => new Map(categories.value.map((category) => [category.id, category])))
const expenseCategories = computed(() => categories.value.filter((category) => category.type === 'expense'))
const eligibleCategories = computed(() =>
  form.value.type === 'transfer' ? [] : categories.value.filter((category) => category.type === form.value.type),
)

const pages = ['dashboard', 'transactions', 'budgets', 'accounts', 'reports', 'settings'] as const
type Page = (typeof pages)[number]
const navigation = [
  { id: 'dashboard' as Page, label: 'Dashboard', icon: LayoutDashboard },
  { id: 'transactions' as Page, label: 'Transactions', icon: ReceiptText },
  { id: 'budgets' as Page, label: 'Budgets', icon: PiggyBank },
  { id: 'accounts' as Page, label: 'Accounts', icon: WalletCards },
  { id: 'reports' as Page, label: 'Reports', icon: BarChart3 },
  { id: 'settings' as Page, label: 'Settings', icon: Settings },
]

const activePage = ref<Page>('dashboard')
const modalOpen = ref(false)
const accountModalOpen = ref(false)
const accountPending = ref(false)
const editingAccountId = ref<string | null>(null)
const accountError = ref('')
const search = ref('')
const typeFilter = ref('all')
const dark = ref(localStorage.getItem('vipro-pocket-theme') === 'dark')
const toast = ref('')
const selectedMonth = ref(monthKey())
const transactionPending = ref(false)
const currencyPending = ref(false)
const pendingBudgetIds = ref(new Set<string>())
const chartCanvas = ref<HTMLCanvasElement | null>(null)
const categoryCanvas = ref<HTMLCanvasElement | null>(null)
let cashChart: Chart | null = null
let categoryChart: Chart | null = null
let toastTimer: ReturnType<typeof setTimeout> | null = null
const transactionLock = createPendingLock()
const currencyLock = createPendingLock()
const budgetLocks = new Map<string, ReturnType<typeof createPendingLock>>()
const accountLock = createPendingLock()

const form = ref({
  type: 'expense' as TransactionType,
  amount: '',
  accountId: accounts.value[0]?.id ?? '',
  toAccountId: accounts.value[1]?.id ?? '',
  categoryId: '',
  merchant: '',
  note: '',
  transactionDate: new Date().toISOString().slice(0, 10),
})
const accountForm = ref<AccountDraft>({
  name: '',
  kind: 'asset',
  openingBalance: '0.00',
  color: '#2aa883',
})
const currency = computed(() => profile.value?.currency ?? 'MYR')
const budgetMonth = computed(() => canonicalBudgetMonth(selectedMonth.value))
const canSubmit = computed(() => isValidTransactionDraft(form.value, accounts.value, categories.value))
const editingAccount = computed(() => accounts.value.find(({ id }) => id === editingAccountId.value) ?? null)

const summary = computed(() => monthlySummary(transactions.value, selectedMonth.value))
const balances = computed(() => accountBalances(accounts.value, transactions.value))
const totalNetWorth = computed(() => netWorth(accounts.value, transactions.value))
const categorySpend = computed(() => categoryTotals(transactions.value, selectedMonth.value))
const totalBudget = computed(() =>
  budgets.value.filter((budget) => budget.month === budgetMonth.value).reduce((sum, budget) => sum + budget.limitMinor, 0),
)
const remainingBudget = computed(() => totalBudget.value - summary.value.expenseMinor)
const budgetUsage = computed(() =>
  totalBudget.value ? Math.round((summary.value.expenseMinor / totalBudget.value) * 100) : 0,
)
const savingsRate = computed(() =>
  summary.value.incomeMinor
    ? Math.round(((summary.value.incomeMinor - summary.value.expenseMinor) / summary.value.incomeMinor) * 100)
    : 0,
)
const sortedTransactions = computed(() =>
  [...transactions.value].sort(
    (first, second) => second.transactionDate.localeCompare(first.transactionDate) || second.createdAt.localeCompare(first.createdAt),
  ),
)
const filteredTransactions = computed(() =>
  sortedTransactions.value.filter(
    (item) =>
      (typeFilter.value === 'all' || item.type === typeFilter.value) &&
      `${item.merchant} ${transactionCategoryName(item)} ${item.note}`.toLowerCase().includes(search.value.toLowerCase()),
  ),
)
const budgetRows = computed(() =>
  expenseCategories.value.map((category) => {
    const limit = budgetForMonth(budgets.value, category.id, selectedMonth.value)?.limitMinor ?? 0
    const spent = categorySpend.value[category.id] ?? 0
    return {
      category,
      limit,
      spent,
      remaining: limit - spent,
      percent: limit ? Math.round((spent / limit) * 100) : 0,
    }
  }),
)
const topCategories = computed(() =>
  Object.entries(categorySpend.value)
    .map(([categoryId, amount]) => ({
      categoryId,
      name: categoryById.value.get(categoryId)?.name ?? 'Unknown',
      amount,
      color: categoryById.value.get(categoryId)?.color ?? '#78827a',
      soft: '#eef1ef',
      count: transactions.value.filter(
        (item) => item.type === 'expense' && item.categoryId === categoryId && item.transactionDate.startsWith(selectedMonth.value),
      ).length,
    }))
    .filter((item) => item.amount > 0)
    .sort((first, second) => second.amount - first.amount),
)
const largestCategoryName = computed(() => topCategories.value[0]?.name ?? 'None')
const pageTitle = computed(
  () =>
    ({
      dashboard: 'Money overview',
      transactions: 'Transactions',
      budgets: 'Monthly budgets',
      accounts: 'Accounts',
      reports: 'Reports',
      settings: 'Settings',
    })[activePage.value],
)

function transactionCategory(transaction: Transaction): Category | undefined {
  return transaction.categoryId ? categoryById.value.get(transaction.categoryId) : undefined
}

function transactionCategoryName(transaction: Transaction): string {
  return transaction.type === 'transfer' ? 'Transfer' : transactionCategory(transaction)?.name ?? 'Unknown'
}

function transactionCategoryColor(transaction: Transaction): string {
  return transaction.type === 'transfer' ? '#4f8cff' : transactionCategory(transaction)?.color ?? '#78827a'
}

function showToast(message: string) {
  if (toastTimer) clearTimeout(toastTimer)
  toast.value = message
  toastTimer = setTimeout(() => {
    toast.value = ''
    toastTimer = null
  }, 2200)
}

function openAdd(type: TransactionType) {
  if (!accounts.value.length) {
    showToast('Add an account before creating a transaction')
    return
  }
  form.value.type = type
  form.value.accountId = accounts.value.some(({ id }) => id === form.value.accountId)
    ? form.value.accountId
    : accounts.value[0]?.id ?? ''
  form.value.toAccountId = accounts.value.find(({ id }) => id !== form.value.accountId)?.id ?? ''
  form.value.categoryId = type === 'transfer' ? '' : categories.value.find((category) => category.type === type)?.id ?? ''
  modalOpen.value = true
}

function openCreateAccount() {
  editingAccountId.value = null
  accountForm.value = { name: '', kind: 'asset', openingBalance: '0.00', color: '#2aa883' }
  accountError.value = ''
  accountModalOpen.value = true
}

function openEditAccount(account: Account) {
  editingAccountId.value = account.id
  accountForm.value = accountDraftFromAccount(account)
  accountError.value = ''
  accountModalOpen.value = true
}

function closeAccountModal() {
  if (accountPending.value) return
  accountModalOpen.value = false
  editingAccountId.value = null
  accountError.value = ''
}

async function submitAccount() {
  accountError.value = ''
  const result = await saveAccount({
    draft: accountForm.value,
    accountId: editingAccountId.value,
    createAccount: (input) => finance.createAccount(input),
    updateAccount: (accountId, input) => finance.updateAccount(accountId, input),
    lock: accountLock,
    setPending: (pending) => { accountPending.value = pending },
  })
  if (result.status === 'success') {
    const action = editingAccountId.value ? 'updated' : 'created'
    closeAccountModal()
    showToast(`Account ${action}`)
    return
  }
  if (result.status === 'invalid' || result.status === 'rejected') {
    accountError.value = result.message ?? 'Unable to save the account. Please try again.'
    if (result.status === 'rejected') showToast(accountError.value)
  }
}

async function removeAccount() {
  if (!editingAccount.value) return
  accountError.value = ''
  const result = await deleteAccountWithConfirmation({
    account: editingAccount.value,
    deleteAccount: (accountId) => finance.deleteAccount(accountId),
    confirmDelete: (message) => confirm(message),
    lock: accountLock,
    setPending: (pending) => { accountPending.value = pending },
  })
  if (result.status === 'success') {
    closeAccountModal()
    showToast('Account deleted')
  } else if (result.status === 'rejected') {
    accountError.value = result.message ?? 'Unable to delete the account. Please try again.'
    showToast(accountError.value)
  }
}

async function addTransaction() {
  if (!canSubmit.value || !transactionLock.tryAcquire()) return
  const amountMinor = parseMinorUnits(form.value.amount)
  if (amountMinor === null) {
    transactionLock.release()
    return
  }
  transactionPending.value = true
  try {
    if (form.value.type === 'transfer') {
      await finance.createTransaction({
        type: 'transfer',
        amountMinor,
        accountId: form.value.accountId,
        toAccountId: form.value.toAccountId,
        merchant: form.value.merchant || 'Transfer',
        note: form.value.note,
        transactionDate: form.value.transactionDate,
      })
    } else {
      const category = categoryById.value.get(form.value.categoryId)
      await finance.createTransaction({
        type: form.value.type,
        amountMinor,
        accountId: form.value.accountId,
        categoryId: form.value.categoryId,
        merchant: form.value.merchant || category?.name || 'Transaction',
        note: form.value.note,
        transactionDate: form.value.transactionDate,
      })
    }
    modalOpen.value = false
    form.value.amount = ''
    form.value.merchant = ''
    form.value.note = ''
    showToast('Transaction saved')
  } catch {
    showToast(finance.error || 'Unable to create the transaction. Please try again.')
  } finally {
    transactionPending.value = false
    transactionLock.release()
  }
}

async function removeTransaction(id: string) {
  if (!confirm('Delete this transaction?')) return
  try {
    await finance.deleteTransaction(id)
    showToast('Transaction deleted')
  } catch {
    showToast(finance.error || 'Unable to delete the transaction. Please try again.')
  }
}

async function updateBudget(categoryId: string, control: HTMLInputElement, currentLimitMinor: number) {
  const rollbackValue = (currentLimitMinor / 100).toFixed(2)
  const limitMinor = parseMinorUnits(control.value, { allowZero: true })
  if (limitMinor === null) {
    control.value = rollbackValue
    showToast('Enter a valid budget with no more than two decimal places.')
    return
  }
  const lock = budgetLocks.get(categoryId) ?? createPendingLock()
  budgetLocks.set(categoryId, lock)
  if (!lock.tryAcquire()) {
    control.value = rollbackValue
    return
  }
  pendingBudgetIds.value = new Set(pendingBudgetIds.value).add(categoryId)
  const saved = await runControlMutation(
    control,
    rollbackValue,
    () => finance.upsertBudget(createBudgetInput(categoryId, selectedMonth.value, limitMinor)),
  )
  if (saved) {
    control.value = (limitMinor / 100).toFixed(2)
    showToast('Budget saved')
  } else {
    showToast(finance.error || 'Unable to save the budget. Please try again.')
  }
  const pending = new Set(pendingBudgetIds.value)
  pending.delete(categoryId)
  pendingBudgetIds.value = pending
  lock.release()
}

async function updateCurrency(control: HTMLSelectElement) {
  const previousCurrency = currency.value
  if (control.value === previousCurrency || !currencyLock.tryAcquire()) {
    control.value = previousCurrency
    return
  }
  currencyPending.value = true
  const updated = await runControlMutation(control, previousCurrency, () => finance.updateProfileCurrency(control.value))
  if (updated) {
    showToast('Currency updated')
  } else {
    showToast(finance.error || 'Unable to update the currency. Please try again.')
  }
  currencyPending.value = false
  currencyLock.release()
}

function exportCsv() {
  const blob = new Blob(
    [buildTransactionsCsv(sortedTransactions.value, accounts.value, categories.value)],
    { type: 'text/csv' },
  )
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = 'vipro-pocket-transactions.csv'
  anchor.click()
  URL.revokeObjectURL(url)
}

function switchPage(page: Page) {
  activePage.value = page
}

function lastSixMonths() {
  return Array.from({ length: 6 }, (_, index) => {
    const date = new Date()
    date.setMonth(date.getMonth() - (5 - index))
    return monthKey(date)
  })
}

function renderCharts() {
  destroyCharts(cashChart, categoryChart)
  cashChart = null
  categoryChart = null

  if (chartCanvas.value) {
    const months = lastSixMonths()
    cashChart = new Chart(chartCanvas.value, {
      type: 'bar',
      data: {
        labels: months.map((month) => new Date(`${month}-01`).toLocaleDateString('en-MY', { month: 'short' })),
        datasets: [
          {
            label: 'Income',
            data: months.map((month) => monthlySummary(transactions.value, month).incomeMinor / 100),
            backgroundColor: '#2aa883',
            borderRadius: 8,
          },
          {
            label: 'Expenses',
            data: months.map((month) => monthlySummary(transactions.value, month).expenseMinor / 100),
            backgroundColor: '#ef7b66',
            borderRadius: 8,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom' } },
        scales: { x: { grid: { display: false } }, y: { grid: { color: 'rgba(120,130,122,.12)' } } },
      },
    })
  }

  if (categoryCanvas.value) {
    const entries = Object.entries(categorySpend.value).filter(([, value]) => value > 0)
    categoryChart = new Chart(categoryCanvas.value, {
      type: 'doughnut',
      data: {
        labels: entries.map(([categoryId]) => categoryById.value.get(categoryId)?.name ?? 'Unknown'),
        datasets: [
          {
            data: entries.map(([, value]) => value / 100),
            backgroundColor: entries.map(([categoryId]) => categoryById.value.get(categoryId)?.color ?? '#78827a'),
            borderWidth: 0,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '70%',
        plugins: { legend: { position: 'bottom' } },
      },
    })
  }
}

watch(
  dark,
  (value) => {
    document.documentElement.classList.toggle('dark', value)
    localStorage.setItem('vipro-pocket-theme', value ? 'dark' : 'light')
  },
  { immediate: true },
)
watch([transactions, categories, selectedMonth, activePage], () => nextTick(renderCharts), { deep: true, immediate: true })
watch(
  () => form.value.type,
  (type) => {
    form.value.categoryId = type === 'transfer' ? '' : categories.value.find((category) => category.type === type)?.id ?? ''
  },
)
onBeforeUnmount(() => {
  destroyCharts(cashChart, categoryChart)
  if (toastTimer) clearTimeout(toastTimer)
})
</script>

<template>
  <div class="app-shell">
    <aside class="sidebar">
      <div class="brand">
        <b>VP</b>
        <div><strong>vipro-pocket</strong><span>Personal finance</span></div>
      </div>

      <nav>
        <button
          v-for="item in navigation"
          :key="item.id"
          class="sidebar-link"
          :class="{ active: activePage === item.id }"
          @click="switchPage(item.id)"
        >
          <span class="nav-indicator"></span>
          <component :is="item.icon" :size="18" />
          <span>{{ item.label }}</span>
          <span v-if="item.id === 'transactions'" class="transaction-count">{{ transactions.length }}</span>
        </button>
      </nav>

      <div class="sidebar-footer">
        <div class="sidebar-budget">
          <div class="sidebar-budget-heading"><span>Monthly budget</span><b>{{ budgetUsage }}%</b></div>
          <div class="progress"><i :style="{ width: `${Math.min(budgetUsage, 100)}%` }"></i></div>
          <strong>{{ money(Math.max(remainingBudget, 0), currency) }}</strong>
          <small>left this month</small>
        </div>
        <button class="sidebar-profile" @click="switchPage('settings')">
          <span class="avatar">VP</span>
          <span><strong>Your workspace</strong><small>{{ currency }} finance</small></span>
          <ChevronRight :size="16" />
        </button>
      </div>
    </aside>

    <main class="main">
      <div class="main-inner">
        <header class="topbar">
          <div>
            <small>{{ new Date().toLocaleDateString('en-MY', { weekday: 'long', day: 'numeric', month: 'long' }) }}</small>
            <h1>{{ pageTitle }}</h1>
          </div>
          <div class="top-actions">
            <button class="icon-button" @click="dark = !dark"><component :is="dark ? Sun : Moon" :size="18" /></button>
            <button class="secondary desktop-only" @click="exportCsv"><Download :size="17" /> Export</button>
            <button class="primary" :disabled="!accounts.length" :title="!accounts.length ? 'Add an account before creating a transaction' : ''" @click="openAdd('expense')"><Plus :size="17" /> Add transaction</button>
          </div>
        </header>

        <section v-if="activePage === 'dashboard'" class="stack dashboard-stack">
          <div class="hero-grid">
            <article class="hero">
              <div class="hero-top">
                <div>
                  <span class="hero-label">Total net worth <Eye :size="16" /></span>
                  <h2>{{ money(totalNetWorth, currency) }}</h2>
                  <p class="net-result"><TrendingUp :size="14" />{{ money(summary.incomeMinor - summary.expenseMinor, currency) }} net this month</p>
                </div>
                <button class="hero-link" @click="switchPage('accounts')"><ArrowUpRight :size="18" /></button>
              </div>
              <div class="hero-actions prototype-actions">
                <button class="hero-primary" :disabled="!accounts.length" :title="!accounts.length ? 'Add an account before creating a transaction' : ''" @click="openAdd('expense')"><Minus :size="16" /> Add expense</button>
                <button :disabled="!accounts.length" :title="!accounts.length ? 'Add an account before creating a transaction' : ''" @click="openAdd('income')"><Plus :size="16" /> Add income</button>
              </div>
            </article>

            <article class="card budget-card prototype-budget-card">
              <div class="section-head">
                <div><span>Monthly budget</span><h3>{{ money(Math.max(remainingBudget, 0), currency) }} left</h3></div>
                <button class="soft-icon-button" @click="switchPage('budgets')"><ArrowUpRight :size="16" /></button>
              </div>
              <div class="budget-ring-wrap">
                <div class="budget-ring">
                  <svg viewBox="0 0 120 120" aria-label="Monthly budget usage">
                    <circle class="budget-ring-track" cx="60" cy="60" r="49" />
                    <circle
                      class="budget-ring-value"
                      cx="60"
                      cy="60"
                      r="49"
                      :stroke-dasharray="307.88"
                      :stroke-dashoffset="307.88 * (1 - Math.min(budgetUsage, 100) / 100)"
                    />
                  </svg>
                  <div><strong>{{ budgetUsage }}%</strong><span>used</span></div>
                </div>
              </div>
              <div class="budget-summary-grid">
                <div><span>Spent</span><strong>{{ money(summary.expenseMinor, currency) }}</strong></div>
                <div><span>Limit</span><strong>{{ money(totalBudget, currency) }}</strong></div>
              </div>
            </article>
          </div>

          <div class="metric-grid">
            <article class="metric-card">
              <div><span class="metric-icon income"><ArrowDownLeft :size="18" /></span><em>Income</em></div>
              <span>This month</span><strong>{{ money(summary.incomeMinor, currency) }}</strong>
            </article>
            <article class="metric-card">
              <div><span class="metric-icon expense"><ArrowUpRight :size="18" /></span><em>Expense</em></div>
              <span>This month</span><strong>{{ money(summary.expenseMinor, currency) }}</strong>
            </article>
            <article class="metric-card">
              <div><span class="metric-icon saved"><PiggyBank :size="18" /></span><em>Saved</em></div>
              <span>This month</span><strong>{{ money(summary.incomeMinor - summary.expenseMinor, currency) }}</strong>
            </article>
            <article class="metric-card">
              <div><span class="metric-icon accounts"><WalletCards :size="18" /></span><em>Accounts</em></div>
              <span>Active</span><strong>{{ accounts.length }}</strong>
            </article>
          </div>

          <div class="content-grid prototype-content-grid">
            <article class="card chart-card">
              <div class="section-head"><div><span>Cash flow</span><h3>Income and spending over six months</h3></div></div>
              <div class="chart-wrap"><canvas ref="chartCanvas"></canvas></div>
            </article>

            <article class="card top-spending-card">
              <div class="section-head"><div><span>Top spending</span><h3>By category this month</h3></div><button class="text-button" @click="switchPage('reports')">View all</button></div>
              <div class="top-spending-list">
                <div v-for="item in topCategories.slice(0, 5)" :key="item.name" class="spending-row">
                  <div class="spending-heading">
                    <span class="category-icon" :style="{ background: item.soft, color: item.color }">{{ item.name.slice(0, 1) }}</span>
                    <span><strong>{{ item.name }}</strong><small>{{ item.count }} transactions</small></span>
                    <b>{{ money(item.amount, currency) }}</b>
                  </div>
                  <div class="progress"><i :style="{ width: `${Math.min((item.amount / Math.max(summary.expenseMinor, 1)) * 100, 100)}%`, background: item.color }"></i></div>
                </div>
                <p v-if="!topCategories.length" class="empty-state">No expenses this month.</p>
              </div>
            </article>
          </div>

          <article class="card recent-transactions-card">
            <div class="section-head"><div><span>Recent transactions</span><h3>Your latest account activity</h3></div><button class="text-button" @click="switchPage('transactions')">View all</button></div>
            <div class="transaction-list prototype-transaction-list">
              <div v-for="item in sortedTransactions.slice(0, 6)" :key="item.id" class="transaction-row">
                <span class="transaction-icon" :style="{ background: '#eef1ef', color: transactionCategoryColor(item) }">{{ transactionCategoryName(item).slice(0, 1) }}</span>
                <div><strong>{{ item.merchant }}</strong><span>{{ transactionCategoryName(item) }} · {{ item.transactionDate }}</span></div>
                <b :class="item.type">{{ item.type === 'expense' ? '−' : item.type === 'income' ? '+' : '' }}{{ money(item.amountMinor, currency) }}</b>
              </div>
              <p v-if="!sortedTransactions.length" class="empty-state">No transactions yet.</p>
            </div>
          </article>
        </section>

        <section v-else-if="activePage === 'transactions'" class="stack">
          <div class="toolbar"><input v-model="search" placeholder="Search transactions…" /><select v-model="typeFilter"><option value="all">All types</option><option value="expense">Expenses</option><option value="income">Income</option><option value="transfer">Transfers</option></select></div>
          <article class="card"><div class="transaction-list"><div v-for="item in filteredTransactions" :key="item.id" class="transaction-row"><i class="category-dot" :style="{ background: transactionCategoryColor(item) }"></i><div><strong>{{ item.merchant }}</strong><span>{{ transactionCategoryName(item) }} · {{ item.transactionDate }} · {{ accounts.find((account) => account.id === item.accountId)?.name }}</span></div><b :class="item.type">{{ item.type === 'expense' ? '−' : item.type === 'income' ? '+' : '' }}{{ money(item.amountMinor, currency) }}</b><button class="delete" @click="removeTransaction(item.id)">×</button></div><div v-if="!transactions.length" class="empty-state">No transactions yet.</div><div v-else-if="!filteredTransactions.length" class="empty-state">No transactions match your filters.</div></div></article>
        </section>

        <section v-else-if="activePage === 'budgets'" class="stack">
          <div class="metrics"><article class="metric"><span>Total budget</span><strong>{{ money(totalBudget, currency) }}</strong></article><article class="metric"><span>Spent</span><strong>{{ money(summary.expenseMinor, currency) }}</strong></article><article class="metric"><span>Remaining</span><strong>{{ money(remainingBudget, currency) }}</strong></article></div>
          <p v-if="!budgets.some((budget) => budget.month === budgetMonth)" class="empty-state">No budgets yet.</p>
          <div class="budget-grid"><article v-for="row in budgetRows" :key="row.category.id" class="card budget-item"><div class="section-head"><div><span>{{ row.category.name }}</span><h3>{{ money(row.spent, currency) }}</h3></div><b :class="{ danger: row.percent > 100 }">{{ row.percent }}%</b></div><div class="progress"><i :style="{ width: `${Math.min(row.percent, 100)}%`, background: row.category.color }"></i></div><div class="split"><span>{{ row.remaining >= 0 ? `${money(row.remaining, currency)} left` : `${money(Math.abs(row.remaining), currency)} over` }}</span><label>Limit <input :value="(row.limit / 100).toFixed(2)" type="number" min="0" step="0.01" :disabled="pendingBudgetIds.has(row.category.id)" @change="updateBudget(row.category.id, $event.target as HTMLInputElement, row.limit)" /></label></div></article></div>
        </section>

        <section v-else-if="activePage === 'accounts'" class="stack">
          <div class="section-head account-page-head"><div><span>Accounts</span><h3>Manage where your money lives</h3></div><button class="primary" type="button" @click="openCreateAccount"><Plus :size="17" /> Add account</button></div>
          <article class="hero compact"><span>Total net worth</span><h2>{{ money(totalNetWorth, currency) }}</h2><p>Assets minus liabilities</p></article>
          <div v-if="!accounts.length" class="card empty-state account-empty-actions"><p>No accounts yet. Add your first account to start recording transactions.</p><button class="primary" type="button" @click="openCreateAccount"><Plus :size="17" /> Add account</button></div>
          <div class="account-grid">
            <article v-for="account in accounts" :key="account.id" class="card account-card">
              <i :style="{ background: account.color }"></i>
              <div><span>{{ account.kind }}</span><h3>{{ account.name }}</h3></div>
              <strong>{{ money(balances[account.id] ?? 0, currency) }}</strong>
              <button class="soft-icon-button account-edit" type="button" :aria-label="`Edit ${account.name}`" @click="openEditAccount(account)"><Pencil :size="16" /></button>
            </article>
          </div>
        </section>

        <section v-else-if="activePage === 'reports'" class="stack"><div class="metrics"><article class="metric"><span>Savings rate</span><strong>{{ savingsRate }}%</strong></article><article class="metric"><span>Average daily spending</span><strong>{{ money(Math.round(summary.expenseMinor / Math.max(1, new Date().getDate())), currency) }}</strong></article><article class="metric"><span>Largest category</span><strong>{{ largestCategoryName }}</strong></article></div><div class="content-grid"><article class="card chart-card"><h3>Income and expenses</h3><div class="chart-wrap"><canvas ref="chartCanvas"></canvas></div></article><article class="card"><h3>Current month categories</h3><div class="chart-wrap small"><canvas ref="categoryCanvas"></canvas></div></article></div></section>

        <section v-else class="settings-grid"><article class="card settings-card"><div><span>Appearance</span><h3>Dark mode</h3><p>Use a dark interface on this device.</p></div><button class="toggle" :class="{ on: dark }" @click="dark = !dark"><i></i></button></article><article class="card settings-card"><div><span>Currency</span><h3>Display currency</h3><p>Stored amounts remain unchanged.</p></div><select :value="currency" :disabled="currencyPending" @change="updateCurrency($event.target as HTMLSelectElement)"><option>MYR</option><option>SGD</option><option>USD</option></select></article><article class="card settings-card"><div><span>Data</span><h3>Export CSV</h3></div><button class="secondary" @click="exportCsv">Export</button></article></section>
      </div>
    </main>

    <button class="mobile-fab" :disabled="!accounts.length" :title="!accounts.length ? 'Add an account before creating a transaction' : ''" @click="openAdd('expense')">＋</button>
    <div v-if="accountModalOpen" class="modal-backdrop" @click.self="closeAccountModal">
      <form class="modal account-modal" novalidate aria-describedby="account-form-error" @submit.prevent="submitAccount">
        <div class="modal-head">
          <div><span>{{ editingAccountId ? 'Edit account' : 'New account' }}</span><h2>{{ editingAccountId ? 'Update account' : 'Add account' }}</h2></div>
          <button class="icon-button" type="button" aria-label="Close account form" :disabled="accountPending" @click="closeAccountModal">×</button>
        </div>
        <label><span>Account name</span><input v-model="accountForm.name" aria-label="Account name" maxlength="80" autocomplete="off" required /></label>
        <div class="form-grid">
          <label><span>Account type</span><select v-model="accountForm.kind" aria-label="Account type" required><option value="asset">Asset</option><option value="liability">Liability</option></select></label>
          <label><span>Opening balance</span><input v-model="accountForm.openingBalance" aria-label="Opening balance" inputmode="decimal" type="number" step="0.01" required /></label>
          <label><span>Color</span><input v-model="accountForm.color" aria-label="Account color" maxlength="7" pattern="#[0-9A-Fa-f]{6}" placeholder="#2aa883" required /></label>
        </div>
        <p v-if="accountError" id="account-form-error" class="form-error" role="alert">{{ accountError }}</p>
        <div class="account-form-actions">
          <button v-if="editingAccountId" class="danger-button" type="button" :disabled="accountPending" @click="removeAccount"><Trash2 :size="16" /> Delete account</button>
          <button class="primary" type="submit" :disabled="accountPending">{{ accountPending ? 'Saving…' : editingAccountId ? 'Save changes' : 'Create account' }}</button>
        </div>
      </form>
    </div>
    <div v-if="modalOpen" class="modal-backdrop" @click.self="modalOpen = false"><form class="modal" @submit.prevent="addTransaction"><div class="modal-head"><div><span>Quick add</span><h2>New transaction</h2></div><button type="button" class="icon-button" :disabled="transactionPending" @click="modalOpen = false">×</button></div><div class="segmented"><button v-for="type in ['expense', 'income', 'transfer']" :key="type" type="button" :class="{ active: form.type === type }" :disabled="transactionPending" @click="form.type = type as TransactionType">{{ type }}</button></div><label class="amount-label"><span>Amount</span><div><b>{{ currency }}</b><input v-model="form.amount" inputmode="decimal" type="number" min="0.01" step="0.01" placeholder="0.00" required autofocus /></div></label><div class="form-grid"><label><span>From account</span><select v-model="form.accountId" required><option v-for="account in accounts" :key="account.id" :value="account.id">{{ account.name }}</option></select></label><label v-if="form.type === 'transfer'"><span>To account</span><select v-model="form.toAccountId" required><option v-for="account in accounts" :key="account.id" :value="account.id" :disabled="account.id === form.accountId">{{ account.name }}</option></select></label><label v-else><span>Category</span><select v-model="form.categoryId" required><option v-for="category in eligibleCategories" :key="category.id" :value="category.id">{{ category.name }}</option></select></label><label><span>Date</span><input v-model="form.transactionDate" type="date" required /></label></div><label><span>Merchant or source</span><input v-model="form.merchant" placeholder="Where was this?" /></label><label><span>Note</span><textarea v-model="form.note" rows="2"></textarea></label><button class="primary full" type="submit" :disabled="transactionPending || !canSubmit">{{ transactionPending ? 'Saving…' : 'Save transaction' }}</button></form></div>
    <div v-if="toast" class="toast">{{ toast }}</div>
  </div>
</template>
