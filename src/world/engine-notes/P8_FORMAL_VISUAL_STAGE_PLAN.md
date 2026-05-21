# AI-PET-WORLD P8 正式视觉阶段总控计划

## 1. 文档定位

本文档是 P8 正式视觉阶段的总控计划。

当前最高依据：

1. AI-PET-WORLD MVP 完整计划书 v1.5。
2. AI-PET-WORLD 人格驱动规则世界引擎设计文档 v1.3。
3. AI-PET-WORLD MVP 整体架构设计文档 v1.0。

P8 阶段的核心目标不是让前端手写一个好看的世界页面，而是建立：

```text
世界事实
-> 渲染投影
-> FormalVisualModel
-> FormalWorldView 只读渲染
```

正式视觉必须服从世界事实，不能反过来由 UI 生成世界。

## 2. 已完成的 P8-G 几何视觉链路

P8-G 已完成从贴图路线到几何路线的纠偏。

当前稳定链路：

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

有效结论：

1. 世界对象不应先被理解成贴图。
2. 树不是 tree.png。
3. 房屋不是 house.png。
4. 道路不是 path.png。
5. ShapeGrammar 用点 / 线 / 面描述世界对象。
6. EntityGeometry 承载 footprint / collision / support / influence。
7. VisualState 可以透传 geometry_source。
8. Renderer Debug View 可以显示几何来源。
9. Debug 诊断区不是最终玩家 UI。
10. P8-G 的几何链路保留。

## 3. 已完成的 P8-H Actor Geometry 链路

P8-H 已完成管家 actor projection 的 Debug 几何占位链路。

当前稳定链路：

```text
HomeMapState
-> world-loop renderable state
-> buildButlerRuntimeProjection
-> buildActorGeometryProjectionFromRuntime
-> buildVisualState(actorRuntimeGeometryProjections)
-> VisualState.actorGeometryProjections
-> Renderer Debug View 只读显示
```

有效结论：

1. 管家可以作为第一生命进入 actor projection 通道。
2. 管家 actor projection 由 world snapshot 派生。
3. Renderer 只读 VisualState.actorGeometryProjections。
4. Renderer 不能生成 actor。
5. Renderer 不能填默认 anchor。
6. Renderer 不能修改 HomeMapState。
7. 当前 actor geometry 是 Debug 几何占位。
8. 当前 actor geometry 不是最终角色美术。
9. 当前 actor geometry 不代表最终 autonomous movement。
10. pet 不作为默认 actor 接入，必须继续后置。

## 4. Debug View 与正式视觉的边界

当前 `/world` 中的“几何 / 程序化视觉预览 v1”仍属于 Debug View / Dev View。

Debug View 可以显示：

1. 大面积工程网格。
2. footprint / collision / support / influence。
3. Geometry Source Diagnostics。
4. World Geometry Overview Debug。
5. Actor Geometry Diagnostics。
6. raw tags。
7. raw sources。
8. F / C / S / I。
9. anchor source。
10. debug reason。
11. actor_projection_debug_only。
12. notFinalArt / notFinalMovement。

这些内容不能作为最终玩家主视觉直接展示。

正式玩家主视觉必须通过 FormalVisualModel 进入，不允许直接复用 Debug View 的诊断结构。

## 5. P8-I 旧路线作废记录

P8-I0 / P8-I1 / P8-I2 / P8-I3 的旧 FormalWorldView 手写视觉路线已经作废。

旧路线的问题：

1. 旧路线让 FormalWorldView 组件承担正式视觉模型生成职责。
2. 旧路线在组件内定义 FormalWorldVisualItem。
3. 旧路线在组件内定义 FormalActorVisualItem。
4. 旧路线在组件内实现 buildFormalWorldVisualItems。
5. 旧路线在组件内实现 buildFormalActorVisualItems。
6. 旧路线让组件决定地面、道路、建筑、树木、设施、管家如何显示。
7. 这违反 MVP v1.5、规则世界引擎 v1.3 与整体架构 v1.0。

已删除内容：

1. `src/app/world/components/formal-world-view/` 旧组件目录。
2. `P8_I0_FORMAL_WORLD_VIEW_PLAN.md`。
3. `P8_I1_FORMAL_WORLD_VIEW_COMPONENT_SHELL.md`。
4. `P8_I2_FORMAL_WORLD_CANVAS.md`。
5. `P8_I3_FORMAL_ACTOR_PRESENTATION.md`。

