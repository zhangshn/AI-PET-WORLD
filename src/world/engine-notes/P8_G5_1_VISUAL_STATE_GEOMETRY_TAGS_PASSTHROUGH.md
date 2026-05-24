> 历史归档：本文件不得作为 V2.6 当前产品、架构或开发依据。  
> 当前最高依据为 V2.6 三份核心文档。当前业务口径是：管家是第一主角；宠物不是开局资产；宠物来源于小镇领养中心；真正驱动宠物进场的是管家自主产生的领养意愿，并且必须通过 AdoptionReview 与 SafeApply 后才可以成为 HomeMapState 世界事实。  
> 本文件如出现孵化器、胚胎、pet_arrival、pet_rest、LifeEvent、CompanionDecision、伴生生命、候选宠物等旧词，仅代表历史阶段记录，不代表当前实现方向。

> Status: phase record. This document is kept for development traceability. Current development follows `src/docs/AI_PET_WORLD_V2_MVP_EXECUTION_PLAN_2026-05-23.md`.

# AI-PET-WORLD P8-G5.1 VisualState 透传 EntityGeometry.tags

P8-G5 已经让 Renderer 从 VisualPlacement.tags 推断 geometry source。

当前 VisualState 需要把 EntityGeometry.tags 透传到 VisualPlacement.tags。

本阶段只修改 visual-state-builder，不修改 Renderer。

透传后 Renderer 能看到：

1. geometry_source:shape_grammar:tree
2. geometry_source:shape_grammar:house
3. geometry_source:shape_grammar:road
4. geometry_source:shape_grammar:generic
5. geometry_source:fallback_rectangle

VisualPlacement.tags 仍然保留 placement.tags / visual_rule / placement_layer。

tags 必须去重。

本阶段不生成 placement。

本阶段不修改 HomeMapState。

本阶段不读取 PNG / WORLD_MAP_ASSETS。

页面查看位置：

1. /world
2. 几何 / 程序化视觉预览 v1
3. source tree / house / road / generic / fallback / unknown 指标
