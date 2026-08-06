import { createRouter, createWebHistory } from 'vue-router'
import { getToken } from './auth.js'

// 路由：/admin/ 登录页，/admin/dashboard 仪表板（需登录）
const routes = [
  { path: '/admin/', name: 'login', component: () => import('./views/Login.vue') },
  { path: '/admin/dashboard', name: 'dashboard', component: () => import('./views/Dashboard.vue'), meta: { requiresAuth: true } },
  { path: '/admin/:pathMatch(.*)*', redirect: '/admin/' },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

// 登录守卫：未登录访问 dashboard 跳回登录
router.beforeEach((to) => {
  if (to.meta.requiresAuth && !getToken()) {
    return { name: 'login' }
  }
})

export default router
