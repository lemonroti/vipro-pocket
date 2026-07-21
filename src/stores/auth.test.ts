import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const authBoundary = vi.hoisted(() => {
  let callback: ((event: string, session: unknown) => void) | undefined
  return {
    setCallback(next: (event: string, session: unknown) => void) { callback = next },
    emit(event: string, session: unknown) { callback?.(event, session) },
    getSession: vi.fn(),
    signOut: vi.fn(),
    unsubscribe: vi.fn(),
  }
})

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: authBoundary.getSession,
      onAuthStateChange: (callback: (event: string, session: unknown) => void) => {
        authBoundary.setCallback(callback)
        return { data: { subscription: { unsubscribe: authBoundary.unsubscribe } } }
      },
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
    expect(authBoundary.unsubscribe).toHaveBeenCalledOnce()
  })
})
