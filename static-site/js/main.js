/**
 * 申论阅读站点 - 全局状态与初始化
 *
 * 各模块拆分到独立文件（在 index.html 中按顺序加载）：
 *   utils.js            通用工具函数（escapeHtml / getMeta / detectRepo）
 *   article-parser.js   文章解析（parseArticle）
 *   file-loader.js      文章文件列表加载、meta 抓取、并发控制
 *   sidebar.js          侧边栏渲染与分类筛选
 *   toc.js              右侧本页大纲
 *   article-renderer.js 文章正文渲染
 *   router.js           hash 路由与文章加载（按需加载正文）
 *   ui-bindings.js      全局 UI 事件绑定
 *   app.js              启动入口（调用 init）
 *
 * 性能设计：
 * - 首屏优先 fetch articles/manifest.json（一次请求拿全部文章 meta，本地/GitHub Pages 通用）；
 *   manifest 不存在时回退到 GitHub Contents API + 并发抓 meta。
 * - 首屏只取 meta 不下载正文，立即渲染目录树，避免文章数量增多时首屏白屏与内存暴涨。
 * - 点击文章 / hash 路由时才按需加载正文，并使用 LRU 缓存限制常驻内存的文章正文数量。
 * - manifest.json 由 scripts/generate-manifest.js 生成（本地手动跑 / GitHub Actions 自动跑）。
 *
 * 新增文章：把 .html 放进 articles/ 即可，无需改任何代码。
 */

const CONFIG = {
  owner: "",        // 例如 "your-name"，留空则自动识别
  repo: "",         // 例如 "your-repo"，留空则自动识别
  articlesPath: "articles",
  branch: "HEAD",
  defaultSlug: "",
  metaConcurrency: 6,   // 首屏抓取 meta 的最大并发数
  contentCacheLimit: 8, // 正文 LRU 缓存上限（篇），超出淘汰最久未访问的
};

// 全局状态
let ARTICLES = [];
let currentSlug = "";

// 正文缓存：仅缓存已加载正文的文章，带 LRU 淘汰，避免大量正文常驻内存
const articleCache = new Map();

function showError(msg) {
  document.getElementById("sidebar-nav").innerHTML = `<div class="sidebar-status error">${escapeHtml(msg)}</div>`;
  document.getElementById("article-container").innerHTML = `<div class="loading error">${escapeHtml(msg)}</div>`;
}

/**
 * LRU 缓存操作：访问/写入时把 key 移到最新位置；超过上限删除最旧条目。
 */
function touchCache(key) {
  if (articleCache.has(key)) {
    const v = articleCache.get(key);
    articleCache.delete(key);
    articleCache.set(key, v);
  }
}
function evictCacheIfNeeded() {
  while (articleCache.size > CONFIG.contentCacheLimit) {
    const oldest = articleCache.keys().next().value;
    articleCache.delete(oldest);
  }
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
    // 优先用 manifest.json（一次 fetch 拿全部 meta，本地/GitHub Pages 都可用，无限流风险）
    let metas = await loadManifest(CONFIG.articlesPath);
    if (!metas) {
      // 回退：manifest 不存在时，调 Contents API 列文件 + 并发抓 meta
      const files = await listFiles(owner, repo, CONFIG.articlesPath);
      if (files.length === 0) { ARTICLES = []; renderSidebar(); route(); return; }
      metas = await mapWithConcurrency(files, async (f) => {
        try { return await fetchArticleMeta(f); }
        catch (e) {
          return { slug: f.name.replace(/\.html$/, ""), fileName: f.name, url: f.download_url,
            title: f.name.replace(/\.html$/, ""), category: "申论", order: 999,
            date: "", description: "", author: "",
            contentHtml: "", titleHtml: "", metaHtml: "", scripts: [] };
        }
      }, CONFIG.metaConcurrency);
    }
    ARTICLES = metas.filter(Boolean).sort((a, b) => {
      if (a.category !== b.category) return a.category.localeCompare(b.category, "zh");
      return a.order - b.order;
    });
    // 首屏不预加载正文，目录树先渲染出来，route() 触发当前文章的按需加载
    renderSidebar();
    route();
  } catch (e) {
    showError(e.message);
  }
}
