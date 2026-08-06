/**
 * 全局 UI 事件绑定
 *
 * - bindSearch：侧边栏搜索过滤
 * - bindSidebarToggle：移动端侧边栏开关
 * - bindBreadcrumb：面包屑导航点击（首页清空筛选 / 分类筛选）
 */

function bindSearch() {
  const input = document.getElementById("search-input");
  input.addEventListener("input", () => {
    const q = input.value.trim().toLowerCase();
    document.querySelectorAll(".sidebar-item").forEach((el) => {
      el.classList.toggle("hidden", q && !el.dataset.title.includes(q));
    });
    document.querySelectorAll(".sidebar-group").forEach((g) => {
      g.style.display = g.querySelector(".sidebar-item:not(.hidden)") ? "" : "none";
    });
  });
}

function bindSidebarToggle() {
  const sidebar = document.getElementById("sidebar");
  const mask = document.getElementById("sidebar-mask");
  const toggle = document.getElementById("sidebar-toggle");
  const open = () => { sidebar.classList.add("open"); mask.classList.add("open"); };
  const close = () => { sidebar.classList.remove("open"); mask.classList.remove("open"); };
  toggle.addEventListener("click", () => sidebar.classList.contains("open") ? close() : open());
  mask.addEventListener("click", close);
  sidebar.addEventListener("click", (e) => {
    if (e.target.classList.contains("sidebar-item") && window.innerWidth <= 900) close();
  });
}

function bindBreadcrumb() {
  document.getElementById("breadcrumb").addEventListener("click", (e) => {
    const target = e.target.closest("[data-breadcrumb]");
    if (!target) return;
    e.preventDefault();
    if (target.dataset.breadcrumb === "home") {
      clearCategoryFilter();
    } else if (target.dataset.breadcrumb === "category") {
      filterByCategory(target.dataset.category);
    }
  });
}
