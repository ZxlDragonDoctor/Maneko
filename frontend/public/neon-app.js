/* Neon Tokyo demo — prefers same-origin (Vite :5173) then falls back to backend :8001 */
const CANDIDATES = ["", "http://127.0.0.1:8001"];

async function api(path, opts) {
  let lastErr;
  for (const base of CANDIDATES) {
    try {
      const res = await fetch(base + path, opts);
      if (!res.ok) {
        let detail = res.statusText;
        try {
          const body = await res.json();
          detail = typeof body.detail === "string" ? body.detail : JSON.stringify(body);
        } catch (_) {}
        // 4xx is a real API error — don't retry other hosts for upload validation
        if (res.status < 500) throw new Error(detail);
        lastErr = new Error(detail);
        continue;
      }
      return res.json();
    } catch (e) {
      if (e.message && !/Failed to fetch|NetworkError|CORS/i.test(e.message)) throw e;
      lastErr = e;
    }
  }
  throw lastErr || new Error("后端不可达 :8001");
}

function comicBase(chapterId, n) {
  const idx = String(n).padStart(2, "0");
  // same-origin first (vite proxy), absolute fallback via onerror
  return {
    src: `/comics/${chapterId}/panel_${idx}.png`,
    altSrc: `http://127.0.0.1:8001/comics/${chapterId}/panel_${idx}.png`,
  };
}

const DEMO_NOVEL = "afdf3e57-c6ba-4f4e-8cb4-e01d3f03152d";

const state = {
  view: "home",
  currentNovel: null,
  currentChapter: null,
  _chapters: [],
  tab: "split",
  selectedFile: null,
};

function el(id) {
  return document.getElementById(id);
}

function toast(msg) {
  const t = document.createElement("div");
  t.className = "toast";
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3200);
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function setView(name) {
  state.view = name;
  ["home", "reader", "comics"].forEach((v) => {
    const node = el("view-" + v);
    if (node) node.hidden = v !== name;
  });
  document.querySelectorAll(".nav-links a").forEach((a) => {
    a.classList.toggle("active", a.dataset.view === name);
  });
  if (name === "home") loadNovels();
  if (name === "reader" || name === "comics") {
    if (!state.currentNovel) {
      openNovelWithChapters(DEMO_NOVEL)
        .then(() => {
          if (name === "comics") setView("comics");
        })
        .catch((err) => toast(err.message || "无法打开示例小说"));
      return;
    }
    if (name === "comics") loadComicsGrid();
    if (name === "reader") {
      renderChapters();
      renderComic(state.currentChapter);
    }
  }
}

function setTab(tab) {
  state.tab = tab;
  document.querySelectorAll(".tab").forEach((b) => {
    const on = b.dataset.tab === tab;
    b.classList.toggle("active", on);
    b.setAttribute("aria-selected", on ? "true" : "false");
  });
  const novel = el("panel-novel");
  const comic = el("panel-comic");
  const split = el("split-layout");
  if (tab === "split") {
    split.style.gridTemplateColumns = "";
    novel.hidden = false;
    comic.hidden = false;
  } else if (tab === "novel") {
    split.style.gridTemplateColumns = "1fr";
    novel.hidden = false;
    comic.hidden = true;
  } else {
    split.style.gridTemplateColumns = "1fr";
    novel.hidden = true;
    comic.hidden = false;
  }
}

function badge(status) {
  if (status === "completed") return '<span class="badge badge-ok">已解析</span>';
  if (status === "error") return '<span class="badge badge-err">解析失败</span>';
  return '<span class="badge badge-warn">处理中</span>';
}

async function loadNovels() {
  const list = el("novel-list");
  list.innerHTML = '<div class="card"><p>加载書庫…</p></div>';
  let novels;
  try {
    novels = await api("/api/novels/");
  } catch (e) {
    list.innerHTML = `<div class="card orange-border"><h3>后端未连接</h3><p>${escapeHtml(e.message)}<br/>请先启动 backend :8001 与前端</p></div>`;
    return;
  }
  if (!novels.length) {
    list.innerHTML = '<div class="card"><h3>書庫是空的</h3><p>上传一本小说开始创作</p></div>';
    return;
  }
  list.innerHTML = novels
    .map(
      (n, i) => `
    <article class="card ${i % 3 === 1 ? "cyan-border" : i % 3 === 2 ? "orange-border" : ""}">
      ${badge(n.status)}
      <h3>${escapeHtml(n.title)}</h3>
      <p>${new Date(n.created_at).toLocaleString()}</p>
      <div class="card-footer">
        <button type="button" class="btn btn-primary" style="padding:0.45rem 0.85rem;font-size:0.65rem;" data-open="${n.id}">読む</button>
        <button type="button" class="btn btn-ghost" style="padding:0.45rem 0.85rem;font-size:0.65rem;" data-comics="${n.id}">漫画集</button>
        <button type="button" class="btn btn-orange" style="padding:0.45rem 0.85rem;font-size:0.65rem;" data-del="${n.id}" data-title="${escapeHtml(n.title)}">删除</button>
      </div>
    </article>`
    )
    .join("");
}

