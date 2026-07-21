import { ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import { createProtectedFinanceLifecycle } from './protected-finance-lifecycle'

describe('protected finance lifecycle', () => {
  it('initializes auth, loads once, redirects on session loss, and disposes cleanly', async () => {
    const userId = ref<string | null>('user-1')
    let resolveLoad!: () => void
    const load = vi.fn(() => new Promise<void>((resolve) => { resolveLoad = resolve }))
    const reset = vi.fn()
    const redirectToLogin = vi.fn()
    const auth = { initialize: vi.fn().mockResolvedValue(undefined), dispose: vi.fn() }
    const finance = { userId: null as string | null, initialized: false, load, reset }
    const lifecycle = createProtectedFinanceLifecycle({ auth, finance, getUserId: () => userId.value, redirectToLogin })

    await lifecycle.start()
    await Promise.resolve()
    userId.value = 'user-1'
    await Promise.resolve()
    expect(auth.initialize).toHaveBeenCalledOnce()
    expect(load).toHaveBeenCalledOnce()

    resolveLoad()
    await Promise.resolve()
    userId.value = null
    await Promise.resolve()
    expect(reset).toHaveBeenCalled()
    expect(redirectToLogin).toHaveBeenCalledOnce()

    lifecycle.stop()
    userId.value = 'user-2'
    await Promise.resolve()
    expect(load).toHaveBeenCalledOnce()
    expect(auth.dispose).toHaveBeenCalledOnce()
  })

  it('exposes retry after a load failure without rendering initialized state', async () => {
    const load = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(undefined)
    const lifecycle = createProtectedFinanceLifecycle({
      auth: { initialize: vi.fn().mockResolvedValue(undefined), dispose: vi.fn() },
      finance: { userId: null, initialized: false, load, reset: vi.fn() },
      getUserId: () => 'user-1',
      redirectToLogin: vi.fn(),
    })

    await lifecycle.start()
    await Promise.resolve()
    await lifecycle.retry()

    expect(load).toHaveBeenCalledTimes(2)
  })
})
