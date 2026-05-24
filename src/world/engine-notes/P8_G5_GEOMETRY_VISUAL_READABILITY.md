> 历史归档：本文件不得作为 V2.6 当前产品、架构或开发依据。  
> 当前最高依据为 V2.6 三份核心文档。当前业务口径是：管家是第一主角；宠物不是开局资产；宠物来源于小镇领养中心；真正驱动宠物进场的是管家自主产生的领养意愿，并且必须通过 AdoptionReview 与 SafeApply 后才可以成为 HomeMapState 世界事实。  
> 本文件如出现孵化器、胚胎、pet_arrival、pet_rest、LifeEvent、CompanionDecision、伴生生命、候选宠物等旧词，仅代表历史阶段记录，不代表当前实现方向。

> Status: phase record. This document is kept for development traceability. Current development follows `src/docs/AI_PET_WORLD_V2_MVP_EXECUTION_PLAN_2026-05-23.md`.

# AI-PET-WORLD P8-G5 几何视觉可读性细化

本阶段不修改世界生成，只增强 Renderer 可读性。

SVG geometry layer 仍然是正式几何主绘制层。

Renderer 继续读取 VisualPlacement.footprint / collision / support / influence。

通过 EntityGeometry.tags / VisualPlacement.tags 推断 geometry source。

source 包括：

1. shape_grammar_tree
2. shape_grammar_house
3. shape_grammar_road
4. shape_grammar_generic
5. fallback_rectangle
6. unknown

新增 source summary 与 legend。

CSS fallback layer 继续保留，但只作为可读辅助，不再铺满 ground。

本阶段不读取 PNG / WORLD_MAP_ASSETS。

本阶段不修改 /world route。

本阶段不修改 world-loop / world-evolution / map-state。

页面地址：

1. /world

看这个面板：

1. 几何 / 程序化视觉预览 v1

重点看：

1. geometry visuals
2. source tree / house / road / generic
3. legend
4. SVG geometry layer

Debug 页面：

1. /world-debug/visual-change-verification

看 before / after 的 geometry source 与 SVG 几何表现。