function renderChapters() {
  const box = el("chapter-list");
  const list = state._chapters || [];
  if (!list.length) {
    box.innerHTML = `<div class="chapter-item"><div class="chapter-body">${escapeHtml(state.currentNovel?.content || "暂无章节")}</div></div>`;
    return;
  }
  box.innerHTML = list
    .map((ch) => {
      const active = state.currentChapter?.id === ch.id;
      return `
      <article class="chapter-item ${active ? "active" : ""}" data-ch="${ch.id}" tabindex="0" role="button">
        <h4>${escapeHtml(ch.title)}</h4>
        <div class="meta">第 ${ch.chapter_number} 章 · 漫画 ${escapeHtml(ch.comic_status || "—")}</div>
        <div class="chapter-body">${escapeHtml((ch.content || "").slice(0, 320))}${(ch.content || "").length > 320 ? "…" : ""}</div>
      </article>`;
    })
    .join("");
}

async function renderComic(chapter) {
  const grid = el("comic-grid");
  const statusEl = el("comic-status");
  if (!chapter) {
    statusEl.textContent = "—";
    grid.innerHTML = '<div class="placeholder">请选择章节</div>';
    return;
  }
  statusEl.textContent = chapter.comic_status || "—";
  grid.innerHTML = '<div class="placeholder">加载分镜…</div>';
  try {
    const st = await api(`/api/comics/${chapter.id}/status`);
    statusEl.textContent = st.status;
    if (st.status !== "completed" || !st.images?.length) {
      grid.innerHTML = `<div class="placeholder">状态: ${escapeHtml(st.status)}</div>`;
      return;
    }
    grid.innerHTML = st.images
      .map((_, i) => {
        const { src, altSrc } = comicBase(chapter.id, i + 1);
        return `
      <figure class="comic-frame" style="margin:0">
        <img src="${src}" alt="分镜 ${i + 1}" loading="lazy"
             onerror="if(!this.dataset.f){this.dataset.f=1;this.src='${altSrc}'}else{this.style.display='none';this.insertAdjacentHTML('afterend','<div class=&quot;placeholder&quot;>分镜 ${i + 1} 加载失败</div>')}" />
        <figcaption class="cap">第 ${i + 1} 幕</figcaption>
      </figure>`;
      })
      .join("");
  } catch (e) {
    statusEl.textContent = "error";
    grid.innerHTML = `<div class="placeholder">${escapeHtml(e.message)}</div>`;
  }
}

async function openNovelWithChapters(id) {
  const novel = await api(`/api/novels/${id}`);
  const chapters = await api(`/api/novels/${id}/chapters`);
  state.currentNovel = novel;
  state._chapters = chapters;
  state.currentChapter = chapters[0] || null;
  el("reader-title").textContent = novel.title;
  el("chapter-count").textContent = `${chapters.length} 章`;
  renderChapters();
  await renderComic(state.currentChapter);
  setView("reader");
  setTab(state.tab);
}

async function loadComicsGrid() {
  const grid = el("comics-grid");
  const novel = state.currentNovel;
  if (!novel) {
    grid.innerHTML = '<div class="card"><p>先打开一部作品</p></div>';
    return;
  }
  el("comics-sub").textContent = `COLLECTION · ${novel.title}`;
  let chapters = state._chapters;
  if (!chapters?.length) {
    try {
      chapters = await api(`/api/novels/${novel.id}/chapters`);
      state._chapters = chapters;
    } catch (_) {
      chapters = [];
    }
  }
  const parts = [];
  for (const ch of chapters) {
    try {
      const st = await api(`/api/comics/${ch.id}/status`);
      if (st.status !== "completed" || !st.images?.length) continue;
      st.images.forEach((_, i) => {
        const { src, altSrc } = comicBase(ch.id, i + 1);
        parts.push(`
        <figure class="comic-frame" style="margin:0">
          <img src="${src}" alt="${escapeHtml(ch.title)} 分镜${i + 1}" loading="lazy"
               onerror="if(!this.dataset.f){this.dataset.f=1;this.src='${altSrc}'}" />
          <figcaption class="cap">${escapeHtml(ch.title)} · ${i + 1}</figcaption>
        </figure>`);
      });
    } catch (_) {}
  }
  grid.innerHTML = parts.join("") || '<div class="card"><h3>还没有完成的分镜</h3><p>进入阅读页查看</p></div>';
}

