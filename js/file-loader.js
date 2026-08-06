/**
 * 文章文件列表加载与并发控制
 *
 * 三种文章清单获取方式（按优先级）：
 * 1. loadManifest：fetch articles/manifest.json（推荐，最快）
 *    —— 本地预览和 GitHub Pages 都可用，一次请求拿到全部文章 meta。
 *    —— manifest.json 由 scripts/generate-manifest.js 生成（本地手动跑 / GitHub Actions 自动跑）。
 * 2. listFiles + fetchArticleMeta：调 GitHub Contents API 列文件，再并发抓 meta（回退方案）
 *    —— 当 manifest.json 不存在时使用，避免破坏旧仓库。
 *
 * 性能：方案 1 首屏只需一次 fetch；方案 2 仍受 GitHub API 限流影响。
 */

/**
 * 尝试加载 manifest.json。成功返回文章 meta 数组，失败返回 null（调用方回退到 listFiles）。
 */
async function loadManifest(articlesPath) {
  try {
    const res = await fetch(`${articlesPath}/manifest.json`, { cache: "no-cache" });
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return null;
    // 规范化字段：补全 download_url / url，正文相关字段留空（loadArticle 时按需加载）
    const base = `${articlesPath}/`;
    return data.map((m) => ({
      name: m.file,
      slug: m.slug || (m.file ? m.file.replace(/\.html$/, "") : ""),
      fileName: m.file,
      url: base + encodeURIComponent(m.file),
      download_url: base + encodeURIComponent(m.file),
      title: m.title || m.file || "",
      category: m.category || "申论",
      order: parseInt(m.order || "999", 10),
      date: m.date || "",
      author: m.author || "",
      description: m.description || "",
      // 正文相关字段留空，loadArticle 时再填充
      contentHtml: "",
      titleHtml: "",
      metaHtml: "",
      scripts: [],
    }));
  } catch (e) {
    return null;
  }
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
 * 仅在 manifest.json 不可用（回退方案）时使用。
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
