> 历史归档：本文件不得作为 V2.6 当前产品、架构或开发依据。  
> 当前最高依据为 V2.6 三份核心文档。当前业务口径是：管家是第一主角；宠物不是开局资产；宠物来源于小镇领养中心；真正驱动宠物进场的是管家自主产生的领养意愿，并且必须通过 AdoptionReview 与 SafeApply 后才可以成为 HomeMapState 世界事实。  
> 本文件如出现孵化器、胚胎、pet_arrival、pet_rest、LifeEvent、CompanionDecision、伴生生命、候选宠物等旧词，仅代表历史阶段记录，不代表当前实现方向。

> Status: phase record. This document is kept for development traceability. Current development follows `src/docs/AI_PET_WORLD_V2_MVP_EXECUTION_PLAN_2026-05-23.md`.

# AI-PET-WORLD P8-G3 Geometry audit 显示 ShapeGrammar 来源

本阶段让 geometry audit 显式显示几何来源。

P8-G2 已经让 tree / house / road / generic placement 优先经过 ShapeGrammar。

P8-G3 不修改 ShapeGrammar，不修改 adapter，只读取 EntityGeometry.tags。

geometrySource 可取：

1. shape_grammar_tree
2. shape_grammar_house
3. shape_grammar_road
4. shape_grammar_generic
5. fallback_rectangle
6. unknown

summary 统计：

1. shapeGrammarCount
2. fallbackRectangleCount
3. unknownGeometrySourceCount

本阶段不修改 Renderer。

本阶段不修改 world-loop。

本阶段不生成 placement。

本阶段不修改 HomeMapState。

后续 P8-G4 才考虑 Renderer 读取 Geometry Projection 绘制。
