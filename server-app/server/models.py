"""
数据模型（SQLAlchemy ORM）

- User：用户账户（用户名 + 密码哈希 + 是否管理员）
  - 首个注册的用户自动成为管理员（is_admin=True）
  - 后续注册的用户为普通用户（is_admin=False），可登录阅读站但无管理后台权限
- Article：文章（slug/标题/分类/序号/日期/作者/摘要/正文HTML）
- LlmConfig：范文生成器的 LLM 配置（单行配置表，固定 id=1，可在后台修改）
"""

from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, Float
from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    is_admin = Column(Boolean, default=False, server_default="0", nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class Article(Base):
    __tablename__ = "articles"

    id = Column(Integer, primary_key=True, index=True)
    slug = Column(String(200), unique=True, index=True, nullable=False)
    title = Column(String(500), nullable=False)
    category = Column(String(100), nullable=False, default="")
    order = Column(Integer, nullable=False, default=999)
    date = Column(String(20), default="")
    author = Column(String(100), default="")
    description = Column(Text, default="")
    content_html = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class LlmConfig(Base):
    """范文生成器 LLM 配置（单行配置表，固定 id=1，通过 upsert 更新）。

    明文存储：内网部署场景简化实现；如需对外可后续加密。
    GET 接口返回时对 api_key 做 mask，仅 PUT 时写入明文。
    """

    __tablename__ = "llm_config"

    id = Column(Integer, primary_key=True, index=True)
    provider = Column(String(50), default="openai")  # openai | claude | local
    api_base = Column(String(255), default="https://api.openai.com/v1")
    api_key = Column(String(255), default="")  # 明文存储（内网部署）
    model = Column(String(100), default="gpt-4o-mini")
    temperature = Column(Float, default=0.7)
    max_tokens = Column(Integer, default=4096)
    timeout = Column(Integer, default=60)  # 单次调用超时（秒）
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

