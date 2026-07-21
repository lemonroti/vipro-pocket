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
    signOut: vi.fn(),
  }
})

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: authBoundary.getSession,
      onAuthStateChange: authBoundary.subscribe,
      signOut: authBoundary.signOut,
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
    authBoundary.signOut.mockResolvedValue({ error: null })
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
