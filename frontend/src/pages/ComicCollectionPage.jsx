import { useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import useNovelStore from '../stores/novelStore'
import useComicStore from '../stores/comicStore'
import { comicApi } from '../api/client'
import { downloadBlob } from '../utils/download'

function panelSrc(chapterId, item, index) {
  let n = index + 1
  if (item && typeof item === 'object' && item.panel_index) n = item.panel_index
  if (typeof item === 'string') {
    const m = item.match(/panel_(\d+)/i)
    if (m) n = Number(m[1])
  }
  return `/comics/${chapterId}/panel_${String(n).padStart(2, '0')}.png`
}

function ComicCollectionPage() {
  const { id } = useParams()
  const { currentNovel, chapters, fetchNovelDetail } = useNovelStore()
  const { chapterComics, fetchChapterStatus } = useComicStore()

  useEffect(() => {
    fetchNovelDetail(id)
  }, [id, fetchNovelDetail])

  useEffect(() => {
    chapters.forEach((chapter) => fetchChapterStatus(chapter.id))
  }, [chapters, fetchChapterStatus])

  if (!currentNovel) {
    return <div className="text-center py-12 text-[var(--color-accent)] text-sm">加载中…</div>
  }

  const completedChapters = chapters.filter((ch) => {
    const comic = chapterComics[ch.id]
    return comic && comic.status === 'completed' && (comic.images?.length > 0 || ch.comic_status === 'completed')
  })

  return (
    <div>
      <Link to="/" className="inline-block mb-4 px-4 py-2 text-[11px] font-bold uppercase tracking-wider rounded-sm text-[var(--color-accent)] border border-[var(--color-accent)]">
        ← 書庫
      </Link>
      <h1 className="font-bold text-2xl md:text-3xl mb-1">
        {currentNovel.title} <span className="text-[var(--color-primary)]  ">漫画集</span>
      </h1>
      <p className="text-[var(--color-muted)] text-sm mb-8">
        已完成 {completedChapters.length} / {chapters.length} 章
      </p>

      {completedChapters.length === 0 ? (
        <div className="bg-[var(--color-surface)]/80 backdrop-blur-md border border-[var(--color-primary)] rounded-sm p-10 text-center">
          <p className="text-[var(--color-muted)] mb-5">还没有生成任何漫画</p>
          <Link
            to={`/novel/${id}`}
            className="inline-block px-6 py-3 font-bold uppercase tracking-wider text-xs rounded-sm bg-transparent text-[var(--color-primary)] border-2 border-[var(--color-primary)] hover:shadow-sm"
          >
            去阅读页
          </Link>
        </div>
      ) : (
        <div className="space-y-8">
          {completedChapters.map((chapter) => {
            const comic = chapterComics[chapter.id]
            const images = comic.images || []
            return (
              <section key={chapter.id} className="bg-[var(--color-surface)]/80 backdrop-blur-md border border-[var(--color-accent)] rounded-sm p-6">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <h2 className="font-bold text-xl">{chapter.title}</h2>
                  <button
                    type="button"
                    onClick={async (event) => {
                      const button = event.currentTarget
                      button.disabled = true
                      try {
                        const archive = await comicApi.exportArchive(chapter.id)
                        downloadBlob(archive, `maneko-${chapter.title || 'chapter'}.zip`)
                      } catch (error) {
                        window.alert(error.message || '分镜导出失败，请重试。')
                      } finally {
                        button.disabled = false
                      }
                    }}
                    className="min-h-11 rounded-lg border border-[var(--color-accent)] px-4 py-2 text-xs font-semibold text-[var(--color-accent)] disabled:opacity-60"
                  >下载本章分镜 ZIP</button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {images.map((panel, index) => (
                    <figure key={panel?.id || panel || index} className="m-0 border border-[var(--color-primary)] rounded-sm overflow-hidden bg-[var(--color-surface-alt)]">
                      <img
                        src={panelSrc(chapter.id, panel, index)}
                        alt={`${chapter.title} 分镜 ${index + 1}`}
                        className="w-full h-auto bg-[var(--color-surface-alt)]"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none'
                        }}
                      />
                      <figcaption className="px-2 py-1 text-[11px] text-[var(--color-muted)]">第 {index + 1} 幕</figcaption>
                    </figure>
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default ComicCollectionPage
