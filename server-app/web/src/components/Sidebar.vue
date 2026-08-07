<script setup>
/**
 * 左侧目录侧边栏
 *
 * - 按分类分组渲染文章列表
 * - 分组标题可折叠
 * - 搜索框过滤（由父组件传入 searchQuery）
 * - 当前文章高亮
 * - 移动端点击文章后关闭侧边栏
 */
import { ref, computed } from 'vue'
import { useRoute } from 'vue-router'
import { categoryOrder, UNCATEGORIZED } from '../shared/constants.js'

const props = defineProps({
  articles: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  error: { type: String, default: '' },
  searchQuery: { type: String, default: '' },
})

const emit = defineEmits(['close'])

const route = useRoute()
const collapsedGroups = ref({})

const currentSlug = computed(() => route.params.slug || '')

// 按分类分组（按 Skill 十大板块固定顺序排序，未分类排到最后）
const groups = computed(() => {
  const map = {}
  for (const a of props.articles) {
    const cat = a.category || UNCATEGORIZED
    if (!map[cat]) map[cat] = []
    map[cat].push(a)
  }
  return Object.keys(map)
    .sort((a, b) => categoryOrder(a) - categoryOrder(b))
    .map((name) => ({ name, items: map[name] }))
})

// 搜索过滤
const filteredGroups = computed(() => {
  const q = props.searchQuery.trim().toLowerCase()
  if (!q) return groups.value
  return groups.value
    .map((g) => ({
      ...g,
      items: g.items.filter((a) => a.title.toLowerCase().includes(q)),
    }))
    .filter((g) => g.items.length > 0)
})

function toggleGroup(name) {
  collapsedGroups.value[name] = !collapsedGroups.value[name]
}

function onItemClick() {
  emit('close')
}
</script>

<template>
  <aside class="sidebar" aria-label="文章目录">
    <nav class="sidebar-nav" id="sidebar-nav">
      <div v-if="loading" class="sidebar-status">加载中…</div>
      <div v-else-if="error" class="sidebar-status error">{{ error }}</div>
      <div v-else-if="articles.length === 0" class="sidebar-status">还没有文章。</div>
      <template v-else>
        <div v-for="g in filteredGroups" :key="g.name" class="sidebar-group">
          <div
            class="sidebar-group-title"
            :class="{ collapsed: collapsedGroups[g.name] }"
            tabindex="0"
            @click="toggleGroup(g.name)"
            @keydown.enter.prevent="toggleGroup(g.name)"
            @keydown.space.prevent="toggleGroup(g.name)"
          >
            <span class="sidebar-arrow">▾</span>{{ g.name }}
          </div>
          <div class="sidebar-group-items" :class="{ collapsed: collapsedGroups[g.name] }">
            <router-link
              v-for="a in g.items"
              :key="a.slug"
              :to="`/article/${a.slug}`"
              class="sidebar-item"
              :class="{ active: currentSlug === a.slug }"
              @click="onItemClick"
            >
              {{ a.title }}
            </router-link>
          </div>
        </div>
      </template>
    </nav>
  </aside>
</template>
