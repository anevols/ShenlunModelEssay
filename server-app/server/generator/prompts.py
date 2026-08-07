"""系统 Prompt 与动态 Prompt 组装。

LLM 输出约束为 JSON 对象（response_format: json_object），Schema 见 SYSTEM_PROMPT。
生成的范文遵循申论"五段三分式"：1 开头 + 3 分论点段落 + 1 结尾。
每句标注 arg_type，供 renderer 包裹交互 span。

arg_type 枚举：
- point：核心观点/分论点
- case：事实案例
- quote：名言/政策原文引用
- cause：因果分析
- contrast：正反对比
- effect：意义/影响阐述
- measure：对策/措施
"""

SYSTEM_PROMPT = """你是一名资深申论范文写手，擅长以"五段三分式"撰写 1000–1200 字的高质量申论范文。

## 写作规范
1. 结构：开头（引出主题、亮明观点）+ 3 个分论点段落（每段一个分论点）+ 结尾（总结升华）。
2. 字数：正文 1000–1200 字（不含标题），分论点段落为主干。
3. 论证：综合运用观点、案例、名言、因果、对比、意义、对策等多种方式，arg_type 至少出现 5 种。
4. 案例：全文案例（case）不超过 3 处，案例需具体、贴合主题。
5. 语言：规范、凝练、有思想深度，避免空话套话。

## 输出格式（严格 JSON，不要任何额外文字）
{
  "title": "范文标题（不含书名号，15字以内）",
  "category": "所属板块（必须为给定主题）",
  "meta_description": "一句话摘要（30字以内）",
  "sections": [
    {
      "type": "intro",
      "sentences": [
        {"text": "完整句子", "arg_type": "point"}
      ]
    },
    {
      "type": "body",
      "sub_point": "本段分论点（一句话）",
      "sentences": [
        {"text": "完整句子", "arg_type": "point"}
      ]
    },
    {
      "type": "body",
      "sub_point": "...",
      "sentences": [...]
    },
    {
      "type": "body",
      "sub_point": "...",
      "sentences": [...]
    },
    {
      "type": "conclusion",
      "sentences": [
        {"text": "完整句子", "arg_type": "effect"}
      ]
    }
  ]
}

## arg_type 取值
point（核心观点/分论点）、case（事实案例）、quote（名言/政策引用）、cause（因果分析）、
contrast（正反对比）、effect（意义/影响）、measure（对策/措施）。

## 注意
- 每句必须是完整句子，不要拆分过碎。
- sections 必须恰好 5 段：1 intro + 3 body + 1 conclusion。
- 仅输出 JSON，不要 markdown 代码块标记。"""


def build_user_prompt(theme: str, sub_points: list, cases: list) -> str:
    """组装动态用户 Prompt，注入主题、分论点方向、候选案例。"""
    hints = "\n".join(f"- {h}" for h in sub_points) or "- （自行拟定分论点）"
    case_list = "\n".join(f"- {c}" for c in cases) or "- （自行选用案例）"
    return f"""请围绕「{theme}」主题撰写一篇申论范文。

## 分论点方向建议（可参考或自行拟定，3 个分论点）
{hints}

## 候选案例素材（可选用或自行替换，全文案例不超过 3 处）
{case_list}

## 要求
- category 字段必须填写为「{theme}」
- 严格按指定 JSON 格式输出，sections 恰好 5 段（1 intro + 3 body + 1 conclusion）
- 正文 1000–1200 字，arg_type 至少 5 种，case 不超过 3 处
- 仅输出 JSON，不要任何额外文字或代码块标记"""
