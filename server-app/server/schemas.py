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
