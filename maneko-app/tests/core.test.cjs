const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const vm = require('node:vm')

const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'core.js'), 'utf8')

function loadManeko({ config = {}, fetchImpl } = {}) {
  const values = new Map()
  const localStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  }
  const window = { MANEKO_CONFIG: config, localStorage }
  vm.runInNewContext(source, {
    window,
    localStorage,
    URLSearchParams,
    FormData,
    Blob,
    fetch: fetchImpl || (async () => ({ ok: true, status: 200, json: async () => ({}) })),
    Date,
    Math,
  })
  return window.Maneko
}

test('production API config starts in live mode without seeded demo data', () => {
  const app = loadManeko({ config: { apiBase: 'https://api.example.test' } })
  app.store.init()

  assert.equal(app.api.base(), 'https://api.example.test')
  assert.equal(app.store.state.demo, false)
  assert.deepEqual(Array.from(app.store.state.novels), [])
})

test('missing API config stays disconnected instead of silently entering demo mode', () => {
  const app = loadManeko()
  app.store.init()

  assert.equal(app.store.state.demo, false)
  assert.equal(app.store.state.apiBase, '')
})

test('mobile library API searches sources and persists book changes', async () => {
  const requests = []
  const app = loadManeko({
    config: { apiBase: 'https://api.example.test' },
    fetchImpl: async (url, options = {}) => {
      requests.push({ url, options })
      return { ok: true, status: 200, json: async () => ({ books: [] }) }
    },
  })
  app.store.init()

  await app.api.searchSource('gutenberg', 'sherlock', 12)
  await app.api.updateBook('novel-1', { favorite: true, progress: 0.5 })

  assert.match(requests[0].url, /\/api\/library\/sources\/gutenberg\/search\?q=sherlock&limit=12$/)
  assert.equal(requests[1].url, 'https://api.example.test/api/library/books/novel-1')
  assert.equal(requests[1].options.method, 'PATCH')
  assert.deepEqual(JSON.parse(requests[1].options.body), { favorite: true, progress: 0.5 })
})

test('mobile comic export requests the real chapter archive', async () => {
  const archive = new Blob(['zip-bytes'], { type: 'application/zip' })
  const requests = []
  const app = loadManeko({
    config: { apiBase: 'https://api.example.test' },
    fetchImpl: async (url) => {
      requests.push(url)
      return { ok: true, status: 200, blob: async () => archive }
    },
  })
  app.store.init()

  const result = await app.api.exportComic('chapter/one')

  assert.equal(result, archive)
  assert.equal(requests[0], 'https://api.example.test/api/comics/chapter%2Fone/export')
})
