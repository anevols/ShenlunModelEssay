/**
 * 文章解析
 *
 * 解析文章 HTML，提取标题、分类、日期、正文等内容。
 * 支持两种结构：
 *  1. 标准结构：<div class="article-page"> 内含 .article-header / .article-content
 *  2. 非标准结构：直接从 body 提取，把首个 h1 拆为标题避免重复
 */

function parseArticle(htmlText, file) {
  const doc = new DOMParser().parseFromString(htmlText, "text/html");
  const title = getMeta(doc, "article-title") || doc.querySelector("title")?.textContent?.trim() || file.name;

  // 收集文章内嵌的 <style> 和 <script>（外链/内联），渲染时重新插入以生效
  const headStyles = Array.from(doc.querySelectorAll("head style, body style")).map(n => n.outerHTML).join("\n");
  const scripts = Array.from(doc.querySelectorAll("script")).map(n => ({
    src: n.getAttribute("src") || "",
    type: n.getAttribute("type") || "text/javascript",
    code: n.textContent || "",
  }));

  // 1. 标准结构：<div class="article-page"> 内含 .article-header 和 .article-content
  const pageEl = doc.querySelector(".article-page");
  if (pageEl) {
    const contentEl = pageEl.querySelector(".article-content");
    const headerH1 = pageEl.querySelector(".article-header h1");
    const metaEl = pageEl.querySelector(".article-meta");
    return {
      slug: file.name.replace(/\.html$/, ""),
      fileName: file.name,
      url: file.download_url,
      title,
      category: getMeta(doc, "article-category") || "申论",
      order: parseInt(getMeta(doc, "article-order") || "999", 10),
      date: getMeta(doc, "article-date"),
      description: getMeta(doc, "article-description"),
      author: getMeta(doc, "article-author"),
      contentHtml: (contentEl ? contentEl.innerHTML : pageEl.innerHTML) + (headStyles ? "\n" + headStyles : ""),
      titleHtml: headerH1 ? headerH1.outerHTML : `<h1>${escapeHtml(title)}</h1>`,
      metaHtml: metaEl ? metaEl.outerHTML : "",
      scripts,
    };
  }

  // 2. 兼容非标准结构：直接从 body 提取，把首个 h1 拆为标题避免重复
  const bodyEl = doc.body;
  let contentHtml = bodyEl?.innerHTML || "";
  let titleHtml = `<h1>${escapeHtml(title)}</h1>`;
  let metaHtml = "";

  // 创建临时容器，检测并剥离正文最前面的 h1 作为标题（无论嵌套多深）
  const tmp = document.createElement("div");
  tmp.innerHTML = contentHtml;

  // 找第一个 h1（允许嵌套在 div 等容器内），且位置在 body 开头（不是中间/结尾）
  const firstH1 = (() => {
    // 使用深度优先遍历，找到文档流第一个 h1；若它前面已有大量文字/元素则视为正文内标题不剥离
    const walker = document.createTreeWalker(tmp, NodeFilter.SHOW_ELEMENT);
    let firstH1Node = null;
    let distance = 0;
    let n;
    while ((n = walker.nextNode())) {
      if (n.tagName === "H1") { firstH1Node = n; break; }
      // 前面跳过的非容器元素（p/img/pre 等）超过 2 个，认为已进入正文，不再剥离
      if (!/^(div|section|article|main|header|aside|nav|footer|span|style)$/i.test(n.tagName)) {
        distance++;
        if (distance > 3) return null;
      }
    }
    return firstH1Node;
  })();

  if (firstH1) {
    titleHtml = firstH1.outerHTML;
    const h1Parent = firstH1.parentElement;
    const nextAfterH1 = firstH1.nextElementSibling;
    firstH1.remove();
    // 若紧跟在 h1 后面的兄弟元素是 .article-meta 或居中/灰色日期说明行，一并提取为 meta
    if (nextAfterH1 && (
      nextAfterH1.classList.contains("article-meta") ||
      /(text-align\s*:\s*center|color\s*:\s*#(888|999|9ca|6b72|999|99a))/i.test(nextAfterH1.getAttribute("style") || "") ||
      (/^(p|div)$/i.test(nextAfterH1.tagName) && /居中|点击|提示|解析|标签/.test(nextAfterH1.textContent || ""))
    )) {
      metaHtml = nextAfterH1.outerHTML;
      nextAfterH1.remove();
    }
    // 如果 h1 的父容器现在变成空的（且非最外层必要容器），一并移除以避免空 padding
    if (h1Parent && h1Parent !== tmp && h1Parent.children.length === 0 && h1Parent.textContent?.trim() === "") {
      h1Parent.remove();
    }
    contentHtml = tmp.innerHTML;
  }

  if (headStyles) contentHtml = headStyles + "\n" + contentHtml;

  return {
    slug: file.name.replace(/\.html$/, ""),
    fileName: file.name,
    url: file.download_url,
    title,
    category: getMeta(doc, "article-category") || "申论",
    order: parseInt(getMeta(doc, "article-order") || "999", 10),
    date: getMeta(doc, "article-date"),
    description: getMeta(doc, "article-description"),
    author: getMeta(doc, "article-author"),
    contentHtml,
    titleHtml,
    metaHtml,
    scripts,
  };
}
