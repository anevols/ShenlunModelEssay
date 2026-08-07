"""LLM 调用封装（OpenAI SDK，JSON 模式）。

参数来自 generator.config.load()，支持运行时通过后台修改而无需重启。
provider=openai 时走标准 OpenAI API；claude/local 通过 OpenAI 兼容接口调用
（多数供应商提供 /v1/chat/completions 兼容端点，故统一用 OpenAI SDK）。

输出：解析后的范文 dict（{title, category, meta_description, sections}）。
"""

import json
import time
from typing import Any, Dict

from openai import OpenAI

from .config import load
from .prompts import SYSTEM_PROMPT, build_user_prompt
from .topics import get_topic


class LlmError(Exception):
    """LLM 调用或解析失败。"""


def _build_client() -> OpenAI:
    """根据当前配置构建 OpenAI 客户端。"""
    cfg = load()
    if not cfg.api_key:
        raise LlmError("LLM 配置缺失：api_key 未设置，请先在后台配置")
    return OpenAI(api_key=cfg.api_key, base_url=cfg.api_base, timeout=cfg.timeout)


def generate_essay(theme: str) -> Dict[str, Any]:
    """生成单篇范文。

    流程：
    1. 取主题的分论点方向与候选案例
    2. 组装 system + user prompt
    3. 调用 LLM（JSON 模式）
    4. 解析返回的 JSON

    失败抛 LlmError，由调用方决定重试或跳过。
    """
    sub_points, cases = get_topic(theme)
    user_prompt = build_user_prompt(theme, sub_points, cases)

    client = _build_client()
    cfg = load()

    try:
        resp = client.chat.completions.create(
            model=cfg.model,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
            temperature=cfg.temperature,
            max_tokens=cfg.max_tokens,
            response_format={"type": "json_object"},
        )
    except Exception as e:
        raise LlmError(f"LLM 调用失败：{e}") from e

    # 健壮性：部分供应商对不支持的模型/参数会返回 HTTP 200 但 choices=null
    if not getattr(resp, "choices", None):
        model_name = getattr(resp, "model", cfg.model) or cfg.model
        raise LlmError(
            f"LLM 返回空响应（choices 为空）。模型「{model_name}」可能不可用或不支持当前参数，"
            f"请到 LLM 配置页更换模型名（如 Qwen/Qwen3-235B-A22B-Instruct-2507）。"
        )

    content = resp.choices[0].message.content or ""
    try:
        data = json.loads(content)
    except json.JSONDecodeError as e:
        raise LlmError(f"LLM 返回非法 JSON：{e}；原始内容前 200 字：{content[:200]}") from e

    # 基础字段校验
    if not isinstance(data, dict) or "sections" not in data or "title" not in data:
        raise LlmError("LLM 返回结构不完整：缺少 title 或 sections")
    return data


def generate_essay_with_retry(theme: str, max_retries: int = 1) -> Dict[str, Any]:
    """带重试的生成（Phase 1 仅 1 次重试；Phase 3 由 validator 接管重试）。"""
    last_err: LlmError | None = None
    for attempt in range(max_retries + 1):
        try:
            return generate_essay(theme)
        except LlmError as e:
            last_err = e
            if attempt < max_retries:
                time.sleep(1)
    raise last_err  # type: ignore[misc]
