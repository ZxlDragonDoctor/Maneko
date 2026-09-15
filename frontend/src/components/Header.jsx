import { Link } from 'react-router-dom'

function Header() {
  return (
    <header className="sticky top-0 z-50 bg-[#0a0a1a]/95 backdrop-blur-md border-b-2 border-[#ff1493]/30 shadow-[0_0_15px_rgba(255,20,147,0.3)]">
      <div className="max-w-6xl mx-auto px-4 md:px-8 py-3 flex items-center justify-between gap-6">
        <Link to="/" className="flex items-center gap-2.5 font-bold text-xl md:text-2xl text-[#ff1493] [text-shadow:0_0_10px_rgba(255,20,147,0.6)] [animation:neonFlicker_6s_linear_infinite]">
          <img
            src="/mascot-neko.png"
            alt="猫娘看板娘"
            width={36}
            height={36}
            className="w-9 h-9 rounded-full border-2 border-[#ff1493]/70 shadow-[0_0_12px_rgba(255,20,147,0.5)] object-cover object-top bg-[#12041e]"
          />
          <span className="leading-tight">
            Maneko
            <span className="block text-[#00f0ff] text-[10px] font-semibold [text-shadow:0_0_10px_rgba(0,240,255,0.55)]">漫猫 · ノベル漫画 · ねこ</span>
          </span>
        </Link>
        <nav className="flex items-center gap-3 md:gap-5 text-xs font-bold uppercase tracking-wider">
          <Link
            to="/"
            className="text-gray-400 hover:text-[#ff1493] hover:[text-shadow:0_0_10px_rgba(255,20,147,0.6)] transition-all duration-300 border-b border-transparent hover:border-[#ff1493] pb-0.5"
          >
            首页
          </Link>
          <Link
            to="/library"
            className="px-3 py-1.5 rounded-sm text-[#00f0ff] border border-[#00f0ff]/45 transition-all duration-300 hover:shadow-[0_0_18px_rgba(0,240,255,0.4)] hover:border-[#00f0ff]"
          >
            書庫
          </Link>
          <Link
            to="/library?tab=sources"
            className="px-3 py-1.5 rounded-sm text-[#ff6b00] border border-[#ff6b00]/45 transition-all duration-300 hover:shadow-[0_0_18px_rgba(255,107,0,0.4)] hover:border-[#ff6b00]"
          >
            书源
          </Link>
        </nav>
      </div>
    </header>
  )
}

export default Header
