<script setup>
/**
 * 阅读站布局
 *
 * 布局：顶部导航栏 + 左侧目录侧边栏 + 右侧正文区（router-view）
 *
 * 职责：
 * - 启动时从 API 加载文章列表 meta（不含正文），provide 给子组件
 * - 搜索框过滤侧边栏
 * - 侧边栏开关状态 provide 给子组件（开关按钮放在子视图面包屑旁）
 * - 导航栏右侧入口（根据登录状态/是否管理员区分显示）：
 *   - 未登录 → 「登录」
 *   - 已登录 → 功能菜单（管理员含「管理后台」）+ 用户名 + 退出
 */
import { ref, provide, onMounted } from 'vue'
import { api, getToken, getUsername, getIsAdmin, clearAuth } from '../shared/auth.js'
import { categoryOrder } from '../shared/constants.js'
import Sidebar from '../components/Sidebar.vue'

const articles = ref([])
const loading = ref(true)
const error = ref('')
const searchQuery = ref('')
// 侧边栏收起状态：true=收起，false=展开
// 桌面端默认展开（false），移动端默认收起（true）
const sidebarCollapsed = ref(window.innerWidth <= 900)
// 登录状态：null=未登录，false=普通用户，true=管理员
const isAdmin = ref(null)
const currentUsername = ref('')

// 文章列表 provide 给 ArticleView（用于上下篇导航）
provide('articles', articles)
// 侧边栏状态 provide 给子视图（开关按钮放在面包屑旁）
provide('sidebar', {
  collapsed: sidebarCollapsed,
  toggle: () => { sidebarCollapsed.value = !sidebarCollapsed.value },
})

async function loadArticles() {
  loading.value = true
  error.value = ''
  try {
    const data = await api.listArticles()
    articles.value = data.sort((a, b) => {
      const ca = categoryOrder(a.category)
      const cb = categoryOrder(b.category)
      if (ca !== cb) return ca - cb
      return a.order - b.order
    })
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

function toggleSidebar() {
  sidebarCollapsed.value = !sidebarCollapsed.value
}

function closeSidebar() {
  // 仅移动端点击文章/遮罩后收起侧边栏（桌面端保持当前状态）
  if (window.innerWidth <= 900) sidebarCollapsed.value = true
}

function refreshLoginState() {
  if (!getToken()) {
    isAdmin.value = null
    currentUsername.value = ''
    return
  }
  currentUsername.value = getUsername() || ''
  isAdmin.value = getIsAdmin()
}

function logout() {
  clearAuth()
  refreshLoginState()
}

onMounted(() => {
  loadArticles()
  refreshLoginState()
  // 监听 storage 变化（其他布局登录/登出后同步入口显示状态）
  window.addEventListener('storage', refreshLoginState)
})
</script>

<template>
  <header class="navbar">
    <div class="navbar-inner">
      <router-link to="/" class="brand">
        <span class="brand-logo">◆</span>
        <span class="brand-name">申论</span>
      </router-link>

      <div class="search-box">
        <svg class="search-icon" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
          <path fill="currentColor" d="M9.5 3a6.5 6.5 0 0 1 4.9 10.8l5.4 5.4-1.1 1.1-5.4-5.4A6.5 6.5 0 1 1 9.5 3zm0 1.7a4.8 4.8 0 1 0 0 9.6 4.8 4.8 0 0 0 0-9.6z"></path>
        </svg>
        <input id="search-input" v-model="searchQuery" type="text" placeholder="搜索文章…" aria-label="搜索文章">
      </div>

      <!-- 功能菜单：登录后按角色显示对应入口（便于后续扩展新功能） -->
      <nav class="navbar-actions">
        <template v-if="isAdmin !== null">
          <!-- 管理员：管理后台入口 -->
          <router-link v-if="isAdmin" to="/admin/dashboard" class="nav-link">管理后台</router-link>
          <!-- 后续可在此扩展普通用户/管理员的新功能入口 -->
        </template>
      </nav>

      <!-- 右侧固定区：登录/用户信息 -->
      <router-link v-if="isAdmin === null" to="/login" class="nav-link nav-link-fixed">登录</router-link>
      <template v-else>
        <span class="nav-link nav-link-user">{{ currentUsername }}</span>
        <button class="nav-link nav-link-fixed nav-logout" @click="logout">退出</button>
      </template>
    </div>
  </header>

  <div class="layout">
    <Sidebar
      :articles="articles"
      :loading="loading"
      :error="error"
      :search-query="searchQuery"
      :class="{ collapsed: sidebarCollapsed }"
      @close="closeSidebar"
    />
    <div class="sidebar-mask" :class="{ open: !sidebarCollapsed }" @click="closeSidebar"></div>

    <main class="main" :class="{ 'sidebar-collapsed': sidebarCollapsed }">
      <router-view />
    </main>
  </div>
</template>
