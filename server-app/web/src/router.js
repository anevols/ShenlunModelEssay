import { createRouter, createWebHistory } from 'vue-router'

// 阅读站路由（history 模式）
// /               → 首页，自动跳转到第一篇文章
// /article/:slug   → 文章详情
// 其他路径         → 重定向到首页
const routes = [
  { path: '/', name: 'home', component: () => import('./views/ArticleView.vue') },
  { path: '/article/:slug', name: 'article', component: () => import('./views/ArticleView.vue'), props: true },
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

export default router
