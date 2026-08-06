import { createRouter, createWebHistory } from 'vue-router'
import { getToken, getIsAdmin } from './auth.js'

// 管理后台路由：仅 /admin/* 后台页面，登录注册在独立的 /login 应用
// - 未登录访问任意 /admin/* → 跳转 /login
// - 已登录但非管理员访问 /admin/* → 跳转 /login（带 forbidden 标记）
// - /admin/ 默认重定向到 /admin/dashboard
const routes = [
  { path: '/admin/', redirect: '/admin/dashboard' },
  { path: '/admin/dashboard', name: 'dashboard', component: () => import('./views/Dashboard.vue'), meta: { requiresAuth: true, requiresAdmin: true } },
  { path: '/admin/:pathMatch(.*)*', redirect: '/admin/dashboard' },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

// 守卫：未登录或非管理员访问后台 → 跳转独立登录页 /login
router.beforeEach((to) => {
  if (to.meta.requiresAuth) {
    if (!getToken()) {
      // 跳转到独立的登录页（不同 Vue 应用，需用 location）
      window.location.href = '/login'
      return false
    }
    if (to.meta.requiresAdmin && !getIsAdmin()) {
      // 已登录但非管理员：跳登录页并提示无权限
      window.location.href = '/login?forbidden=1'
      return false
    }
  }
})

export default router
