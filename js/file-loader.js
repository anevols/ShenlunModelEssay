/**
 * 文章文件列表加载与并发控制
 *
 * - listFiles：GitHub 线上调用 Contents API / 本地解析目录列表
 * - fetchArticleMeta：只下载并解析文章的 meta 信息（标题/分类/序号/日期等），
 *                     不保留正文 contentHtml，避免首屏把所有文章正文都拉进内存
 * - mapWithConcurrency：限制并发数，避免上百篇文章同时 fetch 触发 GitHub API 限流
 */

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

/**
 * 并发执行多个异步任务，限制同时进行的数量。
 * @param {Array} items 待处理数据
 * @param {(item, index) => Promise<any>} worker 单项处理函数
 * @param {number} limit 最大并发数
 * @returns {Promise<Array>} 按原顺序返回结果
 */
async function mapWithConcurrency(items, worker, limit) {
  const results = new Array(items.length);
  let cursor = 0;
  async function run() {
    while (cursor < items.length) {
      const i = cursor++;
      try { results[i] = await worker(items[i], i); }
      catch (e) { results[i] = undefined; }
    }
  }
  const runners = Array.from({ length: Math.min(limit, items.length) }, run);
  await Promise.all(runners);
  return results;
}

/**
 * 只获取文章的 meta 信息（用于首屏目录树），不保留正文。
 * 解析得到 meta 字段后丢弃 contentHtml/titleHtml/metaHtml/scripts，
 * 留待 loadArticle 时按需加载正文再走完整 parseArticle。
 */
async function fetchArticleMeta(file) {
  const res = await fetch(file.download_url);
  const text = await res.text();
  const doc = new DOMParser().parseFromString(text, "text/html");
  const title = getMeta(doc, "article-title") || doc.querySelector("title")?.textContent?.trim() || file.name;
  return {
    name: file.name,        // 保留原始文件名，供 loadArticle 时复用 parseArticle(text, article)
    slug: file.name.replace(/\.html$/, ""),
    fileName: file.name,
    url: file.download_url,
    title,
    category: getMeta(doc, "article-category") || "申论",
    order: parseInt(getMeta(doc, "article-order") || "999", 10),
    date: getMeta(doc, "article-date"),
    description: getMeta(doc, "article-description"),
    author: getMeta(doc, "article-author"),
    // 正文相关字段留空，loadArticle 时再填充
    contentHtml: "",
    titleHtml: "",
    metaHtml: "",
    scripts: [],
  };
}
