import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import useNovelStore from '../stores/novelStore'
import UploadModal from './UploadModal'

function NovelList() {
  const { novels, loading, fetchNovels, deleteNovel } = useNovelStore()
  const [showUpload, setShowUpload] = useState(false)

  useEffect(() => {
    fetchNovels()
  }, [fetchNovels])

  const handleDelete = async (id, title) => {
    if (window.confirm(`确定要删除《${title}》吗？`)) {
      await deleteNovel(id)
    }
  }

  if (loading) {
    return <div className="text-center py-12 text-[#00f0ff] [text-shadow:0_0_10px_rgba(0,240,255,0.55)]">加载書庫…</div>
  }

  return (
    <div>
      <section className="mb-10 border-2 border-[#ff1493]/35 rounded-sm bg-[#0a0a1a]/75 backdrop-blur-md p-6 md:p-10 relative overflow-hidden">
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-[#ff1493]/12 to-transparent" />
        <h1 className="relative font-bold text-3xl md:text-5xl leading-tight text-[#ff1493] [text-shadow:0_0_10px_rgba(255,20,147,0.6)] mb-3">
          把小说变成
          <br />
          <span className="text-[#00f0ff] [text-shadow:0_0_10px_rgba(0,240,255,0.55)]">分镜漫画</span>
        </h1>
        <p className="relative text-gray-400 text-sm md:text-base max-w-xl mb-6">
          上传纯文本 · AI 分章 → 分镜 → 出图。支持修仙 / 科幻 / 悬疑等风格，边读边看漫画。
        </p>
        <button
          type="button"
          onClick={() => setShowUpload(true)}
          className="relative px-6 py-3 font-bold uppercase tracking-wider transition-all duration-300 rounded-sm bg-transparent text-[#ff1493] border-2 border-[#ff1493] shadow-[0_0_15px_rgba(255,20,147,0.3)] hover:shadow-[0_0_30px_rgba(255,20,147,0.5)] active:scale-95"
        >
          上传小说
        </button>
      </section>

      <h2 className="font-bold text-2xl md:text-3xl mb-1">
        我的<span className="text-[#ff1493] [text-shadow:0_0_10px_rgba(255,20,147,0.6)]">書庫</span>
      </h2>
      <p className="text-gray-400 text-sm mb-6">LIBRARY · 选择作品进入阅读 / 漫画</p>

      {novels.length === 0 ? (
        <div className="bg-[#0a0a1a]/80 backdrop-blur-md border border-[#ff1493]/30 rounded-sm p-8 text-center text-gray-400">
          書庫是空的 · 点击上方按钮上传
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {novels.map((novel, i) => (
            <article
              key={novel.id}
              className={`bg-[#0a0a1a]/80 backdrop-blur-md rounded-sm p-6 transition-all duration-300 hover:shadow-[0_0_30px_rgba(255,20,147,0.5)] ${
                i % 3 === 1
                  ? 'border border-[#00f0ff]/35'
                  : i % 3 === 2
                    ? 'border border-[#ff6b00]/35'
                    : 'border border-[#ff1493]/30'
              }`}
            >
              <span
                className={`inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-sm border mb-3 ${
                  novel.status === 'completed'
                    ? 'text-[#00f0ff] border-[#00f0ff]/50'
                    : novel.status === 'error'
                      ? 'text-[#ff1493] border-[#ff1493]/50'
                      : 'text-[#ff6b00] border-[#ff6b00]/50'
                }`}
              >
                {novel.status === 'completed' ? '已解析' : novel.status === 'error' ? '解析失败' : '处理中'}
              </span>
              <h3 className="font-bold text-xl mb-2">{novel.title}</h3>
              <p className="text-gray-400 text-sm mb-4">{novel.created_at?.slice(0, 10)}</p>
              <div className="flex flex-wrap gap-2">
                <Link
                  to={`/novel/${novel.id}`}
                  className="px-4 py-2 text-[11px] font-bold uppercase tracking-wider rounded-sm text-[#ff1493] border-2 border-[#ff1493] transition-all duration-300 hover:shadow-[0_0_20px_rgba(255,20,147,0.45)]"
                >
                  讀む
                </Link>
                <Link
                  to={`/comics/${novel.id}`}
                  className="px-4 py-2 text-[11px] font-bold uppercase tracking-wider rounded-sm text-[#00f0ff] border border-[#00f0ff]/50 transition-all duration-300 hover:shadow-[0_0_20px_rgba(0,240,255,0.4)]"
                >
                  漫画集
                </Link>
                <button
                  type="button"
                  onClick={() => handleDelete(novel.id, novel.title)}
                  className="px-4 py-2 text-[11px] font-bold uppercase tracking-wider rounded-sm text-[#ff6b00] border border-[#ff6b00]/50 transition-all duration-300 hover:shadow-[0_0_20px_rgba(255,107,0,0.4)]"
                >
                  删除
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {showUpload && <UploadModal onClose={() => setShowUpload(false)} />}
    </div>
  )
}

export default NovelList
