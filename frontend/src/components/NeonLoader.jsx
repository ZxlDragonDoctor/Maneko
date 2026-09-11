import '../styles/neon-loader.css'

const MASCOT = '/mascot-neko.png'

export function NeonLoader({ text = '加载中', showBar = true }) {
  return (
    <div className="neon-loader" role="status" aria-live="polite">
      <img className="neon-loader__neko" src={MASCOT} alt="" width={72} height={72} />
      <div className="neon-loader__text">{text}<span>…</span></div>
      {showBar && <div className="neon-loader__bar" aria-hidden="true" />}
    </div>
  )
}

export function NeonSkeleton({ count = 3 }) {
  return (
    <div className="neon-skeleton" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="neon-skeleton__card">
          <div className="neon-skeleton__line w40" />
          <div className="neon-skeleton__line w90" />
          <div className="neon-skeleton__line w60" />
        </div>
      ))}
    </div>
  )
}

export default NeonLoader
