<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../../stores/auth'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const message = ref('')

const mode = computed(() => {
  if (route.path === '/signup') return 'signup'
  if (route.path === '/forgot-password') return 'forgot'
  return 'login'
})

const title = computed(() => ({ login: 'Welcome back', signup: 'Create your account', forgot: 'Reset your password' })[mode.value])

watch(mode, () => {
  auth.clearError()
  message.value = ''
})

function preventPendingNavigation(event: MouseEvent) {
  if (auth.pending) event.preventDefault()
}

async function submit() {
  message.value = ''
  try {
    if (mode.value === 'signup') {
      if (password.value !== confirmPassword.value) throw new Error('Passwords do not match')
      await auth.signUp(email.value.trim(), password.value)
      await router.replace('/')
      return
    }

    if (mode.value === 'forgot') {
      await auth.requestPasswordReset(email.value.trim())
      message.value = 'Check your email for the password reset link.'
      return
    }

    await auth.signIn(email.value.trim(), password.value)
    await router.replace('/')
  } catch {
    // The store exposes a safe user-facing message.
  }
}
</script>

<template>
  <main class="auth-page">
    <section class="auth-card">
      <div class="auth-brand"><b>VP</b><span>vipro-pocket</span></div>
      <h1>{{ title }}</h1>
      <p v-if="mode === 'login'">Sign in to access your finances across devices.</p>
      <p v-else-if="mode === 'signup'">Start with default categories and add your own accounts.</p>
      <p v-else>Enter your email and we will send a recovery link.</p>

      <form @submit.prevent="submit">
        <label>Email<input v-model="email" type="email" autocomplete="email" :disabled="auth.pending" required /></label>
        <label v-if="mode !== 'forgot'">Password<input v-model="password" type="password" :autocomplete="mode === 'signup' ? 'new-password' : 'current-password'" minlength="8" :disabled="auth.pending" required /></label>
        <label v-if="mode === 'signup'">Confirm password<input v-model="confirmPassword" type="password" autocomplete="new-password" minlength="8" :disabled="auth.pending" required /></label>
        <p v-if="auth.error" class="auth-error">{{ auth.error }}</p>
        <p v-if="message" class="auth-success">{{ message }}</p>
        <button class="primary" type="submit" :disabled="auth.pending">
          {{ auth.pending ? 'Please wait…' : mode === 'login' ? 'Sign in' : mode === 'signup' ? 'Create account' : 'Send reset link' }}
        </button>
      </form>

      <nav class="auth-links">
        <RouterLink v-if="mode !== 'login'" to="/login" :aria-disabled="auth.pending" :tabindex="auth.pending ? -1 : undefined" @click="preventPendingNavigation">Sign in</RouterLink>
        <RouterLink v-if="mode !== 'signup'" to="/signup" :aria-disabled="auth.pending" :tabindex="auth.pending ? -1 : undefined" @click="preventPendingNavigation">Create account</RouterLink>
        <RouterLink v-if="mode !== 'forgot'" to="/forgot-password" :aria-disabled="auth.pending" :tabindex="auth.pending ? -1 : undefined" @click="preventPendingNavigation">Forgot password?</RouterLink>
      </nav>
    </section>
  </main>
</template>

<style scoped>
.auth-page{min-height:100vh;display:grid;place-items:center;padding:24px;background:#f5f6f3}.auth-card{width:min(440px,100%);padding:32px;border-radius:28px;background:#fff;box-shadow:0 20px 60px rgba(31,45,37,.12)}.auth-brand{display:flex;align-items:center;gap:12px;margin-bottom:24px;font-weight:700}.auth-brand b{display:grid;place-items:center;width:40px;height:40px;border-radius:14px;background:#153d2f;color:#fff}.auth-card h1{margin:0 0 8px;font-size:30px}.auth-card>p{margin:0 0 24px;color:#6c756f}.auth-card form{display:grid;gap:16px}.auth-card label{display:grid;gap:7px;font-size:13px;font-weight:600}.auth-card input{height:46px;padding:0 14px;border:1px solid #dce1dd;border-radius:13px;font:inherit}.auth-card button{height:48px;border:0;border-radius:14px}.auth-links{display:flex;flex-wrap:wrap;gap:16px;margin-top:20px;font-size:13px}.auth-links a{color:#286b54}.auth-links a[aria-disabled="true"]{pointer-events:none;opacity:.55}.auth-error{color:#b33a2f}.auth-success{color:#247150}
</style>
