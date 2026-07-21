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

  it('starts a fresh same-user load after a null session invalidates a pending load', async () => {
    const userId = ref<string | null>('user-a')
    let resolveOld!: () => void
    let resolveFresh!: () => void
    const load = vi.fn()
      .mockReturnValueOnce(new Promise<void>((resolve) => { resolveOld = resolve }))
      .mockReturnValueOnce(new Promise<void>((resolve) => { resolveFresh = resolve }))
    const lifecycle = createProtectedFinanceLifecycle({
      auth: { initialize: vi.fn().mockResolvedValue(undefined), dispose: vi.fn() },
      finance: { userId: null, initialized: false, load, reset: vi.fn() },
      getUserId: () => userId.value,
      redirectToLogin: vi.fn(),
    })
    await lifecycle.start()

    userId.value = null
    await Promise.resolve()
    userId.value = 'user-a'
    await Promise.resolve()
    expect(load).toHaveBeenCalledTimes(2)

    resolveOld()
    await Promise.resolve()
    expect(load).toHaveBeenCalledTimes(2)
    resolveFresh()
    await Promise.resolve()
  })

  it('deduplicates overlapping starts and does not install a watcher after a stopped initialization resolves', async () => {
    let resolveInitialize!: () => void
    const initialize = vi.fn(() => new Promise<void>((resolve) => { resolveInitialize = resolve }))
    const load = vi.fn().mockResolvedValue(undefined)
    const dispose = vi.fn()
    const userId = ref<string | null>('user-1')
    const lifecycle = createProtectedFinanceLifecycle({
      auth: { initialize, dispose },
      finance: { userId: null, initialized: false, load, reset: vi.fn() },
      getUserId: () => userId.value,
      redirectToLogin: vi.fn(),
    })

    const first = lifecycle.start()
    const second = lifecycle.start()
    expect(initialize).toHaveBeenCalledOnce()
    lifecycle.stop()
    resolveInitialize()
    await Promise.all([first, second])
    userId.value = 'user-2'
    await Promise.resolve()

    expect(load).not.toHaveBeenCalled()
    expect(dispose).toHaveBeenCalledOnce()
  })

  it('can restart safely while a stopped initialization is still settling', async () => {
    let resolveFirst!: () => void
    const initialize = vi.fn()
      .mockReturnValueOnce(new Promise<void>((resolve) => { resolveFirst = resolve }))
      .mockResolvedValueOnce(undefined)
    const load = vi.fn().mockResolvedValue(undefined)
    const lifecycle = createProtectedFinanceLifecycle({
      auth: { initialize, dispose: vi.fn() },
      finance: { userId: null, initialized: false, load, reset: vi.fn() },
      getUserId: () => 'user-1',
      redirectToLogin: vi.fn(),
    })

    const stoppedStart = lifecycle.start()
    lifecycle.stop()
    const restarted = lifecycle.start()
    resolveFirst()
    await Promise.all([stoppedStart, restarted])
    await Promise.resolve()

    expect(initialize).toHaveBeenCalledTimes(2)
    expect(load).toHaveBeenCalledOnce()
  })

  it('turns rejected auth initialization into a safe retryable bootstrap error', async () => {
    const initialize = vi.fn()
      .mockRejectedValueOnce(new Error('private auth endpoint detail'))
      .mockResolvedValueOnce(undefined)
    const load = vi.fn().mockResolvedValue(undefined)
    const dispose = vi.fn()
    const lifecycle = createProtectedFinanceLifecycle({
      auth: { initialize, dispose },
      finance: { userId: null, initialized: false, load, reset: vi.fn() },
      getUserId: () => 'user-1',
      redirectToLogin: vi.fn(),
    })

    await expect(lifecycle.start()).resolves.toBeUndefined()
    expect(lifecycle.bootstrapError.value).toBe('Unable to initialize your session. Please try again.')
    expect(dispose).not.toHaveBeenCalled()
    await lifecycle.retry()

    expect(initialize).toHaveBeenCalledTimes(2)
    expect(lifecycle.bootstrapError.value).toBe('')
    expect(load).toHaveBeenCalledOnce()
  })
})
