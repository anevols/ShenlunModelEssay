/**
 * 管理后台脚本
 *
 * 功能：
 * - 登录状态检查（未登录跳转 login.html）
 * - 文章列表加载 / 搜索过滤
 * - 新建 / 编辑 / 删除文章（调 FastAPI 接口）
 */

// API 基址：同源部署时留空（FastAPI 同时托管前端和API）
const API_BASE = '';

// 登录状态检查
const token = localStorage.getItem('token');
const username = localStorage.getItem('username');
if (!token) {
  window.location.href = 'login.html';
}
document.getElementById('current-user').textContent = username || '管理员';

// 退出登录
document.getElementById('logout-btn').addEventListener('click', () => {
  localStorage.removeItem('token');
  localStorage.removeItem('username');
  window.location.href = 'login.html';
});

// ===== 文章列表 =====
let allArticles = [];

async function loadArticles() {
  const tbody = document.getElementById('article-tbody');
  tbody.innerHTML = '<tr><td colspan="6" class="table-loading">加载中...</td></tr>';
  try {
    const res = await fetch(`${API_BASE}/api/articles`);
    allArticles = await res.json();
    renderTable(allArticles);
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="6" class="table-loading">加载失败：${e.message}</td></tr>`;
  }
}

function renderTable(articles) {
  const tbody = document.getElementById('article-tbody');
  if (articles.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="table-loading">暂无文章</td></tr>';
    return;
  }
  tbody.innerHTML = articles.map(a => `
    <tr>
      <td class="article-title-cell">${escapeHtml(a.title)}</td>
      <td>${escapeHtml(a.category)}</td>
      <td>${a.order}</td>
      <td>${escapeHtml(a.date || '—')}</td>
      <td>${escapeHtml(a.author || '—')}</td>
      <td>
        <button class="btn-text" onclick="openEditor('${a.slug}')">编辑</button>
        <button class="btn-danger" onclick="deleteArticle('${a.slug}')">删除</button>
      </td>
    </tr>
  `).join('');
}

// 搜索过滤
document.getElementById('search').addEventListener('input', (e) => {
  const q = e.target.value.trim().toLowerCase();
  const filtered = q ? allArticles.filter(a => a.title.toLowerCase().includes(q)) : allArticles;
  renderTable(filtered);
});

// ===== 文章编辑弹窗 =====
const modal = document.getElementById('editor-modal');
const form = document.getElementById('article-form');

document.getElementById('new-article-btn').addEventListener('click', () => openEditor(null));

// 关闭弹窗
document.querySelectorAll('[data-close]').forEach(el => {
  el.addEventListener('click', () => modal.style.display = 'none');
});
modal.addEventListener('click', (e) => { if (e.target === modal) modal.style.display = 'none'; });

async function openEditor(slug) {
  // 重置表单
  form.reset();
  document.getElementById('article-id').value = '';
  // 重置上传区域
  document.getElementById('f-upload').value = '';
  const hint = document.getElementById('upload-hint');
  hint.textContent = '上传后自动识别标题、分类、正文等';
  hint.className = 'upload-hint';

  if (slug) {
    // 编辑模式：加载文章详情
    document.getElementById('editor-title').textContent = '编辑文章';
    try {
      const res = await fetch(`${API_BASE}/api/articles/${slug}`);
      if (!res.ok) throw new Error('加载失败');
      const a = await res.json();
      document.getElementById('article-id').value = a.id;
      document.getElementById('f-slug').value = a.slug;
      document.getElementById('f-title').value = a.title;
      document.getElementById('f-category').value = a.category;
      document.getElementById('f-order').value = a.order;
      document.getElementById('f-date').value = a.date;
      document.getElementById('f-author').value = a.author;
      document.getElementById('f-description').value = a.description;
      document.getElementById('f-content').value = a.content_html;
    } catch (e) {
      alert('加载文章失败：' + e.message);
      return;
    }
  } else {
    document.getElementById('editor-title').textContent = '新建文章';
  }
  modal.style.display = 'flex';
}

// 保存文章
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('article-id').value;
  const slug = document.getElementById('f-slug').value.trim();
  const data = {
    title: document.getElementById('f-title').value.trim(),
    slug: slug || undefined,
    category: document.getElementById('f-category').value.trim() || '申论',
    order: parseInt(document.getElementById('f-order').value) || 999,
    date: document.getElementById('f-date').value.trim(),
    author: document.getElementById('f-author').value.trim(),
    description: document.getElementById('f-description').value.trim(),
    content_html: document.getElementById('f-content').value,
  };

  try {
    let res;
    if (id) {
      // 编辑：用 slug 定位（从加载时的数据取）
      const origSlug = document.getElementById('f-slug').dataset.origSlug || slug;
      res = await fetch(`${API_BASE}/api/articles/${origSlug}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(data),
      });
    } else {
      res = await fetch(`${API_BASE}/api/articles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(data),
      });
    }
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || '保存失败');
    }
    modal.style.display = 'none';
    loadArticles();
  } catch (e) {
    alert('保存失败：' + e.message);
  }
});

// 删除文章
async function deleteArticle(slug) {
  if (!confirm('确定删除这篇文章吗？此操作不可撤销。')) return;
  try {
    const res = await fetch(`${API_BASE}/api/articles/${slug}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || '删除失败');
    }
    loadArticles();
  } catch (e) {
    alert('删除失败：' + e.message);
  }
}

