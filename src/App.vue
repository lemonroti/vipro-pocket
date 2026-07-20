<script setup lang="ts">
import Chart from 'chart.js/auto'
import Dexie, { type Table } from 'dexie'
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { accountBalances, categoryTotals, money, monthKey, monthlySummary, netWorth, type Account, type Budget, type Transaction, type TransactionType } from './finance'

class PocketDb extends Dexie {
  accounts!: Table<Account, string>
  transactions!: Table<Transaction, string>
  budgets!: Table<Budget, string>
  constructor() {
    super('vipro-pocket')
    this.version(1).stores({ accounts: 'id,name,kind', transactions: 'id,date,type,accountId,category', budgets: 'id,month,category' })
  }
}

const db = new PocketDb()
const categories = ['Food', 'Transport', 'Shopping', 'Bills', 'Entertainment', 'Health', 'Education', 'Others']
const categoryColors: Record<string, string> = { Food:'#ef7b66', Transport:'#4f8cff', Shopping:'#8d7cf7', Bills:'#d39b28', Entertainment:'#df66a5', Health:'#2aa883', Education:'#5776d9', Others:'#78827a', Salary:'#2aa883', Freelance:'#4f8cff', Transfer:'#4f8cff' }
const pages = ['dashboard','transactions','budgets','accounts','reports','settings'] as const
const activePage = ref<(typeof pages)[number]>('dashboard')
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

const form = ref({ type: 'expense' as TransactionType, amount: '', accountId: 'maybank', toAccountId: 'cash', category: 'Food', merchant: '', note: '', date: new Date().toISOString().slice(0,10) })
const summary = computed(() => monthlySummary(transactions.value, selectedMonth.value))
const balances = computed(() => accountBalances(accounts.value, transactions.value))
const totalNetWorth = computed(() => netWorth(accounts.value, transactions.value))
const categorySpend = computed(() => categoryTotals(transactions.value, selectedMonth.value))
const totalBudget = computed(() => budgets.value.filter((b) => b.month === selectedMonth.value).reduce((sum,b) => sum+b.limitMinor,0))
const remainingBudget = computed(() => totalBudget.value-summary.value.expenseMinor)
const budgetUsage = computed(() => totalBudget.value ? Math.round(summary.value.expenseMinor/totalBudget.value*100) : 0)
const savingsRate = computed(() => summary.value.incomeMinor ? Math.round((summary.value.incomeMinor-summary.value.expenseMinor)/summary.value.incomeMinor*100) : 0)
const sortedTransactions = computed(() => [...transactions.value].sort((a,b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)))
const filteredTransactions = computed(() => sortedTransactions.value.filter((item) => (typeFilter.value==='all'||item.type===typeFilter.value) && `${item.merchant} ${item.category} ${item.note}`.toLowerCase().includes(search.value.toLowerCase())))
const budgetRows = computed(() => categories.map((category) => { const limit = budgets.value.find((b) => b.month===selectedMonth.value&&b.category===category)?.limitMinor ?? 0; const spent = categorySpend.value[category] ?? 0; return { category, limit, spent, remaining: limit-spent, percent: limit ? Math.round(spent/limit*100) : 0 } }))
const pageTitle = computed(() => ({ dashboard:'Money overview', transactions:'Transactions', budgets:'Monthly budgets', accounts:'Accounts', reports:'Reports', settings:'Settings' })[activePage.value])

