import { ref, watch, type WatchStopHandle } from 'vue'

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

const BOOTSTRAP_ERROR = 'Unable to initialize your session. Please try again.'

export function createProtectedFinanceLifecycle(options: ProtectedFinanceLifecycleOptions) {
  const bootstrapError = ref('')
  let stopWatching: WatchStopHandle | null = null
  let startPromise: Promise<void> | null = null
  let startGeneration = 0
  let lifecycleGeneration = 0
  let loadGeneration = 0
  let activeUserId: string | null = null
  let activeLoad: Promise<void> | null = null

  function invalidateActiveLoad(): void {
    loadGeneration += 1
    activeUserId = null
    activeLoad = null
  }

  function loadUser(userId: string): Promise<void> {
    if (options.finance.initialized && options.finance.userId === userId) return Promise.resolve()
    if (activeLoad && activeUserId === userId) return activeLoad

    if (options.finance.userId && options.finance.userId !== userId) options.finance.reset()
    const generation = ++loadGeneration
    activeUserId = userId
    const request = options.finance.load(userId)
      .catch(() => undefined)
      .finally(() => {
        if (generation === loadGeneration && activeLoad === request) {
          activeUserId = null
          activeLoad = null
        }
      })
    activeLoad = request
    return request
  }

  function synchronize(userId: string | null): void {
    if (!userId) {
      invalidateActiveLoad()
      options.finance.reset()
      void options.redirectToLogin()
      return
    }
    void loadUser(userId)
  }

  function start(): Promise<void> {
    if (stopWatching) return Promise.resolve()
    if (startPromise) {
      if (startGeneration === lifecycleGeneration) return startPromise
      const settlingStart = startPromise
      return settlingStart.then(() => start())
    }

    const generation = ++lifecycleGeneration
    startGeneration = generation
    bootstrapError.value = ''
    const request = (async () => {
      try {
        await options.auth.initialize()
      } catch {
        options.auth.dispose()
        if (generation === lifecycleGeneration) bootstrapError.value = BOOTSTRAP_ERROR
        return
      }

      if (generation !== lifecycleGeneration) {
        options.auth.dispose()
        return
      }
      stopWatching = watch(options.getUserId, synchronize, { immediate: true })
    })().finally(() => {
      if (startPromise === request) startPromise = null
    })
    startPromise = request
    return request
  }

  function retry(): Promise<void> {
    if (bootstrapError.value || (!stopWatching && !startPromise)) return start()
    if (startPromise) return startPromise
    const userId = options.getUserId()
    if (!userId) {
      synchronize(null)
      return Promise.resolve()
    }
    return loadUser(userId)
  }

  function stop(): void {
    lifecycleGeneration += 1
    invalidateActiveLoad()
    stopWatching?.()
    stopWatching = null
    options.auth.dispose()
  }

  return { bootstrapError, start, retry, stop }
}