// ===== 上传 HTML 文件自动识别 =====
const uploadInput = document.getElementById('f-upload');
const uploadBtn = document.getElementById('upload-btn');
const uploadHint = document.getElementById('upload-hint');

uploadBtn.addEventListener('click', () => uploadInput.click());

uploadInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const text = await file.text();
    const parsed = parseHtmlFile(text, file.name);
    // 填充表单（仅填充识别到的非空字段）
    if (parsed.title) document.getElementById('f-title').value = parsed.title;
    if (parsed.slug) document.getElementById('f-slug').value = parsed.slug;
    if (parsed.category) document.getElementById('f-category').value = parsed.category;
    if (parsed.order) document.getElementById('f-order').value = parsed.order;
    if (parsed.date) document.getElementById('f-date').value = parsed.date;
    if (parsed.author) document.getElementById('f-author').value = parsed.author;
    if (parsed.description) document.getElementById('f-description').value = parsed.description;
    if (parsed.contentHtml) document.getElementById('f-content').value = parsed.contentHtml;
    uploadHint.textContent = `已识别：${file.name}`;
    uploadHint.className = 'upload-hint success';
  } catch (err) {
    uploadHint.textContent = '解析失败：' + err.message;
    uploadHint.className = 'upload-hint error';
  }
});

/**
 * 解析上传的 HTML 文章，提取 meta 元信息与正文。
 * 规则与阅读站 article-parser.js 一致：
 *  - meta 标签：article-title/category/order/date/author/description
 *  - 标题：article-title > <title> > 文件名
 *  - 正文：标准结构取 .article-page .article-content；否则 body 剥离首个 h1 及紧跟说明行
 *  - 保留文章内嵌 <style> 与交互 span 等内联结构
 */
function parseHtmlFile(htmlText, fileName) {
  const doc = new DOMParser().parseFromString(htmlText, "text/html");
  const getMeta = (name) => doc.querySelector(`meta[name="${name}"]`)?.getAttribute("content")?.trim() || "";

  const title = getMeta("article-title") || doc.querySelector("title")?.textContent?.trim() || fileName.replace(/\.html?$/i, "");
  const category = getMeta("article-category") || "申论";
  const order = parseInt(getMeta("article-order") || "999", 10);
  const date = getMeta("article-date");
  const author = getMeta("article-author");
  const description = getMeta("article-description");
  const slug = fileName.replace(/\.html?$/i, "");

  // 收集 head/body 内的 <style>（保留文章样式）
  const headStyles = Array.from(doc.querySelectorAll("head style, body style")).map(n => n.outerHTML).join("\n");

  let contentHtml;
  const pageEl = doc.querySelector(".article-page");
  if (pageEl) {
    // 标准结构
    const contentEl = pageEl.querySelector(".article-content");
    contentHtml = contentEl ? contentEl.innerHTML : pageEl.innerHTML;
  } else {
    // 非标准结构：body 剥离首个 h1 及紧跟的说明行
    const tmp = document.createElement("div");
    tmp.innerHTML = doc.body?.innerHTML || "";
    const firstH1 = (() => {
      const walker = document.createTreeWalker(tmp, NodeFilter.SHOW_ELEMENT);
      let distance = 0, n;
      while ((n = walker.nextNode())) {
        if (n.tagName === "H1") return n;
        if (!/^(div|section|article|main|header|aside|nav|footer|span|style)$/i.test(n.tagName)) {
          distance++;
          if (distance > 3) return null;
        }
      }
      return null;
    })();
    if (firstH1) {
      const nextAfterH1 = firstH1.nextElementSibling;
      firstH1.remove();
      if (nextAfterH1 && (
        nextAfterH1.classList.contains("article-meta") ||
        /(text-align\s*:\s*center|color\s*:\s*#(888|999|9ca|6b72|99a))/i.test(nextAfterH1.getAttribute("style") || "") ||
        (/^(p|div)$/i.test(nextAfterH1.tagName) && /居中|点击|提示|解析|标签/.test(nextAfterH1.textContent || ""))
      )) {
        nextAfterH1.remove();
      }
    }
    contentHtml = tmp.innerHTML;
  }

  if (headStyles) contentHtml = headStyles + "\n" + contentHtml;

  return { title, category, order, date, author, description, slug, contentHtml };
}

// ===== 工具函数 =====
function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// 编辑时记录原始 slug（用于 PUT 定位）
const origSlugField = document.getElementById('f-slug');
origSlugField.dataset.origSlug = '';
const origOpenEditor = openEditor;

// 初始加载
loadArticles();
