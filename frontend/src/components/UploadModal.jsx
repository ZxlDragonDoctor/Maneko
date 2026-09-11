import { useState } from 'react'
import useNovelStore from '../stores/novelStore'

function UploadModal({ onClose }) {
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)
  const { uploadNovel } = useNovelStore()

  const handleFileChange = (e) => {
    const selected = e.target.files[0]
    if (selected) {
      if (!/\.(txt|md|markdown)$/i.test(selected.name)) {
        setError('只支持 .txt / .md 文本文件')
        return
      }
      if (selected.size > 10 * 1024 * 1024) {
        setError('文件大小不能超过10MB')
        return
      }
      setFile(selected)
      setError(null)
    }
  }

  const handleUpload = async () => {
    if (!file) {
      setError('请选择文件')
      return
    }
    setUploading(true)
    setError(null)
    try {
      await uploadNovel(file)
      onClose()
    } catch (err) {
      setError(err.response?.data?.detail || err.message || '上传失败')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-[#05020c]/80 flex items-center justify-center z-50 p-4">
      <div className="w-full max-w-md bg-[#0a0a1a]/95 backdrop-blur-md border-2 border-[#ff1493]/45 rounded-sm p-6 shadow-[0_0_30px_rgba(255,20,147,0.5)]">
        <h2 className="font-bold text-2xl text-[#ff1493] [text-shadow:0_0_10px_rgba(255,20,147,0.6)] mb-1">上传小说</h2>
        <p className="text-[#00f0ff] text-xs mb-4">アップロード · .txt / .md</p>

        <label className="block border-2 border-dashed border-[#00f0ff]/40 rounded-sm p-8 text-center text-gray-400 cursor-pointer transition-all duration-300 hover:border-[#00f0ff] hover:shadow-[0_0_20px_rgba(0,240,255,0.25)] hover:text-[#00f0ff]">
          <input type="file" accept=".txt,.md,.markdown" onChange={handleFileChange} className="hidden" />
          {file ? (
            <span className="text-sm font-semibold">
              {file.name} · {(file.size / 1024).toFixed(1)} KB
            </span>
          ) : (
            <span className="text-sm">点击选择 .txt / .md · 最大 10MB</span>
          )}
        </label>

        {error && <p className="text-[#ff1493] text-sm mt-3">{error}</p>}

        <div className="flex justify-end gap-3 mt-5">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-3 font-bold uppercase tracking-wider text-xs rounded-sm text-[#00f0ff] border border-[#00f0ff]/50 transition-all duration-300"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleUpload}
            disabled={!file || uploading}
            className="px-6 py-3 font-bold uppercase tracking-wider text-xs rounded-sm bg-transparent text-[#ff1493] border-2 border-[#ff1493] transition-all duration-300 hover:shadow-[0_0_30px_rgba(255,20,147,0.5)] active:scale-95 disabled:opacity-40"
          >
            {uploading ? '上传中…' : '上传'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default UploadModal
