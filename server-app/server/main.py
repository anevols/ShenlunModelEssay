"""
申论阅读站 - FastAPI 后端主应用

路由：
  认证：
    POST /api/register  注册管理员（首个用户可直接注册，后续需登录）
    POST /api/login     登录，返回 JWT
    GET  /api/me        获取当前登录用户信息

  文章：
    GET    /api/articles        文章列表（不含正文）
    GET    /api/articles/{slug} 文章详情（含正文）
    POST   /api/articles        创建文章（需登录）
    PUT    /api/articles/{slug} 更新文章（需登录）
    DELETE /api/articles/{slug} 删除文章（需登录）

启动：
    cd server
    uvicorn main:app --reload --host 0.0.0.0 --port 8000
"""

import re
import unicodedata
from typing import List

from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session

from database import engine, Base, get_db
from models import User, Article
from schemas import (
    UserCreate, UserLogin, TokenResponse,
    ArticleCreate, ArticleUpdate, ArticleResponse, ArticleListItem,
)
from auth import hash_password, verify_password, create_access_token, get_current_user, get_admin_user

# 创建数据库表
Base.metadata.create_all(bind=engine)

app = FastAPI(title="申论阅读站 API", version="1.0.0")

# CORS：允许前端跨域访问（开发环境允许所有来源，生产环境应限定具体域名）
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 托管前端静态文件（同源，避免跨域问题）
# 阅读站、登录页与管理后台为同一个 Vue 项目的多入口构建产物（web/dist）：
#   - index.html → 阅读站（根路径 /）
#   - login.html → 登录/注册页（/login，独立应用，开放注册）
#   - admin.html → 管理后台（/admin/）
# 共享 assets/ 目录。
import os
from fastapi.responses import FileResponse, RedirectResponse

WEB_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "web", "dist")
WEB_INDEX = os.path.join(WEB_DIR, "index.html")
LOGIN_INDEX = os.path.join(WEB_DIR, "login.html")
ADMIN_INDEX = os.path.join(WEB_DIR, "admin.html")


@app.get("/login")
@app.get("/login/")
def login_serve():
    """登录/注册页：独立 Vue 应用，回退 login.html。"""
    return FileResponse(LOGIN_INDEX)


@app.get("/admin")
def admin_root_redirect():
    """/admin → /admin/"""
    return RedirectResponse("/admin/", status_code=307)


@app.get("/admin/{full_path:path}")
def admin_serve(full_path: str):
    """管理后台：静态文件优先，否则回退 admin.html（Vue SPA history 路由）。"""
    # 安全：防止路径穿越
    candidate = os.path.normpath(os.path.join(WEB_DIR, full_path))
    if full_path and candidate.startswith(WEB_DIR) and os.path.isfile(candidate):
        return FileResponse(candidate)
    # 其余路径（含根 /admin/、/admin/dashboard 等）回退到 admin.html
    return FileResponse(ADMIN_INDEX)


def generate_slug(title: str) -> str:
    """从标题生成 URL 友好的 slug（支持中文，保留中文字符）。"""
    # 去除首尾空白
    slug = title.strip().lower()
    # 替换空格和标点为连字符
    slug = re.sub(r"[\s]+", "-", slug)
    # 移除特殊字符，保留中文、字母、数字、连字符
    slug = re.sub(r"[^\w\u4e00-\u9fff-]", "", slug, flags=re.UNICODE)
    return slug[:200] if slug else "untitled"


# ===== 认证路由 =====

