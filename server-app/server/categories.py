"""
主题板块枚举（权威源）

来源：申论范文沉浸式批注网页生成器 Skill 文件「第三部分：选题题库」的十大板块。
此处的顺序即为阅读站侧边栏与后台的展示顺序，前端 shared/constants.js 需保持一致。

注意：板块属于业务枚举（类似订单状态），非可配置数据，故以常量形式维护。
     后续若需动态管理板块，再改为数据库表驱动。
"""

# 十大主题板块（有序，顺序即展示顺序）
CATEGORIES = [
    "基层治理",
    "青年实干",
    "高质量发展",
    "乡村振兴",
    "文化",
    "生态",
    "民生",
    "科技",
    "作风",
    "法治",
]

# 板块 → 展示序号（用于排序），未在枚举内的分类统一排到最后
CATEGORY_ORDER = {name: idx for idx, name in enumerate(CATEGORIES)}
UNKNOWN_CATEGORY_ORDER = len(CATEGORIES)


def category_order(name: str) -> int:
    """返回板块的展示序号；未在枚举内的分类返回 UNKNOWN_CATEGORY_ORDER（排到最后）。"""
    return CATEGORY_ORDER.get(name or "", UNKNOWN_CATEGORY_ORDER)


def is_valid_category(name: str) -> bool:
    """判断给定的分类名是否属于十大板块之一。"""
    return (name or "") in CATEGORY_ORDER
