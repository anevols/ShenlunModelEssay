<script setup>
/**
 * 登录 / 注册视图
 *
 * - 登录：管理员 → 跳转 /admin/dashboard；普通用户 → 跳转 /（阅读站）
 * - 注册：开放注册，首个用户自动管理员，其余为普通用户
 * - 已登录访问本页：管理员跳后台，普通用户跳阅读站
 * - 支持 ?forbidden=1 参数：来自后台守卫的「无权限」提示
 *
 * 跳转使用 router.push（单 SPA，不再 location 整页跳转）。
 */
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api, setAuth, getToken, getIsAdmin } from '../shared/auth.js'

const route = useRoute()
const router = useRouter()

const activeTab = ref('login') // login | register
const message = ref('') // {text, type}
const loading = ref(false)

// 登录表单
const loginForm = ref({ username: '', password: '' })
// 注册表单
const regForm = ref({ username: '', password: '' })

// 来自后台守卫的「无权限」提示
const forbidden = computed(() => route.query.forbidden === '1')

onMounted(() => {
  // 已登录则跳转：管理员进后台，普通用户回阅读站
  if (getToken() && !forbidden.value) {
    router.replace(getIsAdmin() ? '/admin/dashboard' : '/')
  }
})

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
    showMsg('登录成功，正在跳转...', 'success')
    // 管理员进后台，普通用户回阅读站
    setTimeout(() => {
      router.push(data.is_admin ? '/admin/dashboard' : '/')
    }, 500)
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
    showMsg(data.is_admin ? '注册成功（管理员），正在跳转...' : '注册成功，正在跳转...', 'success')
    setTimeout(() => {
      router.push(data.is_admin ? '/admin/dashboard' : '/')
    }, 500)
  } catch (err) {
    showMsg(err.message, 'error')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="auth-container">
    <div class="auth-card">
      <h1 class="auth-title">欢迎来到申论阅读站</h1>
      <p class="auth-subtitle">登录或注册以继续</p>

      <!-- 无权限提示（来自后台守卫） -->
      <div v-if="forbidden" class="auth-message error">
        您是普通用户，无管理后台访问权限。<router-link to="/">返回阅读站</router-link>
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
        <p class="auth-hint">首个注册的用户自动成为管理员，后续注册为普通用户。</p>
      </form>

      <div class="auth-message" :class="message.type">{{ message.text }}</div>
    </div>
  </div>
</template>
