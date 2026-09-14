import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import useNovelStore from '../stores/novelStore'
import NovelReader from '../components/NovelReader'
import ComicViewer from '../components/ComicViewer'
import StylePicker from '../components/StylePicker'
import { comicApi, libraryApi } from '../api/client'

function NovelPage() {
  const { id } = useParams()
  const { currentNovel, chapters, loading, fetchNovelDetail, selectChapter, currentChapter } = useNovelStore()
  const [activeTab, setActiveTab] = useState('split')
  const [styleId, setStyleId] = useState('auto')
  const [detecting, setDetecting] = useState(false)

  useEffect(() => {
    fetchNovelDetail(id)
    // mark reading progress when opening
    libraryApi.updateBook(id, { progress: 0.15 }).catch(() => {})
  }, [id, fetchNovelDetail])

  useEffect(() => {
    if (!id) return
    setDetecting(true)
    comicApi.detectStyle({ novelId: id })
      .then((d) => {
        if (d?.style_id) setStyleId(d.style_id)
      })
      .catch(() => {})
      .finally(() => setDetecting(false))
  }, [id])

  const handleDetect = async () => {
    setDetecting(true)
    try {
      const d = await comicApi.detectStyle({ novelId: id })
      if (d?.style_id) setStyleId(d.style_id)
    } catch (_) {
    } finally {
      setDetecting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96 text-[#00f0ff] [text-shadow:0_0_10px_rgba(0,240,255,0.55)]">
        加载中…
      </div>
    )
  }

  if (!currentNovel) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400">小说不存在</p>
        <Link to="/" className="inline-block mt-4 px-6 py-3 text-xs font-bold uppercase tracking-wider rounded-sm text-[#ff1493] border-2 border-[#ff1493]">
          返回書庫
        </Link>
      </div>
    )
  }

  const tabClass = (name) =>
    `px-6 py-3 text-xs font-bold uppercase tracking-wider rounded-sm transition-all duration-300 ${
      activeTab === name
        ? 'bg-[#ff1493] text-[#0a0a1a] border-2 border-[#ff1493] shadow-[0_0_10px_rgba(255,20,147,0.6)]'
        : 'text-gray-400 border border-gray-400/35 hover:text-[#00f0ff] hover:border-[#00f0ff]'
    }`

  return (
    <div>
      <Link to="/" className="inline-block mb-4 px-4 py-2 text-[11px] font-bold uppercase tracking-wider rounded-sm text-[#00f0ff] border border-[#00f0ff]/50 transition-all duration-300">
        ← 書庫
      </Link>
      <h1 className="font-bold text-2xl md:text-3xl mb-1">
        {currentNovel.title}
      </h1>
      <p className="text-gray-400 text-sm mb-4">章节与分镜同步预览 · 按小说类型适配画风</p>

      <div className="bg-[#0a0a1a]/80 backdrop-blur-md border border-[#ff1493]/25 rounded-sm p-4 mb-4">
        <StylePicker
          value={styleId}
          onChange={setStyleId}
          onDetect={handleDetect}
          detectLoading={detecting}
        />
      </div>

      <div className="flex flex-wrap gap-2 mb-4" role="tablist">
        <button type="button" className={tabClass('split')} onClick={() => setActiveTab('split')} role="tab" aria-selected={activeTab === 'split'}>分屏</button>
        <button type="button" className={tabClass('novel')} onClick={() => setActiveTab('novel')} role="tab" aria-selected={activeTab === 'novel'}>仅小说</button>
        <button type="button" className={tabClass('comic')} onClick={() => setActiveTab('comic')} role="tab" aria-selected={activeTab === 'comic'}>仅漫画</button>
      </div>

      <div className="bg-[#0a0a1a]/80 backdrop-blur-md border border-[#00f0ff]/25 rounded-sm" style={{ height: 'calc(100vh - 360px)', minHeight: '420px' }}>
        {activeTab === 'split' && (
          <div className="grid md:grid-cols-2 h-full divide-y md:divide-y-0 md:divide-x divide-[#00f0ff]/20">
            <div className="h-full overflow-hidden">
              <NovelReader
                chapters={chapters}
                currentChapter={currentChapter}
                onChapterChange={selectChapter}
                novelContent={currentNovel.content}
                styleId={styleId}
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
              styleId={styleId}
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
