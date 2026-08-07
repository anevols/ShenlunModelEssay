<script setup>
/**
 * 文章详情视图
 *
 * - 从 API 加载文章详情（含 content_html），带 LRU 缓存
 * - 渲染标题、meta、正文（v-html）
 * - 右侧 TOC：从正文 h2/h3 提取，滚动高亮
 * - 上一篇/下一篇导航
 * - 面包屑
 * - 访问 / 无 slug 时自动跳转第一篇文章
 */
import { ref, computed, inject, watch, nextTick, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api } from '../shared/auth.js'

const route = useRoute()
const router = useRouter()

// 文章列表（由 ReaderLayout provide）
const articles = inject('articles')
// 侧边栏开关状态（由 ReaderLayout provide，开关按钮放在面包屑旁）
const sidebar = inject('sidebar')

const props = defineProps({
  slug: { type: String, default: '' },
})

// ===== 模块级 LRU 缓存（跨组件实例持久化） =====
const articleCache = new Map()
const CACHE_LIMIT = 8

function touchCache(key) {
  if (articleCache.has(key)) {
    const v = articleCache.get(key)
    articleCache.delete(key)
    articleCache.set(key, v)
  }
}
function evictCache() {
  while (articleCache.size > CACHE_LIMIT) {
    const oldest = articleCache.keys().next().value
    articleCache.delete(oldest)
  }
}

// ===== 响应式状态 =====
const article = ref(null)
const loading = ref(false)
const error = ref('')
const contentRef = ref(null)
const tocItems = ref([])
const activeHeadingId = ref('')

let observer = null

const currentSlug = computed(() => props.slug || route.params.slug || '')

const articleMeta = computed(() =>
  articles.value.find((a) => a.slug === currentSlug.value)
)

const prevArticle = computed(() => {
  const idx = articles.value.findIndex((a) => a.slug === currentSlug.value)
  return idx > 0 ? articles.value[idx - 1] : null
})

const nextArticle = computed(() => {
  const idx = articles.value.findIndex((a) => a.slug === currentSlug.value)
  return idx >= 0 && idx < articles.value.length - 1 ? articles.value[idx + 1] : null
})

// ===== 加载文章 =====
async function loadArticle(slug) {
  if (!slug) return
  loading.value = true
  error.value = ''

  // 命中缓存
  if (articleCache.has(slug)) {
    touchCache(slug)
    article.value = articleCache.get(slug)
    loading.value = false
    await nextTick()
    buildToc()
    updateDocTitle()
    return
  }

  try {
    const data = await api.getArticle(slug)
    articleCache.set(slug, data)
    touchCache(slug)
    evictCache()
    article.value = data
  } catch (e) {
    error.value = e.message
    article.value = null
  } finally {
    loading.value = false
    await nextTick()
    buildToc()
    updateDocTitle()
  }
}

function updateDocTitle() {
  const title = article.value?.title || articleMeta.value?.title
  document.title = title ? `${title} · 申论` : '申论范文阅读站'
}

// ===== TOC 构建 + 滚动高亮 =====
function buildToc() {
  if (observer) {
    observer.disconnect()
    observer = null
  }
  if (!contentRef.value) {
    tocItems.value = []
    return
  }
  const heads = contentRef.value.querySelectorAll('h2, h3')
  const used = {}
  const items = []
  heads.forEach((h, i) => {
    const text = (h.textContent || '').trim() || `section-${i}`
    let base = text.toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, '').replace(/\s+/g, '-').slice(0, 50) || `h-${i}`
    let id = base
    let n = 2
    while (used[id]) { id = `${base}-${n++}` }
    used[id] = true
    h.id = id
    items.push({ id, text: h.textContent, level: h.tagName.toLowerCase() })
  })
  tocItems.value = items

  if (items.length === 0) return
  observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          activeHeadingId.value = entry.target.id
        }
      })
    },
    { rootMargin: '-80px 0px -70% 0px', threshold: 0 }
  )
  heads.forEach((h) => observer.observe(h))
}

function scrollToHeading(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
}

// ===== 监听 slug 变化 =====
watch(
  [() => currentSlug.value, articles],
  ([slug, arts], [oldSlug]) => {
    if (slug !== oldSlug && slug) {
      loadArticle(slug)
      return
    }
    // 无 slug：文章列表已加载且非空时跳转第一篇
    if (!slug && arts && arts.length > 0) {
      router.replace(`/article/${arts[0].slug}`)
    }
  },
  { immediate: true }
)

onUnmounted(() => {
  if (observer) observer.disconnect()
})
</script>

<template>
  <div class="content-wrap">
    <div class="content-area">
      <!-- 侧边栏开关 + 面包屑（始终显示） -->
      <div class="content-topbar">
        <button class="sidebar-toggle" :aria-label="sidebar.collapsed.value ? '展开目录' : '收起目录'" @click="sidebar.toggle">
          <svg v-if="sidebar.collapsed.value" viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M3 6h18v2H3zm0 5h18v2H3zm0 5h18v2H3z"></path></svg>
          <svg v-else viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M3 6h13v2H3zm0 5h13v2H3zm0 5h13v2H3zM19 4l4 8-4 8z"></path></svg>
        </button>
        <div class="breadcrumb">
          <router-link to="/">首页</router-link>
          <template v-if="article">
            <span class="breadcrumb-sep">/</span>
            <span>{{ article.category }}</span>
            <span class="breadcrumb-sep">/</span>
            <span>{{ article.title }}</span>
          </template>
        </div>
      </div>

      <!-- 加载中 -->
      <div v-if="loading && !article" class="loading">正在加载文章…</div>
      <!-- 加载失败 -->
      <div v-else-if="error" class="loading error">{{ error }}</div>
      <!-- 无文章 -->
      <div v-else-if="!article" class="loading">还没有任何文章。</div>
      <!-- 文章正文 -->
      <template v-else>
        <article class="content">
          <h1>{{ article.title }}</h1>
          <div v-if="article.date || article.author" class="article-meta">
            <time v-if="article.date" :datetime="article.date">{{ article.date }}</time>
            <template v-if="article.date && article.author"> · </template>
            <span v-if="article.author">{{ article.author }}</span>
          </div>
          <div ref="contentRef" class="article-content" v-html="article.content_html"></div>
        </article>

        <!-- 上一篇 / 下一篇 -->
        <nav class="prev-next" aria-label="上下篇导航">
          <router-link v-if="prevArticle" :to="`/article/${prevArticle.slug}`" class="pn-link prev">
            <span class="pn-label">← 上一篇</span>
            <span class="pn-title">{{ prevArticle.title }}</span>
          </router-link>
          <span v-else></span>
          <router-link v-if="nextArticle" :to="`/article/${nextArticle.slug}`" class="pn-link next">
            <span class="pn-label">下一篇 →</span>
            <span class="pn-title">{{ nextArticle.title }}</span>
          </router-link>
        </nav>
      </template>
    </div>

    <!-- 右侧 TOC -->
    <aside class="toc" aria-label="本页大纲">
      <div class="toc-title">本页目录</div>
      <div class="toc-list">
        <a
          v-for="item in tocItems"
          :key="item.id"
          :href="`#${item.id}`"
          class="toc-link"
          :class="[item.level, { active: activeHeadingId === item.id }]"
          @click.prevent="scrollToHeading(item.id)"
        >
          {{ item.text }}
        </a>
        <div v-if="tocItems.length === 0 && article" class="toc-empty">本页无子标题</div>
      </div>
    </aside>
  </div>
</template>
