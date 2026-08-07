"""
Pydantic 模型（请求体验证与响应序列化）
"""

from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional


# ===== 认证相关 =====
class UserCreate(BaseModel):
    username: str = Field(..., min_length=2, max_length=50)
    password: str = Field(..., min_length=6, max_length=100)


class UserLogin(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    username: str
    is_admin: bool = False


# ===== 文章相关 =====
class ArticleBase(BaseModel):
    title: str
    category: str = "申论"
    order: int = 999
    date: str = ""
    author: str = ""
    description: str = ""
    content_html: str = ""


class ArticleCreate(ArticleBase):
    slug: Optional[str] = None  # 不传则自动从标题生成


class ArticleUpdate(BaseModel):
    title: Optional[str] = None
    category: Optional[str] = None
    order: Optional[int] = None
    date: Optional[str] = None
    author: Optional[str] = None
    description: Optional[str] = None
    content_html: Optional[str] = None


class ArticleResponse(ArticleBase):
    id: int
    slug: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ArticleListItem(BaseModel):
    """文章列表项（不含正文，用于列表展示）"""
    id: int
    slug: str
    title: str
    category: str
    order: int
    date: str
    author: str
    description: str

    class Config:
        from_attributes = True


# ===== LLM 配置相关 =====
class LlmConfigUpdate(BaseModel):
    """LLM 配置更新请求（OpenAI SDK 配置项）。

    所有字段可选，仅传入的字段会被更新（exclude_unset）。
    api_key：传空串则清空，不传则保留原值。
    """
    api_base: Optional[str] = None
    api_key: Optional[str] = None
    model: Optional[str] = None
    temperature: Optional[float] = None
    max_tokens: Optional[int] = None
    timeout: Optional[int] = None


class LlmConfigResponse(BaseModel):
    """LLM 配置响应（api_key 脱敏）。"""
    api_base: str
    api_key_masked: str  # 脱敏后的 api_key（如 sk-****1234）
    api_key_set: bool    # 是否已设置 api_key
    model: str
    temperature: float
    max_tokens: int
    timeout: int
