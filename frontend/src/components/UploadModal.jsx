import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useNovelStore from '../stores/novelStore'
import StylePicker from './StylePicker'

const MAX_BYTES = 10 * 1024 * 1024
const ACCEPT = /\.(txt|md|markdown)$/i

function formatCount(n) {
  if (n >= 10000) return `${(n / 10000).toFixed(1)} 万`
  return String(n)
}

function estimateChapters(text) {
  const hits = text.match(/第[0-9一二三四五六七八九十百千零两]+[章节回卷篇]|\bChapter\s+\d+/gi)
  return hits ? hits.length : 0
}

function UploadModal({ onClose, onCreated }) {
  const navigate = useNavigate()
  const { uploadNovel } = useNovelStore()
  const [mode, setMode] = useState('file') // file | paste
  const [file, setFile] = useState(null)
  const [pasteText, setPasteText] = useState('')
  const [title, setTitle] = useState('')
  const [styleId, setStyleId] = useState('auto')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)
  const [created, setCreated] = useState(null)
  const [dragging, setDragging] = useState(false)
  const fileInputRef = useRef(null)

  const contentText = mode === 'paste' ? pasteText : ''
  const charCount = contentText.replace(/\s/g, '').length
  const chapterGuess = useMemo(() => estimateChapters(contentText), [contentText])

  const pickFile = (selected) => {
    if (!selected) return
    if (!ACCEPT.test(selected.name)) {
      setError('只支持 .txt / .md 文本文件')
      return
    }
    if (selected.size > MAX_BYTES) {
      setError('文件大小不能超过 10MB')
      return
    }
    setFile(selected)
    setError(null)
    setTitle(selected.name.replace(/\.[^.]+$/, ''))
  }

  const onDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    const selected = e.dataTransfer.files?.[0]
    if (selected) {
      setMode('file')
      pickFile(selected)
    }
  }

  const handleUpload = async () => {
    setError(null)
    if (mode === 'file' && !file) {
      setError('请选择文件')
      return
    }
    if (mode === 'paste' && !pasteText.trim()) {
      setError('请粘贴小说正文')
      return
    }

    setUploading(true)
    try {
      const novel =
        mode === 'file'
          ? await uploadNovel({ file, title: title.trim() })
          : await uploadNovel({ text: pasteText, title: title.trim() })

      try {
        localStorage.setItem('maneko_default_style', styleId)
      } catch {
        /* ignore */
      }

      setCreated(novel)
      onCreated?.(novel)
    } catch (err) {
      setError(err.response?.data?.detail || err.message || '上传失败，请检查后端是否已连接')
    } finally {
      setUploading(false)
    }
  }

  const goRead = () => {
    if (!created) return
    navigate(`/novel/${created.id}`)
    onClose()
  }

  const goComics = () => {
    if (!created) return
    navigate(`/comics/${created.id}`)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 bg-[#05020c]/85 flex items-center justify-center z-50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !uploading) onClose()
      }}
    >
      <div className="w-full max-w-lg bg-[#0a0a1a]/95 backdrop-blur-md border-2 border-[#ff1493]/45 rounded-sm p-6 shadow-[0_0_30px_rgba(255,20,147,0.5)] max-h-[90vh] overflow-y-auto">
        {created ? (
          <div className="text-center py-4">
            <div className="text-4xl mb-3">✓</div>
            <h2 className="font-bold text-2xl text-[#00f0ff] [text-shadow:0_0_10px_rgba(0,240,255,0.55)] mb-2">
              已收入書庫
            </h2>
            <p className="text-white font-semibold text-lg mb-1">{created.title}</p>
            <p className="text-gray-400 text-sm mb-6">AI 正在智能分章，稍后可生成分镜漫画</p>
            <div className="flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={goRead}
                className="px-6 py-3 font-bold uppercase tracking-wider text-xs rounded-sm text-[#ff1493] border-2 border-[#ff1493] hover:shadow-[0_0_25px_rgba(255,20,147,0.45)]"
              >
                去阅读
              </button>
              <button
                type="button"
                onClick={goComics}
                className="px-6 py-3 font-bold uppercase tracking-wider text-xs rounded-sm text-[#00f0ff] border border-[#00f0ff]/50 hover:shadow-[0_0_20px_rgba(0,240,255,0.35)]"
              >
                漫画集
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-3 font-bold uppercase tracking-wider text-xs rounded-sm text-gray-400 border border-gray-500/40"
              >
                继续添加
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-3 mb-1">
              <h2 className="font-bold text-2xl text-[#ff1493] [text-shadow:0_0_10px_rgba(255,20,147,0.6)]">
                新增项目
              </h2>
              <button
                type="button"
                onClick={onClose}
                disabled={uploading}
                className="text-gray-400 hover:text-[#00f0ff] text-xl leading-none px-2"
                aria-label="关闭"
              >
                ✕
              </button>
            </div>
            <p className="text-[#00f0ff] text-xs mb-4">把小说招成漫画 · ノベル → マンガ</p>

            {/* mode tabs */}
            <div className="flex gap-2 mb-4">
              <button
                type="button"
                onClick={() => setMode('file')}
                className={`px-4 py-2 text-[11px] font-bold uppercase tracking-wider rounded-sm border transition-all ${
                  mode === 'file'
                    ? 'text-[#0a0a1a] bg-[#ff1493] border-[#ff1493] shadow-[0_0_12px_rgba(255,20,147,0.5)]'
                    : 'text-gray-300 border-[#00f0ff]/25 hover:border-[#00f0ff] hover:text-[#00f0ff]'
                }`}
              >
                上传文件
              </button>
              <button
                type="button"
                onClick={() => setMode('paste')}
                className={`px-4 py-2 text-[11px] font-bold uppercase tracking-wider rounded-sm border transition-all ${
                  mode === 'paste'
                    ? 'text-[#0a0a1a] bg-[#ff1493] border-[#ff1493] shadow-[0_0_12px_rgba(255,20,147,0.5)]'
                    : 'text-gray-300 border-[#00f0ff]/25 hover:border-[#00f0ff] hover:text-[#00f0ff]'
                }`}
              >
                粘贴正文
              </button>
            </div>

            {mode === 'file' ? (
              <div
                onDragOver={(e) => {
                  e.preventDefault()
                  setDragging(true)
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`block border-2 border-dashed rounded-sm p-8 text-center cursor-pointer transition-all duration-300 ${
                  dragging
                    ? 'border-[#ff1493] shadow-[0_0_25px_rgba(255,20,147,0.4)] text-[#ff1493]'
                    : 'border-[#00f0ff]/40 text-gray-400 hover:border-[#00f0ff] hover:shadow-[0_0_20px_rgba(0,240,255,0.25)] hover:text-[#00f0ff]'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt,.md,.markdown"
                  onChange={(e) => pickFile(e.target.files?.[0])}
                  className="hidden"
                />
                {file ? (
                  <div className="text-sm">
                    <div className="font-semibold text-white">{file.name}</div>
                    <div className="text-xs text-gray-400 mt-1">
                      {(file.size / 1024).toFixed(1)} KB · 可拖入替换
                    </div>
                  </div>
                ) : (
                  <div className="text-sm">
                    <div className="text-2xl mb-2">📄</div>
                    点击选择，或把 .txt / .md 拖到这里
                    <div className="text-xs text-gray-500 mt-2">UTF-8 / GBK · 最大 10MB</div>
                  </div>
                )}
              </div>
            ) : (
              <div>
                <textarea
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  placeholder="把小说正文粘贴到这里…"
                  rows={8}
                  className="w-full bg-[#12041e]/80 border border-[#00f0ff]/30 rounded-sm p-3 text-sm text-white focus:border-[#ff1493] focus:outline-none resize-y"
                />
                <div className="flex justify-between text-[11px] text-gray-500 mt-1">
                  <span>有效字数 {formatCount(charCount)}</span>
                  <span>疑似章节 {chapterGuess || '—'}</span>
                </div>
              </div>
            )}

            <label className="block mt-4">
              <span className="text-[11px] font-bold uppercase tracking-widest text-[#00f0ff]">标题</span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="留空则用文件名"
                maxLength={80}
                className="mt-1 w-full bg-[#12041e]/80 border border-[#ff1493]/30 rounded-sm px-3 py-2 text-sm text-white focus:border-[#ff1493] focus:shadow-[0_0_12px_rgba(255,20,147,0.3)] focus:outline-none"
              />
            </label>

            <div className="mt-4">
              <StylePicker value={styleId} onChange={setStyleId} />
            </div>

            {error && (
              <p className="text-[#ff1493] text-sm mt-3 border border-[#ff1493]/40 rounded-sm px-3 py-2 bg-[#ff1493]/10">
                {error}
              </p>
            )}

            <div className="flex justify-end gap-3 mt-5">
              <button
                type="button"
                onClick={onClose}
                disabled={uploading}
                className="px-6 py-3 font-bold uppercase tracking-wider text-xs rounded-sm text-[#00f0ff] border border-[#00f0ff]/50 transition-all duration-300 disabled:opacity-40"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleUpload}
                disabled={uploading || (mode === 'file' && !file) || (mode === 'paste' && !pasteText.trim())}
                className="px-6 py-3 font-bold uppercase tracking-wider text-xs rounded-sm bg-transparent text-[#ff1493] border-2 border-[#ff1493] transition-all duration-300 hover:shadow-[0_0_30px_rgba(255,20,147,0.5)] active:scale-95 disabled:opacity-40"
              >
                {uploading ? '分章中…' : '加入書庫'}
              </button>
            </div>
            <p className="text-[10px] text-gray-500 mt-3 text-center">
              上传后自动 AI 分章 · 无 Key 时本地规则回退
            </p>
          </>
        )}
      </div>
    </div>
  )
}

export default UploadModal
