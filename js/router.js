/**
 * hash 路由与文章加载
 *
 * - loadArticle：按 slug 加载文章（带缓存），调用 parseArticle + renderArticle
 * - route：解析 hash 切换文章
 */

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
