<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import App from '../App.vue'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const auth = useAuthStore()

onMounted(async () => {
  await auth.initialize()
  if (!auth.user) await router.replace('/login')
})

onBeforeUnmount(() => auth.dispose())
</script>

<template>
  <main v-if="!auth.initialized" class="app-loading">Loading Vipro Pocket…</main>
  <App v-else-if="auth.user" />
</template>

<style scoped>
.app-loading{min-height:100vh;display:grid;place-items:center;background:#f5f6f3;color:#526058;font-weight:600}
</style>
