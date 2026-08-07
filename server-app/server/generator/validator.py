"""LLM 输出校验器。

对 generate_essay() 返回的 dict 做结构 / 字段 / 字数 / 完整性校验，
校验失败由 pipeline 决定是否重试。

校验项：
- 顶层字段：title / category / meta_description / sections
- sections 结构：恰好 5 段（1 intro + 3 body + 1 conclusion）
- 每段 sentences 非空，每句 text 非空、arg_type 合法
- 字数：正文 800–1500 字（宽松区间，避免 LLM 偶尔偏短/偏长直接失败）
- category 必须属于十大板块
"""

from typing import Any, Dict, List, Tuple

from categories import is_valid_category

# 合法 arg_type 枚举（与 prompts.py SYSTEM_PROMPT 一致）
VALID_ARG_TYPES = {"point", "case", "quote", "cause", "contrast", "effect", "measure"}

# 合法 section.type 枚举
VALID_SECTION_TYPES = {"intro", "body", "conclusion"}

# 字数区间（正文，不含标题）
MIN_WORDS = 800
MAX_WORDS = 1500


class ValidationError(Exception):
    """校验失败。message 形如 'sections 数量不足: 3'，供 pipeline 日志/重试判断。"""


def _count_words(sections: List[Dict[str, Any]]) -> int:
    """统计正文字数（所有 sentence.text 的字符数之和，近似中文字数）。"""
    total = 0
    for sec in sections:
        for s in sec.get("sentences", []) or []:
            total += len(s.get("text", "") or "")
    return total


def validate_essay(data: Dict[str, Any]) -> Tuple[bool, str]:
    """校验范文 dict，返回 (是否通过, 失败原因)。

    通过时失败原因为空串。不抛异常，便于调用方按需处理。
    """
    if not isinstance(data, dict):
        return False, "顶层不是 dict"

    # 顶层字段
    title = data.get("title")
    if not title or not isinstance(title, str):
        return False, "title 缺失或非字符串"
    if len(title) > 30:
        return False, f"title 过长: {len(title)} 字"

    category = data.get("category")
    if not category or not isinstance(category, str):
        return False, "category 缺失或非字符串"
    if not is_valid_category(category):
        return False, f"category 不属于十大板块: {category}"

    desc = data.get("meta_description")
    if desc is not None and not isinstance(desc, str):
        return False, "meta_description 非字符串"

    sections = data.get("sections")
    if not isinstance(sections, list):
        return False, "sections 缺失或非列表"
    if len(sections) != 5:
        return False, f"sections 数量必须为 5，实际 {len(sections)}"

    # 段落类型序列必须为 intro / body / body / body / conclusion
    expected_types = ["intro", "body", "body", "body", "conclusion"]
    for i, sec in enumerate(sections):
        if not isinstance(sec, dict):
            return False, f"section[{i}] 非 dict"
        stype = sec.get("type")
        if stype not in VALID_SECTION_TYPES:
            return False, f"section[{i}].type 非法: {stype}"
        if stype != expected_types[i]:
            return False, f"section[{i}].type 期望 {expected_types[i]}，实际 {stype}"

        sentences = sec.get("sentences")
        if not isinstance(sentences, list) or len(sentences) == 0:
            return False, f"section[{i}].sentences 为空"

        # body 段需要 sub_point
        if stype == "body":
            sub = sec.get("sub_point")
            if not sub or not isinstance(sub, str):
                return False, f"section[{i}].sub_point 缺失"

        for j, s in enumerate(sentences):
            if not isinstance(s, dict):
                return False, f"section[{i}].sentences[{j}] 非 dict"
            text = s.get("text")
            if not text or not isinstance(text, str):
                return False, f"section[{i}].sentences[{j}].text 为空"
            arg_type = s.get("arg_type")
            if arg_type not in VALID_ARG_TYPES:
                return False, f"section[{i}].sentences[{j}].arg_type 非法: {arg_type}"

    # 字数校验
    words = _count_words(sections)
    if words < MIN_WORDS:
        return False, f"字数不足: {words} < {MIN_WORDS}"
    if words > MAX_WORDS:
        return False, f"字数超限: {words} > {MAX_WORDS}"

    return True, ""
