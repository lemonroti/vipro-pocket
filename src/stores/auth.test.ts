import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const authBoundary = vi.hoisted(() => {
  const listeners: Array<{ active: boolean, callback: (event: string, session: unknown) => void, unsubscribe: ReturnType<typeof vi.fn> }> = []
  return {
    reset() { listeners.length = 0 },
    subscribe(callback: (event: string, session: unknown) => void) {
      const listener = { active: true, callback, unsubscribe: vi.fn() }
      listener.unsubscribe.mockImplementation(() => { listener.active = false })
      listeners.push(listener)
      return { data: { subscription: { unsubscribe: listener.unsubscribe } } }
    },
    emit(event: string, session: unknown) {
      listeners.filter(({ active }) => active).forEach(({ callback }) => callback(event, session))
    },
    emitAt(index: number, event: string, session: unknown) { listeners[index]?.callback(event, session) },
    activeListenerCount() { return listeners.filter(({ active }) => active).length },
    unsubscribeCallCount() { return listeners.reduce((count, listener) => count + listener.unsubscribe.mock.calls.length, 0) },
    getSession: vi.fn(),
    signInWithPassword: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
    resetPasswordForEmail: vi.fn(),
    updateUser: vi.fn(),
  }
})

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: authBoundary.getSession,
      onAuthStateChange: authBoundary.subscribe,
      signInWithPassword: authBoundary.signInWithPassword,
      signUp: authBoundary.signUp,
      signOut: authBoundary.signOut,
      resetPasswordForEmail: authBoundary.resetPasswordForEmail,
      updateUser: authBoundary.updateUser,
    },
  },
}))

vi.mock('../lib/finance-repository', () => ({ createFinanceRepository: () => ({}) }))

import { useAuthStore } from './auth'
import { useFinanceStore } from './finance'

const session = { user: { id: 'user-1' } }

function seedFinanceState() {
  const finance = useFinanceStore()
  finance.$patch({
    userId: 'user-1', initialized: true,
    profile: { userId: 'user-1', currency: 'MYR', createdAt: '1', updatedAt: '1' },
  })
  return finance
}

