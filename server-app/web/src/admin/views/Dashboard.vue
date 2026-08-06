<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { api, getUsername, clearAuth, getToken } from '../auth.js'
import ArticleEditor from '../components/ArticleEditor.vue'

const router = useRouter()

// 登录态：未登录跳回登录页（守卫已拦截，这里兜底）
if (!getToken()) router.replace({ name: 'login' })

const username = ref(getUsername() || '管理员')
const allArticles = ref([])
const searchQuery = ref('')
const loadingList = ref(false)
const listError = ref('')

// 编辑器弹窗
const editorVisible = ref(false)
const editingSlug = ref(null)

// 过滤后的列表
const filteredArticles = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return allArticles.value
  return allArticles.value.filter((a) => a.title.toLowerCase().includes(q))
})

async function loadArticles() {
  loadingList.value = true
  listError.value = ''
  try {
    allArticles.value = await api.listArticles()
  } catch (err) {
    listError.value = err.message
  } finally {
    loadingList.value = false
  }
}

function openNew() {
  editingSlug.value = null
  editorVisible.value = true
}

function openEdit(slug) {
  editingSlug.value = slug
  editorVisible.value = true
}

function closeEditor() {
  editorVisible.value = false
  editingSlug.value = null
}

function onSaved() {
  closeEditor()
  loadArticles()
}

async function deleteArticle(slug) {
  if (!confirm('确定删除这篇文章吗？此操作不可撤销。')) return
  try {
    await api.deleteArticle(slug)
    await loadArticles()
  } catch (err) {
    alert('删除失败：' + err.message)
  }
}

function logout() {
  clearAuth()
  router.push({ name: 'login' })
}

onMounted(loadArticles)
</script>

<template>
  <div>
    <!-- 顶部栏 -->
    <header class="admin-header">
      <div class="admin-header-inner">
        <a href="/admin/dashboard" class="admin-brand">申论阅读站 · 管理后台</a>
        <div class="admin-user">
          <span>{{ username }}</span>
          <button class="btn-text" @click="logout">退出</button>
        </div>
      </div>
    </header>

    <main class="admin-main">
      <!-- 工具栏 -->
      <div class="toolbar">
        <h2>文章列表</h2>
        <div class="toolbar-actions">
          <input v-model="searchQuery" type="text" placeholder="搜索标题..." class="input-search">
          <button class="btn-primary" @click="openNew">+ 新建文章</button>
        </div>
      </div>

      <!-- 文章列表表格 -->
      <table class="article-table">
        <thead>
          <tr>
            <th>标题</th>
            <th>分类</th>
            <th>序号</th>
            <th>日期</th>
            <th>作者</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loadingList">
            <td colspan="6" class="table-loading">加载中...</td>
          </tr>
          <tr v-else-if="listError">
            <td colspan="6" class="table-loading">加载失败：{{ listError }}</td>
          </tr>
          <tr v-else-if="filteredArticles.length === 0">
            <td colspan="6" class="table-loading">暂无文章</td>
          </tr>
          <tr v-for="a in filteredArticles" :key="a.slug">
            <td class="article-title-cell">{{ a.title }}</td>
            <td>{{ a.category }}</td>
            <td>{{ a.order }}</td>
            <td>{{ a.date || '—' }}</td>
            <td>{{ a.author || '—' }}</td>
            <td>
              <button class="btn-text" @click="openEdit(a.slug)">编辑</button>
              <button class="btn-danger" @click="deleteArticle(a.slug)">删除</button>
            </td>
          </tr>
        </tbody>
      </table>
    </main>

    <!-- 文章编辑弹窗 -->
    <ArticleEditor :visible="editorVisible" :slug="editingSlug" @close="closeEditor" @saved="onSaved" />
  </div>
</template>
