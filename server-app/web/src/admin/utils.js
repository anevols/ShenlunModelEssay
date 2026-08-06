/**
 * 解析上传的 HTML 文章，提取 meta 元信息与正文。
 * 规则与阅读站 article-parser.js 一致：
 *  - meta 标签：article-title/category/order/date/author/description
 *  - 标题：article-title > <title> > 文件名
 *  - 正文：标准结构取 .article-page .article-content；否则 body 剥离首个 h1 及紧跟说明行
 *  - 保留文章内嵌 <style> 与交互 span 等内联结构
 */
export function parseHtmlFile(htmlText, fileName) {
  const doc = new DOMParser().parseFromString(htmlText, 'text/html')
  const getMeta = (name) => doc.querySelector(`meta[name="${name}"]`)?.getAttribute('content')?.trim() || ''

  const title = getMeta('article-title') || doc.querySelector('title')?.textContent?.trim() || fileName.replace(/\.html?$/i, '')
  const category = getMeta('article-category') || '申论'
  const order = parseInt(getMeta('article-order') || '999', 10)
  const date = getMeta('article-date')
  const author = getMeta('article-author')
  const description = getMeta('article-description')
  const slug = fileName.replace(/\.html?$/i, '')

  // 收集 head/body 内的 <style>（保留文章样式）
  const headStyles = Array.from(doc.querySelectorAll('head style, body style')).map((n) => n.outerHTML).join('\n')

  let contentHtml
  const pageEl = doc.querySelector('.article-page')
  if (pageEl) {
    // 标准结构
    const contentEl = pageEl.querySelector('.article-content')
    contentHtml = contentEl ? contentEl.innerHTML : pageEl.innerHTML
  } else {
    // 非标准结构：body 剥离首个 h1 及紧跟的说明行
    const tmp = document.createElement('div')
    tmp.innerHTML = doc.body?.innerHTML || ''
    const firstH1 = (() => {
      const walker = document.createTreeWalker(tmp, NodeFilter.SHOW_ELEMENT)
      let distance = 0
      let n
      while ((n = walker.nextNode())) {
        if (n.tagName === 'H1') return n
        if (!/^(div|section|article|main|header|aside|nav|footer|span|style)$/i.test(n.tagName)) {
          distance++
          if (distance > 3) return null
        }
      }
      return null
    })()
    if (firstH1) {
      const nextAfterH1 = firstH1.nextElementSibling
      firstH1.remove()
      if (
        nextAfterH1 &&
        (nextAfterH1.classList.contains('article-meta') ||
          /(text-align\s*:\s*center|color\s*:\s*#(888|999|9ca|6b72|99a))/i.test(nextAfterH1.getAttribute('style') || '') ||
          (/^(p|div)$/i.test(nextAfterH1.tagName) && /居中|点击|提示|解析|标签/.test(nextAfterH1.textContent || '')))
      ) {
        nextAfterH1.remove()
      }
    }
    contentHtml = tmp.innerHTML
  }

  if (headStyles) contentHtml = headStyles + '\n' + contentHtml

  return { title, category, order, date, author, description, slug, contentHtml }
}
