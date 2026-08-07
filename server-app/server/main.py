"""
申论阅读站 - FastAPI 后端主应用

路由：
  认证：
    POST /api/register  注册管理员（首个用户可直接注册，后续需登录）
    POST /api/login     登录，返回 JWT
    GET  /api/me        获取当前登录用户信息

  文章：
    GET    /api/articles        文章列表（不含正文，按板块枚举顺序排序）
    GET    /api/articles/{slug} 文章详情（含正文）
    POST   /api/articles        创建文章（需登录）
    PUT    /api/articles/{slug} 更新文章（需登录）
    DELETE /api/articles/{slug} 删除文章（需登录）

  分类：
    GET    /api/categories      十大主题板块列表（有序）

  LLM 配置（管理员）：
    GET    /api/admin/llm-config 读取 LLM 配置（api_key mask）
    PUT    /api/admin/llm-config 更新 LLM 配置

启动：
    cd server
    uvicorn main:app --reload --host 0.0.0.0 --port 8000
"""

import re
import unicodedata
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from database import engine, Base, get_db
from models import User, Article, LlmConfig
from schemas import (
    UserCreate, UserLogin, TokenResponse,
    ArticleCreate, ArticleUpdate, ArticleResponse, ArticleListItem,
    LlmConfigUpdate, LlmConfigResponse,
)
from auth import hash_password, verify_password, create_access_token, get_current_user, get_admin_user
from categories import CATEGORIES, category_order, is_valid_category
from generator.config import load as load_llm_config, update_config as update_llm_config
from generator.pipeline import generate_preview, generate_and_save, generate_batch, GenerateError

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
# 单 SPA：阅读站、登录页、管理后台合并为单一 Vue 应用（web/dist/index.html），
# 通过 Vue Router history 模式路由，由 catch-all 统一回退到 index.html。
import os
from fastapi.responses import FileResponse

WEB_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "web", "dist")
WEB_INDEX = os.path.join(WEB_DIR, "index.html")


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
    """获取文章列表（按十大板块枚举顺序 → 序号排序，不含正文）。

    数据库 order_by 无法直接按枚举顺序排，故先查全部再 Python 端排序。
    """
    articles = db.query(Article).all()
    articles.sort(key=lambda a: (category_order(a.category), a.order))
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


# ===== 分类路由 =====

@app.get("/api/categories")
def list_categories():
    """十大主题板块列表（有序，顺序即展示顺序）。"""
    return {"categories": list(CATEGORIES)}


# ===== LLM 配置路由（管理员） =====
# 范文生成器的 LLM 配置：单行配置表（id=1），可在后台修改。
# GET 返回时对 api_key 做 mask，仅 PUT 写入明文。

def _mask_api_key(key: str) -> str:
    """脱敏 api_key：保留前3后4，中间用 **** 替代。空值返回空串。"""
    if not key:
        return ""
    if len(key) <= 8:
        return "****"
    return f"{key[:3]}****{key[-4:]}"


@app.get("/api/admin/llm-config", response_model=LlmConfigResponse)
def get_llm_config(_: User = Depends(get_admin_user)):
    """读取 LLM 配置（api_key 脱敏返回）。"""
    cfg = load_llm_config()
    return LlmConfigResponse(
        api_base=cfg.api_base,
        api_key_masked=_mask_api_key(cfg.api_key),
        api_key_set=bool(cfg.api_key),
        model=cfg.model,
        temperature=cfg.temperature,
        max_tokens=cfg.max_tokens,
        timeout=cfg.timeout,
    )


@app.put("/api/admin/llm-config", response_model=LlmConfigResponse)
def update_llm_config_route(payload: LlmConfigUpdate, db: Session = Depends(get_db), _: User = Depends(get_admin_user)):
    """更新 LLM 配置（管理员）。

    api_key 为可选字段：传空串则清空，不传则保留原值（None 时跳过）。
    其余字段传入即更新。
    """
    data = payload.model_dump(exclude_unset=True)
    # api_key 字段处理：exclude_unset=True 下，未传则不在 data 中（保留原值）
    # 传了空串则清空，传了非空串则更新
    cfg = update_llm_config(db, **data)
    return LlmConfigResponse(
        api_base=cfg.api_base,
        api_key_masked=_mask_api_key(cfg.api_key),
        api_key_set=bool(cfg.api_key),
        model=cfg.model,
        temperature=cfg.temperature,
        max_tokens=cfg.max_tokens,
        timeout=cfg.timeout,
    )


