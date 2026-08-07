<script setup>
/**
 * 阅读站布局
 *
 * 布局：顶部导航栏 + 左侧目录侧边栏 + 右侧正文区（router-view）
 *
 * 职责：
 * - 启动时从 API 加载文章列表 meta（不含正文），provide 给子组件
 * - 搜索框过滤侧边栏
 * - 移动端侧边栏开关
 * - 导航栏右侧入口（根据登录状态/是否管理员区分显示）：
 *   - 未登录 → 「登录」
 *   - 普通用户 → 用户名 + 退出
 *   - 管理员 → 用户名 + 「管理后台」+ 退出
 */
import { ref, provide, onMounted } from 'vue'
import { api, getToken, getUsername, getIsAdmin, clearAuth } from '../shared/auth.js'
import { categoryOrder } from '../shared/constants.js'
import Sidebar from '../components/Sidebar.vue'

const articles = ref([])
const loading = ref(true)
const error = ref('')
const searchQuery = ref('')
const sidebarOpen = ref(false)
// 登录状态：null=未登录，false=普通用户，true=管理员
const isAdmin = ref(null)
const currentUsername = ref('')

// 文章列表 provide 给 ArticleView（用于上下篇导航）
provide('articles', articles)

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
  sidebarOpen.value = !sidebarOpen.value
}

function closeSidebar() {
  sidebarOpen.value = false
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

      <nav class="navbar-actions"></nav>

      <!-- 右侧固定区：根据登录状态显示 -->
      <!-- 未登录 → 登录入口 -->
      <router-link v-if="isAdmin === null" to="/login" class="nav-link nav-link-fixed">登录</router-link>
      <!-- 管理员 → 管理后台入口（普通用户不显示） -->
      <router-link v-else-if="isAdmin" to="/admin/dashboard" class="nav-link nav-link-fixed">管理后台</router-link>

      <!-- 已登录显示用户名 + 退出 -->
      <template v-if="isAdmin !== null">
        <span class="nav-link nav-link-user">{{ currentUsername }}</span>
        <button class="nav-link nav-link-fixed nav-logout" @click="logout">退出</button>
      </template>

      <button class="sidebar-toggle" aria-label="切换目录" @click="toggleSidebar">
        <svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M3 6h18v2H3zm0 5h18v2H3zm0 5h18v2H3z"></path></svg>
      </button>
    </div>
  </header>

  <div class="layout">
    <Sidebar
      :articles="articles"
      :loading="loading"
      :error="error"
      :search-query="searchQuery"
      :sidebar-open="sidebarOpen"
      @close="closeSidebar"
    />
    <div class="sidebar-mask" :class="{ open: sidebarOpen }" @click="closeSidebar"></div>

    <main class="main">
      <router-view />
    </main>
  </div>
</template>
