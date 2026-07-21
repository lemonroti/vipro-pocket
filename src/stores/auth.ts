import type { Session, User } from '@supabase/supabase-js'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { getAuthRedirectUrl } from '../lib/auth-redirect'
import { supabase } from '../lib/supabase'

const MIN_PASSWORD_LENGTH = 8

export const useAuthStore = defineStore('auth', () => {
  const session = ref<Session | null>(null)
  const initialized = ref(false)
  const pending = ref(false)
  const error = ref('')
  const recoveryMode = ref(false)
  let unsubscribe: (() => void) | null = null

  const user = computed<User | null>(() => session.value?.user ?? null)

  async function initialize() {
    if (initialized.value) return

    const { data, error: sessionError } = await supabase.auth.getSession()
    if (sessionError) error.value = sessionError.message
    session.value = data.session

    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      session.value = nextSession
      recoveryMode.value = event === 'PASSWORD_RECOVERY'
    })

    unsubscribe = () => listener.subscription.unsubscribe()
    initialized.value = true
  }

  function validatePassword(password: string) {
    if (password.length < MIN_PASSWORD_LENGTH) {
      throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`)
    }
  }

  async function run<T>(action: () => Promise<T>): Promise<T> {
    pending.value = true
    error.value = ''
    try {
      return await action()
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Authentication failed'
      error.value = message
      throw cause
    } finally {
      pending.value = false
    }
  }

  async function signUp(email: string, password: string) {
    validatePassword(password)
    return run(async () => {
      const { data, error: signUpError } = await supabase.auth.signUp({ email, password })
      if (signUpError) throw signUpError
      if (!data.session) {
        throw new Error('Immediate signup is disabled in Supabase. Turn off Confirm email for production v1.')
      }
      session.value = data.session
      return data
    })
  }

  async function signIn(email: string, password: string) {
    return run(async () => {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password })
      if (signInError) throw signInError
      session.value = data.session
      return data
    })
  }

  async function signOut() {
    return run(async () => {
      const { error: signOutError } = await supabase.auth.signOut()
      if (signOutError) throw signOutError
      session.value = null
    })
  }

  async function requestPasswordReset(email: string) {
    return run(async () => {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: getAuthRedirectUrl('update-password'),
      })
      if (resetError) throw resetError
    })
  }

  async function updatePassword(password: string) {
    validatePassword(password)
    return run(async () => {
      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) throw updateError
      recoveryMode.value = false
    })
  }

  function dispose() {
    unsubscribe?.()
    unsubscribe = null
  }

  return {
    session,
    user,
    initialized,
    pending,
    error,
    recoveryMode,
    initialize,
    signUp,
    signIn,
    signOut,
    requestPasswordReset,
    updatePassword,
    dispose,
  }
})
