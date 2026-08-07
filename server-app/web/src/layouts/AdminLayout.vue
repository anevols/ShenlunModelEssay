<script setup>
/**
 * 管理后台布局
 *
 * - 顶部导航栏：品牌 + 用户名 + 退出（不使用账户图标）
 * - 左侧侧边栏：沿用阅读站侧边栏样式，承载后台功能导航（当前仅「文章管理」）
 * - 主内容区：路由出口
 * - 根元素加 app-admin 类，作用域内覆盖 CSS 变量
 *
 * 后台侧边栏在所有屏幕尺寸下常驻可见（窄屏不折叠，因为没有移动端开关）。
 */
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { getUsername, clearAuth } from '../shared/auth.js'

const router = useRouter()
const username = ref(getUsername() || '管理员')

function refreshUser() {
  username.value = getUsername() || '管理员'
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

        <nav class="navbar-actions"></nav>

        <span class="nav-link nav-link-user">{{ username }}</span>
        <button class="nav-link nav-link-fixed nav-logout" @click="logout">退出</button>
      </div>
    </header>

    <div class="layout admin-layout">
      <aside class="sidebar admin-sidebar" aria-label="后台导航">
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
              <span class="sidebar-arrow">▾</span>返回
            </div>
            <div class="sidebar-group-items">
              <router-link to="/" class="sidebar-item">回到阅读站</router-link>
            </div>
          </div>
        </nav>
      </aside>

      <main class="main">
        <router-view />
      </main>
    </div>
  </div>
</template>
