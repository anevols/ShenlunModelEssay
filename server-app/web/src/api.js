/**
 * 阅读站 API 封装
 *
 * 同源部署：FastAPI 同时托管 web/dist 和 /api/*，API_BASE 为空。
 * 开发环境 Vite proxy 已将 /api 转发到后端 8000 端口。
 */
const API_BASE = ''

async function request(path) {
  const res = await fetch(`${API_BASE}${path}`)
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.detail || `请求失败 (${res.status})`)
  }
  return res.json()
}

export const api = {
  // 文章列表（不含正文，按分类→序号排序）
  listArticles: () => request('/api/articles'),
  // 文章详情（含 content_html 正文）
  getArticle: (slug) => request(`/api/articles/${encodeURIComponent(slug)}`),
}
