> Status: phase record. This document is kept for development traceability. Current development follows `src/docs/AI_PET_WORLD_V2_MVP_EXECUTION_PLAN_2026-05-23.md`.

# AI-PET-WORLD P8-G2 ShapeGrammar 接入 placement geometry adapter

本阶段把 P8-G1 的 ShapeGrammar 接入 MapPlacement -> EntityGeometry 适配层。

tree / house / road / generic placement 优先通过 ShapeGrammar 生成点线面结构。

ShapeGrammar composition 再通过 projectShapeGrammarToSpatialProjection 投影为 footprint / collision / support / influence。

fallback 矩形逻辑仍然保留，用于未映射 layer。

本阶段不修改 Renderer。

本阶段不修改 world-loop。

本阶段不生成 placement。

本阶段不修改 HomeMapState。

本阶段不读取 PNG / WORLD_MAP_ASSETS。

后续 P8-G3 会让 geometry audit 显示 ShapeGrammar 来源。
