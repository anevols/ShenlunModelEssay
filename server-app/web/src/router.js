import { createRouter, createWebHistory } from 'vue-router'
import { getToken, getIsAdmin } from './shared/auth.js'

// 单 SPA 统一路由（history 模式）
// - /login                → 登录/注册页（AuthLayout）
// - /admin/*              → 管理后台（AdminLayout，需管理员）
// - /, /article/:slug     → 阅读站（ReaderLayout）
// - 其他路径              → 重定向到首页
const routes = [
  {
    path: '/login',
    component: () => import('./layouts/AuthLayout.vue'),
    children: [
      { path: '', name: 'login', component: () => import('./views/LoginView.vue') },
    ],
  },
  {
    path: '/admin',
    component: () => import('./layouts/AdminLayout.vue'),
    meta: { requiresAdmin: true },
    children: [
      { path: '', redirect: '/admin/dashboard' },
      { path: 'dashboard', name: 'dashboard', component: () => import('./views/DashboardView.vue') },
      { path: 'llm-config', name: 'llm-config', component: () => import('./views/LlmConfigView.vue') },
      { path: 'generate', name: 'generate', component: () => import('./views/GenerateView.vue') },
      { path: ':pathMatch(.*)*', redirect: '/admin/dashboard' },
    ],
  },
  {
    path: '/',
    component: () => import('./layouts/ReaderLayout.vue'),
    children: [
      { path: '', name: 'home', component: () => import('./views/ArticleView.vue') },
      { path: 'article/:slug', name: 'article', component: () => import('./views/ArticleView.vue'), props: true },
    ],
  },
  { path: '/:pathMatch(.*)*', redirect: '/' },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  // 路由切换时滚动到顶部（由 ArticleView 内部按需控制）
  scrollBehavior() {
    return { top: 0 }
  },
})

// 权限守卫：未登录或非管理员访问后台 → 跳转登录页
router.beforeEach((to) => {
  if (to.meta.requiresAdmin) {
    if (!getToken()) {
      return { name: 'login' }
    }
    if (!getIsAdmin()) {
      // 已登录但非管理员：跳登录页并提示无权限
      return { name: 'login', query: { forbidden: '1' } }
    }
  }
})

export default router
