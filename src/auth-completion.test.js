import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const root = new URL('.', import.meta.url)
const dashboard = readFileSync(new URL('./components/finance/FinanceDashboard.vue', root), 'utf8')
const updatePassword = readFileSync(new URL('./components/auth/UpdatePasswordView.vue', root), 'utf8')
const authView = readFileSync(new URL('./components/auth/AuthView.vue', root), 'utf8')
const main = readFileSync(new URL('./main.ts', root), 'utf8')

describe('Task 5 production auth wiring', () => {
  it('wires an accessible pending-safe Settings sign-out action through the auth store', () => {
    expect(dashboard).toContain("import { useAuthStore } from '../../stores/auth'")
    expect(dashboard).toContain('await auth.signOut()')
    expect(dashboard).toContain('aria-label="Sign out of Vipro Pocket"')
    expect(dashboard).toContain(':disabled="auth.pending"')
    expect(dashboard).toContain("showToast(auth.error || 'Unable to sign out. Please try again.')")
  })

  it('initializes auth eagerly so recovery events are observed before route mounting', () => {
    expect(main).toContain('const pinia = createPinia()')
    expect(main).toContain('useAuthStore(pinia)')
    expect(main).toContain('auth.initialize()')
  })

  it('lazy-loads route views so the production entry bundle stays small', () => {
    expect(main).toContain("component: () => import('./App.vue')")
    expect(main).toContain("component: () => import('./components/auth/AuthView.vue')")
    expect(main).toContain("component: () => import('./components/auth/UpdatePasswordView.vue')")
    expect(main).not.toContain("import App from './App.vue'")
    expect(main).toContain('await router.isReady()')
    expect(main).toContain('createApp(RouterView)')
    expect(main).not.toContain("template: '<RouterView />'")
  })

  it('shows recovery loading and expired-link guidance before rendering the password form', () => {
    expect(updatePassword).toContain('await auth.initialize()')
    expect(updatePassword).toContain('Processing your recovery link…')
    expect(updatePassword).toContain('Request a new reset email')
    expect(updatePassword).toContain('v-else-if="recoveryAvailable"')
    expect(updatePassword).toContain(':disabled="auth.pending"')
  })

  it('prevents auth-route navigation while a mutation is pending', () => {
    expect(authView).toContain('@click="preventPendingNavigation"')
    expect(authView).toContain(':aria-disabled="auth.pending"')
  })

  it('clears stale feedback when moving between authentication forms', () => {
    expect(authView).toContain('watch(mode')
    expect(authView).toContain('auth.clearError()')
  })
})
