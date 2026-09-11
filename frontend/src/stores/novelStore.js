import { create } from 'zustand'
import { novelApi, chapterApi } from '../api/client'

const useNovelStore = create((set, get) => ({
  novels: [],
  currentNovel: null,
  chapters: [],
  currentChapter: null,
  loading: false,
  error: null,

  fetchNovels: async () => {
    set({ loading: true, error: null })
    try {
      const novels = await novelApi.getList()
      set({ novels, loading: false })
    } catch (error) {
      set({ error: error.message, loading: false })
    }
  },

  uploadNovel: async (file) => {
    set({ loading: true, error: null })
    try {
      const novel = await novelApi.upload(file)
      set((state) => ({
        novels: [novel, ...state.novels],
        loading: false
      }))
      return novel
    } catch (error) {
      set({ error: error.message, loading: false })
      throw error
    }
  },

  fetchNovelDetail: async (id) => {
    set({ loading: true, error: null, currentChapter: null })
    try {
      const novel = await novelApi.getDetail(id)
      set({ currentNovel: novel, loading: false })

      const chapters = await chapterApi.getByNovel(id)
      // Auto-select first chapter so comic panel is not empty
      set({ chapters, currentChapter: chapters[0] || null })

      return novel
    } catch (error) {
      set({ error: error.message, loading: false })
      throw error
    }
  },

  selectChapter: (chapter) => {
    set({ currentChapter: chapter })
  },

  deleteNovel: async (id) => {
    try {
      await novelApi.delete(id)
      set((state) => ({
        novels: state.novels.filter(n => n.id !== id)
      }))
    } catch (error) {
      set({ error: error.message })
      throw error
    }
  },
}))

export default useNovelStore
