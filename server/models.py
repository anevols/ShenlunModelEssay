"""
数据模型（SQLAlchemy ORM）

- User：管理员账户（用户名 + 密码哈希）
- Article：文章（slug/标题/分类/序号/日期/作者/摘要/正文HTML）
"""

from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime
from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class Article(Base):
    __tablename__ = "articles"

    id = Column(Integer, primary_key=True, index=True)
    slug = Column(String(200), unique=True, index=True, nullable=False)
    title = Column(String(500), nullable=False)
    category = Column(String(100), nullable=False, default="申论")
    order = Column(Integer, nullable=False, default=999)
    date = Column(String(20), default="")
    author = Column(String(100), default="")
    description = Column(Text, default="")
    content_html = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
