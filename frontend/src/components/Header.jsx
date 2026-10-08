import { Link } from 'react-router-dom'

function Header() {
  return (
    <header className="sticky top-0 z-50 bg-[var(--color-surface)]/95 backdrop-blur-md border-b-2 border-[var(--color-primary)] shadow-sm">
      <div className="max-w-6xl mx-auto px-4 md:px-8 py-3 flex items-center justify-between gap-6">
        <Link to="/" className="flex items-center gap-2.5 font-bold text-xl md:text-2xl text-[var(--color-primary)]  ">
          <img
            src="/mascot-neko.png"
            alt="猫娘看板娘"
            width={36}
            height={36}
            className="w-9 h-9 rounded-full border-2 border-[var(--color-primary)] shadow-sm object-cover object-top bg-[var(--color-surface-alt)]"
          />
          <span className="leading-tight">
            Maneko
            <span className="block text-[var(--color-accent)] text-[10px] font-semibold  ">漫猫 · ノベル漫画 · ねこ</span>
          </span>
        </Link>
        <nav className="flex items-center gap-3 md:gap-5 text-xs font-bold uppercase tracking-wider">
          <Link
            to="/"
            className="text-[var(--color-muted)] hover:text-[var(--color-primary)] transition-colors duration-200 border-b border-transparent hover:border-[var(--color-primary)] pb-0.5"
          >
            首页
          </Link>
          <Link
            to="/library"
            className="px-3 py-1.5 rounded-sm text-[var(--color-accent)] border border-[var(--color-accent)] transition-all duration-300 hover:shadow-sm hover:border-[var(--color-accent)]"
          >
            書庫
          </Link>
          <Link
            to="/library?tab=sources"
            className="px-3 py-1.5 rounded-sm text-[var(--color-warning)] border border-[var(--color-warning)] transition-all duration-300 hover:shadow-sm hover:border-[var(--color-warning)]"
          >
            书源
          </Link>
        </nav>
      </div>
    </header>
  )
}

export default Header
