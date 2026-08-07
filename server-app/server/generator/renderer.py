"""范文 JSON → 单文件 HTML 渲染（Python 字符串模板，无 Jinja2）。

输出要求（与阅读站 parseHtmlFile + analysis.js 切合）：
- <meta name="article-*"> 系列标签，供 parseHtmlFile 提取
- .article-page > .article-content 结构，供 parseHtmlFile 提取正文
- 内联 <style>：arg-type 颜色映射 + .analysis-box 样式
- 内联 <script>：toggleAnalysis 函数，与 web/src/analysis.js 完全一致
- 句子级 span：<span class="arg-{type}" data-text="{释义}" onclick="toggleAnalysis(this,'{type}')">
"""

from typing import Any, Dict
from html import escape

# arg_type → 中文释义（点击后 analysis-box 显示的内容）
# 此处释义为该类型的写作作用说明，便于读者理解标注
ARG_DESCRIPTIONS = {
    "point": "【核心观点】这句话提出或重申了核心观点，是本段或全文的论点。",
    "case": "【事实案例】这是支撑观点的具体案例，以事实增强说服力。",
    "quote": "【名言引用】这里引用了名言、政策原文或领导人讲话，提升论证高度。",
    "cause": "【因果分析】这句话剖析问题成因或推导结果，体现逻辑链条。",
    "contrast": "【正反对比】这里通过正反对比凸显观点，强化论证张力。",
    "effect": "【意义影响】这句话阐述做法的意义或影响，升华主题。",
    "measure": "【对策措施】这是针对问题提出的具体对策或措施，落脚于行动。",
}

# arg_type → 颜色（与阅读站彩色句子风格一致，柔和高对比）
ARG_COLORS = {
    "point": "#2563eb",      # 蓝：观点
    "case": "#16a34a",       # 绿：案例
    "quote": "#9333ea",      # 紫：名言
    "cause": "#ea580c",      # 橙：因果
    "contrast": "#dc2626",   # 红：对比
    "effect": "#0891b2",     # 青：意义
    "measure": "#ca8a04",    # 金：对策
}

# 内联样式片段
_STYLE_CSS = """
.article-page { max-width: 820px; margin: 0 auto; padding: 24px 16px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif; color: #1f2328; line-height: 1.85; }
.article-page h1 { font-size: 26px; font-weight: 700; text-align: center; margin-bottom: 8px; }
.article-meta { text-align: center; color: #9ca3af; font-size: 13px; margin-bottom: 24px; }
.article-content p { margin: 0 0 16px; text-indent: 2em; }
.article-content h2 { font-size: 18px; font-weight: 600; margin: 24px 0 12px; text-indent: 0; }
.arg-point, .arg-case, .arg-quote, .arg-cause, .arg-contrast, .arg-effect, .arg-measure { cursor: pointer; border-bottom: 1px dashed currentColor; padding-bottom: 1px; transition: opacity 0.15s; }
.arg-point:hover, .arg-case:hover, .arg-quote:hover, .arg-cause:hover, .arg-contrast:hover, .arg-effect:hover, .arg-measure:hover { opacity: 0.75; }
.arg-point { color: #2563eb; }
.arg-case { color: #16a34a; }
.arg-quote { color: #9333ea; }
.arg-cause { color: #ea580c; }
.arg-contrast { color: #dc2626; }
.arg-effect { color: #0891b2; }
.arg-measure { color: #ca8a04; }
.analysis-box { margin: 6px 0 14px 2em; padding: 10px 14px; background: #fafafa; border-left: 4px solid #616161; border-radius: 4px; font-size: 0.92em; color: #333; line-height: 1.65; box-shadow: 0 2px 5px rgba(0,0,0,0.05); animation: fadeIn 0.3s; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(-5px); } to { opacity: 1; transform: translateY(0); } }
""".strip()

# 内联 JS：与 web/src/analysis.js 的 setupToggleAnalysis 完全一致
_TOGGLE_JS = """
window.toggleAnalysis = function (element, type) {
  var content = element.getAttribute('data-text');
  if (!content) return;
  var existing = element.nextElementSibling;
  if (existing && existing.classList.contains('analysis-box')) {
    existing.remove();
    return;
  }
  var boxes = document.querySelectorAll('.analysis-box');
  for (var i = 0; i < boxes.length; i++) {
    if (boxes[i].getAttribute('data-type') === type) boxes[i].remove();
  }
  var box = document.createElement('div');
  box.className = 'analysis-box';
  box.setAttribute('data-type', type);
  box.textContent = content;
  element.parentNode.insertBefore(box, element.nextSibling);
};
""".strip()


def _render_sentence(text: str, arg_type: str) -> str:
    """渲染单句为带交互 span 的 HTML。"""
    desc = ARG_DESCRIPTIONS.get(arg_type, f"【{arg_type}】标注句子。")
    safe_text = escape(text)
    safe_desc = escape(desc)
    return f'<span class="arg-{escape(arg_type)}" data-text="{safe_desc}" onclick="toggleAnalysis(this,\'{escape(arg_type)}\')">{safe_text}</span>'


def _render_section(section: Dict[str, Any]) -> str:
    """渲染一个段落为 HTML。"""
    stype = section.get("type", "")
    sentences = section.get("sentences", []) or []

    # 分论点段落以 h2 展示分论点
    parts = []
    if stype == "body":
        sub = section.get("sub_point", "")
        if sub:
            parts.append(f"<h2>{escape(sub)}</h2>")
    elif stype == "intro":
        parts.append("<h2>引言</h2>")
    elif stype == "conclusion":
        parts.append("<h2>结语</h2>")

    # 句子合并为段落
    if sentences:
        spans = [_render_sentence(s.get("text", ""), s.get("arg_type", "point")) for s in sentences]
        parts.append(f"<p>{''.join(spans)}</p>")

    return "\n".join(parts)


def render_html(essay: Dict[str, Any], order: int = 999, date: str = "", author: str = "AI 范文") -> str:
    """将范文 dict 渲染为完整单文件 HTML 字符串。

    Args:
        essay: LLM 返回的范文对象 {title, category, meta_description, sections}
        order: 文章序号（写入 meta article-order）
        date: 日期字符串（写入 meta article-date）
        author: 作者（写入 meta article-author）
    """
    title = essay.get("title", "未命名范文")
    category = essay.get("category", "")
    description = essay.get("meta_description", "")
    sections = essay.get("sections", []) or []

    meta_block = "\n".join([
        f'    <meta name="article-title" content="{escape(title)}">',
        f'    <meta name="article-category" content="{escape(category)}">',
        f'    <meta name="article-order" content="{order}">',
        f'    <meta name="article-date" content="{escape(date)}">',
        f'    <meta name="article-author" content="{escape(author)}">',
        f'    <meta name="article-description" content="{escape(description)}">',
    ])

    body_html = "\n".join(_render_section(s) for s in sections)
    date_meta = f'<div class="article-meta">{escape(date)} · {escape(author)}</div>' if date else f'<div class="article-meta">{escape(author)}</div>'

    return f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{escape(title)}</title>
{meta_block}
  <style>
{_STYLE_CSS}
  </style>
</head>
<body>
  <div class="article-page">
    <h1>{escape(title)}</h1>
    {date_meta}
    <div class="article-content">
{body_html}
    </div>
  </div>
  <script>
{_TOGGLE_JS}
  </script>
</body>
</html>"""
