import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import HomePage from './pages/HomePage'
import NovelPage from './pages/NovelPage'
import ComicCollectionPage from './pages/ComicCollectionPage'
import LibraryPage from './pages/LibraryPage'
import Header from './components/Header'

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gradient-to-b from-[#0a0a1a] to-[#12041e] text-white">
        <Header />
        <main className="max-w-6xl mx-auto px-4 md:px-8 py-6 md:py-10">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/library" element={<LibraryPage />} />
            <Route path="/novel/:id" element={<NovelPage />} />
            <Route path="/comics/:id" element={<ComicCollectionPage />} />
          </Routes>
        </main>
        <footer className="border-t border-[#ff1493]/25 py-6 text-center text-xs text-gray-400">
          <span className="text-[#bc13fe]">ネオン東京</span> · AI 小说漫画生成器
        </footer>
      </div>
    </Router>
  )
}

export default App