function dateAt(day:number, offset=0){const now=new Date();return new Date(now.getFullYear(),now.getMonth()+offset,day).toISOString().slice(0,10)}
function seedAccounts():Account[]{return [
  {id:'cash',name:'Cash',kind:'asset',openingBalanceMinor:46000,color:'#2aa883'},
  {id:'maybank',name:'Maybank',kind:'asset',openingBalanceMinor:948000,color:'#d39b28'},
  {id:'tng',name:"Touch 'n Go",kind:'asset',openingBalanceMinor:26800,color:'#4f8cff'},
  {id:'savings',name:'Emergency Fund',kind:'asset',openingBalanceMinor:1800000,color:'#8d7cf7'},
  {id:'credit',name:'Credit Card',kind:'liability',openingBalanceMinor:132000,color:'#ef7b66'},
]}
function makeTx(id:string,type:TransactionType,amountMinor:number,accountId:string,category:string,merchant:string,day:number,offset=0,toAccountId?:string):Transaction{return {id,type,amountMinor,accountId,toAccountId,category,merchant,note:'',date:dateAt(day,offset),createdAt:new Date().toISOString()}}
function seedTransactions():Transaction[]{return [
  makeTx('salary','income',520000,'maybank','Salary','Monthly salary',1), makeTx('freelance','income',85000,'maybank','Freelance','Website maintenance',4),
  makeTx('internet','expense',12860,'maybank','Bills','Unifi',3), makeTx('lunch','expense',2680,'tng','Food','Village Park',5),
  makeTx('fuel','expense',6240,'maybank','Transport','Petronas',6), makeTx('shopping','expense',23890,'credit','Shopping','Shopee',8),
  makeTx('drink','expense',1590,'tng','Food','Tealive',9), makeTx('groceries','expense',9430,'cash','Food','Jaya Grocer',11),
  makeTx('subscription','expense',13900,'credit','Entertainment','Netflix + Spotify',12), makeTx('health','expense',6800,'maybank','Health','Guardian',14),
  makeTx('utilities','expense',32000,'maybank','Bills','Electricity & water',15), makeTx('grab','expense',4550,'tng','Transport','Grab',17),
  makeTx('course','expense',12000,'maybank','Education','Online course',19), makeTx('saving','transfer',50000,'maybank','Transfer','Monthly saving',20,0,'savings'),
  ...[-1,-2,-3,-4,-5].flatMap((offset,index)=>[makeTx(`salary-${index}`,'income',500000-index*5000,'maybank','Salary','Monthly salary',1,offset),makeTx(`expense-${index}`,'expense',280000+index*7000,'maybank','Others','Monthly expenses',24,offset)])
]}
function seedBudgets():Budget[]{const limits=[90000,45000,40000,85000,25000,20000,30000,35000];return categories.map((category,index)=>({id:`${selectedMonth.value}-${category}`,month:selectedMonth.value,category,limitMinor:limits[index]}))}

