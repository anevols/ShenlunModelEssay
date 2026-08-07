<script setup>
/**
 * 范文生成视图
 *
 * 工作流：
 * 1. 选择板块（十大板块下拉/复选）
 * 2. 单篇预览：调用 /generate/preview 试生成，展示正文效果
 * 3. 单篇入库：对预览满意后调用 /generate/save 写入数据库
 * 4. 批量入库：选择多个板块，调用 /generate/batch 逐篇生成入库
 *
 * 状态：
 * - generating：单篇生成中（预览/入库）
 * - batchRunning：批量生成中
 * - preview：当前预览的范文 dict
 * - batchResults：批量生成的逐项结果
 */
import { ref, computed } from 'vue'
import { api } from '../shared/auth.js'
import { CATEGORIES } from '../shared/constants.js'

// 选中的单篇板块
const selectedTheme = ref(CATEGORIES[0])
// 多选板块（批量入库用）
const selectedThemes = ref([])
// 预览结果
const preview = ref(null)
// 生成中状态
const generating = ref(false)
const generatingMsg = ref('')
// 入库中状态
const saving = ref(false)
// 批量生成中
const batchRunning = ref(false)
const batchResults = ref([])
// 错误信息
const errorMsg = ref('')

const hasPreview = computed(() => !!preview.value)

function toggleTheme(name) {
  const idx = selectedThemes.value.indexOf(name)
  if (idx >= 0) {
    selectedThemes.value.splice(idx, 1)
  } else {
    selectedThemes.value.push(name)
  }
}

async function handlePreview() {
  if (!selectedTheme.value || generating.value) return
  generating.value = true
  generatingMsg.value = '正在生成范文（LLM 调用中，请稍候）…'
  errorMsg.value = ''
  preview.value = null
  try {
    preview.value = await api.generatePreview(selectedTheme.value)
  } catch (err) {
    errorMsg.value = err.message
  } finally {
    generating.value = false
    generatingMsg.value = ''
  }
}

async function handleSave() {
  if (!preview.value || saving.value) return
  saving.value = true
  errorMsg.value = ''
  try {
    const res = await api.generateSave(preview.value.theme)
    if (res.success) {
      alert(`入库成功：${res.title}\nslug: ${res.slug}`)
      // 入库后清空预览（避免重复入库）
      preview.value = null
    } else {
      errorMsg.value = `入库失败：${res.error || '未知错误'}`
    }
  } catch (err) {
    errorMsg.value = err.message
  } finally {
    saving.value = false
  }
}

async function handleBatch() {
  if (selectedThemes.value.length === 0 || batchRunning.value) return
  batchRunning.value = true
  errorMsg.value = ''
  batchResults.value = []
  try {
    const results = await api.generateBatch([...selectedThemes.value])
    batchResults.value = results
    const successCount = results.filter((r) => r.success).length
    alert(`批量生成完成：${successCount}/${results.length} 篇成功`)
  } catch (err) {
    errorMsg.value = err.message
  } finally {
    batchRunning.value = false
  }
}

function discardPreview() {
  preview.value = null
}
</script>

