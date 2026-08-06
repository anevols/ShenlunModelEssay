/**
 * 申论阅读站点脚本
 *
 * 工作方式：
 * 1. 通过 GitHub Contents API 列出 articles/ 下所有 .html 文件（跳过 _ 开头的模板）；
 * 2. 抓取每个文件 <meta> 中的分类/排序/标题等信息，构建目录树；
 * 3. 用 hash 路由（#文件名）切换文章，把 .article-content 注入右侧主区；
 * 4. 自动提取正文 h2/h3 生成右侧“本页大纲”，并维护上一篇/下一篇。
 *
 * 新增文章：把 .html 放进 articles/ 即可，无需改任何代码。
 */

const CONFIG = {
  owner: "",        // 例如 "your-name"，留空则自动识别
  repo: "",         // 例如 "your-repo"，留空则自动识别
  articlesPath: "articles",
  branch: "HEAD",
  defaultSlug: "",
};

let ARTICLES = [];
let currentSlug = "";

function detectRepo() {
  const host = window.location.hostname;
  const path = window.location.pathname.replace(/^\/+/, "");
  const firstSeg = path.split("/")[0];
  if (host.endsWith("github.io") && firstSeg) {
    return { owner: host.split(".")[0], repo: firstSeg };
  }
  if (host.endsWith("github.io")) {
    const owner = host.split(".")[0];
    return { owner, repo: `${owner}.github.io` };
  }
  return { owner: null, repo: null };
}

function getMeta(doc, name) {
  return doc.querySelector(`meta[name="${name}"]`)?.getAttribute("content")?.trim() || "";
}

