import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import HomePage from './pages/HomePage'
import NovelPage from './pages/NovelPage'
import ComicCollectionPage from './pages/ComicCollectionPage'
import LibraryPage from './pages/LibraryPage'
import PrivacyPage from './pages/PrivacyPage'
import Header from './components/Header'

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gradient-to-b from-[var(--color-page)] to-[var(--color-surface-alt)] text-[var(--color-text)]">
        <Header />
        <main className="max-w-6xl mx-auto px-4 md:px-8 py-6 md:py-10">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/library" element={<LibraryPage />} />
            <Route path="/novel/:id" element={<NovelPage />} />
            <Route path="/comics/:id" element={<ComicCollectionPage />} />
            <Route path="/privacy" element={<PrivacyPage />} />
          </Routes>
        </main>
        <footer className="border-t border-[var(--color-primary)] py-8 text-center text-xs text-[var(--color-muted)] space-y-2">
          <div>
            <span className="text-[var(--color-primary)]">Maneko · 漫猫</span>
            {' · '}
            <span className="text-[var(--color-accent)]">小说 · 漫画 · 阅读</span>
            {' · '}
            AI 小说 → 日漫分镜
          </div>
          <div className="flex items-center justify-center gap-4">
            <a className="text-[var(--color-accent)] hover:underline" href="/maneko-app/">移动端</a>
            <a className="text-[var(--color-accent)] hover:underline" href="/privacy">隐私说明</a>
            <a className="text-[var(--color-accent)] hover:underline" href="https://github.com/ZxlDragonDoctor/Maneko" target="_blank" rel="noreferrer">GitHub</a>
            <span>MIT License</span>
          </div>
        </footer>
      </div>
    </Router>
  )
}

export default App