document.addEventListener("click", async (e) => {
  const t = e.target;
  const viewEl = t.closest?.("[data-view]");
  if (viewEl) {
    e.preventDefault();
    setView(viewEl.dataset.view);
    return;
  }
  if (t.closest?.("#logo-home")) {
    e.preventDefault();
    setView("home");
    return;
  }
  if (t.closest?.(".tab")) {
    setTab(t.closest(".tab").dataset.tab);
    return;
  }
  const openBtn = t.closest?.("[data-open]");
  if (openBtn) {
    try {
      await openNovelWithChapters(openBtn.dataset.open);
    } catch (err) {
      toast(err.message);
    }
    return;
  }
  const comicsBtn = t.closest?.("[data-comics]");
  if (comicsBtn) {
    try {
      await openNovelWithChapters(comicsBtn.dataset.comics);
      setView("comics");
    } catch (err) {
      toast(err.message);
    }
    return;
  }
  const delBtn = t.closest?.("[data-del]");
  if (delBtn) {
    if (!confirm(`删除《${delBtn.dataset.title}》？`)) return;
    try {
      await api(`/api/novels/${delBtn.dataset.del}`, { method: "DELETE" });
      toast("已删除");
      loadNovels();
    } catch (err) {
      toast(err.message);
    }
    return;
  }
  if (t.closest?.("[data-ch]")) {
    const art = t.closest("[data-ch]");
    const ch = (state._chapters || []).find((x) => x.id === art.dataset.ch);
    if (ch) {
      state.currentChapter = ch;
      renderChapters();
      renderComic(ch);
    }
    return;
  }
  if (t.closest?.("#btn-upload")) {
    el("upload-modal").hidden = false;
    return;
  }
  if (t.closest?.("#btn-open-demo")) {
    try {
      await openNovelWithChapters(DEMO_NOVEL);
    } catch (err) {
      toast(err.message);
    }
    return;
  }
  if (t.closest?.("#btn-cancel-upload") || t.id === "btn-cancel-upload") {
    el("upload-modal").hidden = true;
    return;
  }
  // click backdrop closes modal
  if (t.id === "upload-modal") {
    el("upload-modal").hidden = true;
  }
});

el("file-input")?.addEventListener("change", (ev) => {
  const f = ev.target.files?.[0];
  state.selectedFile = f || null;
  el("btn-do-upload").disabled = !f;
  el("upload-error").textContent = "";
  el("drop-label").textContent = f
    ? `${f.name} · ${(f.size / 1024).toFixed(1)} KB`
    : "点击选择 .txt / .md · 最大 10MB";
  if (f && !/\.(txt|md|markdown)$/i.test(f.name)) {
    el("upload-error").textContent = "只支持 .txt / .md";
    el("btn-do-upload").disabled = true;
  }
});

el("btn-do-upload")?.addEventListener("click", async () => {
  const f = state.selectedFile;
  if (!f) return;
  const fd = new FormData();
  fd.append("file", f);
  el("btn-do-upload").disabled = true;
  el("btn-do-upload").textContent = "上传中…";
  try {
    let res;
    let data;
    for (const base of CANDIDATES) {
      res = await fetch(base + "/api/novels/upload", { method: "POST", body: fd });
      data = await res.json().catch(() => ({}));
      if (res.ok) break;
      if (res.status < 500) break;
    }
    if (!res.ok) throw new Error(data.detail || "上传失败");
    el("upload-modal").hidden = true;
    toast(`已上传《${data.title}》`);
    await openNovelWithChapters(data.id);
  } catch (e) {
    el("upload-error").textContent = e.message;
  } finally {
    el("btn-do-upload").textContent = "上传";
    el("btn-do-upload").disabled = !state.selectedFile;
  }
});

loadNovels();
