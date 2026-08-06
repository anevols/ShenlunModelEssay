/**
 * 右侧本页大纲
 *
 * - buildHeadingIds：为正文 h2/h3 生成稳定 id（供大纲跳转使用）
 * - renderToc：根据正文 h2/h3 渲染大纲列表
 * - highlightTocOnScroll：滚动时高亮当前章节
 */

function buildHeadingIds(container) {
  const heads = container.querySelectorAll("h2, h3");
  const used = {};
  heads.forEach((h, i) => {
    const text = (h.textContent || "").trim() || `section-${i}`;
    let base = text.toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, "").replace(/\s+/g, "-").slice(0, 50) || `h-${i}`;
    let id = base, n = 2;
    while (used[id]) { id = `${base}-${n++}`; }
    used[id] = true;
    h.id = id;
  });
}

function renderToc(container) {
  const list = document.getElementById("toc-list");
  const heads = container.querySelectorAll("h2, h3");
  if (heads.length === 0) { list.innerHTML = `<div class="toc-empty">本页无子标题</div>`; return; }
  list.innerHTML = "";
  heads.forEach((h) => {
    const a = document.createElement("a");
    a.href = `#${h.id}`;
    a.className = `toc-link ${h.tagName.toLowerCase()}`;
    a.textContent = h.textContent;
    a.dataset.target = h.id;
    list.appendChild(a);
  });
}

function highlightTocOnScroll() {
  const heads = Array.from(document.querySelectorAll("#article-container h2, #article-container h3"));
  const links = Array.from(document.querySelectorAll(".toc-link"));
  if (heads.length === 0) return;
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const id = entry.target.id;
          links.forEach((l) => l.classList.toggle("active", l.dataset.target === id));
        }
      });
    },
    { rootMargin: "-80px 0px -70% 0px", threshold: 0 }
  );
  heads.forEach((h) => observer.observe(h));
}