# ===== 范文生成路由（管理员） =====
# AI 生成申论范文：预览（不入库）/ 单篇入库 / 批量入库（按板块轮询）。
# 前端先预览确认质量，满意后选择「入库」或「批量入库」。

class GeneratePreviewResponse(BaseModel):
    """生成预览响应（不入库）。"""
    theme: str
    title: str
    category: str
    description: str
    content_html: str
    word_count: int


class GenerateSaveResponse(BaseModel):
    """生成入库响应（含入库后的 article slug）。"""
    theme: str
    success: bool
    title: Optional[str] = None
    slug: Optional[str] = None
    error: Optional[str] = None


class GenerateRequest(BaseModel):
    """生成请求：theme 单篇，themes 批量。二选一即可。"""
    theme: Optional[str] = None
    themes: Optional[List[str]] = None


@app.post("/api/admin/generate/preview", response_model=GeneratePreviewResponse)
def api_generate_preview(payload: GenerateRequest, _: User = Depends(get_admin_user)):
    """生成单篇范文预览（不入库）。

    前端用于「试生成」让用户预览效果，满意后再调 /save 入库。
    """
    theme = payload.theme
    if not theme:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="theme 必填")
    if not is_valid_category(theme):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"非法板块：{theme}")
    try:
        result = generate_preview(theme)
        return result
    except GenerateError as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@app.post("/api/admin/generate/save", response_model=GenerateSaveResponse)
def api_generate_save(payload: GenerateRequest, db: Session = Depends(get_db), _: User = Depends(get_admin_user)):
    """生成单篇范文并入库。"""
    theme = payload.theme
    if not theme:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="theme 必填")
    if not is_valid_category(theme):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"非法板块：{theme}")
    try:
        article = generate_and_save(theme, db)
        return GenerateSaveResponse(theme=theme, success=True, title=article.title, slug=article.slug)
    except GenerateError as e:
        return GenerateSaveResponse(theme=theme, success=False, error=str(e))


@app.post("/api/admin/generate/batch", response_model=List[GenerateSaveResponse])
def api_generate_batch(payload: GenerateRequest, db: Session = Depends(get_db), _: User = Depends(get_admin_user)):
    """批量生成入库（按 themes 顺序逐篇生成，单篇失败不影响其他篇）。

    适合后台「一键生成十大板块各一篇」等场景。
    """
    themes = payload.themes or ([payload.theme] if payload.theme else [])
    if not themes:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="themes 或 theme 至少传一个")
    # 校验全部板块合法性（提前失败，避免部分生成后才发现）
    for t in themes:
        if not is_valid_category(t):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"非法板块：{t}")

    results = generate_batch(themes, db)
    return [GenerateSaveResponse(**r) for r in results]


# ===== 托管前端静态文件（单 SPA） =====
# 单 SPA 构建产物（web/dist/index.html），使用 history 模式路由。
# catch-all 路由：静态文件存在则返回文件，否则回退 index.html（SPA fallback）。
# 必须放在所有 API 路由之后，确保 /api/* 优先匹配。
@app.get("/{full_path:path}")
def web_serve(full_path: str):
    """前端静态文件 + Vue SPA history 路由 fallback。"""
    # 未匹配的 API 路径返回 404，避免被 SPA fallback 误处理为 200
    if full_path.startswith("api/"):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not Found")
    # 安全：防止路径穿越
    candidate = os.path.normpath(os.path.join(WEB_DIR, full_path))
    if full_path and candidate.startswith(WEB_DIR) and os.path.isfile(candidate):
        return FileResponse(candidate)
    # 其余路径（含根 /、/article/:slug、/login、/admin/dashboard 等）回退到 index.html
    return FileResponse(WEB_INDEX)
