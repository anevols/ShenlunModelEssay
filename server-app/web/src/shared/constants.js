/**
 * 主题板块枚举（前端权威源）
 *
 * 来源：申论范文沉浸式批注网页生成器 Skill 文件「第三部分：选题题库」的十大板块。
 * 顺序即为阅读站侧边栏与后台的展示顺序。
 *
 * 注意：必须与后端 server/categories.py 的 CATEGORIES 保持完全一致（顺序 + 名称）。
 *      板块属于业务枚举（类似订单状态），非可配置数据，故以常量形式维护。
 *      后续若需动态管理板块，再改为由 GET /api/categories 接口驱动。
 */

// 十大主题板块（有序，顺序即展示顺序）
export const CATEGORIES = [
  '基层治理',
  '青年实干',
  '高质量发展',
  '乡村振兴',
  '文化',
  '生态',
  '民生',
  '科技',
  '作风',
  '法治',
]

// 板块 → 展示序号（用于排序），未在枚举内的分类统一排到最后
const CATEGORY_ORDER = new Map(CATEGORIES.map((name, idx) => [name, idx]))
const UNKNOWN_ORDER = CATEGORIES.length

// 未在枚举内的分类展示名称
export const UNCATEGORIZED = '未分类'

/**
 * 返回板块的展示序号；未在枚举内的分类返回 UNKNOWN_ORDER（排到最后）。
 */
export function categoryOrder(name) {
  return CATEGORY_ORDER.has(name) ? CATEGORY_ORDER.get(name) : UNKNOWN_ORDER
}

/**
 * 判断给定的分类名是否属于十大板块之一。
 */
export function isValidCategory(name) {
  return CATEGORY_ORDER.has(name)
}
