import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 60000,
})

export function formatApiError(error) {
  const status = error?.response?.status
  const detail = error?.response?.data?.detail
  if (status === 413) return '文件超过服务器允许的大小上限，请缩小文件后重试。'
  if (status === 502 || status === 503 || status === 504) {
    return typeof detail === 'string' ? detail : '服务或 AI 提供方暂时不可用，请稍后重试。'
  }
  if (status >= 500) return '服务器暂时出错，请稍后重试；你的原始输入仍保留在当前页面。'
  if (typeof detail === 'string' && detail.trim()) return detail
  if (!error?.response) return '无法连接服务，请检查网络、API 地址和服务状态。'
  return error?.message || '请求失败，请重试。'
}

api.interceptors.request.use(
  (config) => {
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    error.userMessage = formatApiError(error)
    error.message = error.userMessage
    return Promise.reject(error)
  }
)

export const novelApi = {
  upload: (file, title) => {
    const formData = new FormData()
    formData.append('file', file)
    if (title) formData.append('title', title)
    return api.post('/novels/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 180000,
    })
  },
  uploadText: (text, title) => {
    const formData = new FormData()
    formData.append('text', text)
    if (title) formData.append('title', title)
    return api.post('/novels/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 180000,
    })
  },
  getList: () => api.get('/novels/'),
  getDetail: (id) => api.get(`/novels/${id}`),
  delete: (id) => api.delete(`/novels/${id}`),
}

export const chapterApi = {
  getByNovel: (novelId) => api.get(`/novels/${novelId}/chapters`),
  getDetail: (id) => api.get(`/chapters/${id}`),
}

export const comicApi = {
  generate: (chapterId, styleId, { force = false } = {}) =>
    api.post('/comics/generate', {
      chapter_id: chapterId,
      style_id: styleId || 'auto',
      force: !!force,
    }),
  getStatus: (chapterId) => api.get(`/comics/${chapterId}/status`),
  getImages: (chapterId) => api.get(`/comics/${chapterId}/images`),
  exportArchive: (chapterId) => api.get(`/comics/${chapterId}/export`, { responseType: 'blob' }),
  getStyles: () => api.get('/comics/styles'),
  detectStyle: ({ chapterId, novelId } = {}) =>
    api.post('/comics/detect-style', null, {
      params: { chapter_id: chapterId, novel_id: novelId },
    }),
}

export const libraryApi = {
  sources: () => api.get('/library/sources'),
  searchSource: (sourceId, q, limit = 18) =>
    api.get(`/library/sources/${sourceId}/search`, { params: { q: q || '', limit } }),
  searchAll: (q, limit = 18) => api.get('/library/search', { params: { q: q || '', limit } }),
  books: (params = {}) => api.get('/library/books', { params }),
  stats: () => api.get('/library/stats'),
  categories: () => api.get('/library/categories'),
  createCategory: (name, color) => api.post('/library/categories', { name, color }),
  updateCategory: (id, patch) => api.patch(`/library/categories/${id}`, patch),
  deleteCategory: (id) => api.delete(`/library/categories/${id}`),
  updateBook: (id, patch) => api.patch(`/library/books/${id}`, patch),
  importUrl: (payload) => api.post('/library/import/url', payload),
  importSearch: (payload) => api.post('/library/import/search', payload),
}

export default api