@app.post("/api/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(payload: UserCreate, db: Session = Depends(get_db)):
    """注册用户。首个用户自动成为管理员，后续注册的为普通用户。"""
    if db.query(User).filter(User.username == payload.username).first():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="用户名已存在")

    # 首个用户自动成为管理员，后续注册的为普通用户
    is_first = db.query(User).count() == 0
    user = User(
        username=payload.username,
        password_hash=hash_password(payload.password),
        is_admin=is_first,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token({"sub": user.username})
    return TokenResponse(access_token=token, username=user.username, is_admin=user.is_admin)


@app.post("/api/login", response_model=TokenResponse)
def login(payload: UserLogin, db: Session = Depends(get_db)):
    """登录，返回 JWT 令牌。"""
    user = db.query(User).filter(User.username == payload.username).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="用户名或密码错误")

    token = create_access_token({"sub": user.username})
    return TokenResponse(access_token=token, username=user.username, is_admin=user.is_admin)


@app.get("/api/me")
def me(current_user: User = Depends(get_current_user)):
    """获取当前登录用户信息。"""
    return {"id": current_user.id, "username": current_user.username, "is_admin": current_user.is_admin}


# ===== 文章路由 =====

@app.get("/api/articles", response_model=List[ArticleListItem])
def list_articles(db: Session = Depends(get_db)):
    """获取文章列表（按分类 → 序号排序，不含正文）。"""
    articles = db.query(Article).order_by(Article.category, Article.order).all()
    return articles


@app.get("/api/articles/{slug}", response_model=ArticleResponse)
def get_article(slug: str, db: Session = Depends(get_db)):
    """获取单篇文章详情（含正文）。"""
    article = db.query(Article).filter(Article.slug == slug).first()
    if not article:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="文章不存在")
    return article


@app.post("/api/articles", response_model=ArticleResponse, status_code=status.HTTP_201_CREATED)
def create_article(payload: ArticleCreate, db: Session = Depends(get_db), _: User = Depends(get_admin_user)):
    """创建文章（需管理员）。"""
    slug = payload.slug or generate_slug(payload.title)
    if db.query(Article).filter(Article.slug == slug).first():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="slug 已存在")

    article = Article(
        slug=slug,
        title=payload.title,
        category=payload.category,
        order=payload.order,
        date=payload.date,
        author=payload.author,
        description=payload.description,
        content_html=payload.content_html,
    )
    db.add(article)
    db.commit()
    db.refresh(article)
    return article


@app.put("/api/articles/{slug}", response_model=ArticleResponse)
def update_article(slug: str, payload: ArticleUpdate, db: Session = Depends(get_db), _: User = Depends(get_admin_user)):
    """更新文章（需管理员）。只更新传入的字段。"""
    article = db.query(Article).filter(Article.slug == slug).first()
    if not article:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="文章不存在")

    update_data = payload.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(article, key, value)

    db.commit()
    db.refresh(article)
    return article


@app.delete("/api/articles/{slug}", status_code=status.HTTP_204_NO_CONTENT)
def delete_article(slug: str, db: Session = Depends(get_db), _: User = Depends(get_admin_user)):
    """删除文章（需管理员）。"""
    article = db.query(Article).filter(Article.slug == slug).first()
    if not article:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="文章不存在")
    db.delete(article)
    db.commit()


@app.get("/api/health")
def health():
    """健康检查。"""
    return {"status": "ok"}


# ===== 托管阅读站静态文件（根路径） =====
# 阅读站为 Vue 3 构建产物（web/dist/index.html），使用 history 模式路由。
# 用 catch-all 路由处理：静态文件存在则返回文件，否则回退 index.html（SPA）。
# 必须放在所有 API 路由和 /admin 路由之后，确保 /api/* 与 /admin/* 优先匹配。
@app.get("/{full_path:path}")
def web_serve(full_path: str):
    """阅读站静态文件 + Vue SPA history 路由 fallback。"""
    # 安全：防止路径穿越
    candidate = os.path.normpath(os.path.join(WEB_DIR, full_path))
    if full_path and candidate.startswith(WEB_DIR) and os.path.isfile(candidate):
        return FileResponse(candidate)
    # 其余路径（含根 /、/article/:slug 等）回退到 index.html
    return FileResponse(WEB_INDEX)