保留内容：

1. P8-G 几何链路。
2. P8-H actor projection Debug 链路。
3. VisualState / RenderableWorldSnapshot。
4. Renderer Debug View。
5. world-loop actor projection debug 接入。

## 6. P8-I-RESET 当前结论

P8-I-RESET 已完成。

当前结论：

1. 不能继续沿用旧 FormalWorldView 手写视觉路线。
2. 不能在 React 组件内生成正式视觉模型。
3. 不能让组件决定世界对象的正式视觉语义。
4. 正式视觉模型必须来自 `src/world/formal-visual-model/`。
5. FormalVisualModel / FormalVisualGenerator 必须早于新的 FormalWorldView。
6. FormalWorldView 只能只读 FormalVisualModel 渲染。
7. 未来 `/world` 正式主视觉必须等待 FormalVisualModel 链路完成后再接入。

## 7. 正确的后续路线

下一步重新进入：

```text
VISUAL-MODEL-00：FormalVisualModel schema
```

推荐阶段：

1. VISUAL-MODEL-00：FormalVisualModel schema。
2. VISUAL-MODEL-01：FormalVisualGenerator 纯函数。
3. VISUAL-MODEL-02：FormalVisualModel audit / debug summary。
4. VISUAL-MODEL-03：VisualState -> FormalVisualModel 输入边界。
5. VISUAL-MODEL-04：FormalWorldView 只读渲染骨架。
6. VISUAL-MODEL-05：/world 与 /world-debug 展示边界整理。

## 8. FormalVisualModel 的职责

FormalVisualModel 负责把世界渲染投影转换成正式视觉语义。

它可以描述：

1. 地面视觉对象。
2. 道路视觉对象。
3. 建筑视觉对象。
4. 树木视觉对象。
5. 设施视觉对象。
6. actor 视觉对象。
7. 环境氛围。
8. 玩家可理解的状态摘要。

FormalVisualModel 不能：

1. 生成 world fact。
2. 生成 MapPlacement。
3. 修改 HomeMapState。
4. 绕过 Intent / Plan / Validate / Diff / WorldState。
5. 读取 PNG 作为正式主路径。
6. 读取 WORLD_MAP_ASSETS 作为正式主路径。
7. 伪造宠物存在。
8. 让宠物通过事件文本说人话。

## 9. FormalWorldView 的未来职责

未来新的 FormalWorldView 只能：

1. 接收 FormalVisualModel。
2. 只读渲染 FormalVisualModel。
3. 显示玩家可理解的世界画面。
4. 隐藏 Debug Diagnostics。
5. 不显示 raw tags。
6. 不显示 source diagnostics。
7. 不显示 collision boxes / F-C-S-I。
8. 不显示紫微斗数原始术语。

未来新的 FormalWorldView 不能：

1. 生成 FormalVisualModel。
2. 生成 FormalWorldVisualItem。
3. 生成 FormalActorVisualItem。
4. 自行决定树、房子、道路、管家如何显示。
5. 生成 actor。
6. 生成 placement。
7. 填默认 anchor。
8. 修改 VisualState。
9. 修改 HomeMapState。
10. 读取 proposal 当现实。

## 10. 继续禁止事项

1. 禁止把 Debug View 当最终玩家 UI。
2. 禁止把工程网格当最终世界效果。
3. 禁止把 actor Debug 占位当最终角色美术。
4. 禁止为了好看读取 PNG。
5. 禁止重新把 WORLD_MAP_ASSETS 作为正式主路径。
6. 禁止 FormalWorldView 生成正式视觉模型。
7. 禁止 FormalWorldView 生成 actor。
8. 禁止 FormalWorldView 生成 placement。
9. 禁止 FormalWorldView 修改 HomeMapState。
10. 禁止 UI 临时伪造宠物。
11. 禁止默认接入 pet actor。
12. 禁止让宠物通过事件文本说人话。
13. 禁止在正式世界主视觉显示紫微斗数原始术语。
14. 禁止显示 raw tags / source diagnostics / audit internals。
15. 禁止读取 proposal 当现实。

## 11. 当前状态

当前 P8 正式视觉阶段处于 reset 后状态。

可以继续的唯一正确入口是：

```text
VISUAL-MODEL-00：FormalVisualModel schema
```
