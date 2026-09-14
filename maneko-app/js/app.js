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
      } else {
        const list = await api.listNovels();
        store.state.novels = list.map((n) => ({
          id: n.id,
          title: n.title,
          author: n.author || '未知',
          source: n.source || 'upload',
          tags: n.tags || [],
          summary: '',
          favorite: !!n.favorite,
          createdAt: n.created_at ? Date.parse(n.created_at) : Date.now(),
          status: n.status,
          progress: n.progress || 0,
        }));
      }
      store.state.error = null;
    } catch (e) {
      store.state.error = e.message;
      toast('加载失败：' + e.message, 'err');
    }
    store.state.loading = false;
    render();
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
        const raw = await api.chapters(id);
        chapters = raw.map((c) => ({
          id: c.id,
          number: c.chapter_number,
          title: c.title,
          content: c.content,
          comicStatus: c.comic_status,
        }));
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
      store.setComic(chapterId, {
        status: st.status,
        images: st.images || [],
        styleId: store.state.prefs.defaultStyle,
      });
    } catch (_) {
      store.setComic(chapterId, { status: 'pending', images: [] });
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
        store.setComic(chapterId, {
          status: st.status,
          images: st.images || [],
          styleId: store.state.prefs.defaultStyle,
        });
        render();
        if (st.status === 'generating' && n < 180) {
          store.state.pollTimers[chapterId] = setTimeout(tick, 2000);
        } else {
          delete store.state.generating[chapterId];
          if (st.status === 'completed') toast('漫画生成完成', 'ok');
          if (st.status === 'error') toast('生成失败', 'err');
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
      loadNovels();
      return;
    }
    try {
      await api.uploadText(t, text);
      toast('上传成功，正在分章…', 'ok');
      go('home');
      await loadNovels();
    } catch (e) {
      toast(e.message, 'err');
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
      '<p class="muted" style="text-align:center;margin-top:12px">离线可先体验演示；可在「我」连接后端</p>' +
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
    else if (tag && tag !== '全部') list = list.filter((n) => (n.tags || []).indexOf(tag) >= 0);
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
    const tags = ['全部', '收藏', '修仙', '武侠', '科幻', '悬疑', '导入', 'demo'];
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
      (store.state.loading ? skeleton(3) : '') +
      (!store.state.loading && !list.length ? '<div class="empty"><strong>没有匹配的作品</strong>换个关键词，或从「导入」添加小说</div>' : '') +
      list.map(novelCard).join('') +
      '<div class="divider"></div>' +
      '<div class="stats">' +
      '<div class="stat"><b>' + store.state.novels.length + '</b><span>作品</span></div>' +
      '<div class="stat"><b>' + favCount + '</b><span>收藏</span></div>' +
      '<div class="stat"><b>' + (store.state.demo ? 'D' : 'L') + '</b><span>模式</span></div>' +
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
      comicHtml =
        '<div class="empty"><strong>生成失败</strong>可更换风格后重试</div>' +
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
            return (
              '<div class="panel"><img src="' + panelUrl(chapter.id, idx) + '" alt="p' + idx + '" loading="lazy"/>' +
              '<div class="cap">第 ' + idx + ' 幕</div></div>'
            );
          }).join('') +
          '</div>' +
          (comic.status === 'generating'
            ? '<p class="muted" style="margin-bottom:10px">生成中…已出 ' + images.length + ' 格</p>'
            : '') +
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
      '</div>' +

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
    const sources = [
      { id: 'upload', ico: '📁', name: '本地导入', desc: 'TXT / 粘贴正文，离线可用' },
      { id: 'builtin', ico: '⭐', name: '演示佳作', desc: '4 本示例，含分镜演示' },
      { id: 'gutenberg', ico: '🏛', name: 'Gutenberg', desc: '公版书库（需连接后端）' },
    ];
    return (
      '<div class="hero">' +
      '<h2>書庫 · <span class="cyan">书源</span></h2>' +
      '<p>从本地或公版书源导入作品。演示模式完全离线可用。</p>' +
      '<button class="btn btn-primary" id="btnLibImport">导入小说</button>' +
      '</div>' +
      sources.map((s, i) => (
        '<div class="card ' + (i === 1 ? 'cyan' : i === 2 ? 'orange' : '') + '" data-source="' + s.id + '">' +
        '<div class="list-row" style="border:none;padding:0">' +
        '<div class="ico">' + s.ico + '</div>' +
        '<div class="meta"><h4>' + s.name + '</h4><p>' + s.desc + '</p></div>' +
        '<div class="chev">›</div></div></div>'
      )).join('') +
      '<div class="section-title" style="margin-top:8px"><h2>快捷</h2></div>' +
      '<div class="btn-row">' +
      '<button class="btn btn-ghost" id="btnGoStudio">去生成</button>' +
      '<button class="btn btn-ghost" id="btnRefresh">刷新书架</button>' +
      '</div>'
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
        : '<option value="">（请先在演示书架导入，或连接后端）</option>') +
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
          return '<div class="panel"><img src="' + panelUrl(chapterId, idx) + '" alt=""/><div class="cap">P' + idx + '</div></div>';
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
            return '<div class="panel"><img src="' + panelUrl(item.chapterId, idx) + '" alt="" loading="lazy"/><div class="cap">P' + idx + '</div></div>';
          }).join('') +
          '</div></div>'
        );
      }).join('')
    );
  }

  function viewMe() {
    const n = store.state;
    return (
      '<div class="hero">' +
      '<h2>Maneko<span class="cyan"> · 漫猫</span></h2>' +
      '<p>ネオン東京 · ねこ看板娘<br/>Novel in, panels out.</p>' +
      '<div class="stats">' +
      '<div class="stat"><b>' + n.novels.length + '</b><span>作品</span></div>' +
      '<div class="stat"><b>' + (n.demo ? 'DEMO' : 'LIVE') + '</b><span>模式</span></div>' +
      '<div class="stat"><b>MIT</b><span>协议</span></div>' +
      '</div></div>' +

      '<div class="card">' +
      '<div class="section-title"><h2>连接后端</h2></div>' +
      '<div class="field"><label>API Base URL</label>' +
      '<input id="apiBase" placeholder="https://maneko-api.onrender.com" value="' + esc(n.apiBase) + '" /></div>' +
      '<div class="btn-row">' +
      '<button class="btn btn-ghost" id="btnDemoOn">演示模式</button>' +
      '<button class="btn btn-primary" id="btnConnect">连接并同步</button>' +
      '</div>' +
      '<p class="muted" style="margin-top:10px">演示模式：本地书架 + 模拟分镜。连接后端后可真实上传、AI 分章、DashScope 出图。</p>' +
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
      'Maneko 是基于 AgentScope 的 AI 小说→日漫分镜应用。<br/>' +
      'Web / Android 共用 Neon Tokyo 视觉与同一套 API。<br/>' +
      'License: MIT · Maneko Contributors' +
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
    const q = $('#q');
    if (q) {
      q.oninput = () => {
        store.state.search = q.value;
        const listWrap = $('#view');
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

    const btnBack = $('#btnBack');
    if (btnBack) btnBack.onclick = () => { go('home'); loadNovels(); };

    const btnFav = $('#btnFav');
    if (btnFav) {
      btnFav.onclick = () => {
        const novel = store.state.route.params.novel;
        if (!novel) return;
        const on = store.toggleFavorite(novel.id);
        toast(on ? '已收藏' : '已取消收藏', 'ok');
        render();
      };
    }

    $$('[data-ch]').forEach((el) => {
      el.onclick = async () => {
        const id = el.dataset.ch;
        store.state.route.params.chapterId = id;
        const chapters = store.state.route.params.chapters || [];
        const idx = chapters.findIndex((c) => c.id === id);
        const novelId = store.state.route.params.novel && store.state.route.params.novel.id;
        if (novelId && idx >= 0 && chapters.length) {
          M.store.setProgress(novelId, idx / chapters.length);
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
            const raw = await api.chapters(id);
            store.state.chaptersByNovel[id] = raw.map((c) => ({
              id: c.id, number: c.chapter_number, title: c.title,
              content: c.content, comicStatus: c.comic_status,
            }));
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
    const btnDemoOn = $('#btnDemoOn');
    if (btnDemoOn) btnDemoOn.onclick = () => {
      store.setDemo(true, '');
      toast('已切换演示模式', 'ok');
      loadNovels();
    };
    const btnConnect = $('#btnConnect');
    if (btnConnect) btnConnect.onclick = async () => {
      const base = ($('#apiBase').value || '').trim().replace(/\/$/, '');
      if (!base) {
        store.setDemo(true, '');
        toast('未填地址，保持演示模式');
        return;
      }
      store.setDemo(false, base);
      try {
        await api.health();
        toast('连接成功', 'ok');
        await loadStyles();
        await loadNovels();
      } catch (e) {
        store.setDemo(true, base);
        toast('无法连接后端：' + e.message, 'err');
      }
    };
    const defStyle = $('#defStyle');
    if (defStyle) defStyle.onchange = () => M.store.setPrefs({ defaultStyle: defStyle.value });

    const btnExport = $('#btnExport');
    if (btnExport) btnExport.onclick = () => {
      const data = {
        novels: store.state.novels,
        chapters: store.state.chaptersByNovel,
        favorites: store.state.favorites,
        progress: store.state.progress,
        exportedAt: new Date().toISOString(),
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'maneko-shelf.json';
      a.click();
      toast('已导出', 'ok');
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
    $('#impGo').onclick = () => {
      const title = $('#impTitle').value.trim();
      const text = $('#impText').value.trim();
      if (!text) return toast('请粘贴或选择正文', 'err');
      closeSheet();
      importNovel(title, text);
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
    if (store.state.demo) {
      store.loadLocalNovels();
      // pre-seed completed comic markers
      Object.keys(store.state.chaptersByNovel).forEach((nid) => {
        (store.state.chaptersByNovel[nid] || []).forEach((c) => {
          if (c.comicStatus === 'completed') store.ensureDemoComic(c.id);
        });
      });
    }
    await loadNovels();
    render();
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
