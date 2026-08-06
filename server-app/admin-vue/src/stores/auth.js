import { defineStore } from 'pinia'
import api from '@/api'

// 认证 store：管理 token、用户名，提供登录/注册/登出
export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: localStorage.getItem('token') || '',
    username: localStorage.getItem('username') || '',
  }),
  actions: {
    setAuth(token, username) {
      this.token = token
      this.username = username
      localStorage.setItem('token', token)
      localStorage.setItem('username', username)
    },
    logout() {
      this.token = ''
      this.username = ''
      localStorage.removeItem('token')
      localStorage.removeItem('username')
    },
    async login(username, password) {
      const { data } = await api.post('/api/login', { username, password })
      this.setAuth(data.access_token, data.username)
      return data
    },
    async register(username, password) {
      const { data } = await api.post('/api/register', { username, password })
      this.setAuth(data.access_token, data.username)
      return data
    },
  },
})
