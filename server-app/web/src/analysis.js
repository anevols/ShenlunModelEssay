/**
 * 交互句点击解析
 *
 * 文章正文中彩色 <span> 的 onclick="toggleAnalysis(this,'quote')" 调用此函数。
 * 点击后在句子下方插入/移除解析框；同类型同时只显示一个。
 *
 * 此函数挂到 window，供 v-html 渲染的内联 onclick 使用。
 */
export function setupToggleAnalysis() {
  window.toggleAnalysis = function (element, type) {
    const content = element.getAttribute('data-text')
    if (!content) return

    // 同一元素再次点击：关闭已存在的解析框
    const existing = element.nextElementSibling
    if (existing && existing.classList.contains('analysis-box')) {
      existing.remove()
      return
    }

    // 同类型只保留一个
    document.querySelectorAll('.analysis-box').forEach((box) => {
      if (box.getAttribute('data-type') === type) box.remove()
    })

    const box = document.createElement('div')
    box.className = 'analysis-box'
    box.setAttribute('data-type', type)
    box.textContent = content
    element.parentNode.insertBefore(box, element.nextSibling)
  }
}
