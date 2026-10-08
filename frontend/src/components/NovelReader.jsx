import { useEffect, useRef, useCallback } from 'react'

function NovelReader({ chapters = [], currentChapter, onChapterChange, novelContent = '' }) {
  const observerRef = useRef(null)
  const chapterRefs = useRef({})

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
  }, [chapters, onChapterChange])

  const setChapterRef = useCallback((el, chapterId) => {
    chapterRefs.current[chapterId] = el
  }, [])

  return (
    <div className="h-full overflow-y-auto p-4">
      <h2 className="text-xs font-bold uppercase tracking-widest text-[var(--color-accent)]  mb-4 sticky top-0 bg-[var(--color-surface)] py-2 z-10">
        小説 · 原文
      </h2>

      {chapters.length === 0 ? (
        <div className="bg-[var(--color-surface-alt)]/60 border border-[var(--color-primary)] rounded-sm p-4">
          <div className="text-[var(--color-text)] text-sm whitespace-pre-wrap max-w-prose">
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
            className={`mb-4 p-4 rounded-sm cursor-pointer transition-all duration-300 bg-[var(--color-surface-alt)]/50 ${
              currentChapter?.id === chapter.id
                ? 'border-2 border-[var(--color-primary)] shadow-sm'
                : 'border border-[var(--color-accent)] hover:border-[var(--color-accent)]'
            }`}
          >
            <h3 className="font-bold text-base md:text-lg mb-2">{chapter.title}</h3>
            <div className="text-[var(--color-text)] text-sm leading-relaxed whitespace-pre-wrap max-w-prose">
              {chapter.content}
            </div>
            <div className="mt-3 text-[11px] text-[var(--color-muted)] uppercase tracking-wider">
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
