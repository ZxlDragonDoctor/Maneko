import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { libraryApi } from '../api/client'
import UploadModal from '../components/UploadModal'
import { NeonLoader, NeonSkeleton } from '../components/NeonLoader'

const SOURCE_COLORS = {
  builtin: '#bc13fe',
  popular: '#ff1493',
  gutenberg: '#00f0ff',
  wikisource: '#9ca3af',
  url: '#ff6b00',
  upload: '#9ca3af',
}

function Chip({ active, color = '#ff1493', children, ...rest }) {
  return (
    <button
      type="button"
      {...rest}
      className={`px-3 py-1.5 text-[11px] font-bold rounded-sm border transition-all duration-300 ${
        active
          ? 'text-[#0a0a1a] shadow-[0_0_12px_rgba(255,20,147,0.4)]'
          : 'text-gray-300 border-gray-400/30 hover:border-[#00f0ff] hover:text-[#00f0ff]'
      }`}
      style={active ? { background: color, borderColor: color } : undefined}
    >
      {children}
    </button>
  )
}

function LibraryPage() {
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') === 'sources' ? 'sources' : 'shelf'

  const [books, setBooks] = useState([])
  const [categories, setCategories] = useState([])
  const [sources, setSources] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [q, setQ] = useState('')
  const [catFilter, setCatFilter] = useState('')
  const [favOnly, setFavOnly] = useState(false)
  const [sort, setSort] = useState('updated')

  const [activeSource, setActiveSource] = useState('popular')
  const [sourceQ, setSourceQ] = useState('')
  const [sourceBooks, setSourceBooks] = useState([])
  const [sourceLoading, setSourceLoading] = useState(false)
  const [importUrl, setImportUrl] = useState('')
  const [importingId, setImportingId] = useState(null)
  const [importingUrl, setImportingUrl] = useState(false)
  const [newCat, setNewCat] = useState('')
  const [showUpload, setShowUpload] = useState(false)
  const [assignCat, setAssignCat] = useState({})

  const loadShelf = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [b, c, s, st] = await Promise.all([
        libraryApi.books({
          q: q || undefined,
          category_id: catFilter || undefined,
          favorite: favOnly ? true : undefined,
          sort,
        }),
        libraryApi.categories(),
        libraryApi.sources(),
        libraryApi.stats(),
      ])
      setBooks(b.books || [])
      setCategories(c.categories || [])
      setSources(s.sources || [])
      setStats(st)
      const ac = {}
      ;(b.books || []).forEach((x) => { ac[x.id] = x.category_id || '' })
      setAssignCat(ac)
    } catch (e) {
      setError(e.message || '加载失败')
    } finally {
      setLoading(false)
    }
  }, [q, catFilter, favOnly, sort])

  useEffect(() => {
    if (tab === 'shelf') loadShelf()
  }, [tab, loadShelf])

  useEffect(() => {
    if (tab !== 'sources') return
    libraryApi.sources().then((d) => setSources(d.sources || [])).catch(() => {})
  }, [tab])

  const searchSource = useCallback(async () => {
    if (activeSource === 'url') return
    setSourceLoading(true)
    setError('')
    try {
      const limit = 18
      let books = []
      if (activeSource === 'all') {
        const d = await libraryApi.searchAll(sourceQ.trim())
        books = d.books || []
      } else {
        const d = await libraryApi.searchSource(activeSource, sourceQ.trim())
        books = d.books || []
      }
      setSourceBooks(books)
      if (!books.length && sourceQ.trim()) {
        setError(`「${sourceQ.trim()}」在当前书源无结果。可换关键词，或本地上传 .txt/.md。`)
      }
    } catch (e) {
      setError(e.message || '书源搜索失败')
      setSourceBooks([])
    } finally {
      setSourceLoading(false)
    }
  }, [activeSource, sourceQ])

  // 每次进入书源页 / 切换书源都加载默认列表（空搜索）
  useEffect(() => {
    if (tab === 'sources' && activeSource !== 'url') {
      searchSource()
    }
  }, [tab, activeSource, searchSource])

  const handleImportSearch = async (book) => {
    const bookKey = `${book.source}:${book.source_ref}`
    if (book.copyright || !book.download_url) {
      setError(`《${book.title}》为版权作品，站内不提供全文。请点「本地上传」导入你的正版 txt/md。`)
      setShowUpload(true)
      return
    }
    setImportingId(bookKey)
    setError('')
    try {
      await libraryApi.importSearch({
        source: book.source,
        source_ref: book.source_ref,
        download_url: book.download_url,
        title: book.title,
        author: book.author || '',
        summary: book.summary || '',
        cover_url: book.cover_url || '',
      })
      await loadShelf()
      setParams({ tab: 'shelf' })
    } catch (e) {
      setError(e.message || '导入失败')
    } finally {
      setImportingId(null)
    }
  }

  const handleImportUrl = async () => {
    if (!importUrl.trim()) return
    setImportingUrl(true)
    setError('')
    try {
      await libraryApi.importUrl({ url: importUrl.trim() })
      setImportUrl('')
      await loadShelf()
      setParams({ tab: 'shelf' })
    } catch (e) {
      setError(e.message || '链接导入失败')
    } finally {
      setImportingUrl(false)
    }
  }

  const toggleFav = async (book) => {
    await libraryApi.updateBook(book.id, { favorite: !book.favorite })
    loadShelf()
  }

  const setCategory = async (bookId, categoryId) => {
    await libraryApi.updateBook(bookId, {
      category_id: categoryId || null,
      clear_category: !categoryId,
    })
    loadShelf()
  }

  const addCategory = async () => {
    if (!newCat.trim()) return
    try {
      await libraryApi.createCategory(newCat.trim(), '#bc13fe')
      setNewCat('')
      const c = await libraryApi.categories()
      setCategories(c.categories || [])
    } catch (e) {
      setError(e.message || '创建分类失败')
    }
  }

  const deleteCategory = async (id) => {
    if (!window.confirm('删除该分类？书不会被删除，只会变为未分类。')) return
    await libraryApi.deleteCategory(id)
    loadShelf()
  }

  const catName = useMemo(() => {
    const m = {}
    categories.forEach((c) => { m[c.id] = c })
    return m
  }, [categories])

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
        <div>
          <h1 className="font-bold text-2xl md:text-3xl mb-1">
            个人<span className="text-[#ff1493] [text-shadow:0_0_10px_rgba(255,20,147,0.6)]">書庫</span>
          </h1>
          <p className="text-gray-400 text-sm">
            {stats ? `共 ${stats.total} 本 · 收藏 ${stats.favorite} · 分类 ${stats.categories}` : '导入、分类、收藏你的小说'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setShowUpload(true)} className="px-4 py-2 text-[11px] font-bold uppercase rounded-sm text-[#ff1493] border-2 border-[#ff1493] hover:shadow-[0_0_20px_rgba(255,20,147,0.45)]">
            上传文件
          </button>
          <Chip active={tab === 'shelf'} onClick={() => setParams({ tab: 'shelf' })}>我的书库</Chip>
          <Chip active={tab === 'sources'} color="#ff6b00" onClick={() => setParams({ tab: 'sources' })}>接入书源</Chip>
        </div>
      </div>

      {error && (
        <div className="mb-4 border border-[#ff1493]/50 rounded-sm p-3 text-sm text-[#ff1493] bg-[#0a0a1a]/80">{error}</div>
      )}

      {tab === 'shelf' && (
        <>
          <div className="bg-[#0a0a1a]/80 backdrop-blur-md border border-[#00f0ff]/25 rounded-sm p-4 mb-6">
            <div className="flex flex-wrap gap-2 items-center mb-3">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && loadShelf()}
                placeholder="搜索书名 / 作者 / 简介"
                className="flex-1 min-w-[180px] bg-[#0a0a1a]/80 border border-[#ff1493]/30 rounded-sm text-white text-sm px-3 py-2 focus:border-[#ff1493] focus:shadow-[0_0_15px_rgba(255,20,147,0.3)] focus:outline-none"
              />
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                className="bg-[#0a0a1a] border border-[#00f0ff]/30 rounded-sm text-white text-xs px-2 py-2"
              >
                <option value="updated">最近更新</option>
                <option value="title">书名</option>
                <option value="progress">阅读进度</option>
              </select>
              <Chip active={favOnly} color="#ff1493" onClick={() => setFavOnly((v) => !v)}>仅收藏</Chip>
              <Chip active={!catFilter} onClick={() => setCatFilter('')}>全部</Chip>
              {categories.map((c) => (
                <Chip key={c.id} active={catFilter === c.id} color={c.color} onClick={() => setCatFilter(c.id)}>{c.name}</Chip>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] uppercase tracking-wider text-gray-400">管理分类</span>
              <input
                value={newCat}
                onChange={(e) => setNewCat(e.target.value)}
                placeholder="新分类名"
                className="w-28 bg-[#0a0a1a]/80 border border-[#bc13fe]/30 rounded-sm text-white text-xs px-2 py-1.5 focus:outline-none"
              />
              <button type="button" onClick={addCategory} className="px-3 py-1.5 text-[10px] font-bold uppercase rounded-sm text-[#bc13fe] border border-[#bc13fe]/50">添加</button>
              {categories.map((c) => (
                <span key={c.id} className="inline-flex items-center gap-1 text-[10px] text-gray-300 border border-gray-500/30 rounded-sm px-2 py-1">
                  <i className="w-2 h-2 rounded-full inline-block" style={{ background: c.color }} />
                  {c.name}
                  <button type="button" className="text-[#ff6b00] ml-1" onClick={() => deleteCategory(c.id)} aria-label={`删除 ${c.name}`}>×</button>
                </span>
              ))}
            </div>
          </div>

          {loading ? (
            <>
              <NeonLoader text="正在整理書庫" />
              <NeonSkeleton count={3} />
            </>
          ) : books.length === 0 ? (
            <div className="bg-[#0a0a1a]/80 border border-[#ff1493]/25 rounded-sm p-10 text-center text-gray-400">
              <p className="mb-4">书库还是空的</p>
              <button type="button" onClick={() => setParams({ tab: 'sources' })} className="px-6 py-3 text-xs font-bold uppercase rounded-sm text-[#ff6b00] border-2 border-[#ff6b00]">
                去接入书源
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {books.map((b, i) => (
                <article key={b.id} className={`bg-[#0a0a1a]/80 backdrop-blur-md rounded-sm p-5 border transition-all duration-300 hover:shadow-[0_0_25px_rgba(255,20,147,0.35)] ${i % 3 === 1 ? 'border-[#00f0ff]/30' : i % 3 === 2 ? 'border-[#ff6b00]/30' : 'border-[#ff1493]/30'}`}>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex flex-wrap gap-1.5">
                      <span className="text-[10px] px-1.5 py-0.5 border rounded-sm" style={{ color: SOURCE_COLORS[b.source] || '#9ca3af', borderColor: (SOURCE_COLORS[b.source] || '#9ca3af') + '66' }}>
                        {b.source}
                      </span>
                      {b.category_name && (
                        <span className="text-[10px] px-1.5 py-0.5 border rounded-sm" style={{ color: b.category_color || '#ff1493', borderColor: (b.category_color || '#ff1493') + '66' }}>
                          {b.category_name}
                        </span>
                      )}
                    </div>
                    <button type="button" onClick={() => toggleFav(b)} className={`text-sm ${b.favorite ? 'text-[#ff1493]' : 'text-gray-500 hover:text-[#ff1493]'}`} aria-label="收藏">
                      {b.favorite ? '★' : '☆'}
                    </button>
                  </div>
                  <h3 className="font-bold text-lg mb-1 leading-snug">{b.title}</h3>
                  <p className="text-xs text-gray-400 mb-2">{b.author || '佚名'} · {b.content_length} 字</p>
                  {b.summary && <p className="text-xs text-gray-400 mb-3 line-clamp-2">{b.summary}</p>}
                  <div className="h-1 bg-[#12041e] rounded-sm mb-3 overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-[#ff1493] to-[#00f0ff]" style={{ width: `${Math.round((b.progress || 0) * 100)}%` }} />
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={assignCat[b.id] || ''}
                      onChange={(e) => {
                        setAssignCat((s) => ({ ...s, [b.id]: e.target.value }))
                        setCategory(b.id, e.target.value)
                      }}
                      className="bg-[#0a0a1a] border border-[#00f0ff]/25 rounded-sm text-[10px] text-white px-2 py-1"
                    >
                      <option value="">未分类</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                    <Link to={`/novel/${b.id}`} className="px-3 py-1.5 text-[10px] font-bold uppercase rounded-sm text-[#ff1493] border-2 border-[#ff1493]">読む</Link>
                    <Link to={`/comics/${b.id}`} className="px-3 py-1.5 text-[10px] font-bold uppercase rounded-sm text-[#00f0ff] border border-[#00f0ff]/50">漫画集</Link>
                  </div>
                </article>
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'sources' && (
        <>
          <div className="bg-[#0a0a1a]/80 backdrop-blur-md border border-[#ff6b00]/25 rounded-sm p-4 mb-6">
            <div className="flex flex-wrap gap-2 mb-4">
              <Chip active={activeSource === 'all'} color="#ff1493" onClick={() => { setActiveSource('all'); setSourceBooks([]) }}>
                全网检索
              </Chip>
              {sources.map((s) => (
                <Chip key={s.id} active={activeSource === s.id} color="#ff6b00" onClick={() => { setActiveSource(s.id); setSourceBooks([]) }}>
                  {s.name}
                </Chip>
              ))}
            </div>
            <p className="text-xs text-gray-400 mb-3">
              {activeSource === 'all' || activeSource === 'gutenberg'
                ? '小说书源：公版小说全文可导入；热门网文仅索引（请本地上传正版）。'
                : activeSource === 'popular'
                  ? '热门小说索引（龙族/斗罗/诡秘等）。版权保护，全文请上传本地正版 txt。'
                  : activeSource === 'builtin'
                    ? '公版中文小说节选：西游 / 红楼 / 水浒 / 三国 / 聊斋… 可直接导入。'
                    : sources.find((s) => s.id === activeSource)?.description}
            </p>

            {activeSource === 'url' ? (
              <div className="flex flex-wrap gap-2">
                <input
                  value={importUrl}
                  onChange={(e) => setImportUrl(e.target.value)}
                  placeholder="https://example.com/novel.txt（纯文本直链）"
                  className="flex-1 min-w-[220px] bg-[#0a0a1a]/80 border border-[#ff1493]/30 rounded-sm text-white text-sm px-3 py-2 focus:outline-none focus:border-[#ff1493]"
                />
                <button type="button" disabled={importingUrl || !importUrl.trim()} onClick={handleImportUrl} className="px-5 py-2 text-[11px] font-bold uppercase rounded-sm text-[#ff1493] border-2 border-[#ff1493] disabled:opacity-40">
                  {importingUrl ? '导入中…' : '导入链接'}
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                <input
                  value={sourceQ}
                  onChange={(e) => setSourceQ(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && searchSource()}
                  placeholder="搜小说：龙族 / 诡秘 / dracula / sherlock / 西游"
                  className="flex-1 min-w-[180px] bg-[#0a0a1a]/80 border border-[#ff1493]/30 rounded-sm text-white text-sm px-3 py-2 focus:outline-none focus:border-[#ff1493]"
                />
                <button type="button" onClick={searchSource} disabled={sourceLoading} className="px-5 py-2 text-[11px] font-bold uppercase rounded-sm text-[#ff6b00] border-2 border-[#ff6b00] disabled:opacity-40">
                  {sourceLoading ? '检索中' : '搜索'}
                </button>
                <button type="button" onClick={() => setShowUpload(true)} className="px-5 py-2 text-[11px] font-bold uppercase rounded-sm text-[#00f0ff] border border-[#00f0ff]/50">
                  本地上传
                </button>
              </div>
            )}
          </div>

          {activeSource !== 'url' && (
            sourceLoading ? (
              <NeonLoader text="正在搜索书源" />
            ) : sourceBooks.length === 0 ? (
              <div className="text-center py-12">
                <img src="/mascot-neko.png" alt="" className="w-16 h-16 mx-auto mb-3 rounded-full border border-[#ff1493]/40 opacity-80" />
                <p className="text-gray-400 text-sm mb-2">当前书源暂无结果。可搜索「龙族」「dracula」「西游」等，或本地上传小说。</p>
                <p className="text-[11px] text-gray-500">切换书源会自动加载默认书目</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {sourceBooks.map((b) => {
                  const bookKey = `${b.source}:${b.source_ref}`
                  const busy = importingId === bookKey
                  return (
                  <article key={bookKey} className={`bg-[#0a0a1a]/80 rounded-sm p-4 transition-all duration-300 border ${b.copyright || !b.importable ? 'border-[#ff1493]/35' : 'border-[#ff6b00]/25 hover:shadow-[0_0_22px_rgba(255,107,0,0.3)]'}`}>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      <span className="text-[10px] px-1.5 py-0.5 border rounded-sm" style={{ color: SOURCE_COLORS[b.source] || '#9ca3af', borderColor: (SOURCE_COLORS[b.source] || '#9ca3af') + '66' }}>
                        {b.source}
                      </span>
                      {(b.tags || []).slice(0, 3).map((t) => (
                        <span key={t} className="text-[10px] px-1.5 py-0.5 border border-[#bc13fe]/40 text-[#bc13fe] rounded-sm">{t}</span>
                      ))}
                      {b.copyright && (
                        <span className="text-[10px] px-1.5 py-0.5 border border-[#ff1493]/50 text-[#ff1493] rounded-sm">版权</span>
                      )}
                    </div>
                    <h3 className="font-bold text-base mb-1">{b.title}</h3>
                    <p className="text-xs text-gray-400 mb-2">{b.author || '佚名'}{b.language ? ` · ${b.language}` : ''}</p>
                    {b.summary && <p className="text-xs text-gray-400 mb-3 line-clamp-3">{b.summary}</p>}
                    {b.copyright || !b.importable ? (
                      <button
                        type="button"
                        onClick={() => handleImportSearch(b)}
                        className="px-4 py-2 text-[10px] font-bold uppercase rounded-sm text-[#ff1493] border-2 border-[#ff1493] hover:shadow-[0_0_18px_rgba(255,20,147,0.4)]"
                      >
                        上传本地正版
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleImportSearch(b)}
                        className="px-4 py-2 text-[10px] font-bold uppercase rounded-sm text-[#0a0a1a] bg-[#ff6b00] border border-[#ff6b00] disabled:opacity-40"
                      >
                        {busy ? '导入中…' : '导入书库'}
                      </button>
                    )}
                  </article>
                  )
                })}
              </div>
            )
          )}
        </>
      )}

      {showUpload && <UploadModal onClose={() => { setShowUpload(false); loadShelf() }} />}
    </div>
  )
}

export default LibraryPage