<template>
  <article class="content">
    <h1>范文生成</h1>

    <div v-if="errorMsg" class="gen-error">{{ errorMsg }}</div>

    <!-- 单篇生成 -->
    <section class="gen-section">
      <h2>单篇生成</h2>
      <p class="gen-hint">选择一个板块，先生成预览确认效果，满意后入库。</p>

      <div class="gen-form-row">
        <label class="gen-label">板块</label>
        <select v-model="selectedTheme" class="input-search gen-select" :disabled="generating || saving">
          <option v-for="c in CATEGORIES" :key="c" :value="c">{{ c }}</option>
        </select>
        <button class="btn-primary" :disabled="generating || saving" @click="handlePreview">
          {{ generating ? '生成中…' : '生成预览' }}
        </button>
      </div>

      <div v-if="generating" class="gen-loading">{{ generatingMsg }}</div>

      <!-- 预览结果 -->
      <div v-if="preview" class="gen-preview">
        <div class="gen-preview-header">
          <div class="gen-preview-meta">
            <span class="gen-preview-title">{{ preview.title }}</span>
            <span class="gen-preview-info">{{ preview.category }} · {{ preview.word_count }} 字</span>
          </div>
          <div class="gen-preview-actions">
            <button class="btn-primary" :disabled="saving" @click="handleSave">
              {{ saving ? '入库中…' : '入库' }}
            </button>
            <button class="btn-text" :disabled="saving" @click="discardPreview">放弃</button>
          </div>
        </div>
        <div v-if="preview.description" class="gen-preview-desc">{{ preview.description }}</div>
        <!-- 渲染正文（含 arg-type 交互 span，由 renderer 注入的内联脚本驱动） -->
        <div class="gen-preview-body" v-html="preview.content_html"></div>
      </div>
    </section>

    <!-- 批量生成 -->
    <section class="gen-section">
      <h2>批量生成</h2>
      <p class="gen-hint">勾选多个板块，一键生成入库（单篇失败不影响其他篇）。</p>

      <div class="gen-checkbox-grid">
        <label
          v-for="c in CATEGORIES"
          :key="c"
          class="gen-checkbox-item"
          :class="{ checked: selectedThemes.includes(c) }"
        >
          <input
            type="checkbox"
            :value="c"
            :checked="selectedThemes.includes(c)"
            :disabled="batchRunning"
            @change="toggleTheme(c)"
          >
          <span>{{ c }}</span>
        </label>
      </div>

      <div class="gen-form-row">
        <span class="gen-selected-count">已选 {{ selectedThemes.length }} 个板块</span>
        <button
          class="btn-primary"
          :disabled="selectedThemes.length === 0 || batchRunning"
          @click="handleBatch"
        >
          {{ batchRunning ? '批量生成中…' : '批量生成入库' }}
        </button>
      </div>

      <!-- 批量结果 -->
      <div v-if="batchResults.length > 0" class="gen-batch-results">
        <h3>生成结果</h3>
        <table class="article-table">
          <thead>
            <tr>
              <th>板块</th>
              <th>状态</th>
              <th>标题 / 错误</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(r, i) in batchResults" :key="i">
              <td>{{ r.theme }}</td>
              <td>
                <span :class="r.success ? 'gen-status-ok' : 'gen-status-fail'">
                  {{ r.success ? '成功' : '失败' }}
                </span>
              </td>
              <td>
                <router-link v-if="r.success" :to="`/article/${r.slug}`" class="gen-article-link">
                  {{ r.title }}
                </router-link>
                <span v-else class="gen-error-text">{{ r.error }}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </article>
</template>

<style scoped>
.gen-error {
  background: #fef2f2; color: #dc2626; padding: 10px 14px;
  border-radius: 6px; margin-bottom: 16px; font-size: 14px;
}
.gen-section { margin-bottom: 32px; padding-bottom: 24px; border-bottom: 1px solid var(--border-soft); }
.gen-section:last-child { border-bottom: none; }
.gen-section h2 { font-size: 16px; font-weight: 600; margin-bottom: 8px; }
.gen-hint { color: var(--text-light); font-size: 13px; margin-bottom: 16px; }
.gen-form-row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.gen-label { font-size: 14px; font-weight: 500; }
.gen-select { width: auto; min-width: 160px; padding: 6px 10px; }
.gen-loading { color: var(--text-light); font-size: 13px; margin-top: 12px; }

.gen-preview {
  margin-top: 20px; border: 1px solid var(--border);
  border-radius: 8px; overflow: hidden;
}
.gen-preview-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 12px 16px; background: var(--bg-soft); border-bottom: 1px solid var(--border);
  flex-wrap: wrap; gap: 10px;
}
.gen-preview-meta { display: flex; flex-direction: column; gap: 2px; }
.gen-preview-title { font-size: 16px; font-weight: 600; color: var(--text); }
.gen-preview-info { font-size: 12px; color: var(--text-light); }
.gen-preview-actions { display: flex; gap: 8px; }
.gen-preview-desc { padding: 8px 16px; background: var(--accent-soft); color: var(--text); font-size: 13px; }
.gen-preview-body { padding: 20px 24px; max-height: 600px; overflow-y: auto; }

.gen-checkbox-grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 8px; margin-bottom: 16px;
}
.gen-checkbox-item {
  display: flex; align-items: center; gap: 6px; padding: 8px 12px;
  border: 1px solid var(--border); border-radius: 6px; cursor: pointer;
  font-size: 13px; transition: all 0.12s;
}
.gen-checkbox-item:hover { border-color: var(--accent); }
.gen-checkbox-item.checked { border-color: var(--accent); background: var(--accent-soft); }
.gen-checkbox-item input { margin: 0; }
.gen-selected-count { font-size: 13px; color: var(--text-light); margin-right: auto; }

.gen-batch-results { margin-top: 20px; }
.gen-batch-results h3 { font-size: 14px; font-weight: 600; margin-bottom: 10px; }
.gen-status-ok { color: #16a34a; font-weight: 600; }
.gen-status-fail { color: #dc2626; font-weight: 600; }
.gen-article-link { color: var(--accent); text-decoration: none; }
.gen-article-link:hover { text-decoration: underline; }
.gen-error-text { color: #dc2626; font-size: 13px; }
</style>
