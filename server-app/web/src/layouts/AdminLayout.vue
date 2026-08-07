<script setup>
/**
 * 管理后台布局
 *
 * - 顶部导航栏：品牌 + 回到阅读站 + 用户名 + 退出（功能导航由左侧 sidebar 承载）
 * - 左侧侧边栏：承载后台功能导航，桌面端可收起/展开，移动端滑入/滑出（带遮罩）
 * - 主内容区：content-wrap 布局，顶部 content-topbar（侧边栏开关 + 面包屑），下方 router-view
 * - 根元素加 app-admin 类，作用域内覆盖 CSS 变量
 *
 * 侧边栏行为与阅读站一致：
 *   桌面端：常驻可见，点击开关收起/展开
 *   移动端：默认收起，点击开关滑入，点击遮罩/菜单项滑出
 */
import { ref, computed, reactive, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getUsername, clearAuth } from '../shared/auth.js'

const route = useRoute()
const router = useRouter()
const username = ref(getUsername() || '管理员')
// 侧边栏收起状态：true=收起，false=展开（桌面默认展开，移动默认收起）
const sidebarCollapsed = ref(window.innerWidth <= 900)
// 侧边栏分组折叠状态
const collapsedGroups = reactive({})

// 面包屑：管理后台 / 当前功能名（根据路由 name 映射）
const ROUTE_TITLES = {
  dashboard: '文章管理',
  'llm-config': 'LLM 配置',
  generate: '范文生成',
}
const currentTitle = computed(() => ROUTE_TITLES[route.name] || '管理后台')

function refreshUser() {
  username.value = getUsername() || '管理员'
}

function toggleSidebar() {
  sidebarCollapsed.value = !sidebarCollapsed.value
}

function closeSidebar() {
  // 仅移动端点击遮罩/菜单项后收起侧边栏（桌面端保持当前状态）
  if (window.innerWidth <= 900) sidebarCollapsed.value = true
}

function toggleGroup(name) {
  collapsedGroups[name] = !collapsedGroups[name]
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
        <router-link to="/admin/dashboard" class="brand">
          <span class="brand-logo">◆</span>
          <span class="brand-name">申论 · 管理后台</span>
        </router-link>

        <!-- 右侧区：回到阅读站 + 用户名 + 退出 -->
        <nav class="navbar-actions admin-navbar-actions">
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
            <div
              class="sidebar-group-title"
              :class="{ collapsed: collapsedGroups['content'] }"
              tabindex="0"
              role="button"
              @click="toggleGroup('content')"
              @keydown.enter.prevent="toggleGroup('content')"
              @keydown.space.prevent="toggleGroup('content')"
            >
              <svg class="sidebar-arrow" viewBox="0 0 24 24" width="10" height="10"><path fill="currentColor" d="M7 10l5 5 5-5z"></path></svg>内容管理
            </div>
            <div class="sidebar-group-items" :class="{ collapsed: collapsedGroups['content'] }">
              <router-link to="/admin/dashboard" class="sidebar-item" @click="closeSidebar">文章管理</router-link>
              <router-link to="/admin/generate" class="sidebar-item" @click="closeSidebar">范文生成</router-link>
            </div>
          </div>
          <div class="sidebar-group">
            <div
              class="sidebar-group-title"
              :class="{ collapsed: collapsedGroups['system'] }"
              tabindex="0"
              role="button"
              @click="toggleGroup('system')"
              @keydown.enter.prevent="toggleGroup('system')"
              @keydown.space.prevent="toggleGroup('system')"
            >
              <svg class="sidebar-arrow" viewBox="0 0 24 24" width="10" height="10"><path fill="currentColor" d="M7 10l5 5 5-5z"></path></svg>系统配置
            </div>
            <div class="sidebar-group-items" :class="{ collapsed: collapsedGroups['system'] }">
              <router-link to="/admin/llm-config" class="sidebar-item" @click="closeSidebar">LLM 配置</router-link>
            </div>
          </div>
        </nav>
      </aside>
      <div class="sidebar-mask admin-sidebar-mask" :class="{ open: !sidebarCollapsed }" @click="closeSidebar"></div>

      <main class="main" :class="{ 'sidebar-collapsed': sidebarCollapsed }">
        <div class="content-wrap">
          <div class="content-area">
            <!-- 侧边栏开关 + 面包屑 -->
            <div class="content-topbar">
              <button class="sidebar-toggle" :aria-label="sidebarCollapsed ? '展开菜单' : '收起菜单'" @click="toggleSidebar">
                <svg v-if="sidebarCollapsed" viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M3 6h18v2H3zm0 5h18v2H3zm0 5h18v2H3z"></path></svg>
                <svg v-else viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M3 6h13v2H3zm0 5h13v2H3zm0 5h13v2H3zM19 4l4 8-4 8z"></path></svg>
              </button>
              <div class="breadcrumb">
                <router-link to="/admin/dashboard">管理后台</router-link>
                <span class="breadcrumb-sep">/</span>
                <span>{{ currentTitle }}</span>
              </div>
            </div>

            <router-view />
          </div>
        </div>
      </main>
    </div>
  </div>
</template>
