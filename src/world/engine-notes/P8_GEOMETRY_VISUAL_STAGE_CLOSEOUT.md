> Status: phase record. This document is kept for development traceability. Current development follows `src/docs/AI_PET_WORLD_V2_MVP_EXECUTION_PLAN_2026-05-23.md`.

# AI-PET-WORLD P8 几何视觉阶段收口说明

## 1. 阶段定位

P8 几何视觉阶段的目标不是生成世界事实，而是忠实显示已经存在的 WorldState / VisualState / Geometry 派生结果。

Renderer 只能读取：

- RenderableWorldSnapshot
- VisualState
- VisualPlacement
- DrawCommand
- EntityGeometry 派生结果
- footprint / collision / support / influence
- VisualPlacement.tags 中的 geometry_source

Renderer 不能：

- 生成 placement
- 修改 HomeMapState
- 读取 PNG 作为正式世界本体
- 读取 WORLD_MAP_ASSETS 作为正式显示主路径
- 读取 proposal 当作现实
- 绕过 SafeApply
- 重新推断世界事实

## 2. 定版文档路线确认

本阶段已确认：

- 世界不是先画一张图片。
- 世界是先生成几何结构。
- Renderer 再根据几何结构绘制。
- 树不是 tree.png。
- 房屋不是 house.png。
- 道路不是 path.png。
- 世界对象必须先被理解成点、线、面与几何结构。

## 3. 已完成阶段

### P8-GEOMETRY-REPAIR

完成 P8 视觉方向纠偏。

正式 Renderer 已不再读取 PNG，不再读取 WORLD_MAP_ASSETS，不再使用 backgroundImage。

### P8-G1 ShapeGrammar 基础协议

新增 shape-grammar 层。

树、房屋、道路、通用对象可以被拆成点、线、面结构。

### P8-G2 ShapeGrammar Adapter

MapPlacement -> ShapeGrammar -> SpatialProjection -> EntityGeometry 链路建立。

tree / house / road / generic placement 优先经过 ShapeGrammar。

fallback rectangle 保留，用于未映射对象。

### P8-G3 Geometry Audit Source

Geometry audit 可以显示 geometrySource。

来源包括：

- shape_grammar_tree
- shape_grammar_house
- shape_grammar_road
- shape_grammar_generic
- fallback_rectangle
- unknown

### P8-G4 Renderer Geometry Projection

ProceduralRendererView 已读取 VisualPlacement.footprint / collision / support / influence。

SVG geometry layer 成为正式几何主绘制层。

CSS procedural fallback 只作为临时可读辅助层。

### P8-G4.1 中文乱码修复

ProceduralRendererView 中文文案恢复正常。

### P8-G5 Geometry Visual Readability

Renderer 可显示 geometry source summary 与 legend。

tree / house / road / generic / fallback / unknown 可以在页面上区分。

### P8-G5.1 VisualState Geometry Tags Passthrough

VisualState 已将 EntityGeometry.tags 透传到 VisualPlacement.tags。

Renderer 可从 VisualPlacement.tags 读取 geometry_source。

### P8-G6 Geometry Source Diagnostics

新增 Geometry Source Diagnostics。

按 geometry_source 分组显示 placement，并显示：

- label
- layer
- ruleStatus
- hasFootprint
- hasCollision
- hasSupport
- hasInfluence

### P8-G7 World Geometry Overview

新增世界几何结构概览。

### P8-G7.1 World Geometry Overview Debug 定位修复

World Geometry Overview 已明确为 Debug 诊断区，不是最终玩家 UI。

## 4. 当前页面查看位置

正式页面：

/world

查看区域：

- 几何 / 程序化视觉预览 v1
- geometry visuals
- source tree / house / road / generic / fallback / unknown
- geometry legend
- World Geometry Overview Debug
- Geometry Source Diagnostics
- 基础线框预览

Debug 页面：

/world-debug/visual-change-verification

查看区域：

- Before
- After SafeApply
- 几何 / 程序化视觉预览 v1
- World Geometry Overview Debug
- Geometry Source Diagnostics

## 5. 当前稳定链路

当前稳定链路为：

```text
HomeMapState
-> MapPlacement
-> ShapeGrammar
-> SpatialProjection
-> EntityGeometry
-> VisualState
-> VisualPlacement
-> Renderer SVG geometry layer
-> World Geometry Overview Debug / Geometry Source Diagnostics
```

## 6. 当前明确不是最终玩家 UI 的内容

以下内容属于开发期 Debug / Dev View，不是最终玩家 UI：

- DrawCommand Summary
- Placement Rule Summary
- geometry visuals 指标
- source tree / house / road / generic / fallback / unknown 指标
- Geometry Source Diagnostics
- World Geometry Overview Debug
- F / C / S / I 标记
- 基础线框预览

## 7. 下一阶段建议进入 P8-H

P8-G 已完成几何显示链路与 Debug 可读性。

下一阶段可以进入 P8-H：角色几何占位阶段。

P8-H 目标：

1. 管家几何占位。
2. 宠物几何占位。
3. actor placement 与 runtime state 对齐。
4. 不使用 PNG。
5. 不生成 placement。
6. 不修改 HomeMapState。
7. 角色显示必须来自世界状态。
8. 后续动画必须由 runtime state / behavior state 派生。

## 8. 继续禁止事项

后续仍然禁止：

1. Renderer 读取 PNG。
2. Renderer 读取 WORLD_MAP_ASSETS 作为正式显示主路径。
3. Renderer 生成 placement。
4. Renderer 修改 HomeMapState。
5. Renderer 读取 proposal 当作现实。
6. Renderer 为了好看伪造对象。
7. Debug scenario 直接进入正式 /world 作为现实。
8. 管家 / 宠物使用 UI 临时状态伪造存在。
9. 把 Debug 诊断区包装成最终玩家 UI。
10. 混淆产品展示层与世界事实层。
