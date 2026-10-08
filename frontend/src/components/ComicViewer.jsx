import { useEffect, useState } from 'react'
import useComicStore from '../stores/comicStore'
import { NeonLoader } from './NeonLoader'
import { comicApi } from '../api/client'
import { downloadBlob } from '../utils/download'

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
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState('')
  const { chapterComics, fetchChapterStatus, generateComic } = useComicStore()
  const comicData = currentChapter ? chapterComics[currentChapter.id] : null

  useEffect(() => {
    if (currentChapter) fetchChapterStatus(currentChapter.id)
  }, [currentChapter, fetchChapterStatus])

  if (!currentChapter) {
    return (
      <div className="h-full flex items-center justify-center text-[var(--color-muted)] text-sm">
        请选择左侧章节
      </div>
    )
  }

  const exportComic = async () => {
    setExporting(true)
    setExportError('')
    try {
      const archive = await comicApi.exportArchive(currentChapter.id)
      downloadBlob(archive, `maneko-${currentChapter.title || 'chapter'}.zip`)
    } catch (error) {
      setExportError(error.message || '分镜导出失败，请重试。')
    } finally {
      setExporting(false)
    }
  }

  const renderContent = () => {
    if (!comicData || comicData.status === 'pending') {
      return (
        <div className="text-center py-12">
          <p className="text-[var(--color-muted)] mb-4 text-sm">该章节尚未生成漫画</p>
          <button
            type="button"
            onClick={() => generateComic(currentChapter.id, styleId).catch(() => {})}
            className="px-6 py-3 font-bold uppercase tracking-wider text-xs rounded-sm bg-transparent text-[var(--color-primary)] border-2 border-[var(--color-primary)] transition-all duration-300 hover:shadow-sm active:scale-95"
          >
            生成漫画 · {styleId}
          </button>
        </div>
      )
    }
    if (comicData.status === 'generating') {
      const partial = comicData.images || []
      return (
        <div>
          <NeonLoader text="正在生成分镜" />
          {partial.length > 0 && (
            <div className="mt-6">
              <p className="text-[11px] text-[var(--color-muted)] mb-3">已出图 {partial.length} 格…</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {partial.map((image, index) => {
                  const idx = toPanelIndex(image, index)
                  return (
                    <figure
                      key={image?.id || idx || index}
                      className="m-0 border border-[var(--color-accent)] rounded-sm overflow-hidden bg-[var(--color-surface-alt)]"
                    >
                      <img
                        src={panelUrl(currentChapter.id, idx)}
                        alt={`分镜 ${idx}`}
                        className="w-full h-auto bg-[var(--color-surface-alt)]"
                      />
                      <figcaption className="px-2 py-1 text-[11px] text-[var(--color-muted)] border-t border-[var(--color-accent)]">
                        第 {idx} 幕 · 生成中
                      </figcaption>
                    </figure>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )
    }
    if (comicData.status === 'error') {
      const images = comicData.images || []
      return (
        <div>
          <div className="text-center py-6">
            <p role="alert" className="text-[var(--color-danger)] mb-4 text-sm">
              {comicData.error || (images.length ? `本次生成未完成，当前有 ${images.length} 格可用，可导出或重试。` : '生成失败，可重试或稍后检查服务状态。')}
            </p>
            <div className="flex justify-center gap-2">
              {images.length > 0 && (
                <button
                  type="button"
                  disabled={exporting}
                  onClick={exportComic}
                  className="min-h-11 rounded-lg border border-[var(--color-border)] px-4 py-2 text-xs font-semibold text-[var(--color-accent)] disabled:opacity-60"
                >
                  {exporting ? '正在打包…' : '导出已生成画格 ZIP'}
                </button>
              )}
              <button
                type="button"
                onClick={() => generateComic(currentChapter.id, styleId, { force: true }).catch(() => {})}
                className="min-h-11 rounded-lg border border-[var(--color-border)] px-4 py-2 text-xs font-semibold text-[var(--color-accent)]"
              >
                重试
              </button>
            </div>
            {exportError && <p role="alert" className="mt-3 text-sm text-[var(--color-danger)]">{exportError}</p>}
          </div>
          {images.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {images.map((image, index) => {
                const idx = toPanelIndex(image, index)
                return (
                  <figure key={image?.id || idx || index} className="m-0 overflow-hidden rounded-sm border border-[var(--color-border)] bg-[var(--color-surface-alt)]">
                    <img src={panelUrl(currentChapter.id, idx)} alt={`分镜 ${idx}`} className="h-auto w-full" />
                    <figcaption className="border-t border-[var(--color-border)] px-2 py-1 text-[11px] text-[var(--color-muted)]">第 {idx} 幕 · 部分结果</figcaption>
                  </figure>
                )
              })}
            </div>
          )}
        </div>
      )
    }
    if (comicData.status === 'completed') {
      const images = comicData.images || []
      if (!images.length) {
        return <div className="text-center py-12 text-[var(--color-muted)] text-sm">暂无漫画图片</div>
      }
      return (
        <div>
          <div className="mb-3 flex justify-end">
            <button
              type="button"
              disabled={exporting}
              onClick={exportComic}
              className="mr-2 min-h-11 rounded-lg border border-[var(--color-border)] px-4 py-2 text-xs font-semibold text-[var(--color-accent)] disabled:opacity-60"
            >
              {exporting ? '正在打包…' : '下载本章分镜 ZIP'}
            </button>
            <button
              type="button"
              onClick={() => generateComic(currentChapter.id, styleId, { force: true }).catch(() => {})}
              className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider rounded-sm text-[var(--color-accent)] border border-[var(--color-accent)] transition-all duration-300 hover:shadow-sm"
            >
              按当前风格重新生成
            </button>
          </div>
          {exportError && <p role="alert" className="mb-3 text-sm text-[var(--color-danger)]">{exportError}</p>}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {images.map((image, index) => {
            const idx = toPanelIndex(image, index)
            return (
              <figure
                key={image?.id || idx || index}
                className="m-0 border border-[var(--color-primary)] rounded-sm overflow-hidden bg-[var(--color-surface-alt)] transition-all duration-300 hover:shadow-sm"
              >
                <img
                  src={panelUrl(currentChapter.id, idx)}
                  alt={`分镜 ${idx}`}
                  className="w-full h-auto bg-[var(--color-surface-alt)]"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none'
                    const p = e.currentTarget.parentElement
                    if (p && !p.dataset.failed) {
                      p.dataset.failed = '1'
                      const tip = document.createElement('p')
                      tip.className = 'p-4 text-xs text-[var(--color-primary)]'
                      tip.textContent = `加载失败 panel_${String(idx).padStart(2, '0')}`
                      p.appendChild(tip)
                    }
                  }}
                />
                <figcaption className="px-2 py-1 text-[11px] text-[var(--color-muted)] border-t border-[var(--color-primary)]">
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
      <div className="sticky top-0 bg-[var(--color-surface)] py-2 mb-4 z-10">
        <h2 className="text-xs font-bold uppercase tracking-widest text-[var(--color-primary)]  ">
          漫画 · 分鏡
        </h2>
        <div className="text-[11px] text-[var(--color-muted)] mt-1">
          {comicData?.status || currentChapter.comic_status || '—'}
          {currentNovel ? ` · ${currentNovel.title}` : ''}
        </div>
      </div>
      {renderContent()}
    </div>
  )
}

export default ComicViewer
