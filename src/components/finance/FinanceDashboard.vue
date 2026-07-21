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
  PiggyBank,
  Plus,
  ReceiptText,
  Settings,
  Sun,
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
import type { Category, Transaction, TransactionType } from '../../types/finance-domain'

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
const search = ref('')
const typeFilter = ref('all')
const dark = ref(localStorage.getItem('vipro-pocket-theme') === 'dark')
const toast = ref('')
const selectedMonth = ref(monthKey())
const chartCanvas = ref<HTMLCanvasElement | null>(null)
const categoryCanvas = ref<HTMLCanvasElement | null>(null)
let cashChart: Chart | null = null
let categoryChart: Chart | null = null

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
const currency = computed(() => profile.value?.currency ?? 'MYR')
const canSubmit = computed(() => {
  if (!accounts.value.length || !form.value.accountId || Math.round(Number(form.value.amount) * 100) <= 0) return false
  if (form.value.type === 'transfer') {
    return Boolean(form.value.toAccountId && form.value.toAccountId !== form.value.accountId)
  }
  return Boolean(form.value.categoryId)
})

const summary = computed(() => monthlySummary(transactions.value, selectedMonth.value))
const balances = computed(() => accountBalances(accounts.value, transactions.value))
const totalNetWorth = computed(() => netWorth(accounts.value, transactions.value))
const categorySpend = computed(() => categoryTotals(transactions.value, selectedMonth.value))
const totalBudget = computed(() =>
  budgets.value.filter((budget) => budget.month === selectedMonth.value).reduce((sum, budget) => sum + budget.limitMinor, 0),
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
    const limit =
      budgets.value.find((budget) => budget.month === selectedMonth.value && budget.categoryId === category.id)?.limitMinor ?? 0
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
  toast.value = message
  setTimeout(() => (toast.value = ''), 2200)
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

async function addTransaction() {
  const amountMinor = Math.round(Number(form.value.amount) * 100)
  if (!canSubmit.value) return
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

async function updateBudget(categoryId: string, value: string) {
  try {
    await finance.upsertBudget({
      categoryId,
      month: selectedMonth.value,
      limitMinor: Math.max(0, Math.round(Number(value) * 100)),
    })
    showToast('Budget saved')
  } catch {
    showToast(finance.error || 'Unable to save the budget. Please try again.')
  }
}

async function updateCurrency(value: string) {
  if (value === currency.value) return
  try {
    await finance.updateProfileCurrency(value)
    showToast('Currency updated')
  } catch {
    showToast(finance.error || 'Unable to update the currency. Please try again.')
  }
}

function exportCsv() {
  const rows = [
    ['Date', 'Type', 'Category', 'Merchant', 'Amount', 'Account', 'Destination account'],
    ...sortedTransactions.value.map((item) => [
      item.transactionDate,
      item.type,
      transactionCategoryName(item),
      item.merchant,
      (item.amountMinor / 100).toFixed(2),
      accounts.value.find((account) => account.id === item.accountId)?.name ?? '',
      item.toAccountId ? accounts.value.find((account) => account.id === item.toAccountId)?.name ?? '' : '',
    ]),
  ]
  const blob = new Blob(
    [rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(',')).join('\n')],
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
  nextTick(renderCharts)
}

function lastSixMonths() {
  return Array.from({ length: 6 }, (_, index) => {
    const date = new Date()
    date.setMonth(date.getMonth() - (5 - index))
    return monthKey(date)
  })
}

function renderCharts() {
  cashChart?.destroy()
  categoryChart?.destroy()
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
  cashChart?.destroy()
  categoryChart?.destroy()
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
          <span class="avatar">LR</span>
          <span><strong>Lemon Roti</strong><small>Personal workspace</small></span>
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
          <p v-if="!budgets.some((budget) => budget.month === selectedMonth)" class="empty-state">No budgets yet.</p>
          <div class="budget-grid"><article v-for="row in budgetRows" :key="row.category.id" class="card budget-item"><div class="section-head"><div><span>{{ row.category.name }}</span><h3>{{ money(row.spent, currency) }}</h3></div><b :class="{ danger: row.percent > 100 }">{{ row.percent }}%</b></div><div class="progress"><i :style="{ width: `${Math.min(row.percent, 100)}%`, background: row.category.color }"></i></div><div class="split"><span>{{ row.remaining >= 0 ? `${money(row.remaining, currency)} left` : `${money(Math.abs(row.remaining), currency)} over` }}</span><label>Limit <input :value="(row.limit / 100).toFixed(0)" type="number" @change="updateBudget(row.category.id, ($event.target as HTMLInputElement).value)" /></label></div></article></div>
        </section>

        <section v-else-if="activePage === 'accounts'" class="stack"><article class="hero compact"><span>Total net worth</span><h2>{{ money(totalNetWorth, currency) }}</h2><p>Assets minus liabilities</p></article><p v-if="!accounts.length" class="empty-state">No accounts yet. Account management is coming next.</p><div class="account-grid"><article v-for="account in accounts" :key="account.id" class="card account-card"><i :style="{ background: account.color }"></i><div><span>{{ account.kind }}</span><h3>{{ account.name }}</h3></div><strong>{{ money(balances[account.id] ?? 0, currency) }}</strong></article></div></section>

        <section v-else-if="activePage === 'reports'" class="stack"><div class="metrics"><article class="metric"><span>Savings rate</span><strong>{{ savingsRate }}%</strong></article><article class="metric"><span>Average daily spending</span><strong>{{ money(Math.round(summary.expenseMinor / Math.max(1, new Date().getDate())), currency) }}</strong></article><article class="metric"><span>Largest category</span><strong>{{ largestCategoryName }}</strong></article></div><div class="content-grid"><article class="card chart-card"><h3>Income and expenses</h3><div class="chart-wrap"><canvas ref="chartCanvas"></canvas></div></article><article class="card"><h3>Current month categories</h3><div class="chart-wrap small"><canvas ref="categoryCanvas"></canvas></div></article></div></section>

        <section v-else class="settings-grid"><article class="card settings-card"><div><span>Appearance</span><h3>Dark mode</h3><p>Use a dark interface on this device.</p></div><button class="toggle" :class="{ on: dark }" @click="dark = !dark"><i></i></button></article><article class="card settings-card"><div><span>Currency</span><h3>Display currency</h3><p>Stored amounts remain unchanged.</p></div><select :value="currency" @change="updateCurrency(($event.target as HTMLSelectElement).value)"><option>MYR</option><option>SGD</option><option>USD</option></select></article><article class="card settings-card"><div><span>Data</span><h3>Export CSV</h3></div><button class="secondary" @click="exportCsv">Export</button></article></section>
      </div>
    </main>

    <button class="mobile-fab" :disabled="!accounts.length" :title="!accounts.length ? 'Add an account before creating a transaction' : ''" @click="openAdd('expense')">＋</button>
    <div v-if="modalOpen" class="modal-backdrop" @click.self="modalOpen = false"><form class="modal" @submit.prevent="addTransaction"><div class="modal-head"><div><span>Quick add</span><h2>New transaction</h2></div><button type="button" class="icon-button" @click="modalOpen = false">×</button></div><div class="segmented"><button v-for="type in ['expense', 'income', 'transfer']" :key="type" type="button" :class="{ active: form.type === type }" @click="form.type = type as TransactionType">{{ type }}</button></div><label class="amount-label"><span>Amount</span><div><b>{{ currency }}</b><input v-model="form.amount" inputmode="decimal" type="number" min="0.01" step="0.01" placeholder="0.00" autofocus /></div></label><div class="form-grid"><label><span>From account</span><select v-model="form.accountId"><option v-for="account in accounts" :key="account.id" :value="account.id">{{ account.name }}</option></select></label><label v-if="form.type === 'transfer'"><span>To account</span><select v-model="form.toAccountId"><option v-for="account in accounts" :key="account.id" :value="account.id" :disabled="account.id === form.accountId">{{ account.name }}</option></select></label><label v-else><span>Category</span><select v-model="form.categoryId"><option v-for="category in eligibleCategories" :key="category.id" :value="category.id">{{ category.name }}</option></select></label><label><span>Date</span><input v-model="form.transactionDate" type="date" /></label></div><label><span>Merchant or source</span><input v-model="form.merchant" placeholder="Where was this?" /></label><label><span>Note</span><textarea v-model="form.note" rows="2"></textarea></label><button class="primary full" type="submit" :disabled="!canSubmit">Save transaction</button></form></div>
    <div v-if="toast" class="toast">{{ toast }}</div>
  </div>
</template>
