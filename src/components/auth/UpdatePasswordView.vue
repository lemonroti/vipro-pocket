<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../../stores/auth'

const router = useRouter()
const auth = useAuthStore()
const password = ref('')
const confirmPassword = ref('')
const initializationPending = ref(!auth.initialized)
const recoveryAvailable = computed(() => auth.initialized && auth.recoveryMode && Boolean(auth.user))

onMounted(async () => {
  try {
    await auth.initialize()
  } catch {
    // The invalid-link guidance below is safe for initialization failures.
  } finally {
    initializationPending.value = false
  }
})

async function submit() {
  auth.error = ''
  if (!recoveryAvailable.value) {
    auth.error = 'Open a valid password recovery link before choosing a new password.'
    return
  }
  if (password.value !== confirmPassword.value) {
    auth.error = 'Passwords do not match'
    return
  }

  try {
    await auth.updatePassword(password.value)
    await router.replace('/')
  } catch {
    // The store exposes the error.
  }
}
</script>

<template>
  <main class="auth-page">
    <section class="auth-card">
      <div class="auth-brand"><b>VP</b><span>vipro-pocket</span></div>
      <h1>Choose a new password</h1>
      <p v-if="initializationPending">Processing your recovery link…</p>
      <form v-else-if="recoveryAvailable" @submit.prevent="submit">
        <p>Use at least eight characters.</p>
        <label>New password<input v-model="password" type="password" autocomplete="new-password" minlength="8" :disabled="auth.pending" required /></label>
        <label>Confirm password<input v-model="confirmPassword" type="password" autocomplete="new-password" minlength="8" :disabled="auth.pending" required /></label>
        <p v-if="auth.error" class="auth-error">{{ auth.error }}</p>
        <button class="primary" type="submit" :disabled="auth.pending">{{ auth.pending ? 'Saving…' : 'Update password' }}</button>
      </form>
      <div v-else class="auth-guidance" role="alert">
        <p>This recovery link is invalid or has expired.</p>
        <RouterLink to="/forgot-password">Request a new reset email</RouterLink>
      </div>
    </section>
  </main>
</template>

<style scoped>
.auth-page{min-height:100vh;display:grid;place-items:center;padding:24px;background:#f5f6f3}.auth-card{width:min(440px,100%);padding:32px;border-radius:28px;background:#fff;box-shadow:0 20px 60px rgba(31,45,37,.12)}.auth-brand{display:flex;align-items:center;gap:12px;margin-bottom:24px;font-weight:700}.auth-brand b{display:grid;place-items:center;width:40px;height:40px;border-radius:14px;background:#153d2f;color:#fff}.auth-card h1{margin:0 0 8px;font-size:30px}.auth-card>p{margin:0 0 24px;color:#6c756f}.auth-card form{display:grid;gap:16px}.auth-card form>p{margin:0;color:#6c756f}.auth-card label{display:grid;gap:7px;font-size:13px;font-weight:600}.auth-card input{height:46px;padding:0 14px;border:1px solid #dce1dd;border-radius:13px;font:inherit}.auth-card button{height:48px;border:0;border-radius:14px}.auth-guidance{display:grid;gap:12px;color:#6c756f}.auth-guidance p{margin:0}.auth-guidance a{color:#286b54;font-weight:600}.auth-error{color:#b33a2f}
</style>
