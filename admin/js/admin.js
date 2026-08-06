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