function parseArticle(htmlText, file) {
  const doc = new DOMParser().parseFromString(htmlText, "text/html");
  const title = getMeta(doc, "article-title") || doc.querySelector("title")?.textContent?.trim() || file.name;

  // 收集文章内嵌的 <style> 和 <script>（外链/内联），渲染时重新插入以生效
  const headStyles = Array.from(doc.querySelectorAll("head style, body style")).map(n => n.outerHTML).join("\n");
  const scripts = Array.from(doc.querySelectorAll("script")).map(n => ({
    src: n.getAttribute("src") || "",
    type: n.getAttribute("type") || "text/javascript",
    code: n.textContent || "",
  }));

  // 1. 标准结构：<div class="article-page"> 内含 .article-header 和 .article-content
  const pageEl = doc.querySelector(".article-page");
  if (pageEl) {
    const contentEl = pageEl.querySelector(".article-content");
    const headerH1 = pageEl.querySelector(".article-header h1");
    const metaEl = pageEl.querySelector(".article-meta");
    return {
      slug: file.name.replace(/\.html$/, ""),
      fileName: file.name,
      url: file.download_url,
      title,
      category: getMeta(doc, "article-category") || "申论",
      order: parseInt(getMeta(doc, "article-order") || "999", 10),
      date: getMeta(doc, "article-date"),
      description: getMeta(doc, "article-description"),
      author: getMeta(doc, "article-author"),
      contentHtml: (contentEl ? contentEl.innerHTML : pageEl.innerHTML) + (headStyles ? "\n" + headStyles : ""),
      titleHtml: headerH1 ? headerH1.outerHTML : `<h1>${escapeHtml(title)}</h1>`,
      metaHtml: metaEl ? metaEl.outerHTML : "",
      scripts,
    };
  }

  // 2. 兼容非标准结构：直接从 body 提取，把首个 h1 拆为标题避免重复
  const bodyEl = doc.body;
  let contentHtml = bodyEl?.innerHTML || "";
  let titleHtml = `<h1>${escapeHtml(title)}</h1>`;
  let metaHtml = "";

  // 创建临时容器，检测并剥离正文最前面的 h1 作为标题（无论嵌套多深）
  const tmp = document.createElement("div");
  tmp.innerHTML = contentHtml;

  // 找第一个 h1（允许嵌套在 div 等容器内），且位置在 body 开头（不是中间/结尾）
  const firstH1 = (() => {
    // 使用深度优先遍历，找到文档流第一个 h1；若它前面已有大量文字/元素则视为正文内标题不剥离
    const walker = document.createTreeWalker(tmp, NodeFilter.SHOW_ELEMENT);
    let firstH1Node = null;
    let distance = 0;
    let n;
    while ((n = walker.nextNode())) {
      if (n.tagName === "H1") { firstH1Node = n; break; }
      // 前面跳过的非容器元素（p/img/pre 等）超过 2 个，认为已进入正文，不再剥离
      if (!/^(div|section|article|main|header|aside|nav|footer|span|style)$/i.test(n.tagName)) {
        distance++;
        if (distance > 3) return null;
      }
    }
    return firstH1Node;
  })();

  if (firstH1) {
    titleHtml = firstH1.outerHTML;
    const h1Parent = firstH1.parentElement;
    const nextAfterH1 = firstH1.nextElementSibling;
    firstH1.remove();
    // 若紧跟在 h1 后面的兄弟元素是 .article-meta 或居中/灰色日期说明行，一并提取为 meta
    if (nextAfterH1 && (
      nextAfterH1.classList.contains("article-meta") ||
      /(text-align\s*:\s*center|color\s*:\s*#(888|999|9ca|6b72|999|99a))/i.test(nextAfterH1.getAttribute("style") || "") ||
      (/^(p|div)$/i.test(nextAfterH1.tagName) && /居中|点击|提示|解析|标签/.test(nextAfterH1.textContent || ""))
    )) {
      metaHtml = nextAfterH1.outerHTML;
      nextAfterH1.remove();
    }
    // 如果 h1 的父容器现在变成空的（且非最外层必要容器），一并移除以避免空 padding
    if (h1Parent && h1Parent !== tmp && h1Parent.children.length === 0 && h1Parent.textContent?.trim() === "") {
      h1Parent.remove();
    }
    contentHtml = tmp.innerHTML;
  }

  if (headStyles) contentHtml = headStyles + "\n" + contentHtml;

  return {
    slug: file.name.replace(/\.html$/, ""),
    fileName: file.name,
    url: file.download_url,
    title,
    category: getMeta(doc, "article-category") || "申论",
    order: parseInt(getMeta(doc, "article-order") || "999", 10),
    date: getMeta(doc, "article-date"),
    description: getMeta(doc, "article-description"),
    author: getMeta(doc, "article-author"),
    contentHtml,
    titleHtml,
    metaHtml,
    scripts,
  };
}

async function listFiles(owner, repo, path) {
  // GitHub 线上：调用 Contents API
  if (owner && repo) {
    const api = `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${CONFIG.branch}`;
    const res = await fetch(api, { headers: { Accept: "application/vnd.github+json" } });
    if (res.status === 404) throw new Error(`未找到目录 ${path}/，请确认该目录已推送到 GitHub。`);
    if (!res.ok) throw new Error(`GitHub API 请求失败：${res.status} ${res.statusText}`);
    const items = await res.json();
    if (!Array.isArray(items)) throw new Error("GitHub API 返回的不是目录列表。");
    return items
      .filter((i) => i.type === "file" && i.name.endsWith(".html") && !i.name.startsWith("_"))
      .map((i) => ({ name: i.name, download_url: i.download_url }));
  }
  // 本地预览：解析 HTTP 服务器返回的目录列表
  const res = await fetch(`${path}/`);
  if (!res.ok) throw new Error(`无法读取本地目录 ${path}/（${res.status}）。`);
  const html = await res.text();
  const doc = new DOMParser().parseFromString(html, "text/html");
  const links = Array.from(doc.querySelectorAll("a"))
    .map((a) => a.getAttribute("href") || "")
    .filter((h) => h.endsWith(".html") && !h.startsWith("/") && !h.startsWith("_"));
  const base = `${path}/`;
  return links.map((name) => ({ name: decodeURIComponent(name), download_url: base + name }));
}

function renderSidebar() {
  const nav = document.getElementById("sidebar-nav");
  nav.innerHTML = "";
  if (ARTICLES.length === 0) {
    nav.innerHTML = `<div class="sidebar-status">还没有文章。把 HTML 放进 articles/ 即可。</div>`;
    return;
  }
  const groups = {};
  for (const a of ARTICLES) (groups[a.category] = groups[a.category] || []).push(a);
  const groupNames = Object.keys(groups).sort((a, b) => a.localeCompare(b, "zh"));
  for (const gname of groupNames) {
    const group = document.createElement("div");
    group.className = "sidebar-group";
    const titleEl = document.createElement("div");
    titleEl.className = "sidebar-group-title";
    titleEl.tabIndex = 0;
    titleEl.innerHTML = `<span class="sidebar-arrow">▾</span>${escapeHtml(gname)}`;
    const itemsWrap = document.createElement("div");
    itemsWrap.className = "sidebar-group-items";
    titleEl.addEventListener("click", () => toggleGroup(titleEl, itemsWrap));
    titleEl.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleGroup(titleEl, itemsWrap); } });
    group.appendChild(titleEl);
    group.appendChild(itemsWrap);
    for (const a of groups[gname]) {
      const item = document.createElement("a");
      item.className = "sidebar-item";
      item.href = `#${a.slug}`;
      item.dataset.slug = a.slug;
      item.dataset.title = a.title.toLowerCase();
      item.textContent = a.title;
      itemsWrap.appendChild(item);
    }
    nav.appendChild(group);
  }
}