async function load(){if(await db.accounts.count()===0){await db.accounts.bulkAdd(seedAccounts());await db.transactions.bulkAdd(seedTransactions());await db.budgets.bulkAdd(seedBudgets())}accounts.value=await db.accounts.toArray();transactions.value=await db.transactions.toArray();budgets.value=await db.budgets.toArray();await nextTick();renderCharts()}
function showToast(message:string){toast.value=message;setTimeout(()=>toast.value='',2200)}
function openAdd(type:TransactionType){form.value.type=type;form.value.category=type==='income'?'Salary':'Food';modalOpen.value=true}
async function addTransaction(){const amountMinor=Math.round(Number(form.value.amount)*100);if(!amountMinor)return; if(form.value.type==='transfer'&&form.value.accountId===form.value.toAccountId){showToast('Choose a different destination account');return}const item:Transaction={id:crypto.randomUUID(),type:form.value.type,amountMinor,accountId:form.value.accountId,toAccountId:form.value.type==='transfer'?form.value.toAccountId:undefined,category:form.value.type==='transfer'?'Transfer':form.value.category,merchant:form.value.merchant||form.value.category,note:form.value.note,date:form.value.date,createdAt:new Date().toISOString()};await db.transactions.add(item);transactions.value.push(item);modalOpen.value=false;form.value.amount='';form.value.merchant='';form.value.note='';showToast('Transaction saved');renderCharts()}
async function removeTransaction(id:string){if(!confirm('Delete this transaction?'))return;await db.transactions.delete(id);transactions.value=transactions.value.filter((item)=>item.id!==id);renderCharts()}
async function updateBudget(category:string,value:string){const item:Budget={id:`${selectedMonth.value}-${category}`,month:selectedMonth.value,category,limitMinor:Math.max(0,Math.round(Number(value)*100))};await db.budgets.put(item);const index=budgets.value.findIndex((b)=>b.id===item.id);index>=0?budgets.value.splice(index,1,item):budgets.value.push(item)}
async function resetData(){if(!confirm('Reset all local data?'))return;await db.delete();location.reload()}
function exportCsv(){const rows=[['Date','Type','Category','Merchant','Amount','Account'],...sortedTransactions.value.map((item)=>[item.date,item.type,item.category,item.merchant,(item.amountMinor/100).toFixed(2),accounts.value.find((a)=>a.id===item.accountId)?.name??''])];const blob=new Blob([rows.map((row)=>row.map((cell)=>`"${String(cell).replaceAll('"','""')}"`).join(',')).join('\n')],{type:'text/csv'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='vipro-pocket-transactions.csv';a.click();URL.revokeObjectURL(url)}
function switchPage(page:(typeof pages)[number]){activePage.value=page;nextTick(renderCharts)}
function lastSixMonths(){return Array.from({length:6},(_,i)=>{const d=new Date();d.setMonth(d.getMonth()-(5-i));return monthKey(d)})}
function renderCharts(){cashChart?.destroy();categoryChart?.destroy();if(chartCanvas.value){const months=lastSixMonths();cashChart=new Chart(chartCanvas.value,{type:'bar',data:{labels:months.map((m)=>new Date(`${m}-01`).toLocaleDateString('en-MY',{month:'short'})),datasets:[{label:'Income',data:months.map((m)=>monthlySummary(transactions.value,m).incomeMinor/100),backgroundColor:'#2aa883',borderRadius:8},{label:'Expenses',data:months.map((m)=>monthlySummary(transactions.value,m).expenseMinor/100),backgroundColor:'#ef7b66',borderRadius:8}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom'}},scales:{x:{grid:{display:false}},y:{grid:{color:'rgba(120,130,122,.12)'}}}}})}if(categoryCanvas.value){const entries=Object.entries(categorySpend.value).filter(([,value])=>value>0);categoryChart=new Chart(categoryCanvas.value,{type:'doughnut',data:{labels:entries.map(([key])=>key),datasets:[{data:entries.map(([,value])=>value/100),backgroundColor:entries.map(([key])=>categoryColors[key]??'#78827a'),borderWidth:0}]},options:{responsive:true,maintainAspectRatio:false,cutout:'70%',plugins:{legend:{position:'bottom'}}}})}}

watch(dark,(value)=>{document.documentElement.classList.toggle('dark',value);localStorage.setItem('vipro-pocket-theme',value?'dark':'light')},{immediate:true})
watch(currency,(value)=>localStorage.setItem('vipro-pocket-currency',value))
onMounted(load)
</script>

<template>
  <div class="app-shell">
    <aside class="sidebar"><div class="brand"><b>VP</b><div><strong>vipro-pocket</strong><span>Personal finance</span></div></div><nav><button v-for="page in pages" :key="page" :class="{active:activePage===page}" @click="switchPage(page)">{{ page }}</button></nav><div class="sidebar-budget"><span>Monthly budget</span><strong>{{ money(Math.max(remainingBudget,0),currency) }}</strong><small>remaining</small><div class="progress"><i :style="{width:`${Math.min(budgetUsage,100)}%`}"></i></div></div></aside>
    <main class="main"><header class="topbar"><div><small>{{ new Date().toLocaleDateString('en-MY',{weekday:'long',day:'numeric',month:'long'}) }}</small><h1>{{ pageTitle }}</h1></div><div class="top-actions"><button class="icon-button" @click="dark=!dark">{{ dark?'☀':'☾' }}</button><button class="secondary desktop-only" @click="exportCsv">Export</button><button class="primary" @click="openAdd('expense')">＋ Add transaction</button></div></header>
      <section v-if="activePage==='dashboard'" class="stack"><div class="hero-grid"><article class="hero"><span>Total net worth</span><h2>{{ money(totalNetWorth,currency) }}</h2><p>Assets minus liabilities across all accounts.</p><div class="hero-actions"><button @click="openAdd('expense')">− Expense</button><button @click="openAdd('income')">＋ Income</button><button @click="openAdd('transfer')">⇄ Transfer</button></div></article><article class="card budget-card"><div class="section-head"><div><span>Monthly budget</span><h3>{{ money(Math.max(remainingBudget,0),currency) }} left</h3></div><b>{{ budgetUsage }}%</b></div><div class="progress large"><i :style="{width:`${Math.min(budgetUsage,100)}%`}"></i></div><div class="split"><span>Spent {{ money(summary.expenseMinor,currency) }}</span><span>Limit {{ money(totalBudget,currency) }}</span></div></article></div><div class="metrics"><article class="metric"><span>Income</span><strong>{{ money(summary.incomeMinor,currency) }}</strong><em>this month</em></article><article class="metric"><span>Expenses</span><strong>{{ money(summary.expenseMinor,currency) }}</strong><em>this month</em></article><article class="metric"><span>Cash flow</span><strong>{{ money(summary.incomeMinor-summary.expenseMinor,currency) }}</strong><em>income minus spending</em></article></div><div class="content-grid"><article class="card chart-card"><div class="section-head"><div><span>Cash flow</span><h3>Last 6 months</h3></div></div><div class="chart-wrap"><canvas ref="chartCanvas"></canvas></div></article><article class="card"><div class="section-head"><div><span>Spending</span><h3>By category</h3></div></div><div class="chart-wrap small"><canvas ref="categoryCanvas"></canvas></div></article></div><article class="card"><div class="section-head"><div><span>Activity</span><h3>Recent transactions</h3></div><button class="text-button" @click="switchPage('transactions')">View all</button></div><div class="transaction-list"><div v-for="item in sortedTransactions.slice(0,6)" :key="item.id" class="transaction-row"><i class="category-dot" :style="{background:categoryColors[item.category]??'#78827a'}"></i><div><strong>{{ item.merchant }}</strong><span>{{ item.category }} · {{ item.date }}</span></div><b :class="item.type">{{ item.type==='expense'?'−':item.type==='income'?'+':'' }}{{ money(item.amountMinor,currency) }}</b></div></div></article></section>
      <section v-else-if="activePage==='transactions'" class="stack"><div class="toolbar"><input v-model="search" placeholder="Search transactions…"><select v-model="typeFilter"><option value="all">All types</option><option value="expense">Expenses</option><option value="income">Income</option><option value="transfer">Transfers</option></select></div><article class="card"><div class="transaction-list"><div v-for="item in filteredTransactions" :key="item.id" class="transaction-row"><i class="category-dot" :style="{background:categoryColors[item.category]??'#78827a'}"></i><div><strong>{{ item.merchant }}</strong><span>{{ item.category }} · {{ item.date }} · {{ accounts.find((a)=>a.id===item.accountId)?.name }}</span></div><b :class="item.type">{{ item.type==='expense'?'−':item.type==='income'?'+':'' }}{{ money(item.amountMinor,currency) }}</b><button class="delete" @click="removeTransaction(item.id)">×</button></div><div v-if="!filteredTransactions.length" class="empty-state">No transactions match your filters.</div></div></article></section>
      <section v-else-if="activePage==='budgets'" class="stack"><div class="metrics"><article class="metric"><span>Total budget</span><strong>{{ money(totalBudget,currency) }}</strong></article><article class="metric"><span>Spent</span><strong>{{ money(summary.expenseMinor,currency) }}</strong></article><article class="metric"><span>Remaining</span><strong>{{ money(remainingBudget,currency) }}</strong></article></div><div class="budget-grid"><article v-for="row in budgetRows" :key="row.category" class="card budget-item"><div class="section-head"><div><span>{{ row.category }}</span><h3>{{ money(row.spent,currency) }}</h3></div><b :class="{danger:row.percent>100}">{{ row.percent }}%</b></div><div class="progress"><i :style="{width:`${Math.min(row.percent,100)}%`,background:categoryColors[row.category]}"></i></div><div class="split"><span>{{ row.remaining>=0?money(row.remaining,currency)+' left':money(Math.abs(row.remaining),currency)+' over' }}</span><label>Limit <input :value="(row.limit/100).toFixed(0)" type="number" @change="updateBudget(row.category,($event.target as HTMLInputElement).value)"></label></div></article></div></section>
      <section v-else-if="activePage==='accounts'" class="stack"><article class="hero compact"><span>Net worth</span><h2>{{ money(totalNetWorth,currency) }}</h2><p>Assets minus liabilities</p></article><div class="account-grid"><article v-for="account in accounts" :key="account.id" class="card account-card"><i :style="{background:account.color}"></i><div><span>{{ account.kind }}</span><h3>{{ account.name }}</h3></div><strong>{{ money(balances[account.id]??0,currency) }}</strong></article></div></section>
      <section v-else-if="activePage==='reports'" class="stack"><div class="metrics"><article class="metric"><span>Savings rate</span><strong>{{ savingsRate }}%</strong></article><article class="metric"><span>Average daily spending</span><strong>{{ money(Math.round(summary.expenseMinor/Math.max(1,new Date().getDate())),currency) }}</strong></article><article class="metric"><span>Largest category</span><strong>{{ Object.entries(categorySpend).sort((a,b)=>b[1]-a[1])[0]?.[0]??'None' }}</strong></article></div><div class="content-grid"><article class="card chart-card"><h3>Income and expenses</h3><div class="chart-wrap"><canvas ref="chartCanvas"></canvas></div></article><article class="card"><h3>Current month categories</h3><div class="chart-wrap small"><canvas ref="categoryCanvas"></canvas></div></article></div></section>
      <section v-else class="settings-grid"><article class="card settings-card"><div><span>Appearance</span><h3>Dark mode</h3><p>Use a dark interface on this device.</p></div><button class="toggle" :class="{on:dark}" @click="dark=!dark"><i></i></button></article><article class="card settings-card"><div><span>Currency</span><h3>Display currency</h3><p>Stored amounts remain unchanged.</p></div><select v-model="currency"><option>MYR</option><option>SGD</option><option>USD</option></select></article><article class="card settings-card"><div><span>Data</span><h3>Export CSV</h3></div><button class="secondary" @click="exportCsv">Export</button></article><article class="card settings-card"><div><span>Local database</span><h3>Reset sample data</h3></div><button class="secondary" @click="resetData">Reset</button></article></section>
    </main><button class="mobile-fab" @click="openAdd('expense')">＋</button>
    <div v-if="modalOpen" class="modal-backdrop" @click.self="modalOpen=false"><form class="modal" @submit.prevent="addTransaction"><div class="modal-head"><div><span>Quick add</span><h2>New transaction</h2></div><button type="button" class="icon-button" @click="modalOpen=false">×</button></div><div class="segmented"><button v-for="type in ['expense','income','transfer']" :key="type" type="button" :class="{active:form.type===type}" @click="form.type=type as TransactionType">{{ type }}</button></div><label class="amount-label"><span>Amount</span><div><b>{{ currency }}</b><input v-model="form.amount" inputmode="decimal" type="number" min="0.01" step="0.01" placeholder="0.00" autofocus></div></label><div class="form-grid"><label><span>From account</span><select v-model="form.accountId"><option v-for="account in accounts" :key="account.id" :value="account.id">{{ account.name }}</option></select></label><label v-if="form.type==='transfer'"><span>To account</span><select v-model="form.toAccountId"><option v-for="account in accounts" :key="account.id" :value="account.id">{{ account.name }}</option></select></label><label v-else><span>Category</span><select v-model="form.category"><option v-for="category in form.type==='income'?['Salary','Freelance','Other Income']:categories" :key="category">{{ category }}</option></select></label><label><span>Date</span><input v-model="form.date" type="date"></label></div><label><span>Merchant or source</span><input v-model="form.merchant" placeholder="Where was this?"></label><label><span>Note</span><textarea v-model="form.note" rows="2"></textarea></label><button class="primary full" type="submit">Save transaction</button></form></div><div v-if="toast" class="toast">{{ toast }}</div>
  </div>
</template>
