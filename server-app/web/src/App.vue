<script setup>
/**
 * 阅读站根组件
 *
 * 布局：顶部导航栏 + 左侧目录侧边栏 + 右侧正文区（router-view）
 *
 * 职责：
 * - 启动时从 API 加载文章列表 meta（不含正文），provide 给子组件
 * - 搜索框过滤侧边栏
 * - 移动端侧边栏开关
 * - 管理后台入口（仅登录后显示）
 */
import { ref, provide, onMounted } from 'vue'
import { api } from './api.js'
import Sidebar from './components/Sidebar.vue'

const articles = ref([])
const loading = ref(true)
const error = ref('')
const searchQuery = ref('')
const sidebarOpen = ref(false)
const isLoggedIn = ref(false)

// 文章列表 provide 给 ArticleView（用于上下篇导航）
provide('articles', articles)

async function loadArticles() {
  loading.value = true
  error.value = ''
  try {
    const data = await api.listArticles()
    articles.value = data.sort((a, b) => {
      if (a.category !== b.category) return a.category.localeCompare(b.category, 'zh')
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
  isLoggedIn.value = !!localStorage.getItem('token')
}

onMounted(() => {
  loadArticles()
  refreshLoginState()
  // 监听 storage 变化（管理后台登录/登出后同步入口显示状态）
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

      <nav class="navbar-actions">
        <a href="https://github.com/" target="_blank" rel="noopener" class="nav-link">GitHub</a>
      </nav>
      <a v-if="isLoggedIn" href="/admin/dashboard" class="nav-link nav-link-fixed">管理后台</a>

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
