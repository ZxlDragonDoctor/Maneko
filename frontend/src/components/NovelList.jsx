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
    return <div className="text-center py-12 text-[var(--color-accent)]  ">加载書庫…</div>
  }

  return (
    <div>
      <section className="mb-10 border border-[var(--color-border)] rounded-xl bg-[var(--color-surface)] p-6 md:p-10 relative overflow-hidden min-h-[280px] shadow-sm">
        <div className="absolute inset-y-0 right-0 w-1/3 bg-gradient-to-l from-[var(--color-surface-alt)]/70 to-transparent" aria-hidden="true" />
        <div className="relative max-w-xl">
          <p className="text-[11px] font-bold uppercase tracking-[0.35em] text-[var(--color-accent)] mb-3  ">
            小说 · 阅读 · 分镜
          </p>
          <h1 className="font-bold text-3xl md:text-5xl leading-tight text-[var(--color-primary)]  mb-2">
            Maneko
          </h1>
          <p className="font-bold text-xl md:text-2xl text-[var(--color-text)] mb-3">
            把小说变成
            <span className="text-[var(--color-accent)]  ">分镜漫画</span>
          </p>
          <p className="text-[var(--color-muted)] text-sm md:text-base mb-6">
            上传纯文本 · AI 分章 → 分镜 → 出图。支持修仙 / 科幻 / 悬疑等风格，边读边看漫画。
          </p>
          <div className="flex flex-wrap gap-1.5 mb-6">
            {['AgentScope', 'FastAPI', 'React 19', 'MIT'].map((tag, i) => (
              <span
                key={tag}
                className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 border rounded-sm ${
                  i === 0
                    ? 'text-[var(--color-primary)] border-[var(--color-primary)]'
                    : i === 1
                      ? 'text-[var(--color-accent)] border-[var(--color-accent)]'
                      : i === 2
                        ? 'text-[var(--color-warning)] border-[var(--color-warning)]'
                        : 'text-[var(--color-text)] border-[var(--color-border)]'
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
              className="px-6 py-3 font-bold uppercase tracking-wider transition-all duration-300 rounded-sm bg-transparent text-[var(--color-primary)] border-2 border-[var(--color-primary)] shadow-sm hover:shadow-sm active:scale-95"
            >
              新增项目
            </button>
            <a
              href="/maneko-app/"
              className="inline-flex px-6 py-3 font-bold uppercase tracking-wider transition-all duration-300 rounded-sm text-[var(--color-accent)] border-2 border-[var(--color-accent)] hover:shadow-sm active:scale-95"
            >
              移动端 App
            </a>
          </div>
        </div>

        <img
          src="/mascot-neko.png"
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute right-0 bottom-0 h-[92%] max-h-[320px] w-auto object-contain object-bottom opacity-90 hidden md:block drop-shadow-sm"
        />
      </section>

      <h2 className="font-bold text-2xl md:text-3xl mb-1">
        我的<span className="text-[var(--color-primary)]  ">書庫</span>
      </h2>
      <p className="text-[var(--color-muted)] text-sm mb-6">LIBRARY · 选择作品进入阅读 / 漫画</p>

      {novels.length === 0 ? (
        <div className="bg-[var(--color-surface)]/80 backdrop-blur-md border border-[var(--color-primary)] rounded-sm p-10 text-center text-[var(--color-muted)]">
          <img src="/mascot-neko.png" alt="" className="w-20 h-20 mx-auto mb-4 rounded-full border-2 border-[var(--color-primary)] object-cover object-top shadow-sm" />
          書庫是空的 · 点击上方按钮上传，把小说招成漫画
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {novels.map((novel, i) => (
            <article
              key={novel.id}
              className={`bg-[var(--color-surface)]/80 backdrop-blur-md rounded-sm p-6 transition-all duration-300 hover:shadow-sm ${
                i % 3 === 1
                  ? 'border border-[var(--color-accent)]'
                  : i % 3 === 2
                    ? 'border border-[var(--color-warning)]'
                    : 'border border-[var(--color-primary)]'
              }`}
            >
              <span
                className={`inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-sm border mb-3 ${
                  novel.status === 'completed'
                    ? 'text-[var(--color-accent)] border-[var(--color-accent)]'
                    : novel.status === 'error'
                      ? 'text-[var(--color-primary)] border-[var(--color-primary)]'
                      : 'text-[var(--color-warning)] border-[var(--color-warning)]'
                }`}
              >
                {novel.status === 'completed' ? '已解析' : novel.status === 'error' ? '解析失败' : '处理中'}
              </span>
              <h3 className="font-bold text-xl mb-2">{novel.title}</h3>
              <p className="text-[var(--color-muted)] text-sm mb-4">{novel.created_at?.slice(0, 10)}</p>
              <div className="flex flex-wrap gap-2">
                <Link
                  to={`/novel/${novel.id}`}
                  className="px-4 py-2 text-[11px] font-bold uppercase tracking-wider rounded-sm text-[var(--color-primary)] border-2 border-[var(--color-primary)] transition-all duration-300 hover:shadow-sm"
                >
                  讀む
                </Link>
                <Link
                  to={`/comics/${novel.id}`}
                  className="px-4 py-2 text-[11px] font-bold uppercase tracking-wider rounded-sm text-[var(--color-accent)] border border-[var(--color-accent)] transition-all duration-300 hover:shadow-sm"
                >
                  漫画集
                </Link>
                <button
                  type="button"
                  onClick={() => handleDelete(novel.id, novel.title)}
                  className="px-4 py-2 text-[11px] font-bold uppercase tracking-wider rounded-sm text-[var(--color-muted)] border border-[var(--color-border)] hover:text-[var(--color-primary)] hover:border-[var(--color-primary)] transition-all duration-300"
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