function toggleGroup(titleEl, itemsWrap) {
  const collapsed = itemsWrap.classList.toggle("collapsed");
  titleEl.classList.toggle("collapsed", collapsed);
}

function markActive(slug) {
  document.querySelectorAll(".sidebar-item").forEach((el) => {
    el.classList.toggle("active", el.dataset.slug === slug);
  });
  const active = document.querySelector(".sidebar-item.active");
  if (active) active.scrollIntoView({ block: "nearest" });
}

function renderArticle(article) {
  const container = document.getElementById("article-container");
  container.innerHTML = article.titleHtml + article.metaHtml + article.contentHtml;
  document.getElementById("breadcrumb").innerHTML =
    `<a href="#" data-breadcrumb="home">首页</a><span class="breadcrumb-sep">/</span>` +
    `<a href="#" data-breadcrumb="category" data-category="${escapeHtml(article.category)}">${escapeHtml(article.category)}</a><span class="breadcrumb-sep">/</span>` +
    `<span>${escapeHtml(article.title)}</span>`;
  document.title = `${article.title} · 申论`;
  buildHeadingIds(container);
  renderToc(container);
  renderPrevNext(article);
  markActive(article.slug);
  window.scrollTo({ top: 0, behavior: "auto" });
  highlightTocOnScroll();
  // 执行文章内嵌脚本（外链/内联）
  if (article.scripts && article.scripts.length) executeArticleScripts(container, article.scripts);
}

function executeArticleScripts(container, scripts) {
  // innerHTML 插入的 script 不会执行，需手动重建 script 元素追加到 DOM
  // 外链脚本按顺序串行加载，内联脚本按顺序立即执行
  let chain = Promise.resolve();
  scripts.forEach((s) => {
    chain = chain.then(() => new Promise((resolve) => {
      const sc = document.createElement("script");
      if (s.type && s.type !== "text/javascript") sc.type = s.type;
      if (s.src) {
        sc.src = s.src;
        sc.async = false;
        sc.onload = () => resolve();
        sc.onerror = () => resolve();
        container.appendChild(sc);
      } else if (s.code.trim()) {
        sc.textContent = s.code;
        container.appendChild(sc);
        resolve();
      } else {
        resolve();
      }
    }));
  });
}

