<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../../stores/auth'

const router = useRouter()
const auth = useAuthStore()
const password = ref('')
const confirmPassword = ref('')

async function submit() {
  auth.error = ''
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
      <p>Use at least eight characters.</p>
      <form @submit.prevent="submit">
        <label>New password<input v-model="password" type="password" autocomplete="new-password" minlength="8" required /></label>
        <label>Confirm password<input v-model="confirmPassword" type="password" autocomplete="new-password" minlength="8" required /></label>
        <p v-if="auth.error" class="auth-error">{{ auth.error }}</p>
        <button class="primary" type="submit" :disabled="auth.pending">{{ auth.pending ? 'Saving…' : 'Update password' }}</button>
      </form>
    </section>
  </main>
</template>

<style scoped>
.auth-page{min-height:100vh;display:grid;place-items:center;padding:24px;background:#f5f6f3}.auth-card{width:min(440px,100%);padding:32px;border-radius:28px;background:#fff;box-shadow:0 20px 60px rgba(31,45,37,.12)}.auth-brand{display:flex;align-items:center;gap:12px;margin-bottom:24px;font-weight:700}.auth-brand b{display:grid;place-items:center;width:40px;height:40px;border-radius:14px;background:#153d2f;color:#fff}.auth-card h1{margin:0 0 8px;font-size:30px}.auth-card>p{margin:0 0 24px;color:#6c756f}.auth-card form{display:grid;gap:16px}.auth-card label{display:grid;gap:7px;font-size:13px;font-weight:600}.auth-card input{height:46px;padding:0 14px;border:1px solid #dce1dd;border-radius:13px;font:inherit}.auth-card button{height:48px;border:0;border-radius:14px}.auth-error{color:#b33a2f}
</style>
