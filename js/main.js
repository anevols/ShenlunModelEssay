/**
 * 文章列表自动发现
 * 通过 GitHub API 列出 articles/ 目录下的 .html 文件，
 * 抓取每个文件 <meta> 中的标题/日期/摘要/标签，渲染为卡片。
 *
 * 仅需在 articles/ 目录下新增 HTML 文件即可发布新文章。
 */

// ============ 配置（自定义域名时需要手动填写）============
const CONFIG = {
  owner: "", // 例如 "your-name"，留空则自动检测
  repo: "",  // 例如 "your-repo"，留空则自动检测
  articlesPath: "articles",
  branch: "HEAD", // GitHub Pages 服务的分支，HEAD 表示默认分支
};
// ========================================================

/** 从当前 URL 自动推断 GitHub owner / repo */
function detectRepo() {
  const host = window.location.hostname;
  const path = window.location.pathname.replace(/^\/+/, "");
  const firstSeg = path.split("/")[0];

  // username.github.io/repo/...
  if (host.endsWith("github.io") && firstSeg) {
    return { owner: host.split(".")[0], repo: firstSeg };
  }
  // username.github.io/  (user page)
  if (host.endsWith("github.io")) {
    const owner = host.split(".")[0];
    return { owner, repo: `${owner}.github.io` };
  }
  return { owner: null, repo: null };
}

/** 将 <meta> 标签内容解析为文章信息 */
function parseArticleMeta(htmlText, fileUrl) {
  const doc = new DOMParser().parseFromString(htmlText, "text/html");
  const meta = (name) =>
    doc.querySelector(`meta[name="${name}"]`)?.getAttribute("content")?.trim() ||
    "";
  const title = meta("article-title") || doc.querySelector("title")?.textContent || "无标题";
  const date = meta("article-date") || "";
  const description = meta("article-description") || "";
  const author = meta("article-author") || "";
  const tags = meta("article-tags")
    ? meta("article-tags").split(",").map((t) => t.trim()).filter(Boolean)
    : [];
  return { title, date, description, author, tags, url: fileUrl };
}

/** 调用 GitHub Contents API 列出 articles 目录 */
async function listArticleFiles(owner, repo, path) {
  const api = `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${CONFIG.branch}`;
  const res = await fetch(api, {
    headers: { Accept: "application/vnd.github+json" },
  });
  if (res.status === 404) {
    throw new Error(`未找到目录 ${path}/。请确认该目录已存在并已推送到 GitHub。`);
  }
  if (!res.ok) {
    throw new Error(`GitHub API 请求失败：${res.status} ${res.statusText}`);
  }
  const items = await res.json();
  if (!Array.isArray(items)) {
    throw new Error("GitHub API 返回的不是目录列表。请检查路径是否指向文件。");
  }
  return items.filter((i) => i.type === "file" && i.name.endsWith(".html"));
}

function formatDate(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function renderCards(articles) {
  const grid = document.getElementById("articles");
  const status = document.getElementById("status");
  status.textContent = "";

  if (articles.length === 0) {
    status.textContent = "还没有文章。把 HTML 文件放进 articles/ 目录即可。";
    return;
  }

  // 按日期倒序（无日期的排到后面）
  articles.sort((a, b) => {
    if (!a.date && !b.date) return 0;
    if (!a.date) return 1;
    if (!b.date) return -1;
    return b.date.localeCompare(a.date);
  });

  grid.innerHTML = articles
    .map(
      (a) => `
      <a class="article-card" href="${a.url}">
        <div class="card-title">${escapeHtml(a.title)}</div>
        <div class="card-description">${escapeHtml(a.description || "（无摘要）")}</div>
        <div class="card-meta">
          <time datetime="${escapeHtml(a.date)}">${formatDate(a.date)}</time>
          ${a.author ? `<span>· ${escapeHtml(a.author)}</span>` : ""}
        </div>
        ${
          a.tags.length
            ? `<div class="card-tags">${a.tags
                .map((t) => `<span class="card-tag">${escapeHtml(t)}</span>`)
                .join("")}</div>`
            : ""
        }
      </a>`
    )
    .join("");
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));
}

function showError(msg) {
  const status = document.getElementById("status");
  status.classList.add("error");
  status.textContent = msg;
}

async function init() {
  const { owner: dOwner, repo: dRepo } = detectRepo();
  const owner = CONFIG.owner || dOwner;
  const repo = CONFIG.repo || dRepo;

  if (!owner || !repo) {
    showError(
      "无法自动识别 GitHub 仓库信息。请在 js/main.js 顶部 CONFIG 中手动填写 owner 和 repo。"
    );
    return;
  }

  try {
    const files = await listArticleFiles(owner, repo, CONFIG.articlesPath);
    if (files.length === 0) {
      renderCards([]);
      return;
    }

    // 并行抓取每个文章的元信息
    const metas = await Promise.all(
      files.map(async (f) => {
        try {
          const res = await fetch(f.download_url);
          const text = await res.text();
          return parseArticleMeta(text, f.download_url);
        } catch (e) {
          console.warn("抓取失败:", f.name, e);
          return {
            title: f.name,
            date: "",
            description: "（读取失败）",
            author: "",
            tags: [],
            url: f.download_url,
          };
        }
      })
    );
    renderCards(metas);
  } catch (e) {
    showError(e.message);
  }
}

init();
