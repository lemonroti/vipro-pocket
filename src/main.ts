import { createPinia } from 'pinia'
import { createApp } from 'vue'
import { createRouter, createWebHashHistory } from 'vue-router'
import App from './App.vue'
import AuthView from './components/auth/AuthView.vue'
import UpdatePasswordView from './components/auth/UpdatePasswordView.vue'
import { useAuthStore } from './stores/auth'
import './style.css'
import './sidebar-nav.css'
import './account-management.css'
import './category-transaction-management.css'
import './monthly-budget-management.css'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', component: App },
    { path: '/login', component: AuthView },
    { path: '/signup', component: AuthView },
    { path: '/forgot-password', component: AuthView },
    { path: '/update-password', component: UpdatePasswordView },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})

const pinia = createPinia()
const auth = useAuthStore(pinia)
void auth.initialize().catch(() => undefined)

createApp({ template: '<RouterView />' }).use(pinia).use(router).mount('#app')
