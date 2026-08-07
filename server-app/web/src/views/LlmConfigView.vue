<script setup>
/**
 * LLM 配置页（管理员）
 *
 * - 加载当前配置（api_key 脱敏返回）
 * - 编辑并保存：api_key 留空则保留原值，填写则更新
 * - 复用后台 .admin-main / .toolbar / .article-table 等样式
 */
import { ref, reactive, onMounted } from 'vue'
import { api } from '../shared/auth.js'

const loading = ref(false)
const saving = ref(false)
const message = ref({}) // {text, type}

// 表单数据（api_key 留空表示保留原值）
const form = reactive({
  api_base: 'https://api.openai.com/v1',
  api_key: '',
  model: 'gpt-4o-mini',
  temperature: 0.7,
  max_tokens: 4096,
  timeout: 60,
})

// 当前 api_key 是否已设置（用于提示）
const apiKeySet = ref(false)
const apiKeyMasked = ref('')

async function loadConfig() {
  loading.value = true
  message.value = {}
  try {
    const data = await api.getLlmConfig()
    form.api_base = data.api_base
    form.api_key = '' // 不回显明文，留空表示保留
    form.model = data.model
    form.temperature = data.temperature
    form.max_tokens = data.max_tokens
    form.timeout = data.timeout
    apiKeySet.value = data.api_key_set
    apiKeyMasked.value = data.api_key_masked
  } catch (err) {
    message.value = { text: '加载失败：' + err.message, type: 'error' }
  } finally {
    loading.value = false
  }
}

async function handleSave() {
  saving.value = true
  message.value = {}
  // 仅在 api_key 非空时才提交该字段（留空 = 保留原值）
  const payload = {
    api_base: form.api_base,
    model: form.model,
    temperature: Number(form.temperature),
    max_tokens: Number(form.max_tokens),
    timeout: Number(form.timeout),
  }
  if (form.api_key) payload.api_key = form.api_key
  try {
    const data = await api.updateLlmConfig(payload)
    apiKeySet.value = data.api_key_set
    apiKeyMasked.value = data.api_key_masked
    form.api_key = ''
    message.value = { text: '保存成功', type: 'success' }
  } catch (err) {
    message.value = { text: '保存失败：' + err.message, type: 'error' }
  } finally {
    saving.value = false
  }
}

onMounted(loadConfig)
</script>

<template>
  <article class="content">
    <h1>LLM 配置</h1>

    <div v-if="loading" class="loading">加载中...</div>

    <form v-else class="article-form" style="max-width: 640px" @submit.prevent="handleSave">
      <!-- API 地址 -->
      <div class="form-group">
        <label for="f-api-base">API 地址（api_base）</label>
        <input id="f-api-base" v-model="form.api_base" type="text" placeholder="https://api.openai.com/v1">
      </div>

      <!-- API Key -->
      <div class="form-group">
        <label for="f-api-key">API Key（留空保留原值）</label>
        <input id="f-api-key" v-model="form.api_key" type="password" placeholder="输入新 key 以更新">
        <p class="auth-hint" style="text-align: left; margin-top: 6px;">
          <template v-if="apiKeySet">当前已设置：{{ apiKeyMasked }}</template>
          <template v-else>当前未设置 API Key</template>
        </p>
      </div>

      <!-- 模型 -->
      <div class="form-group">
        <label for="f-model">模型（model）</label>
        <input id="f-model" v-model="form.model" type="text" placeholder="gpt-4o-mini">
      </div>

      <div class="form-row">
        <div class="form-group form-group-small">
          <label for="f-temperature">温度（temperature）</label>
          <input id="f-temperature" v-model.number="form.temperature" type="number" step="0.1" min="0" max="2">
        </div>
        <div class="form-group form-group-small">
          <label for="f-max-tokens">最大 tokens</label>
          <input id="f-max-tokens" v-model.number="form.max_tokens" type="number" min="256">
        </div>
        <div class="form-group form-group-small">
          <label for="f-timeout">超时（秒）</label>
          <input id="f-timeout" v-model.number="form.timeout" type="number" min="5">
        </div>
      </div>

      <div v-if="message.text" class="auth-message" :class="message.type" style="text-align: left; margin-bottom: 12px;">
        {{ message.text }}
      </div>

      <div class="form-actions">
        <button type="submit" class="btn-primary" :disabled="saving">{{ saving ? '保存中...' : '保存配置' }}</button>
      </div>
    </form>
  </article>
</template>
