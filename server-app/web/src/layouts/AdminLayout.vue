<script setup>
/**
 * 管理后台布局
 *
 * - 顶部导航栏：侧边栏开关 + 品牌 + 管理菜单 + 用户名 + 退出（不使用账户图标）
 * - 左侧侧边栏：沿用阅读站侧边栏样式，承载后台功能导航，桌面端可收起
 * - 主内容区：路由出口
 * - 根元素加 app-admin 类，作用域内覆盖 CSS 变量
 */
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { getUsername, clearAuth } from '../shared/auth.js'

const router = useRouter()
const username = ref(getUsername() || '管理员')
// 侧边栏收起状态：true=收起，false=展开（桌面默认展开，移动默认收起）
const sidebarCollapsed = ref(window.innerWidth <= 900)

function refreshUser() {
  username.value = getUsername() || '管理员'
}

function toggleSidebar() {
  sidebarCollapsed.value = !sidebarCollapsed.value
}

function logout() {
  clearAuth()
  router.push('/login')
}

onMounted(() => {
  refreshUser()
  window.addEventListener('storage', refreshUser)
})
</script>

<template>
  <div class="app-admin">
    <header class="navbar admin-navbar">
      <div class="navbar-inner">
        <button class="sidebar-toggle" aria-label="切换目录" @click="toggleSidebar">
          <svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M3 6h18v2H3zm0 5h18v2H3zm0 5h18v2H3z"></path></svg>
        </button>

        <router-link to="/admin/dashboard" class="brand">
          <span class="brand-logo">◆</span>
          <span class="brand-name">申论 · 管理后台</span>
        </router-link>

        <!-- 顶部管理菜单 -->
        <nav class="navbar-actions">
          <router-link to="/admin/dashboard" class="nav-link">文章管理</router-link>
          <router-link to="/admin/llm-config" class="nav-link">LLM 配置</router-link>
          <router-link to="/" class="nav-link">回到阅读站</router-link>
        </nav>

        <span class="nav-link nav-link-user">{{ username }}</span>
        <button class="nav-link nav-link-fixed nav-logout" @click="logout">退出</button>
      </div>
    </header>

    <div class="layout admin-layout">
      <aside class="sidebar admin-sidebar" :class="{ collapsed: sidebarCollapsed }" aria-label="后台导航">
        <nav class="sidebar-nav">
          <div class="sidebar-group">
            <div class="sidebar-group-title">
              <span class="sidebar-arrow">▾</span>内容管理
            </div>
            <div class="sidebar-group-items">
              <router-link to="/admin/dashboard" class="sidebar-item">文章管理</router-link>
            </div>
          </div>
          <div class="sidebar-group">
            <div class="sidebar-group-title">
              <span class="sidebar-arrow">▾</span>系统配置
            </div>
            <div class="sidebar-group-items">
              <router-link to="/admin/llm-config" class="sidebar-item">LLM 配置</router-link>
            </div>
          </div>
        </nav>
      </aside>

      <main class="main" :class="{ 'sidebar-collapsed': sidebarCollapsed }">
        <router-view />
      </main>
    </div>
  </div>
</template>
