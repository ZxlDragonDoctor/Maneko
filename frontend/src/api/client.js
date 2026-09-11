import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 60000,
})

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
    console.error('API Error:', error.response?.data || error.message)
    return Promise.reject(error)
  }
)

export const novelApi = {
  upload: (file) => {
    const formData = new FormData()
    formData.append('file', file)
    return api.post('/novels/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
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
  generate: (chapterId, styleId) =>
    api.post('/comics/generate', { chapter_id: chapterId, style_id: styleId || 'auto' }),
  getStatus: (chapterId) => api.get(`/comics/${chapterId}/status`),
  getImages: (chapterId) => api.get(`/comics/${chapterId}/images`),
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
