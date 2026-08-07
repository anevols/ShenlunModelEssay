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
 * - 导航栏右侧：统一用 SVG 菜单图标收纳所有功能入口（下拉菜单）：
 *   - 未登录 → 「登录」
 *   - 已登录 → 用户名 + 功能菜单（管理员含「管理后台」）+ 退出
 *   （后续新增功能直接加到下拉菜单即可，保持导航栏整洁）
 */
import { ref, provide, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { api, getToken, getUsername, getIsAdmin, clearAuth } from '../shared/auth.js'
import { categoryOrder } from '../shared/constants.js'
import Sidebar from '../components/Sidebar.vue'

const router = useRouter()

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
// 用户菜单下拉开关
const userMenuOpen = ref(false)
const userMenuRef = ref(null)

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

function toggleUserMenu() {
  userMenuOpen.value = !userMenuOpen.value
}

function closeUserMenu() {
  userMenuOpen.value = false
}

function handleClickOutside(e) {
  if (userMenuRef.value && !userMenuRef.value.contains(e.target)) {
    closeUserMenu()
  }
}

function handleLoginClick() {
  closeUserMenu()
  router.push('/login')
}

function handleLogout() {
  clearAuth()
  refreshLoginState()
  closeUserMenu()
}

onMounted(() => {
  loadArticles()
  refreshLoginState()
  // 监听 storage 变化（其他布局登录/登出后同步入口显示状态）
  window.addEventListener('storage', refreshLoginState)
  // 点击外部关闭用户菜单
  document.addEventListener('click', handleClickOutside)
})

onBeforeUnmount(() => {
  window.removeEventListener('storage', refreshLoginState)
  document.removeEventListener('click', handleClickOutside)
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

      <!-- 用户菜单（SVG 图标触发下拉，收纳登录态 / 功能入口 / 退出） -->
      <div class="user-menu" :class="{ open: userMenuOpen }" ref="userMenuRef">
        <button
          class="user-menu-trigger nav-link nav-link-fixed"
          type="button"
          :aria-label="userMenuOpen ? '关闭菜单' : '打开菜单'"
          :aria-expanded="userMenuOpen"
          aria-haspopup="true"
          @click.stop="toggleUserMenu"
        >
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path fill="currentColor" d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"></path>
          </svg>
        </button>
        <div v-if="userMenuOpen" class="user-menu-dropdown" role="menu">
          <template v-if="isAdmin === null">
            <!-- 未登录 -->
            <button type="button" class="user-menu-item" role="menuitem" @click="handleLoginClick">
              <svg class="user-menu-icon" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M10 17v-2H6V5h12v4h2V5c0-1.1-.9-2-2-2H6C4.9 3 4 3.9 4 5v10c0 1.1.9 2 2 2h4zm10.5-3l-1.4-1.4L15 16.7V11h-2v5.7l-4.1-4.1-1.4 1.4L14 22l6.5-8z"></path></svg>
              登录
            </button>
          </template>
          <template v-else>
            <!-- 已登录：用户信息头 -->
            <div class="user-menu-header">
              <div class="user-menu-avatar">
                <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M12 12c2.8 0 5-2.2 5-5s-2.2-5-5-5-5 2.2-5 5 2.2 5 5 5zm0 2c-3.3 0-10 1.7-10 5v3h20v-3c0-3.3-6.7-5-10-5z"></path></svg>
              </div>
              <div class="user-menu-info">
                <div class="user-menu-name">{{ currentUsername || '用户' }}</div>
                <div class="user-menu-role">{{ isAdmin ? '管理员' : '普通用户' }}</div>
              </div>
            </div>
            <div class="user-menu-divider" role="separator"></div>
            <!-- 功能菜单：按角色显示对应入口（便于后续扩展新功能） -->
            <template v-if="isAdmin">
              <router-link
                to="/admin/dashboard"
                class="user-menu-item"
                role="menuitem"
                @click="closeUserMenu"
              >
                <svg class="user-menu-icon" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M3 3h8v8H3zm10 0h8v8h-8zM3 13h8v8H3zm10 0h8v8h-8z"></path></svg>
                管理后台
              </router-link>
            </template>
            <!-- 后续可在此扩展普通用户/管理员的新功能入口 -->
            <div class="user-menu-divider" role="separator"></div>
            <button type="button" class="user-menu-item user-menu-item-danger" role="menuitem" @click="handleLogout">
              <svg class="user-menu-icon" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M10 17v-2H6V5h12v4h2V5c0-1.1-.9-2-2-2H6C4.9 3 4 3.9 4 5v10c0 1.1.9 2 2 2h4zm10.5-3l-1.4-1.4L15 16.7V11h-2v5.7l-4.1-4.1-1.4 1.4L14 22l6.5-8z"></path></svg>
              退出登录
            </button>
          </template>
        </div>
      </div>
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