function buildHeadingIds(container) {
  const heads = container.querySelectorAll("h2, h3");
  const used = {};
  heads.forEach((h, i) => {
    const text = (h.textContent || "").trim() || `section-${i}`;
    let base = text.toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, "").replace(/\s+/g, "-").slice(0, 50) || `h-${i}`;
    let id = base, n = 2;
    while (used[id]) { id = `${base}-${n++}`; }
    used[id] = true;
    h.id = id;
  });
}

function renderToc(container) {
  const list = document.getElementById("toc-list");
  const heads = container.querySelectorAll("h2, h3");
  if (heads.length === 0) { list.innerHTML = `<div class="toc-empty">本页无子标题</div>`; return; }
  list.innerHTML = "";
  heads.forEach((h) => {
    const a = document.createElement("a");
    a.href = `#${h.id}`;
    a.className = `toc-link ${h.tagName.toLowerCase()}`;
    a.textContent = h.textContent;
    a.dataset.target = h.id;
    list.appendChild(a);
  });
}

function highlightTocOnScroll() {
  const heads = Array.from(document.querySelectorAll("#article-container h2, #article-container h3"));
  const links = Array.from(document.querySelectorAll(".toc-link"));
  if (heads.length === 0) return;
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const id = entry.target.id;
          links.forEach((l) => l.classList.toggle("active", l.dataset.target === id));
        }
      });
    },
    { rootMargin: "-80px 0px -70% 0px", threshold: 0 }
  );
  heads.forEach((h) => observer.observe(h));
}

function renderPrevNext(article) {
  const box = document.getElementById("prev-next");
  const idx = ARTICLES.findIndex((a) => a.slug === article.slug);
  const prev = idx > 0 ? ARTICLES[idx - 1] : null;
  const next = idx >= 0 && idx < ARTICLES.length - 1 ? ARTICLES[idx + 1] : null;
  let html = "";
  if (prev) html += `<a class="pn-link prev" href="#${prev.slug}"><span class="pn-label">← 上一篇</span><span class="pn-title">${escapeHtml(prev.title)}</span></a>`;
  else html += `<span></span>`;
  if (next) html += `<a class="pn-link next" href="#${next.slug}"><span class="pn-label">下一篇 →</span><span class="pn-title">${escapeHtml(next.title)}</span></a>`;
  box.innerHTML = html;
}

const articleCache = new Map();
async function loadArticle(slug) {
  const article = ARTICLES.find((a) => a.slug === slug);
  if (!article) {
    document.getElementById("article-container").innerHTML = `<div class="loading error">未找到文章：${escapeHtml(slug)}</div>`;
    return;
  }
  currentSlug = slug;
  if (articleCache.has(slug)) { renderArticle(articleCache.get(slug)); return; }
  const container = document.getElementById("article-container");
  container.innerHTML = `<div class="loading">正在加载文章…</div>`;
  try {
    const res = await fetch(article.url);
    const text = await res.text();
    const parsed = parseArticle(text, article);
    Object.assign(article, parsed);
    articleCache.set(slug, article);
    renderArticle(article);
  } catch (e) {
    container.innerHTML = `<div class="loading error">加载失败：${escapeHtml(e.message)}</div>`;
  }
}

