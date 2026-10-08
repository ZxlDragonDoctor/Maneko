/* Maneko app router + views */
(function () {
  'use strict';

  const M = window.Maneko;
  const { store, api, panelUrl, statusLabel, styleLabel, splitLocalChapters, uid } = M;

  const $ = (sel, el) => (el || document).querySelector(sel);
  const $$ = (sel, el) => Array.prototype.slice.call((el || document).querySelectorAll(sel));

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  function toast(msg, type) {
    const t = $('#toast');
    t.textContent = msg;
    t.className = 'toast show' + (type ? ' ' + type : '');
    clearTimeout(t._h);
    t._h = setTimeout(() => { t.className = 'toast'; }, 2400);
  }

  function openSheet(html) {
    const mask = $('#sheetMask');
    $('#sheetBody').innerHTML = html;
    mask.classList.add('show');
  }
  function closeSheet() {
    $('#sheetMask').classList.remove('show');
  }

  function loader(text) {
    return (
      '<div class="neon-loader" role="status">' +
      '<img class="neko" src="assets/mascot-neko.png" alt="" width="72" height="72" />' +
      '<div>' + esc(text || '加载中') + '<span style="color:var(--pink)">…</span></div>' +
      '<div class="neon-loader__bar"></div></div>'
    );
  }

  function skeleton(n) {
    let h = '';
    for (let i = 0; i < (n || 3); i++) h += '<div class="skeleton"></div>';
    return h;
  }

  /* ---------- clock ---------- */
  function tickClock() {
    const el = $('#clock');
    if (el) el.textContent = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  }

  /* ---------- data loaders ---------- */
  async function loadNovels() {
    store.state.loading = true;
    render();
    try {
      if (store.state.demo) {
        store.loadLocalNovels();
      } else if (!api.base()) {
        store.state.novels = [];
        store.state.error = '尚未连接服务。请在「我的」中设置 Maneko API 地址并测试连接。';
      } else {
        const response = await api.listBooks({ sort: 'updated' });
        const list = response.books || [];
        store.state.novels = list.map((n) => ({
          id: n.id,
          title: n.title,
          author: n.author || '未知',
          source: n.source || 'upload',
          tags: n.tags || [],
          summary: n.summary || '',
          favorite: !!n.favorite,
          createdAt: n.created_at ? Date.parse(n.created_at) : Date.now(),
          status: n.status,
          progress: n.progress || 0,
          category_id: n.category_id || '',
          category_name: n.category_name || '',
        }));
        store.state.favorites = Object.fromEntries(list.filter((n) => n.favorite).map((n) => [n.id, true]));
      }
      if (api.base() || store.state.demo) store.state.error = null;
    } catch (e) {
      store.state.error = e.message;
      toast('加载失败：' + e.message, 'err');
    }
    store.state.loading = false;
    render();
  }

  async function loadCategories() {
    if (!api.base() || store.state.demo) return;
    try {
      const data = await api.categories();
      store.state.categories = data.categories || [];
    } catch (e) {
      store.state.error = '分类加载失败：' + e.message;
    }
  }

  async function loadSources() {
    if (!api.base() || store.state.demo) {
      store.state.sources = [];
      return;
    }
    try {
      const data = await api.sources();
      store.state.sources = (data.sources || []).filter((source) => source.enabled !== false && source.id !== 'url');
    } catch (e) {
      store.state.sourceError = '书源暂时不可用：' + e.message;
    }
  }

  async function searchLibrary(sourceId, query) {
    if (!api.base() || store.state.demo) {
      store.state.sourceError = '请先连接 Maneko 服务后搜索在线书源';
      render();
      return;
    }
    store.state.selectedSource = sourceId || 'all';
    store.state.sourceQuery = query || '';
    store.state.sourceLoading = true;
    store.state.sourceError = null;
    render();
    try {
      const data = store.state.selectedSource === 'all'
        ? await api.searchAll(store.state.sourceQuery)
        : await api.searchSource(store.state.selectedSource, store.state.sourceQuery);
      store.state.sourceBooks = data.books || [];
    } catch (e) {
      store.state.sourceBooks = [];
      store.state.sourceError = e.message || '书源搜索失败，请稍后重试';
    } finally {
      store.state.sourceLoading = false;
      render();
    }
  }

  async function loadChapters(novelId) {
    if (!novelId || store.state.demo || !api.base()) return [];
    const raw = await api.chapters(novelId);
    const chapters = raw.map((c) => ({
      id: c.id,
      number: c.chapter_number,
      title: c.title,
      content: c.content,
      comicStatus: c.comic_status,
    }));
    store.state.chaptersByNovel[novelId] = chapters;
    return chapters;
  }

  async function loadAllComics() {
    if (!api.base() || store.state.demo) return;
    try {
      await Promise.all(store.state.novels.map(async (novel) => {
        const chapters = await loadChapters(novel.id);
        await Promise.all(chapters.map((chapter) => ensureComic(chapter.id)));
      }));
    } catch (e) {
      toast('漫画集加载失败：' + e.message, 'err');
    }
  }

  async function loadStyles() {
    try {
      if (store.state.demo) {
        store.state.styles = M.DEMO_STYLES.slice();
      } else {
        const data = await api.styles();
        if (data && data.styles) store.state.styles = data.styles;
      }
    } catch (_) {
      store.state.styles = M.DEMO_STYLES.slice();
    }
  }

  async function openNovel(id) {
    go('novel', { id });
    store.state.loading = true;
    render();
    try {
      let novel;
      let chapters;
      if (store.state.demo) {
        store.loadLocalNovels();
        novel = store.state.novels.find((n) => n.id === id);
        chapters = store.state.chaptersByNovel[id] || [];
      } else {
        novel = await api.getNovel(id);
        chapters = await loadChapters(id);
      }
      store.state.route.params.novel = novel;
      store.state.route.params.chapters = chapters;
      const prog = M.store.getProgress(id);
      const nextIdx = chapters.length
        ? Math.min(chapters.length - 1, Math.floor(prog * chapters.length))
        : 0;
      store.state.route.params.chapterId = (chapters[nextIdx] || chapters[0] || {}).id || null;
      if (store.state.route.params.chapterId) await ensureComic(store.state.route.params.chapterId, false);
    } catch (e) {
      toast(e.message, 'err');
    }
    store.state.loading = false;
    render();
  }

  async function ensureComic(chapterId, showLoad) {
    if (store.state.demo) {
      store.ensureDemoComic(chapterId);
      return store.state.comicByChapter[chapterId];
    }
    try {
      const st = await api.comicStatus(chapterId);
      let images = st.images || [];
      if (st.status === 'completed') {
        const panels = await api.comicImages(chapterId);
        if (panels.length) images = panels;
      }
      store.setComic(chapterId, {
        status: st.status,
        images,
        styleId: store.state.prefs.defaultStyle,
      });
    } catch (e) {
      store.setComic(chapterId, { status: 'error', images: [], error: e.message });
    }
    return store.state.comicByChapter[chapterId];
  }

  async function generateComic(chapterId, styleId, force) {
    const style = styleId || store.state.prefs.defaultStyle || 'auto';
    if (store.state.generating[chapterId]) return;

    if (store.state.demo) {
      store.state.generating[chapterId] = true;
      store.setComic(chapterId, { status: 'generating', images: [], styleId: style });
      store.markChapterComic(chapterId, 'generating');
      render();
      let step = 0;
      const timer = setInterval(() => {
        step += 1;
        store.setComic(chapterId, {
          status: 'generating',
          images: Array.from({ length: step }, (_, i) => i + 1),
          styleId: style,
        });
        if (step >= 4) {
          clearInterval(timer);
          store.setComic(chapterId, { status: 'completed', images: [1, 2, 3, 4], styleId: style });
          store.markChapterComic(chapterId, 'completed');
          delete store.state.generating[chapterId];
          toast('演示分镜已生成', 'ok');
        }
        render();
      }, 650);
      return;
    }

    store.state.generating[chapterId] = true;
    store.setComic(chapterId, { status: 'generating', images: [], styleId: style });
    render();
    try {
      await api.generate(chapterId, style, force);
      startPoll(chapterId);
    } catch (e) {
      delete store.state.generating[chapterId];
      store.setComic(chapterId, { status: 'error', images: [] });
      toast('生成失败：' + e.message, 'err');
      render();
    }
  }

  function startPoll(chapterId) {
    clearTimeout(store.state.pollTimers[chapterId]);
    let n = 0;
    const tick = async () => {
      n += 1;
      try {
        const st = await api.comicStatus(chapterId);
        let images = st.images || [];
        if (st.status === 'completed') {
          const panels = await api.comicImages(chapterId);
          if (panels.length) images = panels;
        }
        store.setComic(chapterId, {
          status: st.status,
          images,
          styleId: store.state.prefs.defaultStyle,
        });
        render();
        if (['pending', 'generating'].includes(st.status) && n < 180) {
          store.state.pollTimers[chapterId] = setTimeout(tick, 2000);
        } else {
          delete store.state.generating[chapterId];
          if (st.status === 'completed') toast('漫画生成完成', 'ok');
          if (st.status === 'error') toast('生成失败', 'err');
          if (['pending', 'generating'].includes(st.status)) {
            store.setComic(chapterId, { status: 'error', error: '生成等待超时，请重试' });
            toast('生成等待超时，请重试', 'err');
          }
          render();
        }
      } catch (e) {
        if (n < 30) store.state.pollTimers[chapterId] = setTimeout(tick, 3000);
        else {
          delete store.state.generating[chapterId];
          toast('状态查询失败', 'err');
        }
      }
    };
    store.state.pollTimers[chapterId] = setTimeout(tick, 1000);
  }

  async function importNovel(title, text) {
    const t = (title || '未命名小说').trim();
    if (store.state.demo) {
      const id = uid('local');
      const chapters = splitLocalChapters(text);
      store.addDemoNovel({
        id, title: t, author: '我', source: 'upload',
        tags: ['导入'], summary: text.slice(0, 60),
        favorite: false, createdAt: Date.now(),
      }, chapters);
      toast('已导入本地书架', 'ok');
      go('home');
      await loadNovels();
      return true;
    }
    try {
      await api.uploadText(t, text);
      toast('小说已上传，章节已准备就绪', 'ok');
      go('home');
      await loadNovels();
      return true;
    } catch (e) {
      toast(e.message, 'err');
      return false;
    }
  }

  /* ---------- navigation ---------- */
  function go(name, params) {
    store.state.route = { name: name, params: params || {} };
    if (['home', 'library', 'studio', 'comics', 'me'].indexOf(name) >= 0) {
      store.state.tab = name;
    }
    window.scrollTo(0, 0);
    render();
    if (name === 'library') {
      Promise.all([loadSources(), loadCategories()]).then(render);
    } else if (name === 'studio') {
      const novelId = store.state.route.params.studioNovelId || (store.state.novels[0] && store.state.novels[0].id);
      if (novelId && !store.state.chaptersByNovel[novelId]) {
        loadChapters(novelId).then(render).catch((e) => toast('章节加载失败：' + e.message, 'err'));
      }
    } else if (name === 'comics') {
      loadAllComics().then(render);
    }
  }

  function syncNav() {
    $$('.nav-item').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.tab === store.state.tab);
    });
  }

  /* ---------- views ---------- */
  function viewOnboard() {
    return (
      '<div class="onboard">' +
      '<div class="logo-wrap">' +
      '<img src="assets/mascot-neko.png" alt="ねこ" />' +
      '<h1>Maneko · 漫猫</h1>' +
      '<div class="sub">Novel → Manga · Neon Tokyo</div>' +
      '</div>' +
      '<div class="steps">' +
      '<div class="step"><b>01 导入小说</b><span>TXT / 粘贴正文，自动分章。</span></div>' +
      '<div class="step"><b>02 选择画风</b><span>修仙 · 武侠 · 科幻 · 霓虹东京…</span></div>' +
      '<div class="step"><b>03 生成分镜</b><span>一键生成可预览的日漫风章节漫画。</span></div>' +
      '</div>' +
      '<button class="btn btn-primary" id="obDone">开始使用</button>' +
      '<p class="muted" style="text-align:center;margin-top:12px">连接 Maneko 服务后即可使用完整书库与漫画生成功能。</p>' +
      '</div>'
    );
  }

  function novelCard(n) {
    const fav = !!store.state.favorites[n.id];
    const prog = n.progress != null ? n.progress : M.store.getProgress(n.id);
    const ico = (n.tags && n.tags[0] === '科幻') ? '🚀' : (n.tags && n.tags[0] === '武侠') ? '⚔️' : (n.tags && n.tags[0] === '悬疑') ? '🔍' : '📖';
    return (
      '<div class="card" data-open="' + esc(n.id) + '">' +
      '<div class="row">' +
      '<div class="cover">' + ico + '</div>' +
      '<div class="meta">' +
      '<h3>' + esc(n.title) + (fav ? ' <span class="badge">♥</span>' : '') + '</h3>' +
      '<p>' + esc(n.author || '未知') + ' · ' + esc((n.source || 'upload')) + '</p>' +
      (n.summary ? '<div class="desc">' + esc(n.summary) + '</div>' : '') +
      '<div class="chips">' +
      (n.tags || []).slice(0, 3).map((t) => '<span class="badge">' + esc(t) + '</span>').join('') +
      '<span class="badge cyan">' + Math.round((prog || 0) * 100) + '%</span>' +
      '</div>' +
      '<div class="progress"><i style="width:' + Math.round((prog || 0) * 100) + '%"></i></div>' +
      '</div></div></div>'
    );
  }

  function filteredNovels() {
    let list = store.state.novels.slice();
    const q = (store.state.search || '').trim().toLowerCase();
    const tag = store.state.filterTag;
    if (tag === '收藏') list = list.filter((n) => store.state.favorites[n.id]);
    else if (tag && tag !== '全部') list = list.filter((n) =>
      (n.tags || []).indexOf(tag) >= 0 || n.category_name === tag
    );
    if (q) {
      list = list.filter((n) =>
        (n.title || '').toLowerCase().indexOf(q) >= 0 ||
        (n.author || '').toLowerCase().indexOf(q) >= 0 ||
        (n.summary || '').toLowerCase().indexOf(q) >= 0
      );
    }
    return list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }

  function viewHome() {
    const list = filteredNovels();
    const tags = ['全部', '收藏', ...store.state.categories.map((c) => c.name), '修仙', '武侠', '科幻', '悬疑', '导入'];
    const favCount = Object.keys(store.state.favorites).length;
    return (
      '<div class="banner">' +
      '<h3>Novel → 漫画</h3>' +
      '<p>导入小说，选风格，生成可预览的日漫分镜。</p>' +
      '<img class="neko" src="assets/mascot-neko.png" alt="" />' +
      '</div>' +
      '<div class="search-bar">' +
      '<input id="q" placeholder="搜索书名 / 作者 / 简介" value="' + esc(store.state.search) + '" />' +
      '<button class="btn btn-ghost btn-sm" id="btnImportTop">导入</button>' +
      '</div>' +
      '<div class="chips-scroll">' +
      tags.map((t) => '<button class="filter-chip' + (store.state.filterTag === t ? ' active' : '') + '" data-tag="' + esc(t) + '">' + esc(t) + '</button>').join('') +
      '</div>' +
      '<div class="section-title"><h2>我的<span class="accent">书架</span></h2><span class="side">' + list.length + ' books</span></div>' +
      (!store.state.apiBase && !store.state.demo
        ? '<div class="notice" role="status">服务尚未连接。<button class="text-link" data-go-me="1">设置服务地址</button> 后即可同步书架、搜索公版书并生成漫画。</div>'
        : '') +
      (store.state.error ? '<div class="notice error" role="alert">' + esc(store.state.error) + '</div>' : '') +
      (store.state.loading ? skeleton(3) : '') +
      (!store.state.loading && !list.length ? '<div class="empty"><strong>没有匹配的作品</strong>换个关键词，或从「导入」添加小说</div>' : '') +
      list.map(novelCard).join('') +
      '<div class="divider"></div>' +
      '<div class="stats">' +
      '<div class="stat"><b>' + store.state.novels.length + '</b><span>作品</span></div>' +
      '<div class="stat"><b>' + favCount + '</b><span>收藏</span></div>' +
      '<div class="stat"><b>' + (store.state.apiBase && !store.state.demo ? '在线' : '未连接') + '</b><span>服务</span></div>' +
      '</div>'
    );
  }

  function viewNovel() {
    const novel = store.state.route.params.novel;
    if (!novel) return '<div class="empty">未找到作品</div>';
    const chapters = store.state.route.params.chapters || [];
    const chapterId = store.state.route.params.chapterId;
    const chapter = chapters.find((c) => c.id === chapterId) || chapters[0];
    const comic = (chapter && store.state.comicByChapter[chapter.id]) || { status: 'pending', images: [] };
    const fav = !!store.state.favorites[novel.id];
    const fs = store.state.prefs.fontScale || 1;
    const styleId = (comic && comic.styleId) || store.state.prefs.defaultStyle || 'auto';

    let comicHtml = '';
    if (!chapter) {
      comicHtml = '<div class="empty">暂无章节</div>';
    } else if (comic.status === 'generating' && !(comic.images || []).length) {
      comicHtml = loader('正在生成分镜');
    } else if (comic.status === 'error') {
      const images = comic.images || [];
      comicHtml =
        '<div class="notice error" role="alert"><strong>生成未完整完成</strong>' +
        esc(comic.error || (images.length ? '本次生成未完成，当前有 ' + images.length + ' 格可用，可先导出或重试。' : '请检查服务状态后重试。')) + '</div>' +
        (images.length
          ? '<div class="panel-grid">' + images.map((img, i) => {
            const idx = typeof img === 'string'
              ? Number((img.match(/panel_(\d+)/) || [])[1] || i + 1)
              : (img.panel_index || i + 1);
            const imagePath = typeof img === 'object' && img ? img.image_path : img;
            return '<div class="panel"><img src="' + esc(panelUrl(chapter.id, idx, imagePath)) + '" alt="第 ' + idx + ' 幕分镜" loading="lazy"/><div class="cap">第 ' + idx + ' 幕 · 部分结果</div></div>';
          }).join('') + '</div>' +
          '<button class="btn btn-ghost" data-export-comic="' + esc(chapter.id) + '">导出已生成画格 ZIP</button>'
          : '') +
        '<button class="btn btn-orange" data-gen="1" data-force="1">重试</button>';
    } else {
      const images = comic.images || [];
      if (images.length) {
        comicHtml =
          '<div class="panel-grid">' +
          images.map((img, i) => {
            const idx = typeof img === 'string'
              ? Number((img.match(/panel_(\d+)/) || [])[1] || i + 1)
              : (img.panel_index || i + 1);
            const imagePath = typeof img === 'object' && img ? img.image_path : img;
            return (
              '<div class="panel"><img src="' + esc(panelUrl(chapter.id, idx, imagePath)) + '" alt="第 ' + idx + ' 幕分镜" loading="lazy"/>' +
              '<div class="cap">第 ' + idx + ' 幕</div></div>'
            );
          }).join('') +
          '</div>' +
          (comic.status === 'generating'
            ? '<p class="muted" style="margin-bottom:10px">生成中…已出 ' + images.length + ' 格</p>'
            : '') +
          (comic.status === 'completed' ? '<button class="btn btn-ghost" data-export-comic="' + esc(chapter.id) + '">下载本章分镜 ZIP</button>' : '') +
          '<button class="btn btn-ghost" data-gen="1" data-force="1">按「' + esc(styleLabel(styleId)) + '」重新生成</button>';
      } else {
        comicHtml =
          '<div class="empty"><strong>尚未生成漫画</strong>选择画风后一键生成</div>' +
          '<button class="btn btn-primary" data-gen="1">生成漫画 · ' + esc(styleLabel(styleId)) + '</button>';
      }
    }

    return (
      '<div class="row" style="margin-bottom:12px">' +
      '<button class="btn btn-ghost btn-sm" id="btnBack">← 书架</button>' +
      '<div class="meta"><h3 style="margin:0">' + esc(novel.title) + '</h3>' +
      '<p>' + esc(novel.author || '') + '</p></div>' +
      '<button class="icon-btn" id="btnFav" aria-label="收藏">' + (fav ? '♥' : '♡') + '</button>' +
      '<button class="btn btn-danger btn-sm" id="btnDeleteNovel">删除</button>' +
      '</div>' +

      (!store.state.demo && store.state.categories.length
        ? '<div class="field"><label for="novelCategory">分类</label><select id="novelCategory"><option value="">未分类</option>' + store.state.categories.map((c) => '<option value="' + esc(c.id) + '"' + (novel.category_id === c.id ? ' selected' : '') + '>' + esc(c.name) + '</option>').join('') + '</select></div>'
        : '') +

      '<div class="reader-toolbar">' +
      '<div class="seg" id="fontSeg">' +
      '<button data-fs="0.9" class="' + (fs === 0.9 ? 'active' : '') + '">A-</button>' +
      '<button data-fs="1" class="' + (fs === 1 ? 'active' : '') + '">A</button>' +
      '<button data-fs="1.15" class="' + (fs === 1.15 ? 'active' : '') + '">A+</button>' +
      '</div>' +
      '<div class="spacer"></div>' +
      '<button class="btn btn-ghost btn-sm" id="btnStylePick">风格 · ' + esc(styleLabel(styleId)) + '</button>' +
      '</div>' +

      '<div class="section-title"><h2>章节</h2><span class="side">' + chapters.length + ' ch</span></div>' +
      chapters.map((c) => (
        '<div class="chapter-item' + (chapter && c.id === chapter.id ? ' active' : '') + '" data-ch="' + esc(c.id) + '">' +
        '<div class="num">' + c.number + '</div>' +
        '<div class="t">' + esc(c.title) + '</div>' +
        '<div class="st ' + (c.comicStatus === 'completed' ? 'done' : c.comicStatus === 'generating' ? 'gen' : '') + '">' +
        statusLabel(c.comicStatus) + '</div></div>'
      )).join('') +

      (chapter ? (
        '<div class="section-title" style="margin-top:16px"><h2>正文</h2></div>' +
        '<div class="reader-panel" style="font-size:' + (14 * fs).toFixed(1) + 'px">' + esc(chapter.content || '') + '</div>' +
        '<div class="section-title" style="margin-top:16px"><h2>漫画 · <span class="accent">分鏡</span></h2>' +
        '<span class="side">' + statusLabel(comic.status) + '</span></div>' +
        comicHtml
      ) : '')
    );
  }

  function viewLibrary() {
    const sources = store.state.sources;
    return (
      '<div class="hero">' +
      '<h2>书库与<span class="cyan">书源</span></h2>' +
      '<p>搜索可导入的公版小说，或上传你拥有使用权的 TXT / Markdown 文件。</p>' +
      '<button class="btn btn-primary" id="btnLibImport">导入小说</button>' +
      '</div>' +
      (!api.base() && !store.state.demo ? '<div class="notice error" role="alert">请先在「我的」中设置并测试服务地址，在线书源需要连接后端。</div>' : '') +
      '<div class="field"><label for="sourceSelect">书源</label><select id="sourceSelect"><option value="all"' + (store.state.selectedSource === 'all' ? ' selected' : '') + '>全部书源</option>' +
      sources.map((s) => '<option value="' + esc(s.id) + '"' + (store.state.selectedSource === s.id ? ' selected' : '') + '>' + esc(s.name) + ' · ' + esc(s.description || '') + '</option>').join('') +
      '</select></div>' +
      '<div class="search-bar"><input id="sourceQuery" value="' + esc(store.state.sourceQuery) + '" placeholder="搜索公版小说标题或作者" aria-label="搜索书源"/><button class="btn btn-primary btn-sm" id="btnSearchSource">搜索</button></div>' +
      (store.state.sourceError ? '<div class="notice error" role="alert">' + esc(store.state.sourceError) + '</div>' : '') +
      (store.state.sourceLoading ? loader('正在搜索书源') : '') +
      (store.state.sourceBooks.map((book, index) => '<div class="card"><div class="meta"><h3>' + esc(book.title) + '</h3><p>' + esc(book.author || '作者未知') + ' · ' + esc(book.source) + '</p>' + (book.summary ? '<div class="desc">' + esc(book.summary) + '</div>' : '') + (!book.importable ? '<p class="notice">该条目仅提供书目信息，全文需由你上传正版文件。</p>' : '<button class="btn btn-ghost btn-sm" data-import-book="' + index + '">导入全文</button>') + '</div></div>').join('') || (!store.state.sourceLoading ? '<div class="empty"><strong>暂无搜索结果</strong>选择书源并输入关键词进行搜索</div>' : '')) +
      '<div class="section-title" style="margin-top:20px"><h2>链接导入</h2></div>' +
      '<div class="field"><label for="sourceUrl">TXT / Markdown 直链</label><input id="sourceUrl" type="url" placeholder="https://example.com/novel.txt"/></div>' +
      '<button class="btn btn-ghost" id="btnImportUrl">从链接导入</button>' +
      '<div class="section-title" style="margin-top:20px"><h2>分类管理</h2></div>' +
      '<div class="search-bar"><input id="categoryName" maxlength="40" placeholder="新分类名称" aria-label="新分类名称"/><button class="btn btn-ghost btn-sm" id="btnCreateCategory">添加</button></div>' +
      '<div class="chips-scroll">' + store.state.categories.map((c) => '<span class="badge">' + esc(c.name) + '</span><button class="text-link" data-delete-category="' + esc(c.id) + '" aria-label="删除分类 ' + esc(c.name) + '">删除</button>').join('') + '</div>' +
      '<div class="btn-row"><button class="btn btn-ghost" id="btnGoStudio">去生成</button><button class="btn btn-ghost" id="btnRefresh">刷新书架</button></div>'
    );
  }

  function viewStudio() {
    const novels = store.state.novels;
    const selectedId = store.state.route.params.studioNovelId || (novels[0] && novels[0].id);
    const chapters = selectedId ? (store.state.chaptersByNovel[selectedId] || []) : [];
    if (!store.state.demo && selectedId && !chapters.length) {
      // live mode chapters not cached — load on demand message
    }
    const chapterId = store.state.route.params.studioChapterId || (chapters[0] && chapters[0].id);
    const styleId = store.state.prefs.defaultStyle || 'auto';
    const comic = chapterId ? store.state.comicByChapter[chapterId] : null;

    return (
      '<div class="hero">' +
      '<h2>生成<span class="cyan">工作台</span></h2>' +
      '<p>选择章节与画风，生成并预览分镜。风格会写入出图 Prompt。</p>' +
      '</div>' +

      '<div class="field"><label>作品</label>' +
      '<select id="selNovel">' +
      novels.map((n) => '<option value="' + esc(n.id) + '"' + (n.id === selectedId ? ' selected' : '') + '>' + esc(n.title) + '</option>').join('') +
      '</select></div>' +

      '<div class="field"><label>章节</label>' +
      '<select id="selChapter">' +
      (chapters.length
        ? chapters.map((c) => '<option value="' + esc(c.id) + '"' + (c.id === chapterId ? ' selected' : '') + '>' + esc(c.number + ' · ' + c.title) + '</option>').join('')
        : '<option value="">请先导入小说并确保其章节已加载</option>') +
      '</select></div>' +

      '<div class="section-title"><h2>画风</h2><span class="side">' + esc(styleLabel(styleId)) + '</span></div>' +
      '<div class="grid2">' +
      (store.state.styles || []).map((s) => (
        '<button class="style-card' + (s.id === styleId ? ' active' : '') + '" data-style="' + esc(s.id) + '">' +
        '<strong>' + esc(s.label) + '</strong><span>' + esc(s.description || '') + '</span></button>'
      )).join('') +
      '</div>' +

      '<div class="sticky-actions">' +
      '<button class="btn btn-primary" id="btnStudioGen"' + (chapterId ? '' : ' disabled') + '>生成分镜</button>' +
      '</div>' +

      (chapterId && comic && (comic.status === 'completed' || (comic.images || []).length) ? (
        '<div class="section-title" style="margin-top:14px"><h2>预览</h2><span class="side">' + statusLabel(comic.status) + '</span></div>' +
        '<div class="panel-grid">' +
        (comic.images || []).map((img, i) => {
          const idx = typeof img === 'string' ? Number((img.match(/panel_(\d+)/) || [])[1] || i + 1) : (img.panel_index || i + 1);
          const imagePath = typeof img === 'object' && img ? img.image_path : img;
          return '<div class="panel"><img src="' + esc(panelUrl(chapterId, idx, imagePath)) + '" alt="第 ' + idx + ' 幕分镜"/><div class="cap">P' + idx + '</div></div>';
        }).join('') +
        '</div>'
      ) : chapterId ? '<div class="empty" style="margin-top:12px">尚未生成，点上方按钮开始</div>' : '')
    );
  }

  function viewComics() {
    const done = [];
    Object.keys(store.state.comicByChapter).forEach((cid) => {
      const c = store.state.comicByChapter[cid];
      if (c && c.status === 'completed' && (c.images || []).length) {
        done.push({ chapterId: cid, comic: c });
      }
    });
    // also scan demo chapters
    Object.keys(store.state.chaptersByNovel).forEach((nid) => {
      (store.state.chaptersByNovel[nid] || []).forEach((ch) => {
        if (ch.comicStatus === 'completed' && !done.find((d) => d.chapterId === ch.id)) {
          done.push({
            chapterId: ch.id,
            title: ch.title,
            novelId: nid,
            comic: store.state.comicByChapter[ch.id] || { status: 'completed', images: [1, 2, 3, 4] },
          });
        }
      });
    });

    if (!done.length) {
      return (
        '<div class="hero"><h2>漫画<span class="cyan">集</span></h2>' +
        '<p>已生成的分镜会汇总在这里。</p></div>' +
        '<div class="empty"><strong>还没有成品</strong>去「生成」或打开一本书创建分镜</div>' +
        '<button class="btn btn-primary" id="btnGoStudio2" style="margin-top:12px">去生成</button>'
      );
    }

    return (
      '<div class="section-title"><h2>漫画<span class="accent">集</span></h2><span class="side">' + done.length + ' chapters</span></div>' +
      done.map((item) => {
        const novel = store.state.novels.find((n) => n.id === item.novelId);
        const title = item.title || '章节漫画';
        const images = item.comic.images || [];
        return (
          '<div class="card">' +
          '<div class="meta" style="margin-bottom:10px">' +
          '<h3>' + esc(title) + '</h3>' +
          '<p>' + esc(novel ? novel.title : '') + ' · ' + images.length + ' 格</p></div>' +
          '<div class="panel-grid">' +
          images.slice(0, 4).map((img, i) => {
            const idx = typeof img === 'string' ? Number((img.match(/panel_(\d+)/) || [])[1] || i + 1) : (img.panel_index || i + 1);
            const imagePath = typeof img === 'object' && img ? img.image_path : img;
            return '<div class="panel"><img src="' + esc(panelUrl(item.chapterId, idx, imagePath)) + '" alt="第 ' + idx + ' 幕分镜" loading="lazy"/><div class="cap">P' + idx + '</div></div>';
          }).join('') +
          '</div><button class="btn btn-ghost btn-sm" data-export-comic="' + esc(item.chapterId) + '">下载本章分镜 ZIP</button></div>'
        );
      }).join('')
    );
  }

  function viewMe() {
    const n = store.state;
    return (
      '<div class="hero">' +
      '<h2>Maneko<span class="cyan"> · 漫猫</span></h2>' +
      '<p>小说阅读与漫画创作<br/>Novel in, panels out.</p>' +
      '<div class="stats">' +
      '<div class="stat"><b>' + n.novels.length + '</b><span>作品</span></div>' +
      '<div class="stat"><b>' + (n.apiBase && !n.demo ? '在线' : '未连接') + '</b><span>服务</span></div>' +
      '<div class="stat"><b>MIT</b><span>协议</span></div>' +
      '</div></div>' +

      '<div class="card">' +
      '<div class="section-title"><h2>连接后端</h2></div>' +
      '<div class="field"><label>API Base URL</label>' +
      '<input id="apiBase" type="url" placeholder="https://api.example.com" value="' + esc(n.apiBase) + '"' + (M.PROD_API && M.DEMO_ALLOWED === false ? ' readonly' : '') + ' /></div>' +
      '<div class="btn-row">' +
      '<button class="btn btn-primary" id="btnConnect">连接并同步</button>' +
      '</div>' +
      '<p class="muted" style="margin-top:10px">连接后使用服务端书架、书源、章节与真实漫画生成任务。生成能力由部署方配置的 AI 服务提供。</p>' +
      '</div>' +

      '<div class="card cyan">' +
      '<div class="section-title"><h2>阅读偏好</h2></div>' +
      '<div class="field"><label>默认画风</label>' +
      '<select id="defStyle">' +
      (n.styles || []).map((s) => '<option value="' + esc(s.id) + '"' + (s.id === (n.prefs.defaultStyle || 'auto') ? ' selected' : '') + '>' + esc(s.label) + '</option>').join('') +
      '</select></div></div>' +

      '<div class="card orange">' +
      '<div class="section-title"><h2>数据</h2></div>' +
      '<div class="btn-row">' +
      '<button class="btn btn-ghost" id="btnExport">导出书架 JSON</button>' +
      '<button class="btn btn-danger" id="btnReset">重置本地数据</button>' +
      '</div></div>' +

      '<div class="card">' +
      '<div class="section-title"><h2>关于</h2></div>' +
      '<p class="muted" style="margin:0;line-height:1.65">' +
      'Maneko 是 AI 小说到漫画分镜创作工具。<br/>' +
      '小说正文和生成提示会由当前服务配置的模型处理。<br/>' +
      '<a class="text-link" href="privacy.html" target="_blank" rel="noreferrer">隐私说明</a> · License: MIT' +
      '</p></div>'
    );
  }

  /* ---------- bind ---------- */
  function bind() {
    // onboarding
    const ob = $('#obDone');
    if (ob) ob.onclick = () => { store.completeOnboard(); render(); };

    $$('[data-tab]').forEach((btn) => {
      btn.onclick = () => go(btn.dataset.tab);
    });

    $$('[data-open]').forEach((el) => {
      el.onclick = () => openNovel(el.dataset.open);
    });
    $$('[data-tag]').forEach((el) => {
      el.onclick = () => { store.state.filterTag = el.dataset.tag; render(); };
    });
    $$('[data-go-me]').forEach((el) => { el.onclick = () => go('me'); });
    $$('[data-export-comic]').forEach((button) => {
      button.onclick = async () => {
        button.disabled = true;
        const original = button.textContent;
        button.textContent = '正在打包…';
        try {
          const blob = await api.exportComic(button.dataset.exportComic);
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = 'maneko-comic.zip';
          link.click();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
          toast('分镜已导出', 'ok');
        } catch (error) {
          toast(error.message || '分镜导出失败，请重试', 'err');
        } finally {
          button.disabled = false;
          button.textContent = original;
        }
      };
    });
    const q = $('#q');
    if (q) {
      q.oninput = () => {
        store.state.search = q.value;
        // lightweight re-render
        render();
        const q2 = $('#q');
        if (q2) { q2.focus(); q2.setSelectionRange(q2.value.length, q2.value.length); }
      };
    }
    const btnImportTop = $('#btnImportTop');
    if (btnImportTop) btnImportTop.onclick = openImportSheet;
    const btnLibImport = $('#btnLibImport');
    if (btnLibImport) btnLibImport.onclick = openImportSheet;

    const btnSearchSource = $('#btnSearchSource');
    if (btnSearchSource) btnSearchSource.onclick = () => searchLibrary($('#sourceSelect').value, $('#sourceQuery').value.trim());
    const sourceQuery = $('#sourceQuery');
    if (sourceQuery) sourceQuery.onkeydown = (event) => {
      if (event.key === 'Enter') searchLibrary($('#sourceSelect').value, sourceQuery.value.trim());
    };
    const sourceSelect = $('#sourceSelect');
    if (sourceSelect) sourceSelect.onchange = () => { store.state.selectedSource = sourceSelect.value; };

    $$('[data-import-book]').forEach((el) => {
      el.onclick = async () => {
        const book = store.state.sourceBooks[Number(el.dataset.importBook)];
        if (!book || !book.importable) return;
        el.disabled = true;
        el.textContent = '正在导入…';
        try {
          const result = await api.importSearch({
            source: book.source,
            source_ref: book.source_ref,
            download_url: book.download_url,
            title: book.title,
            author: book.author || '',
            summary: book.summary || '',
            cover_url: book.cover_url || '',
            tags: book.tags || [],
          });
          await loadNovels();
          toast('《' + (result.book?.title || book.title) + '》已加入书架', 'ok');
          go('home');
        } catch (e) {
          toast('导入失败：' + e.message, 'err');
          el.disabled = false;
          el.textContent = '导入全文';
        }
      };
    });

    const btnImportUrl = $('#btnImportUrl');
    if (btnImportUrl) btnImportUrl.onclick = async () => {
      const url = ($('#sourceUrl').value || '').trim();
      if (!url) return toast('请填写小说 TXT / Markdown 链接', 'err');
      btnImportUrl.disabled = true;
      try {
        const response = await api.importUrl({ url });
        await loadNovels();
        toast('《' + response.book.title + '》已导入', 'ok');
        go('home');
      } catch (e) {
        toast('链接导入失败：' + e.message, 'err');
        btnImportUrl.disabled = false;
      }
    };

    const btnCreateCategory = $('#btnCreateCategory');
    if (btnCreateCategory) btnCreateCategory.onclick = async () => {
      const input = $('#categoryName');
      const name = input.value.trim();
      if (!name) return toast('请输入分类名称', 'err');
      try {
        await api.createCategory(name);
        await loadCategories();
        render();
        toast('分类已添加', 'ok');
      } catch (e) { toast('添加分类失败：' + e.message, 'err'); }
    };
    $$('[data-delete-category]').forEach((el) => {
      el.onclick = async () => {
        if (!window.confirm('删除该分类？作品会保留在书架中。')) return;
        try {
          await api.deleteCategory(el.dataset.deleteCategory);
          await loadCategories();
          await loadNovels();
          render();
          toast('分类已删除', 'ok');
        } catch (e) { toast('删除分类失败：' + e.message, 'err'); }
      };
    });

    const btnBack = $('#btnBack');
    if (btnBack) btnBack.onclick = () => { go('home'); loadNovels(); };

    const btnFav = $('#btnFav');
    if (btnFav) {
      btnFav.onclick = async () => {
        const novel = store.state.route.params.novel;
        if (!novel) return;
        const on = !store.state.favorites[novel.id];
        try {
          if (!store.state.demo) await api.updateBook(novel.id, { favorite: on });
          if (on) store.state.favorites[novel.id] = true;
          else delete store.state.favorites[novel.id];
          localStorage.setItem(M.KEYS.favorites, JSON.stringify(store.state.favorites));
          novel.favorite = on;
          toast(on ? '已收藏并同步' : '已取消收藏并同步', 'ok');
          render();
        } catch (e) { toast('收藏未保存：' + e.message, 'err'); }
      };
    }

    const btnDeleteNovel = $('#btnDeleteNovel');
    if (btnDeleteNovel) btnDeleteNovel.onclick = async () => {
      const novel = store.state.route.params.novel;
      if (!novel || !window.confirm(`确定删除《${novel.title}》及其漫画吗？此操作不可撤销。`)) return;
      try {
        if (!store.state.demo) await api.deleteNovel(novel.id);
        store.removeNovel(novel.id);
        store.state.route.params.novel = null;
        toast('作品已删除', 'ok');
        go('home');
        await loadNovels();
      } catch (e) { toast('删除失败：' + e.message, 'err'); }
    };

    const novelCategory = $('#novelCategory');
    if (novelCategory) novelCategory.onchange = async () => {
      const novel = store.state.route.params.novel;
      if (!novel) return;
      try {
        const categoryId = novelCategory.value;
        const updated = await api.updateBook(novel.id, { category_id: categoryId || null, clear_category: !categoryId });
        novel.category_id = updated.category_id || '';
        novel.category_name = updated.category_name || '';
        store.state.novels = store.state.novels.map((item) => item.id === novel.id
          ? Object.assign({}, item, { category_id: novel.category_id, category_name: novel.category_name })
          : item);
        toast('分类已保存', 'ok');
      } catch (e) { toast('分类保存失败：' + e.message, 'err'); render(); }
    };

    $$('[data-ch]').forEach((el) => {
      el.onclick = async () => {
        const id = el.dataset.ch;
        store.state.route.params.chapterId = id;
        const chapters = store.state.route.params.chapters || [];
        const idx = chapters.findIndex((c) => c.id === id);
        const novelId = store.state.route.params.novel && store.state.route.params.novel.id;
        if (novelId && idx >= 0 && chapters.length) {
          const ratio = chapters.length > 1 ? idx / (chapters.length - 1) : 1;
          M.store.setProgress(novelId, ratio);
          if (!store.state.demo) {
            api.updateBook(novelId, { progress: ratio }).catch((e) => toast('阅读进度未同步：' + e.message, 'err'));
          }
        }
        await ensureComic(id);
        render();
      };
    });

    $$('[data-gen]').forEach((el) => {
      el.onclick = () => {
        const chapterId = store.state.route.params.chapterId;
        if (chapterId) generateComic(chapterId, store.state.prefs.defaultStyle, el.dataset.force === '1');
      };
    });

    $$('[data-fs]').forEach((el) => {
      el.onclick = () => {
        M.store.setPrefs({ fontScale: Number(el.dataset.fs) });
        render();
      };
    });

    const btnStylePick = $('#btnStylePick');
    if (btnStylePick) btnStylePick.onclick = openStyleSheet;

    // library
    $$('[data-source]').forEach((el) => {
      el.onclick = () => {
        const id = el.dataset.source;
        if (id === 'upload') openImportSheet();
        else if (id === 'builtin') { go('home'); loadNovels(); toast('已定位演示作品'); }
        else toast(store.state.demo ? '请先在「我」连接后端' : '书库检索请调用后端 /api/library');
      };
    });
    const btnGoStudio = $('#btnGoStudio');
    if (btnGoStudio) btnGoStudio.onclick = () => go('studio');
    const btnRefresh = $('#btnRefresh');
    if (btnRefresh) btnRefresh.onclick = () => loadNovels();
    const btnGoStudio2 = $('#btnGoStudio2');
    if (btnGoStudio2) btnGoStudio2.onclick = () => go('studio');

    // studio
    const selNovel = $('#selNovel');
    if (selNovel) {
      selNovel.onchange = async () => {
        const id = selNovel.value;
        store.state.route.params.studioNovelId = id;
        store.state.route.params.studioChapterId = null;
        if (!store.state.demo) {
          try {
            await loadChapters(id);
          } catch (e) { toast(e.message, 'err'); }
        }
        render();
      };
    }
    const selChapter = $('#selChapter');
    if (selChapter) {
      selChapter.onchange = async () => {
        store.state.route.params.studioChapterId = selChapter.value;
        if (selChapter.value) await ensureComic(selChapter.value);
        render();
      };
    }
    $$('[data-style]').forEach((el) => {
      el.onclick = () => {
        M.store.setPrefs({ defaultStyle: el.dataset.style });
        toast('默认画风：' + styleLabel(el.dataset.style), 'ok');
        render();
      };
    });
    const btnStudioGen = $('#btnStudioGen');
    if (btnStudioGen) {
      btnStudioGen.onclick = () => {
        const chapterId = store.state.route.params.studioChapterId;
        if (!chapterId) return toast('请选择章节');
        generateComic(chapterId, store.state.prefs.defaultStyle, true);
      };
    }

    // me
    const btnConnect = $('#btnConnect');
    if (btnConnect) btnConnect.onclick = async () => {
      const base = ($('#apiBase').value || '').trim().replace(/\/$/, '');
      if (!base) return toast('请先填写 Maneko 服务地址', 'err');
      if (!/^https?:\/\//i.test(base)) return toast('服务地址必须以 http:// 或 https:// 开头', 'err');
      if (!store.setDemo(false, base)) return toast('此发布版本的服务地址由构建配置锁定', 'err');
      try {
        await api.health();
        toast('连接成功', 'ok');
        await loadStyles();
        await Promise.all([loadCategories(), loadSources()]);
        await loadNovels();
      } catch (e) {
        toast('无法连接后端：' + e.message, 'err');
      }
    };
    const defStyle = $('#defStyle');
    if (defStyle) defStyle.onchange = () => M.store.setPrefs({ defaultStyle: defStyle.value });

    const btnExport = $('#btnExport');
    if (btnExport) btnExport.onclick = async () => {
      btnExport.disabled = true;
      const original = btnExport.textContent;
      btnExport.textContent = '正在准备完整书库…';
      try {
        let novels = store.state.novels;
        let chapters = store.state.chaptersByNovel;
        if (!store.state.demo) {
          if (!api.base()) throw new Error('请先连接服务端，才能导出完整书库正文');
          novels = await Promise.all(store.state.novels.map(async (item) => {
            const [detail, chapterList] = await Promise.all([api.getNovel(item.id), api.chapters(item.id)]);
            chapters[item.id] = chapterList;
            return detail;
          }));
        }
        const data = {
          novels,
          chapters,
          favorites: store.state.favorites,
          progress: store.state.progress,
          categories: store.state.categories,
          exportedAt: new Date().toISOString(),
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'maneko-shelf.json';
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        toast('完整书库已导出', 'ok');
      } catch (error) {
        toast(error.message || '书库导出失败', 'err');
      } finally {
        btnExport.disabled = false;
        btnExport.textContent = original;
      }
    };
    const btnReset = $('#btnReset');
    if (btnReset) btnReset.onclick = () => {
      openSheet(
        '<div class="grab"></div><h3>重置本地数据？</h3>' +
        '<p class="muted">将清除书架、进度、收藏与演示作品（不可恢复）。</p>' +
        '<div class="btn-row" style="margin-top:12px">' +
        '<button class="btn btn-ghost" id="sheetCancel">取消</button>' +
        '<button class="btn btn-danger" id="sheetOk">确认重置</button></div>'
      );
      $('#sheetCancel').onclick = closeSheet;
      $('#sheetOk').onclick = () => {
        [M.KEYS.novels, M.KEYS.favorites, M.KEYS.progress, M.KEYS.prefs, 'maneko_chapters_v1'].forEach((k) => localStorage.removeItem(k));
        closeSheet();
        toast('已重置，重新加载');
        setTimeout(() => location.reload(), 600);
      };
    };

    const sheetMask = $('#sheetMask');
    if (sheetMask) {
      sheetMask.onclick = (e) => { if (e.target === sheetMask) closeSheet(); };
    }
  }

  function openImportSheet() {
    openSheet(
      '<div class="grab"></div><h3>导入小说</h3>' +
      '<div class="field"><label>标题</label><input id="impTitle" placeholder="未命名小说" /></div>' +
      '<div class="field"><label>正文</label><textarea id="impText" placeholder="第一章 …&#10;&#10;粘贴小说内容"></textarea></div>' +
      '<div class="field"><label>或选择 TXT 文件</label><input type="file" id="impFile" accept=".txt,.md,.markdown" /></div>' +
      '<button class="btn btn-primary" id="impGo">导入到书架</button>'
    );
    const file = $('#impFile');
    file.onchange = async () => {
      const f = file.files && file.files[0];
      if (!f) return;
      const text = await f.text();
      $('#impText').value = text;
      $('#impTitle').value = f.name.replace(/\.(txt|md|markdown)$/i, '');
    };
    $('#impGo').onclick = async () => {
      const title = $('#impTitle').value.trim();
      const text = $('#impText').value.trim();
      if (!text) return toast('请粘贴或选择正文', 'err');
      const button = $('#impGo');
      button.disabled = true;
      button.textContent = '正在上传并分章…';
      const imported = await importNovel(title, text);
      if (imported) closeSheet();
      else {
        button.disabled = false;
        button.textContent = '重试导入';
      }
    };
  }

  function openStyleSheet() {
    openSheet(
      '<div class="grab"></div><h3>选择画风</h3>' +
      '<div class="grid2">' +
      (store.state.styles || []).map((s) => (
        '<button class="style-card' + (s.id === store.state.prefs.defaultStyle ? ' active' : '') + '" data-style-pick="' + esc(s.id) + '">' +
        '<strong>' + esc(s.label) + '</strong><span>' + esc(s.description || '') + '</span></button>'
      )).join('') +
      '</div>'
    );
    $$('[data-style-pick]').forEach((el) => {
      el.onclick = () => {
        M.store.setPrefs({ defaultStyle: el.dataset.stylePick });
        closeSheet();
        toast('画风：' + styleLabel(el.dataset.stylePick), 'ok');
        render();
      };
    });
  }

  function render() {
    const root = $('#view');
    if (!root) return;
    if (!store.state.onboarded) {
      document.body.classList.add('onboarding');
      $('#app').style.display = 'none';
      let ob = $('#onboardRoot');
      if (!ob) {
        ob = document.createElement('div');
        ob.id = 'onboardRoot';
        document.body.appendChild(ob);
      }
      ob.innerHTML = viewOnboard();
      bind();
      return;
    }
    document.body.classList.remove('onboarding');
    $('#app').style.display = '';
    const ob = $('#onboardRoot');
    if (ob) ob.remove();

    const name = store.state.route.name;
    let html = '';
    if (name === 'novel') html = viewNovel();
    else if (name === 'library') html = viewLibrary();
    else if (name === 'studio') html = viewStudio();
    else if (name === 'comics') html = viewComics();
    else if (name === 'me') html = viewMe();
    else html = viewHome();
    root.innerHTML = html;
    syncNav();
    bind();
  }

  /* ---------- boot ---------- */
  async function boot() {
    M.store.init();
    tickClock();
    setInterval(tickClock, 30000);
    await loadStyles();
    if (store.state.demo && M.DEMO_ALLOWED) {
      store.loadLocalNovels();
      // pre-seed completed comic markers
      Object.keys(store.state.chaptersByNovel).forEach((nid) => {
        (store.state.chaptersByNovel[nid] || []).forEach((c) => {
          if (c.comicStatus === 'completed') store.ensureDemoComic(c.id);
        });
      });
    }
    await Promise.all([loadCategories(), loadSources()]);
    await loadNovels();
    render();
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