describe('auth finance lifecycle', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    authBoundary.reset()
    authBoundary.getSession.mockResolvedValue({ data: { session }, error: null })
    authBoundary.signInWithPassword.mockResolvedValue({ data: { session }, error: null })
    authBoundary.signUp.mockResolvedValue({ data: { session }, error: null })
    authBoundary.signOut.mockResolvedValue({ error: null })
    authBoundary.resetPasswordForEmail.mockResolvedValue({ error: null })
    authBoundary.updateUser.mockResolvedValue({ error: null })
  })

  it('clears finance state when an external signed-out session is observed', async () => {
    const finance = seedFinanceState()
    const auth = useAuthStore()
    await auth.initialize()

    authBoundary.emit('SIGNED_OUT', null)

    expect(auth.user).toBeNull()
    expect(finance.userId).toBeNull()
    expect(finance.profile).toBeNull()
    expect(finance.initialized).toBe(false)
  })

  it('clears finance state after an explicit successful sign-out', async () => {
    const finance = seedFinanceState()
    const auth = useAuthStore()
    await auth.initialize()

    await auth.signOut()

    expect(finance.userId).toBeNull()
    expect(finance.profile).toBeNull()
    expect(finance.initialized).toBe(false)
  })

  it('keeps the authenticated app usable and exposes safe feedback when sign-out is rejected', async () => {
    const finance = seedFinanceState()
    const auth = useAuthStore()
    await auth.initialize()
    authBoundary.signOut.mockResolvedValueOnce({ error: new Error('private provider detail') })

    await expect(auth.signOut()).rejects.toThrow('private provider detail')

    expect(auth.user?.id).toBe('user-1')
    expect(finance.userId).toBe('user-1')
    expect(finance.initialized).toBe(true)
    expect(auth.error).toBe('Unable to sign out. Please try again.')
  })

  it('blocks a second auth mutation until the active request settles', async () => {
    let resolveSignIn!: (result: { data: { session: typeof session }, error: null }) => void
    authBoundary.signInWithPassword.mockReturnValueOnce(new Promise((resolve) => { resolveSignIn = resolve }))
    const auth = useAuthStore()

    const first = auth.signIn('vincent@example.com', 'password123')
    expect(auth.pending).toBe(true)
    await expect(auth.requestPasswordReset('vincent@example.com')).rejects.toThrow('Authentication request already in progress')
    expect(authBoundary.resetPasswordForEmail).not.toHaveBeenCalled()
    expect(auth.pending).toBe(true)

    resolveSignIn({ data: { session }, error: null })
    await first
    expect(auth.pending).toBe(false)
  })

  it('preserves a password recovery event emitted before initialization', async () => {
    const auth = useAuthStore()
    authBoundary.emit('PASSWORD_RECOVERY', session)

    await auth.initialize()
    authBoundary.emit('SIGNED_IN', session)

    expect(auth.user?.id).toBe('user-1')
    expect(auth.recoveryMode).toBe(true)
  })

  it('preserves a password recovery event emitted while initialization is pending', async () => {
    let resolveSession!: (result: { data: { session: typeof session }, error: null }) => void
    authBoundary.getSession.mockReturnValueOnce(new Promise((resolve) => { resolveSession = resolve }))
    const auth = useAuthStore()

    const initialization = auth.initialize()
    authBoundary.emit('PASSWORD_RECOVERY', session)
    resolveSession({ data: { session }, error: null })
    await initialization

    expect(auth.user?.id).toBe('user-1')
    expect(auth.recoveryMode).toBe(true)
  })

  it('waits for a queued password recovery event before initialization completes', async () => {
    authBoundary.getSession.mockImplementationOnce(async () => {
      setTimeout(() => authBoundary.emit('PASSWORD_RECOVERY', session), 0)
      return { data: { session }, error: null }
    })
    const auth = useAuthStore()

    await auth.initialize()

    expect(auth.recoveryMode).toBe(true)
  })

  it('refuses to update a password without an authenticated recovery session', async () => {
    const auth = useAuthStore()
    authBoundary.getSession.mockResolvedValueOnce({ data: { session: null }, error: null })
    await auth.initialize()

    await expect(auth.updatePassword('password123')).rejects.toThrow('Open a valid password recovery link')
    expect(authBoundary.updateUser).not.toHaveBeenCalled()
  })

  it('clears recovery mode after a successful password update', async () => {
    const auth = useAuthStore()
    await auth.initialize()
    authBoundary.emit('PASSWORD_RECOVERY', session)

    await auth.updatePassword('password123')

    expect(authBoundary.updateUser).toHaveBeenCalledWith({ password: 'password123' })
    expect(auth.recoveryMode).toBe(false)
  })

  it('can initialize a fresh auth listener after disposal', async () => {
    const auth = useAuthStore()
    await auth.initialize()
    auth.dispose()
    await auth.initialize()

    expect(authBoundary.getSession).toHaveBeenCalledTimes(2)
    expect(authBoundary.unsubscribeCallCount()).toBe(1)
  })

  it('shares one initialization request and subscription across concurrent callers', async () => {
    let resolveSession!: (result: { data: { session: typeof session }, error: null }) => void
    authBoundary.getSession.mockReturnValue(new Promise((resolve) => { resolveSession = resolve }))
    const auth = useAuthStore()

    const first = auth.initialize()
    const second = auth.initialize()
    expect(authBoundary.getSession).toHaveBeenCalledOnce()
    resolveSession({ data: { session }, error: null })
    await Promise.all([first, second])

    expect(auth.initialized).toBe(true)
    expect(authBoundary.activeListenerCount()).toBe(1)
  })

  it('keeps a newer initialization active when a disposed older request resolves late', async () => {
    let resolveOld!: (result: { data: { session: typeof session }, error: null }) => void
    let resolveNew!: (result: { data: { session: typeof session }, error: null }) => void
    authBoundary.getSession
      .mockReturnValueOnce(new Promise((resolve) => { resolveOld = resolve }))
      .mockReturnValueOnce(new Promise((resolve) => { resolveNew = resolve }))
    const auth = useAuthStore()

    const oldInitialization = auth.initialize()
    auth.dispose()
    const newInitialization = auth.initialize()
    expect(authBoundary.getSession).toHaveBeenCalledTimes(2)

    resolveNew({ data: { session: { user: { id: 'new-user' } } }, error: null })
    await newInitialization
    resolveOld({ data: { session: { user: { id: 'old-user' } } }, error: null })
    await oldInitialization

    expect(auth.initialized).toBe(true)
    expect(auth.user?.id).toBe('new-user')
    expect(authBoundary.activeListenerCount()).toBe(1)
  })

  it('ignores auth events from a listener that no longer owns the store', async () => {
    const auth = useAuthStore()
    await auth.initialize()
    auth.dispose()
    authBoundary.getSession.mockResolvedValueOnce({ data: { session: { user: { id: 'new-user' } } }, error: null })
    await auth.initialize()

    authBoundary.emitAt(0, 'SIGNED_OUT', null)

    expect(auth.initialized).toBe(true)
    expect(auth.user?.id).toBe('new-user')
    expect(authBoundary.activeListenerCount()).toBe(1)
  })
})
