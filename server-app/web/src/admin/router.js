import { createRouter, createWebHistory } from 'vue-router'
import { getToken, getIsAdmin } from './auth.js'

// 路由：/admin/ 登录页，/admin/dashboard 仪表板（需登录 + 管理员）
const routes = [
  { path: '/admin/', name: 'login', component: () => import('./views/Login.vue') },
  { path: '/admin/dashboard', name: 'dashboard', component: () => import('./views/Dashboard.vue'), meta: { requiresAuth: true, requiresAdmin: true } },
  { path: '/admin/:pathMatch(.*)*', redirect: '/admin/' },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

// 守卫：未登录或非管理员访问 dashboard 跳回登录页
router.beforeEach((to) => {
  if (to.meta.requiresAuth) {
    if (!getToken()) return { name: 'login' }
    if (to.meta.requiresAdmin && !getIsAdmin()) {
      // 已登录但非管理员：跳回登录页并提示
      return { name: 'login', query: { forbidden: '1' } }
    }
  }
})

export default router
