<script setup>
/**
 * 登录/注册页布局
 *
 * 简洁顶部栏（品牌 + 返回阅读站） + 路由出口
 * 根元素加 app-auth 类，作用域内覆盖 CSS 变量，避免污染阅读站全局样式。
 */
</script>

<template>
  <div class="app-auth">
    <header class="auth-navbar">
      <div class="auth-navbar-inner">
        <router-link to="/" class="brand">
          <span class="brand-logo">◆</span>
          <span>申论</span>
        </router-link>
        <router-link to="/" class="nav-back">← 返回阅读站</router-link>
      </div>
    </header>

    <router-view />
  </div>
</template>
