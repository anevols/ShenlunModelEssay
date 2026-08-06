import axios from 'axios'

// axios 实例：同源部署，baseURL 留空（FastAPI 同时托管前端和 API）
// 开发时由 Vite 代理 /api 到 FastAPI(8000)
const api = axios.create({
  baseURL: '',
  timeout: 15000,
})

// 请求拦截器：自动附加 JWT
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// 响应拦截器：401 跳登录
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('username')
      // 避免在登录页重复跳转
      if (!window.location.pathname.endsWith('/admin/login')) {
        window.location.href = '/admin/login'
      }
    }
    return Promise.reject(err)
  }
)

export default api
