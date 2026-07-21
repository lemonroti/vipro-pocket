import { watch, type WatchStopHandle } from 'vue'

type AuthLifecycle = {
  initialize: () => Promise<void>
  dispose: () => void
}

type FinanceLifecycle = {
  userId: string | null
  initialized: boolean
  load: (userId: string) => Promise<void>
  reset: () => void
}

type ProtectedFinanceLifecycleOptions = {
  auth: AuthLifecycle
  finance: FinanceLifecycle
  getUserId: () => string | null
  redirectToLogin: () => void | Promise<void>
}

export function createProtectedFinanceLifecycle(options: ProtectedFinanceLifecycleOptions) {
  let stopWatching: WatchStopHandle | null = null
  let activeUserId: string | null = null
  let activeLoad: Promise<void> | null = null

  function loadUser(userId: string): Promise<void> {
    if (options.finance.initialized && options.finance.userId === userId) return Promise.resolve()
    if (activeLoad && activeUserId === userId) return activeLoad

    if (options.finance.userId && options.finance.userId !== userId) options.finance.reset()
    activeUserId = userId
    activeLoad = options.finance.load(userId)
      .catch(() => undefined)
      .finally(() => {
        if (activeUserId === userId) {
          activeUserId = null
          activeLoad = null
        }
      })
    return activeLoad
  }

  function synchronize(userId: string | null): void {
    if (!userId) {
      options.finance.reset()
      void options.redirectToLogin()
      return
    }
    void loadUser(userId)
  }

  async function start(): Promise<void> {
    await options.auth.initialize()
    stopWatching = watch(options.getUserId, synchronize, { immediate: true })
  }

  function retry(): Promise<void> {
    const userId = options.getUserId()
    if (!userId) {
      synchronize(null)
      return Promise.resolve()
    }
    return loadUser(userId)
  }

  function stop(): void {
    stopWatching?.()
    stopWatching = null
    options.auth.dispose()
  }

  return { start, retry, stop }
}
