> 历史归档：本文件不得作为 V2.6 当前产品、架构或开发依据。  
> 当前最高依据为 V2.6 三份核心文档。当前业务口径是：管家是第一主角；宠物不是开局资产；宠物来源于小镇领养中心；真正驱动宠物进场的是管家自主产生的领养意愿，并且必须通过 AdoptionReview 与 SafeApply 后才可以成为 HomeMapState 世界事实。  
> 本文件如出现孵化器、胚胎、pet_arrival、pet_rest、LifeEvent、CompanionDecision、伴生生命、候选宠物等旧词，仅代表历史阶段记录，不代表当前实现方向。

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
