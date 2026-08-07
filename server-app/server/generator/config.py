"""LLM 配置加载（从 LlmConfig 表读取，带模块级内存缓存）。

设计要点：
- 单行配置表：固定 id=1，不存在时按默认值自动初始化。
- 内存缓存：首次 load 时缓存到模块级变量，避免每次调用都查库。
- 缓存失效：update_config 写入后清空缓存，下次 load 重新读取。
- LLM 调用频繁（批量生成），但配置变更极少，缓存收益明显。
"""

from dataclasses import dataclass
from typing import Optional

from sqlalchemy.orm import Session

from database import SessionLocal
from models import LlmConfig

# 固定单行 id
CONFIG_ID = 1

# 默认值（首次初始化或回退用）
_DEFAULTS = dict(
    api_base="https://api.openai.com/v1",
    api_key="",
    model="gpt-4o-mini",
    temperature=0.7,
    max_tokens=4096,
    timeout=60,
)


@dataclass
class LlmSettings:
    """LLM 调用参数（不可变，由 load() 返回）。"""

    api_base: str
    api_key: str
    model: str
    temperature: float
    max_tokens: int
    timeout: int


# 模块级缓存：None 表示未加载
_cache: Optional[LlmSettings] = None


def _to_settings(row: LlmConfig) -> LlmSettings:
    return LlmSettings(
        api_base=row.api_base or _DEFAULTS["api_base"],
        api_key=row.api_key or "",
        model=row.model or _DEFAULTS["model"],
        temperature=float(row.temperature if row.temperature is not None else _DEFAULTS["temperature"]),
        max_tokens=int(row.max_tokens or _DEFAULTS["max_tokens"]),
        timeout=int(row.timeout or _DEFAULTS["timeout"]),
    )


def load(db: Optional[Session] = None) -> LlmSettings:
    """读取 LLM 配置。

    首次调用从数据库读取并缓存；后续调用直接返回缓存。
    传入 db 则使用该会话，否则内部新建临时会话。

    若配置表无记录，按默认值初始化一行（id=1）并返回。
    """
    global _cache
    if _cache is not None:
        return _cache

    own_session = db is None
    if own_session:
        db = SessionLocal()
    try:
        row = db.get(LlmConfig, CONFIG_ID)
        if row is None:
            # 首次初始化
            row = LlmConfig(id=CONFIG_ID, **_DEFAULTS)
            db.add(row)
            db.commit()
            db.refresh(row)
        _cache = _to_settings(row)
        return _cache
    finally:
        if own_session:
            db.close()


def invalidate_cache() -> None:
    """清空内存缓存，下次 load() 重新读取数据库。

    配置更新后必须调用，否则生成器仍用旧值。
    """
    global _cache
    _cache = None


def update_config(db: Session, **fields) -> LlmSettings:
    """更新配置（upsert）并刷新缓存。

    仅更新传入的字段；写入后清空缓存并重新加载返回最新值。
    """
    row = db.get(LlmConfig, CONFIG_ID)
    if row is None:
        # 表为空时按默认值创建，再覆盖传入字段
        row = LlmConfig(id=CONFIG_ID, **_DEFAULTS)
        db.add(row)
    for key, value in fields.items():
        if value is not None and hasattr(row, key):
            setattr(row, key, value)
    db.commit()
    db.refresh(row)
    invalidate_cache()
    return _to_settings(row)
