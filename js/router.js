/**
 * hash 路由与文章加载（按需加载正文）
 *
 * - loadArticle：按 slug 加载文章正文。命中缓存直接渲染；否则 fetch 全文 →
 *   parseArticle → 写入 LRU 缓存 → 渲染。
 *   首屏 init 只取了 meta，正文相关字段（contentHtml 等）为空，首次访问时才填充。
 * - route：解析 hash 切换文章
 */

async function loadArticle(slug) {
  const article = ARTICLES.find((a) => a.slug === slug);
  if (!article) {
    document.getElementById("article-container").innerHTML = `<div class="loading error">未找到文章：${escapeHtml(slug)}</div>`;
    return;
  }
  currentSlug = slug;

  // 命中正文缓存：LRU 提至最新并直接渲染（同时清理可能因上限调小而超出的旧条目）
  if (articleCache.has(slug) && articleCache.get(slug).contentHtml) {
    touchCache(slug);
    evictCacheIfNeeded();
    renderArticle(articleCache.get(slug));
    return;
  }

  const container = document.getElementById("article-container");
  container.innerHTML = `<div class="loading">正在加载文章…</div>`;
  try {
    const res = await fetch(article.url);
    const text = await res.text();
    const parsed = parseArticle(text, article);
    Object.assign(article, parsed);
    // 写入 LRU 缓存并按上限淘汰最久未访问的正文
    articleCache.set(slug, article);
    touchCache(slug);
    evictCacheIfNeeded();
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
