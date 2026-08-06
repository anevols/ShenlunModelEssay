import api from '@/api'

// 文章 API 封装
export const articlesApi = {
  list: () => api.get('/api/articles').then((r) => r.data),
  get: (slug) => api.get(`/api/articles/${slug}`).then((r) => r.data),
  create: (payload) => api.post('/api/articles', payload).then((r) => r.data),
  update: (slug, payload) => api.put(`/api/articles/${slug}`, payload).then((r) => r.data),
  remove: (slug) => api.delete(`/api/articles/${slug}`),
}