function route() {
  const hash = window.location.hash.replace(/^#/, "").trim();
  let slug = hash;
  if (!slug) slug = CONFIG.defaultSlug || (ARTICLES[0] && ARTICLES[0].slug) || "";
  if (!slug) {
    document.getElementById("article-container").innerHTML = `<div class="loading">还没有任何文章。把 HTML 文件放进 articles/ 目录即可。</div>`;
    return;
  }
  if (slug !== currentSlug) loadArticle(slug);
}

function bindSearch() {
  const input = document.getElementById("search-input");
  input.addEventListener("input", () => {
    const q = input.value.trim().toLowerCase();
    document.querySelectorAll(".sidebar-item").forEach((el) => {
      el.classList.toggle("hidden", q && !el.dataset.title.includes(q));
    });
    document.querySelectorAll(".sidebar-group").forEach((g) => {
      g.style.display = g.querySelector(".sidebar-item:not(.hidden)") ? "" : "none";
    });
  });
}

function bindSidebarToggle() {
  const sidebar = document.getElementById("sidebar");
  const mask = document.getElementById("sidebar-mask");
  const toggle = document.getElementById("sidebar-toggle");
  const open = () => { sidebar.classList.add("open"); mask.classList.add("open"); };
  const close = () => { sidebar.classList.remove("open"); mask.classList.remove("open"); };
  toggle.addEventListener("click", () => sidebar.classList.contains("open") ? close() : open());
  mask.addEventListener("click", close);
  sidebar.addEventListener("click", (e) => {
    if (e.target.classList.contains("sidebar-item") && window.innerWidth <= 900) close();
  });
}

function bindBreadcrumb() {
  document.getElementById("breadcrumb").addEventListener("click", (e) => {
    const target = e.target.closest("[data-breadcrumb]");
    if (!target) return;
    e.preventDefault();
    if (target.dataset.breadcrumb === "home") {
      clearCategoryFilter();
    } else if (target.dataset.breadcrumb === "category") {
      filterByCategory(target.dataset.category);
    }
  });
}

function filterByCategory(category) {
  const groups = document.querySelectorAll(".sidebar-group");
  let activeGroup = null;
  groups.forEach((g) => {
    const title = g.querySelector(".sidebar-group-title");
    const isMatch = title.textContent.replace(/^▾\s*/, "") === category;
    g.style.display = isMatch ? "" : "none";
    if (isMatch) {
      activeGroup = g;
      title.classList.remove("collapsed");
      g.querySelector(".sidebar-group-items")?.classList.remove("collapsed");
    }
  });
  const bc = document.getElementById("breadcrumb");
  const catLink = bc.querySelector('[data-breadcrumb="category"]');
  if (catLink) catLink.classList.toggle("filtering", true);
  const sidebar = document.getElementById("sidebar");
  if (sidebar && window.innerWidth <= 900) sidebar.classList.add("open"), document.getElementById("sidebar-mask")?.classList.add("open");
}

function clearCategoryFilter() {
  document.querySelectorAll(".sidebar-group").forEach((g) => { g.style.display = ""; });
  const bc = document.getElementById("breadcrumb");
  const catLink = bc.querySelector('[data-breadcrumb="category"]');
  if (catLink) catLink.classList.remove("filtering");
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function showError(msg) {
  document.getElementById("sidebar-nav").innerHTML = `<div class="sidebar-status error">${escapeHtml(msg)}</div>`;
  document.getElementById("article-container").innerHTML = `<div class="loading error">${escapeHtml(msg)}</div>`;
}

async function init() {
  const { owner: dOwner, repo: dRepo } = detectRepo();
  const owner = CONFIG.owner || dOwner;
  const repo = CONFIG.repo || dRepo;
  bindSearch();
  bindSidebarToggle();
  bindBreadcrumb();
  window.addEventListener("hashchange", route);
  try {
    const files = await listFiles(owner, repo, CONFIG.articlesPath);
    if (files.length === 0) { ARTICLES = []; renderSidebar(); route(); return; }
    const metas = await Promise.all(files.map(async (f) => {
      try {
        const res = await fetch(f.download_url);
        const text = await res.text();
        return parseArticle(text, f);
      } catch (e) {
        return { slug: f.name.replace(/\.html$/, ""), fileName: f.name, url: f.download_url,
          title: f.name.replace(/\.html$/, ""), category: "申论", order: 999,
          date: "", description: "", author: "",
          contentHtml: `<p>（读取失败：${escapeHtml(e.message)}）</p>`,
          titleHtml: `<h1>${escapeHtml(f.name)}</h1>`, metaHtml: "", scripts: [] };
      }
    }));
    ARTICLES = metas.sort((a, b) => {
      if (a.category !== b.category) return a.category.localeCompare(b.category, "zh");
      return a.order - b.order;
    });
    for (const a of ARTICLES) articleCache.set(a.slug, a);
    renderSidebar();
    route();
  } catch (e) {
    showError(e.message);
  }
}

init();
