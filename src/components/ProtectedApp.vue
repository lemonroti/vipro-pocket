<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import App from '../App.vue'
import { createProtectedFinanceLifecycle } from '../lib/protected-finance-lifecycle'
import { useAuthStore } from '../stores/auth'
import { useFinanceStore } from '../stores/finance'

const router = useRouter()
const auth = useAuthStore()
const finance = useFinanceStore()
const lifecycle = createProtectedFinanceLifecycle({
  auth,
  finance,
  getUserId: () => auth.user?.id ?? null,
  redirectToLogin: async () => { await router.replace('/login') },
})

onMounted(() => lifecycle.start())

onBeforeUnmount(() => lifecycle.stop())
</script>

<template>
  <main v-if="!auth.initialized || finance.loading" class="app-loading">Loading Vipro Pocket…</main>
  <main v-else-if="auth.user && finance.error && !finance.initialized" class="app-loading">
    <section class="load-error" role="alert">
      <p>{{ finance.error }}</p>
      <button type="button" @click="lifecycle.retry">Try again</button>
    </section>
  </main>
  <App v-else-if="auth.user && finance.initialized && finance.userId === auth.user.id" />
</template>

<style scoped>
.app-loading{min-height:100vh;display:grid;place-items:center;background:#f5f6f3;color:#526058;font-weight:600}
.load-error{display:grid;justify-items:center;gap:1rem;text-align:center}
.load-error button{border:0;border-radius:.65rem;padding:.7rem 1rem;background:#1f7a62;color:#fff;font:inherit;cursor:pointer}
</style>
