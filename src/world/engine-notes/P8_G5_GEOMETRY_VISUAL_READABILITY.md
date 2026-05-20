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
