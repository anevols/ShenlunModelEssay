<script setup>
import { ref, reactive, watch } from 'vue'
import { api } from '../auth.js'
import { parseHtmlFile } from '../utils.js'

const props = defineProps({
  visible: { type: Boolean, default: false },
  // 编辑模式时传入 slug；新建模式传 null
  slug: { type: String, default: null },
})

const emit = defineEmits(['close', 'saved'])

const loading = ref(false)
const saving = ref(false)
const error = ref('')
const uploadHint = ref('')
const uploadStatus = ref('') // '' | success | error
const fileInput = ref(null)

const isEdit = () => !!props.slug

// 表单数据
const form = reactive({
  id: '',
  slug: '',
  origSlug: '', // 编辑时记录原始 slug，用于 PUT 定位
  title: '',
  category: '申论',
  order: 999,
  date: '',
  author: '',
  description: '',
  contentHtml: '',
})

// 弹窗打开时加载数据
watch(
  () => props.visible,
  async (val) => {
    if (!val) return
    resetForm()
    if (props.slug) {
      loading.value = true
      try {
        const a = await api.getArticle(props.slug)
        form.id = a.id
        form.slug = a.slug
        form.origSlug = a.slug
        form.title = a.title
        form.category = a.category
        form.order = a.order
        form.date = a.date
        form.author = a.author
        form.description = a.description
        form.contentHtml = a.content_html
      } catch (err) {
        error.value = '加载文章失败：' + err.message
      } finally {
        loading.value = false
      }
    }
  }
)

function resetForm() {
  form.id = ''
  form.slug = ''
  form.origSlug = ''
  form.title = ''
  form.category = '申论'
  form.order = 999
  form.date = ''
  form.author = ''
  form.description = ''
  form.contentHtml = ''
  error.value = ''
  uploadHint.value = ''
  uploadStatus.value = ''
  if (fileInput.value) fileInput.value.value = ''
}

// 上传 HTML 文件自动识别
function triggerUpload() {
  fileInput.value?.click()
}

async function onFileChange(e) {
  const file = e.target.files[0]
  if (!file) return
  try {
    const text = await file.text()
    const parsed = parseHtmlFile(text, file.name)
    // 仅填充识别到的非空字段
    if (parsed.title) form.title = parsed.title
    if (parsed.slug) form.slug = parsed.slug
    if (parsed.category) form.category = parsed.category
    if (parsed.order) form.order = parsed.order
    if (parsed.date) form.date = parsed.date
    if (parsed.author) form.author = parsed.author
    if (parsed.description) form.description = parsed.description
    if (parsed.contentHtml) form.contentHtml = parsed.contentHtml
    uploadHint.value = `已识别：${file.name}`
    uploadStatus.value = 'success'
  } catch (err) {
    uploadHint.value = '解析失败：' + err.message
    uploadStatus.value = 'error'
  }
}

// 保存
async function handleSave() {
  if (!form.title.trim()) {
    error.value = '请填写标题'
    return
  }
  saving.value = true
  error.value = ''
  const data = {
    title: form.title.trim(),
    slug: form.slug.trim() || undefined,
    category: form.category.trim() || '申论',
    order: parseInt(form.order) || 999,
    date: form.date.trim(),
    author: form.author.trim(),
    description: form.description.trim(),
    content_html: form.contentHtml,
  }
  try {
    if (isEdit()) {
      await api.updateArticle(form.origSlug, data)
    } else {
      await api.createArticle(data)
    }
    emit('saved')
  } catch (err) {
    error.value = '保存失败：' + err.message
  } finally {
    saving.value = false
  }
}

function close() {
  emit('close')
}
</script>

<template>
  <div v-if="visible" class="modal" @click.self="close">
    <div class="modal-content modal-large">
      <div class="modal-header">
        <h3>{{ isEdit() ? '编辑文章' : '新建文章' }}</h3>
        <button class="modal-close" @click="close">×</button>
      </div>

      <div v-if="loading" class="article-form" style="text-align:center;color:var(--text-light);padding:60px">加载中...</div>

      <form v-else class="article-form" @submit.prevent="handleSave">
        <!-- 上传 HTML 文件自动识别 -->
        <div class="form-group upload-group">
          <label>从 HTML 文件导入</label>
          <div class="upload-area">
            <input ref="fileInput" type="file" accept=".html,.htm" hidden @change="onFileChange">
            <button type="button" class="btn-upload" @click="triggerUpload">选择 HTML 文件</button>
            <span class="upload-hint" :class="uploadStatus">{{ uploadHint || '上传后自动识别标题、分类、正文等' }}</span>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label for="f-title">标题 *</label>
            <input id="f-title" v-model="form.title" type="text" required>
          </div>
          <div class="form-group form-group-small">
            <label for="f-slug">slug（留空自动生成）</label>
            <input id="f-slug" v-model="form.slug" type="text">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group form-group-small">
            <label for="f-category">分类</label>
            <input id="f-category" v-model="form.category" type="text">
          </div>
          <div class="form-group form-group-small">
            <label for="f-order">序号</label>
            <input id="f-order" v-model.number="form.order" type="number">
          </div>
          <div class="form-group form-group-small">
            <label for="f-date">日期</label>
            <input id="f-date" v-model="form.date" type="text" placeholder="如 2024-06-15">
          </div>
          <div class="form-group form-group-small">
            <label for="f-author">作者</label>
            <input id="f-author" v-model="form.author" type="text">
          </div>
        </div>
        <div class="form-group">
          <label for="f-description">摘要</label>
          <textarea id="f-description" v-model="form.description" rows="2"></textarea>
        </div>
        <div class="form-group">
          <label for="f-content">正文 HTML</label>
          <textarea id="f-content" v-model="form.contentHtml" rows="18" class="code-textarea" placeholder="直接粘贴文章 HTML 正文..."></textarea>
        </div>

        <div v-if="error" class="auth-message error" style="text-align:left;margin-bottom:12px">{{ error }}</div>

        <div class="form-actions">
          <button type="button" class="btn-text" @click="close">取消</button>
          <button type="submit" class="btn-primary" :disabled="saving">{{ saving ? '保存中...' : '保存' }}</button>
        </div>
      </form>
    </div>
  </div>
</template>
