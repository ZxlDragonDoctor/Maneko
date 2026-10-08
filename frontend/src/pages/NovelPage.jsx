import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import useNovelStore from '../stores/novelStore'
import NovelReader from '../components/NovelReader'
import ComicViewer from '../components/ComicViewer'
import StylePicker from '../components/StylePicker'
import { comicApi, libraryApi } from '../api/client'
import { progressForChapter } from '../utils/readingProgress'

function NovelPage() {
  const { id } = useParams()
  const { currentNovel, chapters, loading, fetchNovelDetail, selectChapter, currentChapter } = useNovelStore()
  const [activeTab, setActiveTab] = useState('split')
  const [styleId, setStyleId] = useState('auto')
  const [detecting, setDetecting] = useState(false)
  const [progressError, setProgressError] = useState('')
  const [styleError, setStyleError] = useState('')
  const readingProgress = progressForChapter(currentChapter, chapters)

  useEffect(() => {
    fetchNovelDetail(id)
  }, [id, fetchNovelDetail])

  useEffect(() => {
    if (!id || currentNovel?.id !== id || readingProgress <= 0) return undefined
    let active = true
    libraryApi.updateBook(id, { progress: readingProgress })
      .then(() => {
        if (active) setProgressError('')
      })
      .catch((error) => {
        if (active) setProgressError(error.message || '阅读进度暂未同步到书库')
      })
    return () => { active = false }
  }, [id, currentNovel?.id, readingProgress])

  const handleDetect = async () => {
    setDetecting(true)
    setStyleError('')
    try {
      const d = await comicApi.detectStyle({ novelId: id })
      if (d?.style_id) setStyleId(d.style_id)
    } catch (error) {
      setStyleError(error.message || '画风识别失败，请稍后重试。')
    } finally {
      setDetecting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96 text-[var(--color-accent)]  ">
        加载中…
      </div>
    )
  }

  if (!currentNovel) {
    return (
      <div className="text-center py-12">
        <p className="text-[var(--color-muted)]">小说不存在</p>
        <Link to="/" className="inline-block mt-4 px-6 py-3 text-xs font-bold uppercase tracking-wider rounded-sm text-[var(--color-primary)] border-2 border-[var(--color-primary)]">
          返回書庫
        </Link>
      </div>
    )
  }

  const tabClass = (name) =>
    `px-6 py-3 text-xs font-bold uppercase tracking-wider rounded-sm transition-all duration-300 ${
      activeTab === name
        ? 'bg-[var(--color-primary)] text-[var(--color-on-primary)] border-2 border-[var(--color-primary)] shadow-sm'
        : 'text-[var(--color-muted)] border border-[var(--color-border)] hover:text-[var(--color-accent)] hover:border-[var(--color-accent)]'
    }`

  return (
    <div>
      <Link to="/" className="inline-block mb-4 px-4 py-2 text-[11px] font-bold uppercase tracking-wider rounded-sm text-[var(--color-accent)] border border-[var(--color-accent)] transition-all duration-300">
        ← 書庫
      </Link>
      <h1 className="font-bold text-2xl md:text-3xl mb-1">
        {currentNovel.title}
      </h1>
      <p className="text-[var(--color-muted)] text-sm mb-4">章节与分镜同步预览 · 按小说类型适配画风</p>
      {progressError && <p role="status" className="mb-4 text-sm text-[var(--color-warning)]">阅读正常，但进度暂未同步：{progressError}</p>}

      <div className="bg-[var(--color-surface)]/80 backdrop-blur-md border border-[var(--color-primary)] rounded-sm p-4 mb-4">
        <StylePicker
          value={styleId}
          onChange={setStyleId}
          onDetect={handleDetect}
          detectLoading={detecting}
        />
      </div>
      {styleError && <p role="status" className="mb-4 text-sm text-[var(--color-warning)]">{styleError}</p>}

      <div className="flex flex-wrap gap-2 mb-4" role="tablist">
        <button type="button" className={tabClass('split')} onClick={() => setActiveTab('split')} role="tab" aria-selected={activeTab === 'split'}>分屏</button>
        <button type="button" className={tabClass('novel')} onClick={() => setActiveTab('novel')} role="tab" aria-selected={activeTab === 'novel'}>仅小说</button>
        <button type="button" className={tabClass('comic')} onClick={() => setActiveTab('comic')} role="tab" aria-selected={activeTab === 'comic'}>仅漫画</button>
      </div>

      <div className="bg-[var(--color-surface)]/80 backdrop-blur-md border border-[var(--color-accent)] rounded-sm" style={{ height: 'calc(100vh - 360px)', minHeight: '420px' }}>
        {activeTab === 'split' && (
          <div className="grid md:grid-cols-2 h-full divide-y md:divide-y-0 md:divide-x divide-[var(--color-accent)]/20">
            <div className="h-full overflow-hidden">
              <NovelReader
                chapters={chapters}
                currentChapter={currentChapter}
                onChapterChange={selectChapter}
                novelContent={currentNovel.content}
              />
            </div>
            <div className="h-full overflow-hidden">
              <ComicViewer currentChapter={currentChapter} currentNovel={currentNovel} styleId={styleId} />
            </div>
          </div>
        )}
        {activeTab === 'novel' && (
          <div className="h-full overflow-hidden">
            <NovelReader
              chapters={chapters}
              currentChapter={currentChapter}
              onChapterChange={selectChapter}
              novelContent={currentNovel.content}
            />
          </div>
        )}
        {activeTab === 'comic' && (
          <div className="h-full overflow-hidden">
            <ComicViewer currentChapter={currentChapter} currentNovel={currentNovel} styleId={styleId} />
          </div>
        )}
      </div>
    </div>
  )
}

export default NovelPage
