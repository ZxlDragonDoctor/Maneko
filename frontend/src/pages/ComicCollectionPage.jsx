import { useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import useNovelStore from '../stores/novelStore'
import useComicStore from '../stores/comicStore'

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
    return <div className="text-center py-12 text-[#00f0ff] text-sm">加载中…</div>
  }

  const completedChapters = chapters.filter((ch) => {
    const comic = chapterComics[ch.id]
    return comic && comic.status === 'completed' && (comic.images?.length > 0 || ch.comic_status === 'completed')
  })

  return (
    <div>
      <Link to="/" className="inline-block mb-4 px-4 py-2 text-[11px] font-bold uppercase tracking-wider rounded-sm text-[#00f0ff] border border-[#00f0ff]/50">
        ← 書庫
      </Link>
      <h1 className="font-bold text-2xl md:text-3xl mb-1">
        {currentNovel.title} <span className="text-[#ff1493] [text-shadow:0_0_10px_rgba(255,20,147,0.6)]">漫画集</span>
      </h1>
      <p className="text-gray-400 text-sm mb-8">
        已完成 {completedChapters.length} / {chapters.length} 章
      </p>

      {completedChapters.length === 0 ? (
        <div className="bg-[#0a0a1a]/80 backdrop-blur-md border border-[#ff1493]/30 rounded-sm p-10 text-center">
          <p className="text-gray-400 mb-5">还没有生成任何漫画</p>
          <Link
            to={`/novel/${id}`}
            className="inline-block px-6 py-3 font-bold uppercase tracking-wider text-xs rounded-sm bg-transparent text-[#ff1493] border-2 border-[#ff1493] hover:shadow-[0_0_30px_rgba(255,20,147,0.5)]"
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
              <section key={chapter.id} className="bg-[#0a0a1a]/80 backdrop-blur-md border border-[#00f0ff]/25 rounded-sm p-6">
                <h2 className="font-bold text-xl mb-4">{chapter.title}</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {images.map((panel, index) => (
                    <figure key={panel?.id || panel || index} className="m-0 border border-[#ff1493]/30 rounded-sm overflow-hidden bg-[#12041e]">
                      <img
                        src={panelSrc(chapter.id, panel, index)}
                        alt={`${chapter.title} 分镜 ${index + 1}`}
                        className="w-full h-auto bg-[#12041e]"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none'
                        }}
                      />
                      <figcaption className="px-2 py-1 text-[11px] text-gray-400">第 {index + 1} 幕</figcaption>
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
