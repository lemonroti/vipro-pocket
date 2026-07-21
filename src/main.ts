import { createPinia } from 'pinia'
import { createApp } from 'vue'
import { createRouter, createWebHashHistory, RouterView } from 'vue-router'
import { useAuthStore } from './stores/auth'
import './style.css'
import './sidebar-nav.css'
import './account-management.css'
import './category-transaction-management.css'
import './monthly-budget-management.css'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', component: () => import('./App.vue') },
    { path: '/login', component: () => import('./components/auth/AuthView.vue') },
    { path: '/signup', component: () => import('./components/auth/AuthView.vue') },
    { path: '/forgot-password', component: () => import('./components/auth/AuthView.vue') },
    { path: '/update-password', component: () => import('./components/auth/UpdatePasswordView.vue') },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})

const pinia = createPinia()
const auth = useAuthStore(pinia)
void auth.initialize().catch(() => undefined)

const app = createApp(RouterView)
app.use(pinia).use(router)
await router.isReady()
app.mount('#app')
