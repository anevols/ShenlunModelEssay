"""范文生成流水线编排。

串联 topics → prompts → llm_client → validator → renderer → Article 入库。

对外接口（被 main.py 调用）：
- generate_preview(theme, db=None) → 生成但不入库，返回预览 dict（含 content_html）
- generate_and_save(theme, db) → 生成并入库，返回 Article 对象
- generate_batch(themes, db) → 批量生成入库，返回结果列表（成功/失败逐项记录）

设计要点：
- 每次生成最多重试 2 次（LLM 调用失败 + 校验失败合并计入），失败抛 GenerateError
- 入库前自动去重 slug（已存在则加 -2 / -3 后缀）
- order 字段：同板块下取 max(order)+1，避免新生成的文章挤占序号
- date 字段：当天日期（YYYY-MM-DD）
- author：固定 'AI 范文'
"""

from datetime import date
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy.orm import Session

from categories import is_valid_category
from database import SessionLocal
from models import Article
from .llm_client import generate_essay, LlmError
from .renderer import render_html
from .validator import validate_essay

# 生成参数
MAX_RETRIES = 2          # 单篇最多重试次数（不含首次）
RETRY_INTERVAL = 1.0     # 重试间隔（秒）
DEFAULT_AUTHOR = "AI 范文"


class GenerateError(Exception):
    """生成失败（LLM 调用失败 / 校验失败 / 入库冲突）。"""


def _next_order(db: Session, category: str) -> int:
    """取该板块下最大 order + 1（无文章则 1）。"""
    articles = db.query(Article).filter(Article.category == category).all()
    if not articles:
        return 1
    return max(a.order for a in articles) + 1


def _unique_slug(db: Session, base_slug: str) -> str:
    """若 slug 已存在，追加 -2 / -3 后缀直到唯一。"""
    slug = base_slug
    n = 2
    while db.query(Article).filter(Article.slug == slug).first():
        slug = f"{base_slug}-{n}"
        n += 1
    return slug


def _generate_one(theme: str) -> Dict[str, Any]:
    """生成单篇范文 dict（含校验 + 重试），失败抛 GenerateError。"""
    import time

    last_err = ""
    for attempt in range(MAX_RETRIES + 1):
        try:
            data = generate_essay(theme)
        except LlmError as e:
            last_err = f"LLM 调用失败：{e}"
            if attempt < MAX_RETRIES:
                time.sleep(RETRY_INTERVAL)
            continue

        ok, reason = validate_essay(data)
        if ok:
            return data
        last_err = f"校验失败：{reason}"
        if attempt < MAX_RETRIES:
            time.sleep(RETRY_INTERVAL)

    raise GenerateError(last_err or "生成失败")


def _essay_to_article_data(db: Session, essay: Dict[str, Any]) -> Dict[str, Any]:
    """将范文 dict 转换为 Article 入库字段 dict（含 content_html 渲染）。"""
    from main import generate_slug  # 复用 main.py 的 slug 生成器

    title = essay.get("title", "未命名范文")
    category = essay.get("category", "")
    description = essay.get("meta_description", "")
    order = _next_order(db, category)
    today = date.today().isoformat()

    # 渲染正文 HTML（renderer 输出完整 HTML 文档，这里只取正文 body 部分）
    full_html = render_html(essay, order=order, date=today, author=DEFAULT_AUTHOR)
    content_html = _extract_body(full_html)

    base_slug = generate_slug(title)
    slug = _unique_slug(db, base_slug)

    return {
        "slug": slug,
        "title": title,
        "category": category,
        "order": order,
        "date": today,
        "author": DEFAULT_AUTHOR,
        "description": description,
        "content_html": content_html,
    }


def _extract_body(full_html: str) -> str:
    """从 renderer 输出的完整 HTML 文档中提取 .article-page 块（含交互 span）。

    阅读站 ArticleView 用 v-html 渲染 content_html，只需正文 + 内联 style/script，
    不需要完整的 <html>/<head>/<body> 包裹。
    """
    # 取 <body>...</body> 内的内容
    start = full_html.find("<body>")
    end = full_html.find("</body>")
    if start == -1 or end == -1:
        return full_html
    body_inner = full_html[start + 6:end]
    # body_inner 包含 <div class="article-page">...</div> + <script>...</script>
    # 提取 style 与 script，合并到正文前以便 v-html 渲染时样式生效
    return body_inner.strip()


def generate_preview(theme: str) -> Dict[str, Any]:
    """生成单篇范文预览（不入库）。

    返回：
    {
      "theme": "...",
      "title": "...",
      "category": "...",
      "description": "...",
      "content_html": "...",
      "word_count": 1234,
    }

    失败抛 GenerateError。
    """
    if not is_valid_category(theme):
        raise GenerateError(f"非法板块：{theme}")

    essay = _generate_one(theme)

    # 预览用临时 order/date 渲染（不入库）
    full_html = render_html(essay, order=0, date="", author=DEFAULT_AUTHOR)
    content_html = _extract_body(full_html)

    from .validator import _count_words
    word_count = _count_words(essay.get("sections", []))

    return {
        "theme": theme,
        "title": essay.get("title", ""),
        "category": essay.get("category", ""),
        "description": essay.get("meta_description", ""),
        "content_html": content_html,
        "word_count": word_count,
    }


def generate_and_save(theme: str, db: Session) -> Article:
    """生成单篇范文并入库，返回 Article 对象。失败抛 GenerateError。"""
    if not is_valid_category(theme):
        raise GenerateError(f"非法板块：{theme}")

    essay = _generate_one(theme)
    data = _essay_to_article_data(db, essay)

    article = Article(**data)
    db.add(article)
    db.commit()
    db.refresh(article)
    return article


def generate_batch(
    themes: List[str],
    db: Optional[Session] = None,
) -> List[Dict[str, Any]]:
    """批量生成入库，返回逐项结果。

    单篇失败不影响其他篇，结果列表每项形如：
    {"theme": "...", "success": True/False, "title"?: "...", "slug"?: "...", "error"?: "..."}

    传入 db 则复用该会话，否则内部新建临时会话（每篇独立事务，互不影响）。
    """
    results: List[Dict[str, Any]] = []
    for theme in themes:
        own_session = db is None
        session = db or SessionLocal()
        try:
            article = generate_and_save(theme, session)
            results.append({
                "theme": theme,
                "success": True,
                "title": article.title,
                "slug": article.slug,
            })
        except GenerateError as e:
            if own_session:
                session.rollback()
            results.append({"theme": theme, "success": False, "error": str(e)})
        except Exception as e:
            if own_session:
                session.rollback()
            results.append({"theme": theme, "success": False, "error": f"未知错误：{e}"})
        finally:
            if own_session:
                session.close()
    return results
