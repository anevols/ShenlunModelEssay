// 认证与 API 封装
// 同源部署：API_BASE 为空（FastAPI 同时托管前端和 API）

const API_BASE = ''
const TOKEN_KEY = 'token'
const USERNAME_KEY = 'username'

export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function getUsername() {
  return localStorage.getItem(USERNAME_KEY)
}

export function setAuth(token, username) {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(USERNAME_KEY, username)
}

export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USERNAME_KEY)
}

// 统一请求封装：自动带 token、抛出后端 detail
async function request(path, { method = 'GET', body, auth = false } = {}) {
  const headers = { 'Content-Type': 'application/json' }
  if (auth) {
    const token = getToken()
    if (token) headers['Authorization'] = `Bearer ${token}`
  }
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
  if (res.status === 204) return null
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.detail || `请求失败 (${res.status})`)
  return data
}

export const api = {
  register: (username, password) => request('/api/register', { method: 'POST', body: { username, password } }),
  login: (username, password) => request('/api/login', { method: 'POST', body: { username, password } }),
  listArticles: () => request('/api/articles'),
  getArticle: (slug) => request(`/api/articles/${slug}`),
  createArticle: (data) => request('/api/articles', { method: 'POST', body: data, auth: true }),
  updateArticle: (slug, data) => request(`/api/articles/${slug}`, { method: 'PUT', body: data, auth: true }),
  deleteArticle: (slug) => request(`/api/articles/${slug}`, { method: 'DELETE', auth: true }),
}
