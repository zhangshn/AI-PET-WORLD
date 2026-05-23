> Status: phase record. This document is kept for development traceability. Current development follows `src/docs/AI_PET_WORLD_V2_MVP_EXECUTION_PLAN_2026-05-23.md`.

# AI-PET-WORLD P8-G4 Renderer 读取 Geometry Projection 绘制

本阶段让 ProceduralRendererView 优先读取 VisualPlacement.footprint / collision / support / influence。

这些 geometry 来自 MapPlacement -> ShapeGrammar -> SpatialProjection -> EntityGeometry -> VisualState。

SVG geometry layer 成为正式几何主绘制层。

CSS procedural fallback layer 只保留为临时可读层，不再是唯一主体。

ground / path / zone / edge 不再用 CSS fallback 大量铺满，避免遮挡 geometry。

本阶段不修改 /world route。

本阶段不修改 world-loop。

本阶段不修改 map-state。

本阶段不读取 PNG / WORLD_MAP_ASSETS。

后续 P8-G5 再细化 tree / house / road 的几何表现和 debug 可读性。

页面地址：

1. /world

Debug 页面：

1. /world-debug/visual-change-verification

看什么：

1. “几何 / 程序化视觉预览 v1” 面板中的 geometry visuals / footprint / collision / support / influence 指标。
2. “几何 / 程序化视觉预览 v1” 面板中的 SVG 几何绘制层。
