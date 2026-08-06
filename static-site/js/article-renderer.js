/**
 * 文章正文渲染
 *
 * - renderArticle：注入标题、meta、正文，更新面包屑与文档标题，触发大纲/上下篇渲染
 * - executeArticleScripts：手动重建 innerHTML 插入的 <script> 使其生效
 * - renderPrevNext：上一篇/下一篇导航
 */

function renderArticle(article) {
  const container = document.getElementById("article-container");
  let metaHtml = article.metaHtml || "";
  // 若 metaHtml 中未含日期，则用 article.date/author 补充生成标准 meta 行
  if ((article.date || article.author) && !/<time/i.test(metaHtml) && !/article-meta/i.test(metaHtml)) {
    const dateHtml = article.date ? `<time datetime="${escapeHtml(article.date)}">${escapeHtml(article.date)}</time>` : "";
    const sep = dateHtml && article.author ? " · " : "";
    const authorHtml = article.author ? escapeHtml(article.author) : "";
    const extraMeta = `<div class="article-meta">${dateHtml}${sep}${authorHtml}</div>`;
    metaHtml = metaHtml ? metaHtml + extraMeta : extraMeta;
  }
  container.innerHTML = article.titleHtml + metaHtml + article.contentHtml;
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
