/**
 * 文章文件列表加载
 *
 * - GitHub 线上：调用 Contents API 列出 articles/ 下所有 .html 文件（跳过 _ 开头的模板）
 * - 本地预览：解析 HTTP 服务器返回的目录列表
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
