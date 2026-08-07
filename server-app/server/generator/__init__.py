"""范文生成器子模块。

编排流程：topics（主题/素材）→ prompts（Prompt 组装）→ llm_client（LLM 调用）
→ renderer（HTML 封装）→ validator（校验）→ pipeline（编排入库）。

Phase 1 实现：config / topics / prompts / llm_client / renderer。
Phase 2/3 实现：pipeline（入库）与 validator（校验）。
"""
