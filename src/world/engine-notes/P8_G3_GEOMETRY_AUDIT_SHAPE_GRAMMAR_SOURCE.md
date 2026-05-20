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
