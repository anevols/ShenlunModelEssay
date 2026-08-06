/**
 * 申论阅读站点 - 全局状态与初始化
 *
 * 各模块拆分到独立文件（在 index.html 中按顺序加载）：
 *   utils.js            通用工具函数（escapeHtml / getMeta / detectRepo）
 *   article-parser.js   文章解析（parseArticle）
 *   file-loader.js      文章文件列表加载（listFiles）
 *   sidebar.js          侧边栏渲染与分类筛选
 *   toc.js              右侧本页大纲
 *   article-renderer.js 文章正文渲染
 *   router.js           hash 路由与文章加载
 *   ui-bindings.js      全局 UI 事件绑定
 *   app.js              启动入口（调用 init）
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

// 全局状态
let ARTICLES = [];
let currentSlug = "";
const articleCache = new Map();

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
