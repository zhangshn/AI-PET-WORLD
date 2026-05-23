> Status: phase record. This document is kept for development traceability. Current development follows `src/docs/AI_PET_WORLD_V2_MVP_EXECUTION_PLAN_2026-05-23.md`.

# AI-PET-WORLD P8-G6 Geometry Source Diagnostics

1. 本阶段只增强 ProceduralRendererView 的只读诊断能力。
2. 诊断区读取 VisualPlacement.tags 中的 geometry_source。
3. 不读取 audit report。
4. 不重新推断世界事实。
5. 不生成 placement。
6. 不修改 HomeMapState。
7. 分组来源包括：
   - shape_grammar_tree
   - shape_grammar_house
   - shape_grammar_road
   - shape_grammar_generic
   - fallback_rectangle
   - unknown
8. 每个 placement 显示：
   - label
   - layer
   - ruleStatus
   - hasFootprint
   - hasCollision
   - hasSupport
   - hasInfluence
9. 页面查看位置：
   - /world
   - 几何 / 程序化视觉预览 v1
   - Geometry Source Diagnostics
10. Debug 查看位置：
    - /world-debug/visual-change-verification
    - Before / After 的 Geometry Source Diagnostics
