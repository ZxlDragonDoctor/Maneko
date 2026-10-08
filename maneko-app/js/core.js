/* Maneko core: config, store, api, demo data */
(function (global) {
  'use strict';

  const KEYS = {
    onboard: 'maneko_onboard_v1',
    demo: 'maneko_demo_v1',
    api: 'maneko_api_v1',
    novels: 'maneko_novels_v1',
    progress: 'maneko_progress_v1',
    favorites: 'maneko_favorites_v1',
    prefs: 'maneko_prefs_v1',
  };

  /** Build scripts inject production service configuration in js/config.js. */
  const RUNTIME_CONFIG = global.MANEKO_CONFIG || {};
  const PROD_API = RUNTIME_CONFIG.apiBase || '';
  const DEMO_ALLOWED = RUNTIME_CONFIG.allowDemo === true;

  const DEFAULT_PREFS = {
    fontScale: 1,
    readerLine: 'normal',
    defaultStyle: 'auto',
  };

  const DEMO_STYLES = [
    { id: 'auto', label: '自动适配', description: '按章节关键词匹配题材' },
    { id: 'xianxia', label: '修仙', description: '仙山云海 · 御剑灵气' },
    { id: 'wuxia', label: '武侠', description: '江湖刀剑 · 水墨意境' },
    { id: 'scifi', label: '科幻', description: '星舰机甲 · 赛博都市' },
    { id: 'mystery', label: '悬疑', description: '雨夜侦探 · 强对比' },
    { id: 'neon-tokyo', label: '霓虹东京', description: '深夜街景 · 粉青霓虹' },
    { id: 'romance', label: '言情', description: '柔光花瓣 · 情感特写' },
    { id: 'fantasy', label: '奇幻', description: '魔法符文 · 异世界' },
    { id: 'horror', label: '恐怖', description: '压迫暗部 · 心理惊悚' },
    { id: 'daily', label: '日常', description: '治愈柔光 · 小确幸' },
  ];

  function uid(prefix) {
    return (prefix || 'id') + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
  }

  function loadJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch (_) {
      return fallback;
    }
  }

  function saveJSON(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function seedDemoNovels() {
    return [
      {
        id: 'demo-1',
        title: '霓虹雨夜的修士',
        author: '漫猫演示',
        source: 'demo',
        tags: ['修仙', '霓虹东京'],
        summary: '雨夜街头，少年遇见从宗门逃出的少女。她掌心微光未散，巷口脚步声已近。',
        favorite: true,
        createdAt: Date.now() - 86400000 * 2,
      },
      {
        id: 'demo-2',
        title: '星舰上的最后一封信',
        author: '漫猫演示',
        source: 'demo',
        tags: ['科幻'],
        summary: '跃迁窗口只剩三分钟。舰长把未寄出的信锁进保险柜，对全员广播：准备硬着陆。',
        favorite: false,
        createdAt: Date.now() - 86400000,
      },
      {
        id: 'demo-3',
        title: '竹林客栈',
        author: '漫猫演示',
        source: 'demo',
        tags: ['武侠'],
        summary: '竹影摇窗，酒旗半卷。黑衣客推门而入，刀未出鞘，杀气已满堂。',
        favorite: false,
        createdAt: Date.now() - 3600000,
      },
      {
        id: 'demo-4',
        title: '密室与第二把钥匙',
        author: '漫猫演示',
        source: 'demo',
        tags: ['悬疑'],
        summary: '死者反锁在书房，窗台却有泥。侦探说：凶手一定有第二把钥匙。',
        favorite: false,
        createdAt: Date.now() - 7200000,
      },
    ];
  }

  function seedDemoChapters(novelId) {
    const packs = {
      'demo-1': [
        {
          id: 'demo-1-c1', number: 1, title: '第一章 初遇',
          content: '雨点砸在柏油路上，霓虹倒影被车轮碾碎。\n\n少年把伞倾向那个浑身湿透的少女：“你从哪里来？”\n\n少女抬眼，掌心微光一闪：“宗门。”\n\n巷口传来脚步声，她抓住他的手腕：“带我走。”\n\n——那一刻，整条街的霓虹都像为他们闪烁。',
          comicStatus: 'completed',
        },
        {
          id: 'demo-1-c2', number: 2, title: '第二章 启程',
          content: '穿过潮湿的巷子，远处高楼像倒插的剑。\n\n少女低声说：“他们不会放过我。”\n\n少年把外套披在她肩上：“那就一起躲。”\n\n雨水顺着伞骨滑落，像无数细小的流星。',
          comicStatus: 'pending',
        },
        {
          id: 'demo-1-c3', number: 3, title: '第三章 灵气',
          content: '她在便利店的灯光下摊开掌心，淡青色的光纹缓缓游走。\n\n“这是筑基之后才有的灵纹。”\n\n少年看得出神，忘记了手里还握着关东煮。',
          comicStatus: 'pending',
        },
      ],
      'demo-2': [
        {
          id: 'demo-2-c1', number: 1, title: '第一章 跃迁失败',
          content: '警报撕裂舰桥。跃迁窗口在三分钟后关闭。\n\n舰长把未寄出的信放进保险柜，对全员广播：“准备硬着陆。”\n\n舷窗外，未知行星的云带正缓缓展开，像一封被拆开的信。',
          comicStatus: 'pending',
        },
      ],
      'demo-3': [
        {
          id: 'demo-3-c1', number: 1, title: '第一回 客栈',
          content: '竹影摇窗，酒旗半卷。\n\n黑衣客推门而入，刀未出鞘，杀气已满堂。\n\n掌柜擦着杯子，眼皮都没抬：“客官，打尖还是住店？”',
          comicStatus: 'pending',
        },
      ],
      'demo-4': [
        {
          id: 'demo-4-c1', number: 1, title: '第1章 反锁的书房',
          content: '书房从内反锁。窗台有泥，地毯却干干净净。\n\n侦探蹲下身：“密室可以伪造，习惯不行。”\n\n壁炉里，半张烧焦的信纸仍在冒烟。',
          comicStatus: 'pending',
        },
      ],
    };
    return packs[novelId] || [{
      id: novelId + '-c1', number: 1, title: '第一章',
      content: '（空章节）', comicStatus: 'pending',
    }];
  }

  const store = {
    _s: {
      ready: false,
      onboarded: false,
      demo: false,
      apiBase: '',
      tab: 'home',
      route: { name: 'home', params: {} },
      novels: [],
      chaptersByNovel: {},
      comicByChapter: {},
      sources: [],
      categories: [],
      sourceBooks: [],
      sourceLoading: false,
      sourceError: null,
      selectedSource: 'all',
      sourceQuery: '',
      styles: DEMO_STYLES.slice(),
      prefs: Object.assign({}, DEFAULT_PREFS),
      favorites: {},
      progress: {},
      loading: false,
      error: null,
      filterTag: '全部',
      search: '',
      generating: {},
      pollTimers: {},
    },

    get state() { return this._s; },

    init() {
      const onboarded = localStorage.getItem(KEYS.onboard) === '1';
      const savedApi = localStorage.getItem(KEYS.api) || '';
      const apiBase = RUNTIME_CONFIG.lockApiBase
        ? PROD_API
        : (savedApi || PROD_API);
      const demoFlag = localStorage.getItem(KEYS.demo);
      const demo = DEMO_ALLOWED && demoFlag === '1';
      this._s.onboarded = onboarded;
      this._s.apiBase = apiBase;
      this._s.demo = demo;
      this._s.prefs = Object.assign({}, DEFAULT_PREFS, loadJSON(KEYS.prefs, {}));
      this._s.favorites = loadJSON(KEYS.favorites, {});
      this._s.progress = loadJSON(KEYS.progress, {});
      this._s.ready = true;
      return this;
    },

    completeOnboard() {
      localStorage.setItem(KEYS.onboard, '1');
      this._s.onboarded = true;
    },

    setPrefs(patch) {
      this._s.prefs = Object.assign({}, this._s.prefs, patch);
      saveJSON(KEYS.prefs, this._s.prefs);
    },

    setDemo(on, apiBase) {
      if (on && !DEMO_ALLOWED) return false;
      if (RUNTIME_CONFIG.lockApiBase && typeof apiBase === 'string' && apiBase.replace(/\/$/, '') !== PROD_API) {
        return false;
      }
      if (typeof apiBase === 'string') {
        this._s.apiBase = apiBase.replace(/\/$/, '');
        if (this._s.apiBase) localStorage.setItem(KEYS.api, this._s.apiBase);
        else localStorage.removeItem(KEYS.api);
      }
      this._s.demo = !!on;
      localStorage.setItem(KEYS.demo, this._s.demo ? '1' : '0');
      return true;
    },

    toggleFavorite(novelId) {
      const next = !this._s.favorites[novelId];
      if (next) this._s.favorites[novelId] = true;
      else delete this._s.favorites[novelId];
      saveJSON(KEYS.favorites, this._s.favorites);
      return next;
    },

    setProgress(novelId, ratio) {
      this._s.progress[novelId] = Math.max(0, Math.min(1, ratio));
      saveJSON(KEYS.progress, this._s.progress);
    },

    getProgress(novelId) {
      return this._s.progress[novelId] || 0;
    },

    persistNovels() {
      if (!this._s.demo) return;
      saveJSON(KEYS.novels, this._s.novels);
      saveJSON('maneko_chapters_v1', this._s.chaptersByNovel);
    },

    loadLocalNovels() {
      const saved = loadJSON(KEYS.novels, null);
      const chapters = loadJSON('maneko_chapters_v1', null);
      if (saved && saved.length) {
        this._s.novels = saved;
        this._s.chaptersByNovel = chapters || {};
      } else {
        this._s.novels = seedDemoNovels();
        this._s.chaptersByNovel = {};
        seedDemoNovels().forEach((n) => {
          this._s.chaptersByNovel[n.id] = seedDemoChapters(n.id);
        });
        this.persistNovels();
      }
    },

    addDemoNovel(novel, chapters) {
      this._s.novels.unshift(novel);
      this._s.chaptersByNovel[novel.id] = chapters;
      this.persistNovels();
    },

    removeNovel(id) {
      this._s.novels = this._s.novels.filter((n) => n.id !== id);
      delete this._s.chaptersByNovel[id];
      Object.keys(this._s.comicByChapter).forEach((cid) => {
        if (cid.indexOf(id) === 0) delete this._s.comicByChapter[cid];
      });
      delete this._s.favorites[id];
      delete this._s.progress[id];
      saveJSON(KEYS.favorites, this._s.favorites);
      saveJSON(KEYS.progress, this._s.progress);
      this.persistNovels();
    },

    setComic(chapterId, comic) {
      this._s.comicByChapter[chapterId] = comic;
    },

    ensureDemoComic(chapterId) {
      const existing = this._s.comicByChapter[chapterId];
      if (existing && existing.status) return existing;
      // find chapter status from demo data
      let status = 'pending';
      Object.keys(this._s.chaptersByNovel).forEach((nid) => {
        (this._s.chaptersByNovel[nid] || []).forEach((c) => {
          if (c.id === chapterId) status = c.comicStatus || 'pending';
        });
      });
      const comic = {
        status,
        images: status === 'completed' ? [1, 2, 3, 4] : [],
        styleId: 'neon-tokyo',
      };
      this._s.comicByChapter[chapterId] = comic;
      return comic;
    },

    markChapterComic(chapterId, status) {
      Object.keys(this._s.chaptersByNovel).forEach((nid) => {
        this._s.chaptersByNovel[nid] = (this._s.chaptersByNovel[nid] || []).map((c) =>
          c.id === chapterId ? Object.assign({}, c, { comicStatus: status }) : c
        );
      });
      this.persistNovels();
    },
  };

  const api = {
    base() {
      return (store.state.apiBase || '').replace(/\/$/, '');
    },

    async request(path, options) {
      if (store.state.demo) throw new Error('当前处于本地预览模式，请切换到服务端模式后使用此功能');
      if (!this.base()) throw new Error('尚未配置 Maneko 服务地址，请先在「我的」中设置并测试连接');
      const opts = options || {};
      const headers = Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {});
      const res = await fetch(this.base() + path, Object.assign({}, opts, { headers }));
      if (!res.ok) {
        let detail = '';
        try {
          const j = await res.json();
          const dependencyMessages = {
            database: '数据库暂不可用',
            chapter_model_configuration: '服务端尚未配置小说分章模型',
            production_image_provider: '服务端仍使用模拟出图，无法生成真实漫画',
            image_provider_credentials: '服务端未配置图像生成凭据',
            image_provider_configuration: '服务端图像提供方配置不受支持',
          };
          detail = j.detail || j.message || dependencyMessages[j.dependency] || '';
        } catch (_) {
          try { detail = await res.text(); } catch (_) { /* keep status fallback */ }
        }
        if (res.status === 413) detail = detail || '内容超过服务端允许的大小，请缩短后重试';
        const err = new Error(typeof detail === 'string' && detail ? detail : `服务请求失败（${res.status}）`);
        err.status = res.status;
        throw err;
      }
      if (res.status === 204) return null;
      return res.json();
    },

    health() { return this.request('/ready'); },

    listNovels() { return this.request('/api/novels/'); },
    getNovel(id) { return this.request('/api/novels/' + id); },
    deleteNovel(id) {
      return this.request('/api/novels/' + encodeURIComponent(id), { method: 'DELETE' });
    },
    chapters(novelId) { return this.request('/api/novels/' + encodeURIComponent(novelId) + '/chapters'); },
    chapter(id) { return this.request('/api/chapters/' + encodeURIComponent(id)); },

    styles() { return this.request('/api/comics/styles'); },
    sources() { return this.request('/api/library/sources'); },
    searchSource(sourceId, query, limit = 12) {
      const params = new URLSearchParams({ q: query || '', limit: String(limit) });
      return this.request(`/api/library/sources/${encodeURIComponent(sourceId)}/search?${params}`);
    },
    searchAll(query, limit = 16) {
      const params = new URLSearchParams({ q: query || '', limit: String(limit) });
      return this.request(`/api/library/search?${params}`);
    },
    listBooks(params = {}) {
      const query = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') query.set(key, String(value));
      });
      return this.request('/api/library/books' + (query.size ? `?${query}` : ''));
    },
    categories() { return this.request('/api/library/categories'); },
    createCategory(name, color) {
      return this.request('/api/library/categories', {
        method: 'POST', body: JSON.stringify({ name, color }),
      });
    },
    updateCategory(id, patch) {
      return this.request(`/api/library/categories/${encodeURIComponent(id)}`, {
        method: 'PATCH', body: JSON.stringify(patch),
      });
    },
    deleteCategory(id) {
      return this.request(`/api/library/categories/${encodeURIComponent(id)}`, { method: 'DELETE' });
    },
    updateBook(id, patch) {
      return this.request(`/api/library/books/${encodeURIComponent(id)}`, {
        method: 'PATCH', body: JSON.stringify(patch),
      });
    },
    importUrl(payload) {
      return this.request('/api/library/import/url', { method: 'POST', body: JSON.stringify(payload) });
    },
    importSearch(payload) {
      return this.request('/api/library/import/search', { method: 'POST', body: JSON.stringify(payload) });
    },
    detectStyle(params) {
      const q = new URLSearchParams();
      if (params.novelId) q.set('novel_id', params.novelId);
      if (params.chapterId) q.set('chapter_id', params.chapterId);
      return this.request('/api/comics/detect-style?' + q.toString(), { method: 'POST' });
    },
    generate(chapterId, styleId, force) {
      return this.request('/api/comics/generate', {
        method: 'POST',
        body: JSON.stringify({ chapter_id: chapterId, style_id: styleId || 'auto', force: !!force }),
      });
    },
    comicStatus(chapterId) { return this.request('/api/comics/' + chapterId + '/status'); },
    comicImages(chapterId) { return this.request('/api/comics/' + chapterId + '/images'); },
    async exportComic(chapterId) {
      if (store.state.demo) throw new Error('本地预览内容没有真实漫画图片可导出');
      if (!this.base()) throw new Error('尚未配置 Maneko 服务地址');
      const response = await fetch(this.base() + '/api/comics/' + encodeURIComponent(chapterId) + '/export');
      if (!response.ok) {
        let detail = '';
        try { const body = await response.json(); detail = body.detail || ''; } catch (_) { /* use status fallback */ }
        const error = new Error(detail || `分镜导出失败（${response.status}）`);
        error.status = response.status;
        throw error;
      }
      return response.blob();
    },

    async uploadText(title, text) {
      if (store.state.demo) throw new Error('本地预览内容不能上传到书架，请切换到服务端模式');
      if (!this.base()) throw new Error('尚未配置 Maneko 服务地址，请先在「我的」中设置并测试连接');
      const fd = new FormData();
      fd.append('file', new Blob([text], { type: 'text/plain' }), 'novel.txt');
      if (title) fd.append('title', title);
      const res = await fetch(this.base() + '/api/novels/upload', { method: 'POST', body: fd });
      if (!res.ok) {
        let message = `上传失败（${res.status}）`;
        try { message = (await res.json()).detail || message; } catch (_) { /* keep fallback */ }
        throw new Error(message);
      }
      return res.json();
    },

    async uploadFile(file, title) {
      if (store.state.demo) throw new Error('本地预览内容不能上传到书架，请切换到服务端模式');
      if (!this.base()) throw new Error('尚未配置 Maneko 服务地址，请先在「我的」中设置并测试连接');
      const fd = new FormData();
      fd.append('file', file, file.name);
      if (title) fd.append('title', title);
      const res = await fetch(this.base() + '/api/novels/upload', { method: 'POST', body: fd });
      if (!res.ok) {
        let message = `上传失败（${res.status}）`;
        try { message = (await res.json()).detail || message; } catch (_) { /* keep fallback */ }
        throw new Error(message);
      }
      return res.json();
    },
  };

  function panelUrl(chapterId, index, imagePath) {
    if (store.state.demo && DEMO_ALLOWED) return demoPanelUri(index);
    if (!api.base()) return '';
    if (typeof imagePath === 'string' && imagePath) {
      if (/^https?:\/\//i.test(imagePath)) return imagePath;
      return api.base() + (imagePath.startsWith('/') ? imagePath : `/${imagePath}`);
    }
    const n = String(index).padStart(2, '0');
    return api.base() + '/comics/' + chapterId + '/panel_' + n + '.png';
  }

  function demoPanelUri(index) {
    const hues = [330, 190, 280, 20, 160, 300, 40, 220, 350, 120];
    const h = hues[index % hues.length];
    const h2 = (h + 48) % 360;
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" width="480" height="480">' +
      '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0%" stop-color="hsl(' + h + ',90%,46%)"/>' +
      '<stop offset="100%" stop-color="hsl(' + h2 + ',85%,20%)"/>' +
      '</linearGradient></defs>' +
      '<rect width="480" height="480" fill="#0a0a1a"/>' +
      '<rect x="16" y="16" width="448" height="448" fill="url(#g)" opacity="0.9"/>' +
      '<rect x="40" y="40" width="400" height="280" fill="none" stroke="#00f0ff" stroke-width="3" opacity="0.75"/>' +
      '<rect x="40" y="40" width="400" height="280" fill="none" stroke="#ff1493" stroke-width="1" opacity="0.35"/>' +
      '<text x="240" y="200" text-anchor="middle" fill="#fff" font-size="30" font-family="sans-serif" font-weight="700">PANEL ' + index + '</text>' +
      '<text x="240" y="250" text-anchor="middle" fill="#ffd" font-size="14" font-family="sans-serif">ネオン東京 · 漫猫</text>' +
      '<text x="240" y="400" text-anchor="middle" fill="#ff9ad0" font-size="16" font-family="sans-serif">Maneko</text>' +
      '</svg>';
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  function statusLabel(s) {
    return { pending: '待生成', generating: '生成中', completed: '已完成', error: '失败' }[s] || s || '—';
  }

  function styleLabel(id) {
    const list = store.state.styles.length ? store.state.styles : DEMO_STYLES;
    const s = list.find((x) => x.id === id);
    return s ? s.label : id;
  }

  function splitLocalChapters(text) {
    const src = (text || '').replace(/\r\n/g, '\n').trim();
    if (!src) return [];
    const marks = [];
    const re = /^\s*第\s*[0-9一二三四五六七八九十百千]+\s*[章回节卷].*$/gm;
    let m;
    while ((m = re.exec(src))) marks.push(m.index);
    const md = /^\s*#{1,3}\s+.+$/gm;
    while ((m = md.exec(src))) marks.push(m.index);
    const uniq = Array.from(new Set(marks)).sort((a, b) => a - b);
    if (!uniq.length || uniq[0] > 0) uniq.unshift(0);
    const chapters = [];
    for (let i = 0; i < uniq.length; i++) {
      const start = uniq[i];
      const end = i + 1 < uniq.length ? uniq[i + 1] : src.length;
      const block = src.slice(start, end).trim();
      if (!block) continue;
      const nl = block.indexOf('\n');
      const title = (nl === -1 ? block : block.slice(0, nl)).trim().slice(0, 80);
      const body = (nl === -1 ? block : block.slice(nl + 1)).trim() || block;
      chapters.push({
        id: uid('ch'),
        number: chapters.length + 1,
        title: title || '第' + (chapters.length + 1) + '章',
        content: body,
        comicStatus: 'pending',
      });
    }
    return chapters.length ? chapters : [{ id: uid('ch'), number: 1, title: '全文', content: src, comicStatus: 'pending' }];
  }

  global.Maneko = {
    KEYS, PROD_API, DEMO_STYLES, DEMO_ALLOWED,
    store, api, panelUrl, statusLabel, styleLabel, splitLocalChapters, uid,
  };
})(window);
