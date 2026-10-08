import { useEffect, useState } from 'react'
import { comicApi } from '../api/client'

const FALLBACK_STYLES = [
  { id: 'auto', label: '自动适配', description: '根据内容关键词匹配' },
  { id: 'xianxia', label: '修仙', description: '仙山灵力古风' },
  { id: 'wuxia', label: '武侠', description: '江湖刀光剑影' },
  { id: 'scifi', label: '科幻', description: '星际机甲赛博' },
  { id: 'mystery', label: '悬疑', description: '黑雨线索明暗' },
  { id: 'horror', label: '恐怖', description: '暗部压迫惊悚' },
  { id: 'fantasy', label: '奇幻', description: '西幻魔法史诗' },
  { id: 'romance', label: '言情', description: '柔光情感特写' },
  { id: 'urban', label: '都市', description: '现代街景职场' },
  { id: 'history', label: '历史', description: '古风朝堂市井' },
  { id: 'daily', label: '日常', description: '治愈校园生活' },
  { id: 'sports', label: '热血', description: '速度线爆发力' },
  { id: 'neon-tokyo', label: '霓虹东京', description: '雨夜霓虹都市' },
]

function StylePicker({ value, onChange, onDetect, detectLoading }) {
  const [styles, setStyles] = useState(FALLBACK_STYLES)

  useEffect(() => {
    let cancelled = false
    comicApi.getStyles()
      .then((data) => {
        if (!cancelled && Array.isArray(data?.styles) && data.styles.length) {
          setStyles(data.styles)
        }
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between gap-2 mb-2">
        <label className="text-[11px] font-bold uppercase tracking-widest text-[var(--color-accent)]">
          漫画风格 · ジャンル
        </label>
        {onDetect && (
          <button
            type="button"
            onClick={onDetect}
            disabled={detectLoading}
            className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-sm text-[var(--color-warning)] border border-[var(--color-warning)] transition-all duration-300 hover:shadow-sm disabled:opacity-40"
          >
            {detectLoading ? '识别中…' : '智能识别'}
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-2" role="listbox" aria-label="漫画风格">
        {styles.map((s) => {
          const active = value === s.id
          return (
            <button
              key={s.id}
              type="button"
              role="option"
              aria-selected={active}
              title={s.description}
              onClick={() => onChange?.(s.id)}
              className={`px-3 py-1.5 text-[11px] font-bold rounded-sm transition-all duration-300 border ${
                active
                  ? 'bg-[var(--color-primary)] text-[var(--color-on-primary)] border-[var(--color-primary)] shadow-sm'
                  : 'text-[var(--color-text)] border-[var(--color-accent)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]'
              }`}
            >
              {s.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default StylePicker
