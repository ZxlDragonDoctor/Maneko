import { useEffect, useRef, useCallback } from 'react'
import useComicStore from '../stores/comicStore'

function NovelReader({ chapters = [], currentChapter, onChapterChange, novelContent = '', styleId = 'auto' }) {
  const observerRef = useRef(null)
  const chapterRefs = useRef({})
  const { chapterComics, generateComic } = useComicStore()

  const handleSelect = useCallback((chapter) => {
    onChapterChange?.(chapter)
  }, [onChapterChange])

  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const chapterId = entry.target.dataset.chapterId
            const chapter = chapters.find((ch) => ch.id === chapterId)
            if (chapter) {
              onChapterChange(chapter)
              const comicStatus = chapterComics[chapterId]
              if (
                chapter.comic_status !== 'completed' &&
                (!comicStatus || comicStatus.status === 'pending')
              ) {
                generateComic(chapterId, styleId)
              }
            }
          }
        })
      },
      { root: null, rootMargin: '-50% 0px -50% 0px', threshold: 0 }
    )
    Object.values(chapterRefs.current).forEach((ref) => {
      if (ref) observerRef.current.observe(ref)
    })
    return () => observerRef.current?.disconnect()
  }, [chapters, chapterComics, generateComic, onChapterChange, styleId])

  const setChapterRef = useCallback((el, chapterId) => {
    chapterRefs.current[chapterId] = el
  }, [])

  return (
    <div className="h-full overflow-y-auto p-4">
      <h2 className="text-xs font-bold uppercase tracking-widest text-[#00f0ff] [text-shadow:0_0_10px_rgba(0,240,255,0.55)] mb-4 sticky top-0 bg-[#0a0a1a] py-2 z-10">
        小説 · 原文
      </h2>

      {chapters.length === 0 ? (
        <div className="bg-[#12041e]/60 border border-[#ff1493]/25 rounded-sm p-4">
          <div className="text-gray-300 text-sm whitespace-pre-wrap max-w-prose">
            {novelContent || '暂无章节内容'}
          </div>
        </div>
      ) : (
        chapters.map((chapter) => (
          <article
            key={chapter.id}
            ref={(el) => setChapterRef(el, chapter.id)}
            data-chapter-id={chapter.id}
            onClick={() => handleSelect(chapter)}
            tabIndex={0}
            role="button"
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                handleSelect(chapter)
              }
            }}
            className={`mb-4 p-4 rounded-sm cursor-pointer transition-all duration-300 bg-[#12041e]/50 ${
              currentChapter?.id === chapter.id
                ? 'border-2 border-[#ff1493] shadow-[0_0_15px_rgba(255,20,147,0.3)]'
                : 'border border-[#00f0ff]/20 hover:border-[#00f0ff]/45'
            }`}
          >
            <h3 className="font-bold text-base md:text-lg mb-2">{chapter.title}</h3>
            <div className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap max-w-prose">
              {chapter.content}
            </div>
            <div className="mt-3 text-[11px] text-gray-400 uppercase tracking-wider">
              第 {chapter.chapter_number} 章
              {chapter.comic_status ? ` · ${chapter.comic_status}` : ''}
            </div>
          </article>
        ))
      )}
    </div>
  )
}

export default NovelReader
