<script setup lang="ts">
import Chart from 'chart.js/auto'
import Dexie, { type Table } from 'dexie'
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
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import {
  accountBalances,
  categoryTotals,
  money,
  monthKey,
  monthlySummary,
  netWorth,
  type Account,
  type Budget,
  type Transaction,
  type TransactionType,
} from './finance'

class PocketDb extends Dexie {
  accounts!: Table<Account, string>
  transactions!: Table<Transaction, string>
  budgets!: Table<Budget, string>

  constructor() {
    super('vipro-pocket')
    this.version(1).stores({
      accounts: 'id,name,kind',
      transactions: 'id,date,type,accountId,category',
      budgets: 'id,month,category',
    })
  }
}

const db = new PocketDb()
const categories = ['Food', 'Transport', 'Shopping', 'Bills', 'Entertainment', 'Health', 'Education', 'Others']
const categoryColors: Record<string, string> = {
  Food: '#ef7b66',
  Transport: '#4f8cff',
  Shopping: '#8d7cf7',
  Bills: '#d39b28',
  Entertainment: '#df66a5',
  Health: '#2aa883',
  Education: '#5776d9',
  Others: '#78827a',
  Salary: '#2aa883',
  Freelance: '#4f8cff',
  Transfer: '#4f8cff',
}
const categorySoftColors: Record<string, string> = {
  Food: '#fff0ed',
  Transport: '#e9f1ff',
  Shopping: '#eeebff',
  Bills: '#fff7df',
  Entertainment: '#fff0f7',
  Health: '#e4f0e9',
  Education: '#edf1ff',
  Others: '#eef1ef',
}

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
const accounts = ref<Account[]>([])
const transactions = ref<Transaction[]>([])
const budgets = ref<Budget[]>([])
const modalOpen = ref(false)
const search = ref('')
const typeFilter = ref('all')
const currency = ref(localStorage.getItem('vipro-pocket-currency') || 'MYR')
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
  accountId: 'maybank',
  toAccountId: 'cash',
  category: 'Food',
  merchant: '',
  note: '',
  date: new Date().toISOString().slice(0, 10),
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
    (first, second) => second.date.localeCompare(first.date) || second.createdAt.localeCompare(first.createdAt),
  ),
)
const filteredTransactions = computed(() =>
  sortedTransactions.value.filter(
    (item) =>
      (typeFilter.value === 'all' || item.type === typeFilter.value) &&
      `${item.merchant} ${item.category} ${item.note}`.toLowerCase().includes(search.value.toLowerCase()),
  ),
)
const budgetRows = computed(() =>
  categories.map((category) => {
    const limit =
      budgets.value.find((budget) => budget.month === selectedMonth.value && budget.category === category)?.limitMinor ?? 0
    const spent = categorySpend.value[category] ?? 0
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
    .map(([name, amount]) => ({
      name,
      amount,
      color: categoryColors[name] ?? '#78827a',
      soft: categorySoftColors[name] ?? '#eef1ef',
      count: transactions.value.filter(
        (item) => item.type === 'expense' && item.category === name && item.date.startsWith(selectedMonth.value),
      ).length,
    }))
    .filter((item) => item.amount > 0)
    .sort((first, second) => second.amount - first.amount),
)
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

function dateAt(day: number, offset = 0) {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth() + offset, day).toISOString().slice(0, 10)
}

function seedAccounts(): Account[] {
  return [
    { id: 'cash', name: 'Cash', kind: 'asset', openingBalanceMinor: 46000, color: '#2aa883' },
    { id: 'maybank', name: 'Maybank', kind: 'asset', openingBalanceMinor: 948000, color: '#d39b28' },
    { id: 'tng', name: "Touch 'n Go", kind: 'asset', openingBalanceMinor: 26800, color: '#4f8cff' },
    { id: 'savings', name: 'Emergency Fund', kind: 'asset', openingBalanceMinor: 1800000, color: '#8d7cf7' },
    { id: 'credit', name: 'Credit Card', kind: 'liability', openingBalanceMinor: 132000, color: '#ef7b66' },
  ]
}

function makeTx(
  id: string,
  type: TransactionType,
  amountMinor: number,
  accountId: string,
  category: string,
  merchant: string,
  day: number,
  offset = 0,
  toAccountId?: string,
): Transaction {
  return {
    id,
    type,
    amountMinor,
    accountId,
    toAccountId,
    category,
    merchant,
    note: '',
    date: dateAt(day, offset),
    createdAt: new Date().toISOString(),
  }
}

function seedTransactions(): Transaction[] {
  return [
    makeTx('salary', 'income', 520000, 'maybank', 'Salary', 'Monthly salary', 1),
    makeTx('freelance', 'income', 85000, 'maybank', 'Freelance', 'Website maintenance', 4),
    makeTx('internet', 'expense', 12860, 'maybank', 'Bills', 'Unifi', 3),
    makeTx('lunch', 'expense', 2680, 'tng', 'Food', 'Village Park', 5),
    makeTx('fuel', 'expense', 6240, 'maybank', 'Transport', 'Petronas', 6),
    makeTx('shopping', 'expense', 23890, 'credit', 'Shopping', 'Shopee', 8),
    makeTx('drink', 'expense', 1590, 'tng', 'Food', 'Tealive', 9),
    makeTx('groceries', 'expense', 9430, 'cash', 'Food', 'Jaya Grocer', 11),
    makeTx('subscription', 'expense', 13900, 'credit', 'Entertainment', 'Netflix + Spotify', 12),
    makeTx('health', 'expense', 6800, 'maybank', 'Health', 'Guardian', 14),
    makeTx('utilities', 'expense', 32000, 'maybank', 'Bills', 'Electricity & water', 15),
    makeTx('grab', 'expense', 4550, 'tng', 'Transport', 'Grab', 17),
    makeTx('course', 'expense', 12000, 'maybank', 'Education', 'Online course', 19),
    makeTx('saving', 'transfer', 50000, 'maybank', 'Transfer', 'Monthly saving', 20, 0, 'savings'),
    ...[-1, -2, -3, -4, -5].flatMap((offset, index) => [
      makeTx(`salary-${index}`, 'income', 500000 - index * 5000, 'maybank', 'Salary', 'Monthly salary', 1, offset),
      makeTx(`expense-${index}`, 'expense', 280000 + index * 7000, 'maybank', 'Others', 'Monthly expenses', 24, offset),
    ]),
  ]
}

function seedBudgets(): Budget[] {
  const limits = [90000, 45000, 40000, 85000, 25000, 20000, 30000, 35000]
  return categories.map((category, index) => ({
    id: `${selectedMonth.value}-${category}`,
    month: selectedMonth.value,
    category,
    limitMinor: limits[index],
  }))
}

async function load() {
  if ((await db.accounts.count()) === 0) {
    await db.accounts.bulkAdd(seedAccounts())
    await db.transactions.bulkAdd(seedTransactions())
    await db.budgets.bulkAdd(seedBudgets())
  }
  accounts.value = await db.accounts.toArray()
  transactions.value = await db.transactions.toArray()
  budgets.value = await db.budgets.toArray()
  await nextTick()
  renderCharts()
}

function showToast(message: string) {
  toast.value = message
  setTimeout(() => (toast.value = ''), 2200)
}

function openAdd(type: TransactionType) {
  form.value.type = type
  form.value.category = type === 'income' ? 'Salary' : 'Food'
  modalOpen.value = true
}

async function addTransaction() {
  const amountMinor = Math.round(Number(form.value.amount) * 100)
  if (!amountMinor) return
  if (form.value.type === 'transfer' && form.value.accountId === form.value.toAccountId) {
    showToast('Choose a different destination account')
    return
  }
  const item: Transaction = {
    id: crypto.randomUUID(),
    type: form.value.type,
    amountMinor,
    accountId: form.value.accountId,
    toAccountId: form.value.type === 'transfer' ? form.value.toAccountId : undefined,
    category: form.value.type === 'transfer' ? 'Transfer' : form.value.category,
    merchant: form.value.merchant || form.value.category,
    note: form.value.note,
    date: form.value.date,
    createdAt: new Date().toISOString(),
  }
  await db.transactions.add(item)
  transactions.value.push(item)
  modalOpen.value = false
  form.value.amount = ''
  form.value.merchant = ''
  form.value.note = ''
  showToast('Transaction saved')
  renderCharts()
}

async function removeTransaction(id: string) {
  if (!confirm('Delete this transaction?')) return
  await db.transactions.delete(id)
  transactions.value = transactions.value.filter((item) => item.id !== id)
  renderCharts()
}

async function updateBudget(category: string, value: string) {
  const item: Budget = {
    id: `${selectedMonth.value}-${category}`,
    month: selectedMonth.value,
    category,
    limitMinor: Math.max(0, Math.round(Number(value) * 100)),
  }
  await db.budgets.put(item)
  const index = budgets.value.findIndex((budget) => budget.id === item.id)
  index >= 0 ? budgets.value.splice(index, 1, item) : budgets.value.push(item)
}

async function resetData() {
  if (!confirm('Reset all local data?')) return
  await db.delete()
  location.reload()
}

function exportCsv() {
  const rows = [
    ['Date', 'Type', 'Category', 'Merchant', 'Amount', 'Account'],
    ...sortedTransactions.value.map((item) => [
      item.date,
      item.type,
      item.category,
      item.merchant,
      (item.amountMinor / 100).toFixed(2),
      accounts.value.find((account) => account.id === item.accountId)?.name ?? '',
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
        labels: entries.map(([key]) => key),
        datasets: [
          {
            data: entries.map(([, value]) => value / 100),
            backgroundColor: entries.map(([key]) => categoryColors[key] ?? '#78827a'),
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
watch(currency, (value) => localStorage.setItem('vipro-pocket-currency', value))
onMounted(load)
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
            <button class="primary" @click="openAdd('expense')"><Plus :size="17" /> Add transaction</button>
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
                <button class="hero-primary" @click="openAdd('expense')"><Minus :size="16" /> Add expense</button>
                <button @click="openAdd('income')"><Plus :size="16" /> Add income</button>
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
                <span class="transaction-icon" :style="{ background: categorySoftColors[item.category] ?? '#eef1ef', color: categoryColors[item.category] ?? '#78827a' }">{{ item.category.slice(0, 1) }}</span>
                <div><strong>{{ item.merchant }}</strong><span>{{ item.category }} · {{ item.date }}</span></div>
                <b :class="item.type">{{ item.type === 'expense' ? '−' : item.type === 'income' ? '+' : '' }}{{ money(item.amountMinor, currency) }}</b>
              </div>
            </div>
          </article>
        </section>

        <section v-else-if="activePage === 'transactions'" class="stack">
          <div class="toolbar"><input v-model="search" placeholder="Search transactions…" /><select v-model="typeFilter"><option value="all">All types</option><option value="expense">Expenses</option><option value="income">Income</option><option value="transfer">Transfers</option></select></div>
          <article class="card"><div class="transaction-list"><div v-for="item in filteredTransactions" :key="item.id" class="transaction-row"><i class="category-dot" :style="{ background: categoryColors[item.category] ?? '#78827a' }"></i><div><strong>{{ item.merchant }}</strong><span>{{ item.category }} · {{ item.date }} · {{ accounts.find((account) => account.id === item.accountId)?.name }}</span></div><b :class="item.type">{{ item.type === 'expense' ? '−' : item.type === 'income' ? '+' : '' }}{{ money(item.amountMinor, currency) }}</b><button class="delete" @click="removeTransaction(item.id)">×</button></div><div v-if="!filteredTransactions.length" class="empty-state">No transactions match your filters.</div></div></article>
        </section>

        <section v-else-if="activePage === 'budgets'" class="stack">
          <div class="metrics"><article class="metric"><span>Total budget</span><strong>{{ money(totalBudget, currency) }}</strong></article><article class="metric"><span>Spent</span><strong>{{ money(summary.expenseMinor, currency) }}</strong></article><article class="metric"><span>Remaining</span><strong>{{ money(remainingBudget, currency) }}</strong></article></div>
          <div class="budget-grid"><article v-for="row in budgetRows" :key="row.category" class="card budget-item"><div class="section-head"><div><span>{{ row.category }}</span><h3>{{ money(row.spent, currency) }}</h3></div><b :class="{ danger: row.percent > 100 }">{{ row.percent }}%</b></div><div class="progress"><i :style="{ width: `${Math.min(row.percent, 100)}%`, background: categoryColors[row.category] }"></i></div><div class="split"><span>{{ row.remaining >= 0 ? `${money(row.remaining, currency)} left` : `${money(Math.abs(row.remaining), currency)} over` }}</span><label>Limit <input :value="(row.limit / 100).toFixed(0)" type="number" @change="updateBudget(row.category, ($event.target as HTMLInputElement).value)" /></label></div></article></div>
        </section>

        <section v-else-if="activePage === 'accounts'" class="stack"><article class="hero compact"><span>Total net worth</span><h2>{{ money(totalNetWorth, currency) }}</h2><p>Assets minus liabilities</p></article><div class="account-grid"><article v-for="account in accounts" :key="account.id" class="card account-card"><i :style="{ background: account.color }"></i><div><span>{{ account.kind }}</span><h3>{{ account.name }}</h3></div><strong>{{ money(balances[account.id] ?? 0, currency) }}</strong></article></div></section>

        <section v-else-if="activePage === 'reports'" class="stack"><div class="metrics"><article class="metric"><span>Savings rate</span><strong>{{ savingsRate }}%</strong></article><article class="metric"><span>Average daily spending</span><strong>{{ money(Math.round(summary.expenseMinor / Math.max(1, new Date().getDate())), currency) }}</strong></article><article class="metric"><span>Largest category</span><strong>{{ Object.entries(categorySpend).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'None' }}</strong></article></div><div class="content-grid"><article class="card chart-card"><h3>Income and expenses</h3><div class="chart-wrap"><canvas ref="chartCanvas"></canvas></div></article><article class="card"><h3>Current month categories</h3><div class="chart-wrap small"><canvas ref="categoryCanvas"></canvas></div></article></div></section>

        <section v-else class="settings-grid"><article class="card settings-card"><div><span>Appearance</span><h3>Dark mode</h3><p>Use a dark interface on this device.</p></div><button class="toggle" :class="{ on: dark }" @click="dark = !dark"><i></i></button></article><article class="card settings-card"><div><span>Currency</span><h3>Display currency</h3><p>Stored amounts remain unchanged.</p></div><select v-model="currency"><option>MYR</option><option>SGD</option><option>USD</option></select></article><article class="card settings-card"><div><span>Data</span><h3>Export CSV</h3></div><button class="secondary" @click="exportCsv">Export</button></article><article class="card settings-card"><div><span>Local database</span><h3>Reset sample data</h3></div><button class="secondary" @click="resetData">Reset</button></article></section>
      </div>
    </main>

    <button class="mobile-fab" @click="openAdd('expense')">＋</button>
    <div v-if="modalOpen" class="modal-backdrop" @click.self="modalOpen = false"><form class="modal" @submit.prevent="addTransaction"><div class="modal-head"><div><span>Quick add</span><h2>New transaction</h2></div><button type="button" class="icon-button" @click="modalOpen = false">×</button></div><div class="segmented"><button v-for="type in ['expense', 'income', 'transfer']" :key="type" type="button" :class="{ active: form.type === type }" @click="form.type = type as TransactionType">{{ type }}</button></div><label class="amount-label"><span>Amount</span><div><b>{{ currency }}</b><input v-model="form.amount" inputmode="decimal" type="number" min="0.01" step="0.01" placeholder="0.00" autofocus /></div></label><div class="form-grid"><label><span>From account</span><select v-model="form.accountId"><option v-for="account in accounts" :key="account.id" :value="account.id">{{ account.name }}</option></select></label><label v-if="form.type === 'transfer'"><span>To account</span><select v-model="form.toAccountId"><option v-for="account in accounts" :key="account.id" :value="account.id">{{ account.name }}</option></select></label><label v-else><span>Category</span><select v-model="form.category"><option v-for="category in form.type === 'income' ? ['Salary', 'Freelance', 'Other Income'] : categories" :key="category">{{ category }}</option></select></label><label><span>Date</span><input v-model="form.date" type="date" /></label></div><label><span>Merchant or source</span><input v-model="form.merchant" placeholder="Where was this?" /></label><label><span>Note</span><textarea v-model="form.note" rows="2"></textarea></label><button class="primary full" type="submit">Save transaction</button></form></div>
    <div v-if="toast" class="toast">{{ toast }}</div>
  </div>
</template>
