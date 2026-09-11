import { useEffect } from 'react'
import useComicStore from '../stores/comicStore'
import { NeonLoader } from './NeonLoader'

function panelUrl(chapterId, panelIndex) {
  const n = Number(panelIndex) || 1
  return `/comics/${chapterId}/panel_${String(n).padStart(2, '0')}.png`
}

function toPanelIndex(item, fallbackIndex) {
  if (item && typeof item === 'object' && item.panel_index) return item.panel_index
  if (typeof item === 'string') {
    const m = item.match(/panel_(\d+)/i)
    if (m) return Number(m[1])
  }
  return fallbackIndex + 1
}

function ComicViewer({ currentChapter, currentNovel, styleId = 'auto' }) {
  const { chapterComics, fetchChapterStatus, generateComic } = useComicStore()
  const comicData = currentChapter ? chapterComics[currentChapter.id] : null

  useEffect(() => {
    if (currentChapter) fetchChapterStatus(currentChapter.id)
  }, [currentChapter, fetchChapterStatus])

  if (!currentChapter) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400 text-sm">
        请选择左侧章节
      </div>
    )
  }

  const renderContent = () => {
    if (!comicData || comicData.status === 'pending') {
      return (
        <div className="text-center py-12">
          <p className="text-gray-400 mb-4 text-sm">该章节尚未生成漫画</p>
          <button
            type="button"
            onClick={() => generateComic(currentChapter.id, styleId)}
            className="px-6 py-3 font-bold uppercase tracking-wider text-xs rounded-sm bg-transparent text-[#ff1493] border-2 border-[#ff1493] transition-all duration-300 hover:shadow-[0_0_30px_rgba(255,20,147,0.5)] active:scale-95"
          >
            生成漫画 · {styleId}
          </button>
        </div>
      )
    }
    if (comicData.status === 'generating') {
      return <NeonLoader text="正在生成分镜" />
    }
    if (comicData.status === 'error') {
      return (
        <div className="text-center py-12">
          <p className="text-[#ff1493] mb-4 text-sm">生成失败</p>
          <button
            type="button"
            onClick={() => generateComic(currentChapter.id, styleId, { force: true })}
            className="px-6 py-3 font-bold uppercase tracking-wider text-xs rounded-sm text-[#ff6b00] border-2 border-[#ff6b00] transition-all duration-300 hover:shadow-[0_0_25px_rgba(255,107,0,0.45)]"
          >
            重试
          </button>
        </div>
      )
    }
    if (comicData.status === 'completed') {
      const images = comicData.images || []
      if (!images.length) {
        return <div className="text-center py-12 text-gray-400 text-sm">暂无漫画图片</div>
      }
      return (
        <div>
          <div className="mb-3 flex justify-end">
            <button
              type="button"
              onClick={() => generateComic(currentChapter.id, styleId, { force: true })}
              className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider rounded-sm text-[#00f0ff] border border-[#00f0ff]/50 transition-all duration-300 hover:shadow-[0_0_15px_rgba(0,240,255,0.4)]"
            >
              按当前风格重新生成
            </button>
          </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {images.map((image, index) => {
            const idx = toPanelIndex(image, index)
            return (
              <figure
                key={image?.id || idx || index}
                className="m-0 border border-[#ff1493]/35 rounded-sm overflow-hidden bg-[#12041e] transition-all duration-300 hover:shadow-[0_0_25px_rgba(255,20,147,0.4)]"
              >
                <img
                  src={panelUrl(currentChapter.id, idx)}
                  alt={`分镜 ${idx}`}
                  className="w-full h-auto bg-[#12041e]"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none'
                    const p = e.currentTarget.parentElement
                    if (p && !p.dataset.failed) {
                      p.dataset.failed = '1'
                      const tip = document.createElement('p')
                      tip.className = 'p-4 text-xs text-[#ff1493]'
                      tip.textContent = `加载失败 panel_${String(idx).padStart(2, '0')}`
                      p.appendChild(tip)
                    }
                  }}
                />
                <figcaption className="px-2 py-1 text-[11px] text-gray-400 border-t border-[#ff1493]/20">
                  第 {idx} 幕
                </figcaption>
              </figure>
            )
          })}
        </div>
        </div>
      )
    }
    return null
  }

  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="sticky top-0 bg-[#0a0a1a] py-2 mb-4 z-10">
        <h2 className="text-xs font-bold uppercase tracking-widest text-[#ff1493] [text-shadow:0_0_10px_rgba(255,20,147,0.6)]">
          漫画 · 分鏡
        </h2>
        <div className="text-[11px] text-gray-400 mt-1">
          {comicData?.status || currentChapter.comic_status || '—'}
          {currentNovel ? ` · ${currentNovel.title}` : ''}
        </div>
      </div>
      {renderContent()}
    </div>
  )
}

export default ComicViewer
