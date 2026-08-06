/**
 * 侧边栏渲染与分类筛选
 *
 * - renderSidebar：按分类分组渲染目录树，分组标题可折叠
 * - toggleGroup：折叠/展开分组
 * - markActive：高亮当前文章
 * - filterByCategory / clearCategoryFilter：按分类筛选侧边栏（由面包屑触发）
 */

function renderSidebar() {
  const nav = document.getElementById("sidebar-nav");
  nav.innerHTML = "";
  if (ARTICLES.length === 0) {
    nav.innerHTML = `<div class="sidebar-status">还没有文章。把 HTML 放进 articles/ 即可。</div>`;
    return;
  }
  const groups = {};
  for (const a of ARTICLES) (groups[a.category] = groups[a.category] || []).push(a);
  const groupNames = Object.keys(groups).sort((a, b) => a.localeCompare(b, "zh"));
  for (const gname of groupNames) {
    const group = document.createElement("div");
    group.className = "sidebar-group";
    const titleEl = document.createElement("div");
    titleEl.className = "sidebar-group-title";
    titleEl.tabIndex = 0;
    titleEl.innerHTML = `<span class="sidebar-arrow">▾</span>${escapeHtml(gname)}`;
    const itemsWrap = document.createElement("div");
    itemsWrap.className = "sidebar-group-items";
    titleEl.addEventListener("click", () => toggleGroup(titleEl, itemsWrap));
    titleEl.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleGroup(titleEl, itemsWrap); } });
    group.appendChild(titleEl);
    group.appendChild(itemsWrap);
    for (const a of groups[gname]) {
      const item = document.createElement("a");
      item.className = "sidebar-item";
      item.href = `#${a.slug}`;
      item.dataset.slug = a.slug;
      item.dataset.title = a.title.toLowerCase();
      item.textContent = a.title;
      itemsWrap.appendChild(item);
    }
    nav.appendChild(group);
  }
}

function toggleGroup(titleEl, itemsWrap) {
  const collapsed = itemsWrap.classList.toggle("collapsed");
  titleEl.classList.toggle("collapsed", collapsed);
}

function markActive(slug) {
  document.querySelectorAll(".sidebar-item").forEach((el) => {
    el.classList.toggle("active", el.dataset.slug === slug);
  });
  const active = document.querySelector(".sidebar-item.active");
  if (active) active.scrollIntoView({ block: "nearest" });
}

function filterByCategory(category) {
  const groups = document.querySelectorAll(".sidebar-group");
  let activeGroup = null;
  groups.forEach((g) => {
    const title = g.querySelector(".sidebar-group-title");
    const isMatch = title.textContent.replace(/^▾\s*/, "") === category;
    g.style.display = isMatch ? "" : "none";
    if (isMatch) {
      activeGroup = g;
      title.classList.remove("collapsed");
      g.querySelector(".sidebar-group-items")?.classList.remove("collapsed");
    }
  });
  const bc = document.getElementById("breadcrumb");
  const catLink = bc.querySelector('[data-breadcrumb="category"]');
  if (catLink) catLink.classList.toggle("filtering", true);
  const sidebar = document.getElementById("sidebar");
  if (sidebar && window.innerWidth <= 900) sidebar.classList.add("open"), document.getElementById("sidebar-mask")?.classList.add("open");
}

function clearCategoryFilter() {
  document.querySelectorAll(".sidebar-group").forEach((g) => { g.style.display = ""; });
  const bc = document.getElementById("breadcrumb");
  const catLink = bc.querySelector('[data-breadcrumb="category"]');
  if (catLink) catLink.classList.remove("filtering");
}
