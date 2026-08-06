<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { api, setAuth, getToken, getIsAdmin } from '../auth.js'

const router = useRouter()
const route = useRoute()

// 已登录且是管理员则跳转仪表板
onMounted(() => {
  if (getToken() && getIsAdmin()) router.replace({ name: 'dashboard' })
})

const activeTab = ref('login') // login | register
const message = ref('') // {text, type}
const loading = ref(false)

// 来自守卫的「无权限」提示，或登录后发现是普通用户
const forbidden = computed(() => route.query.forbidden === '1')

// 登录表单
const loginForm = ref({ username: '', password: '' })
// 注册表单
const regForm = ref({ username: '', password: '' })

function showMsg(text, type) {
  message.value = { text, type }
}

async function handleLogin() {
  if (!loginForm.value.username || !loginForm.value.password) return
  loading.value = true
  message.value = {}
  try {
    const data = await api.login(loginForm.value.username.trim(), loginForm.value.password)
    setAuth(data.access_token, data.username, data.is_admin)
    if (data.is_admin) {
      showMsg('登录成功，正在跳转...', 'success')
      setTimeout(() => router.push({ name: 'dashboard' }), 500)
    } else {
      // 普通用户：不跳转，提示无管理后台权限
      showMsg('登录成功，但您是普通用户，无管理后台访问权限。', 'error')
    }
  } catch (err) {
    showMsg(err.message, 'error')
  } finally {
    loading.value = false
  }
}

async function handleRegister() {
  if (regForm.value.username.trim().length < 2 || regForm.value.password.length < 6) return
  loading.value = true
  message.value = {}
  try {
    const data = await api.register(regForm.value.username.trim(), regForm.value.password)
    setAuth(data.access_token, data.username, data.is_admin)
    if (data.is_admin) {
      showMsg('注册成功（管理员），正在跳转...', 'success')
      setTimeout(() => router.push({ name: 'dashboard' }), 500)
    } else {
      // 普通用户：不跳转，提示
      showMsg('注册成功（普通用户），无管理后台访问权限，可前往阅读站。', 'error')
    }
  } catch (err) {
    showMsg(err.message, 'error')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div>
    <!-- 顶部导航栏（与阅读站一致） -->
    <header class="auth-navbar">
      <div class="auth-navbar-inner">
        <a href="/" class="brand">
          <span class="brand-logo">◆</span>
          <span>申论</span>
        </a>
        <a href="/" class="nav-back">← 返回阅读站</a>
      </div>
    </header>

    <div class="auth-container">
      <div class="auth-card">
        <h1 class="auth-title">管理后台</h1>
        <p class="auth-subtitle">登录以管理文章</p>

        <!-- 无权限提示 -->
        <div v-if="forbidden" class="auth-message error">
          您是普通用户，无管理后台访问权限。<a href="/">返回阅读站</a>
        </div>

        <!-- 登录/注册切换 -->
        <div class="auth-tabs">
          <button class="auth-tab" :class="{ active: activeTab === 'login' }" @click="activeTab = 'login'; message = {}">登录</button>
          <button class="auth-tab" :class="{ active: activeTab === 'register' }" @click="activeTab = 'register'; message = {}">注册</button>
        </div>

        <!-- 登录表单 -->
        <form v-if="activeTab === 'login'" class="auth-form" @submit.prevent="handleLogin">
          <div class="form-group">
            <label for="login-username">用户名</label>
            <input id="login-username" v-model="loginForm.username" type="text" required autocomplete="username">
          </div>
          <div class="form-group">
            <label for="login-password">密码</label>
            <input id="login-password" v-model="loginForm.password" type="password" required autocomplete="current-password">
          </div>
          <button type="submit" class="btn-primary" :disabled="loading">登录</button>
        </form>

        <!-- 注册表单 -->
        <form v-else class="auth-form" @submit.prevent="handleRegister">
          <div class="form-group">
            <label for="reg-username">用户名</label>
            <input id="reg-username" v-model="regForm.username" type="text" required minlength="2" autocomplete="username">
          </div>
          <div class="form-group">
            <label for="reg-password">密码（至少6位）</label>
            <input id="reg-password" v-model="regForm.password" type="password" required minlength="6" autocomplete="new-password">
          </div>
          <button type="submit" class="btn-primary" :disabled="loading">注册</button>
          <p class="auth-hint">首个注册的用户自动成为管理员，后续注册为普通用户（仅可登录阅读站）。</p>
        </form>

        <div class="auth-message" :class="message.type">{{ message.text }}</div>
      </div>
    </div>
  </div>
</template>
