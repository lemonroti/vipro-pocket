import { createPinia } from 'pinia'
import { createApp } from 'vue'
import { createRouter, createWebHashHistory } from 'vue-router'
import AuthView from './components/auth/AuthView.vue'
import UpdatePasswordView from './components/auth/UpdatePasswordView.vue'
import ProtectedApp from './components/ProtectedApp.vue'
import './style.css'
import './sidebar-nav.css'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', component: ProtectedApp },
    { path: '/login', component: AuthView },
    { path: '/signup', component: AuthView },
    { path: '/forgot-password', component: AuthView },
    { path: '/update-password', component: UpdatePasswordView },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})

createApp({ template: '<RouterView />' }).use(createPinia()).use(router).mount('#app')
