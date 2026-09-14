import { create } from 'zustand'
import { comicApi } from '../api/client'

const useComicStore = create((set, get) => ({
  chapterComics: {},
  generatingChapters: new Set(),

  _setChapter: (chapterId, patch) => {
    set((state) => ({
      chapterComics: {
        ...state.chapterComics,
        [chapterId]: { ...(state.chapterComics[chapterId] || {}), ...patch }
      }
    }))
  },

  generateComic: async (chapterId, styleId = 'auto', { force = false } = {}) => {
    const state = get()
    if (state.generatingChapters.has(chapterId)) {
      return
    }
    if (!force && state.chapterComics[chapterId]?.status === 'completed') {
      return
    }

    set((s) => ({
      generatingChapters: new Set([...s.generatingChapters, chapterId]),
    }))
    get()._setChapter(chapterId, {
      status: 'generating',
      images: force ? [] : (state.chapterComics[chapterId]?.images || []),
      styleId,
    })

    const maxPolls = 180 // ~6 minutes at 2s
    let polls = 0

    try {
      await comicApi.generate(chapterId, styleId, { force })

      const pollStatus = async () => {
        polls += 1
        try {
          const status = await comicApi.getStatus(chapterId)
          get()._setChapter(chapterId, {
            status: status.status,
            images: status.images || []
          })

          if (status.status === 'generating') {
            if (polls >= maxPolls) {
              set((s) => {
                const newSet = new Set(s.generatingChapters)
                newSet.delete(chapterId)
                return { generatingChapters: newSet }
              })
              get()._setChapter(chapterId, { status: 'error' })
              return
            }
            setTimeout(pollStatus, 2000)
            return
          }

          set((s) => {
            const newSet = new Set(s.generatingChapters)
            newSet.delete(chapterId)
            return { generatingChapters: newSet }
          })

          if (status.status === 'completed') {
            try {
              const panels = await comicApi.getImages(chapterId)
              if (Array.isArray(panels) && panels.length > 0) {
                get()._setChapter(chapterId, { status: 'completed', images: panels })
              }
            } catch (_) {
              // keep path strings from status API
            }
          }
        } catch (err) {
          console.error('轮询漫画状态失败:', err)
          if (polls < maxPolls) {
            setTimeout(pollStatus, 3000)
          } else {
            set((s) => {
              const newSet = new Set(s.generatingChapters)
              newSet.delete(chapterId)
              return { generatingChapters: newSet }
            })
            get()._setChapter(chapterId, { status: 'error' })
          }
        }
      }

      setTimeout(pollStatus, 1000)
    } catch (error) {
      set((s) => ({
        generatingChapters: new Set([...s.generatingChapters].filter(id => id !== chapterId)),
      }))
      get()._setChapter(chapterId, { status: 'error', images: [] })
      throw error
    }
  },

  fetchChapterStatus: async (chapterId) => {
    try {
      const status = await comicApi.getStatus(chapterId)
      get()._setChapter(chapterId, {
        status: status.status,
        images: status.images || []
      })

      if (status.status === 'completed') {
        try {
          const panels = await comicApi.getImages(chapterId)
          if (Array.isArray(panels) && panels.length > 0) {
            get()._setChapter(chapterId, { status: 'completed', images: panels })
          }
        } catch (_) {}
      }
    } catch (error) {
      console.error('获取漫画状态失败:', error)
    }
  },

  fetchChapterImages: async (chapterId) => {
    try {
      const images = await comicApi.getImages(chapterId)
      get()._setChapter(chapterId, {
        ...(get().chapterComics[chapterId] || { status: 'completed' }),
        images
      })
      return images
    } catch (error) {
      console.error('获取漫画图片失败:', error)
      return []
    }
  },
}))

export default useComicStore
