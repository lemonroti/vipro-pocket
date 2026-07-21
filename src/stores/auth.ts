import type { Session, User } from '@supabase/supabase-js'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { getAuthRedirectUrl } from '../lib/auth-redirect'
import { supabase } from '../lib/supabase'
import { useFinanceStore } from './finance'

const MIN_PASSWORD_LENGTH = 8
const AUTH_IN_PROGRESS = 'Authentication request already in progress'
const INVALID_RECOVERY = 'Open a valid password recovery link before choosing a new password.'
const SIGN_OUT_FAILED = 'Unable to sign out. Please try again.'
const LOCAL_SIGN_OUT_UNCONFIRMED = 'Signed out on this device, but the server could not confirm session revocation.'

export const useAuthStore = defineStore('auth', () => {
  const finance = useFinanceStore()
  const session = ref<Session | null>(null)
  const initialized = ref(false)
  const pending = ref(false)
  const error = ref('')
  const recoverySessionToken = ref<string | null>(null)
  let unsubscribe: (() => void) | null = null
  let initialization: Promise<void> | null = null
  let initializationGeneration = -1
  let generation = 0
  let authEventRevision = 0
  let mutationGeneration = 0

  const user = computed<User | null>(() => session.value?.user ?? null)
  const recoveryMode = computed(() =>
    Boolean(recoverySessionToken.value && session.value?.access_token === recoverySessionToken.value),
  )

  function ensureSubscription(): void {
    if (unsubscribe) return

    const ownerGeneration = generation
    let ownsSubscription = true
    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!ownsSubscription || ownerGeneration !== generation) return
      authEventRevision += 1
      session.value = nextSession
      if (!nextSession) finance.reset()
      if (event === 'PASSWORD_RECOVERY' && nextSession) {
        recoverySessionToken.value = nextSession.access_token
      } else if (event === 'SIGNED_OUT' || nextSession?.access_token !== recoverySessionToken.value) {
        recoverySessionToken.value = null
      }
    })
    unsubscribe = () => {
      ownsSubscription = false
      listener.subscription.unsubscribe()
    }
  }

  ensureSubscription()

  function initialize(): Promise<void> {
    if (initialized.value) return Promise.resolve()
    if (initialization && initializationGeneration === generation) return initialization

    ensureSubscription()
    const ownerGeneration = generation
    const startingEventRevision = authEventRevision
    initializationGeneration = ownerGeneration
    let request!: Promise<void>
    request = (async () => {
      const { data, error: sessionError } = await supabase.auth.getSession()
      // auth-js delivers URL recovery notifications on the next task after its
      // initialization promise settles. Keep the route loading until that event runs.
      await new Promise<void>((resolve) => setTimeout(resolve, 0))
      if (ownerGeneration !== generation) return

      if (sessionError) error.value = sessionError.message
      if (authEventRevision === startingEventRevision) {
        session.value = data.session
        if (data.session?.access_token !== recoverySessionToken.value) recoverySessionToken.value = null
        if (!data.session) finance.reset()
      }
      initialized.value = true
    })().finally(() => {
      if (initialization === request) initialization = null
    })
    initialization = request
    return request
  }

  function validatePassword(password: string) {
    if (password.length < MIN_PASSWORD_LENGTH) {
      throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`)
    }
  }

  async function run<T>(action: () => Promise<T>, safeError?: string | (() => string)): Promise<T> {
    if (pending.value) throw new Error(AUTH_IN_PROGRESS)

    const ownerGeneration = ++mutationGeneration
    pending.value = true
    error.value = ''
    try {
      return await action()
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Authentication failed'
      error.value = typeof safeError === 'function' ? safeError() : safeError ?? message
      throw cause
    } finally {
      if (ownerGeneration === mutationGeneration) pending.value = false
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
      recoverySessionToken.value = null
      session.value = data.session
      return data
    })
  }

  async function signIn(email: string, password: string) {
    return run(async () => {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password })
      if (signInError) throw signInError
      recoverySessionToken.value = null
      session.value = data.session
      return data
    })
  }

  async function signOut() {
    return run(async () => {
      const { error: signOutError } = await supabase.auth.signOut({ scope: 'local' })
      if (signOutError) throw signOutError
      session.value = null
      recoverySessionToken.value = null
      finance.reset()
    }, () => session.value ? SIGN_OUT_FAILED : LOCAL_SIGN_OUT_UNCONFIRMED)
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
      if (!initialized.value || !session.value || !recoveryMode.value) throw new Error(INVALID_RECOVERY)
      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) throw updateError
      recoverySessionToken.value = null
    })
  }

  function dispose() {
    generation += 1
    unsubscribe?.()
    unsubscribe = null
    recoverySessionToken.value = null
    initialized.value = false
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
