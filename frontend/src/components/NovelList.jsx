import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import useNovelStore from '../stores/novelStore'
import UploadModal from './UploadModal'

const PANELS = [
  { className: 'left-[6%] top-[12%] w-[18%] h-[28%] border-[#ff1493]', delay: '0s' },
  { className: 'left-[28%] top-[8%] w-[22%] h-[36%] border-[#00f0ff]', delay: '0.4s' },
  { className: 'right-[28%] top-[14%] w-[20%] h-[32%] border-[#ff1493]', delay: '0.8s' },
  { className: 'right-[6%] top-[10%] w-[18%] h-[40%] border-[#00f0ff]', delay: '1.2s' },
  { className: 'left-[12%] bottom-[10%] w-[24%] h-[22%] border-[#ff6b00]/70', delay: '0.6s' },
  { className: 'right-[10%] bottom-[8%] w-[26%] h-[26%] border-[#ff1493]', delay: '1s' },
]

const SPARKS = [
  { style: { left: '18%', top: '22%' }, color: '#ff6b00', size: 4 },
  { style: { left: '42%', top: '16%' }, color: '#00f0ff', size: 3 },
  { style: { left: '67%', top: '28%' }, color: '#ff1493', size: 4 },
  { style: { left: '82%', top: '18%' }, color: '#00f0ff', size: 3 },
  { style: { left: '30%', top: '62%' }, color: '#ff1493', size: 3 },
  { style: { left: '74%', top: '58%' }, color: '#ff6b00', size: 4 },
]

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
      <section className="mb-10 border-2 border-[#ff1493]/40 rounded-sm bg-[#0a0a1a]/80 backdrop-blur-md p-6 md:p-10 relative overflow-hidden min-h-[280px]">
        {/* neon manga panels — echo of the README banner */}
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          {PANELS.map((p) => (
            <div
              key={p.className}
              className={`absolute rounded-sm border-2 opacity-25 animate-[panelPulse_4s_ease-in-out_infinite] ${p.className}`}
              style={{ animationDelay: p.delay, boxShadow: '0 0 18px currentColor' }}
            />
          ))}
          {SPARKS.map((s, i) => (
            <span
              key={i}
              className="absolute rounded-full animate-[sparkFloat_5s_ease-in-out_infinite]"
              style={{
                ...s.style,
                width: s.size,
                height: s.size,
                background: s.color,
                boxShadow: `0 0 8px ${s.color}`,
                animationDelay: `${i * 0.35}s`,
              }}
            />
          ))}
          <div className="absolute inset-0 bg-gradient-to-r from-[#0a0a1a] via-[#0a0a1a]/85 to-[#0a0a1a]/40" />
          <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-[#ff1493]/15 to-transparent" />
        </div>

        <div className="relative max-w-xl">
          <p className="text-[11px] font-bold uppercase tracking-[0.35em] text-[#00f0ff] mb-3 [text-shadow:0_0_10px_rgba(0,240,255,0.55)]">
            Novel → Manga Panels
          </p>
          <h1 className="font-bold text-3xl md:text-5xl leading-tight text-[#ff1493] [text-shadow:0_0_12px_rgba(255,20,147,0.65)] mb-2">
            Maneko
          </h1>
          <p className="font-bold text-xl md:text-2xl text-white mb-3">
            把小说变成
            <span className="text-[#00f0ff] [text-shadow:0_0_10px_rgba(0,240,255,0.55)]">分镜漫画</span>
          </p>
          <p className="text-gray-400 text-sm md:text-base mb-6">
            上传纯文本 · AI 分章 → 分镜 → 出图。支持修仙 / 科幻 / 悬疑等风格，边读边看漫画。
          </p>
          <div className="flex flex-wrap gap-1.5 mb-6">
            {['AgentScope', 'FastAPI', 'React 19', 'MIT'].map((tag, i) => (
              <span
                key={tag}
                className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 border rounded-sm ${
                  i === 0
                    ? 'text-[#ff1493] border-[#ff1493]/60'
                    : i === 1
                      ? 'text-[#00f0ff] border-[#00f0ff]/60'
                      : i === 2
                        ? 'text-[#ff6b00] border-[#ff6b00]/60'
                        : 'text-gray-300 border-gray-400/50'
                }`}
              >
                {tag}
              </span>
            ))}
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setShowUpload(true)}
              className="px-6 py-3 font-bold uppercase tracking-wider transition-all duration-300 rounded-sm bg-transparent text-[#ff1493] border-2 border-[#ff1493] shadow-[0_0_15px_rgba(255,20,147,0.3)] hover:shadow-[0_0_30px_rgba(255,20,147,0.5)] active:scale-95"
            >
              上传小说
            </button>
            <a
              href="/maneko-app/"
              className="inline-flex px-6 py-3 font-bold uppercase tracking-wider transition-all duration-300 rounded-sm text-[#00f0ff] border-2 border-[#00f0ff]/50 hover:shadow-[0_0_20px_rgba(0,240,255,0.35)] active:scale-95"
            >
              移动端 App
            </a>
          </div>
        </div>

        <img
          src="/mascot-neko.png"
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute right-0 bottom-0 h-[92%] max-h-[320px] w-auto object-contain object-bottom opacity-90 hidden md:block drop-shadow-[0_0_24px_rgba(255,20,147,0.35)]"
        />
      </section>

      <h2 className="font-bold text-2xl md:text-3xl mb-1">
        我的<span className="text-[#ff1493] [text-shadow:0_0_10px_rgba(255,20,147,0.6)]">書庫</span>
      </h2>
      <p className="text-gray-400 text-sm mb-6">LIBRARY · 选择作品进入阅读 / 漫画</p>

      {novels.length === 0 ? (
        <div className="bg-[#0a0a1a]/80 backdrop-blur-md border border-[#ff1493]/30 rounded-sm p-10 text-center text-gray-400">
          <img src="/mascot-neko.png" alt="" className="w-20 h-20 mx-auto mb-4 rounded-full border-2 border-[#ff1493]/50 object-cover object-top shadow-[0_0_20px_rgba(255,20,147,0.35)]" />
          書庫是空的 · 点击上方按钮上传，把小说招成漫画
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
                  className="px-4 py-2 text-[11px] font-bold uppercase tracking-wider rounded-sm text-gray-400 border border-gray-500/40 hover:text-[#ff1493] hover:border-[#ff1493]/50 transition-all duration-300"
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
