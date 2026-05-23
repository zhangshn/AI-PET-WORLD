> Status: phase record. This document is kept for development traceability. Current development follows `src/docs/AI_PET_WORLD_V2_MVP_EXECUTION_PLAN_2026-05-23.md`.

# AI-PET-WORLD P8-H8 Actor Geometry 阶段收口与 Formal World View 分离规划

## 1. 阶段定位

P8-H8 是 Actor Geometry 阶段的收口与下一阶段分离规划。

当前 /world 中看到的大量网格、线框、诊断面板、Debug actor 占位，不是最终玩家主视觉。

当前画面属于：

- Debug View
- Dev View
- Geometry Verification View
- Runtime Projection Verification View

未来正式玩家主视觉属于：

- Formal World View
- Player-facing World Presentation
- Clean Autonomous World View

## 2. 当前已经完成的底层链路

当前已经完成：

HomeMapState
-> world-loop renderable state
-> buildButlerRuntimeProjection
-> buildActorGeometryProjectionFromRuntime
-> buildVisualState(actorRuntimeGeometryProjections)
-> VisualState.actorGeometryProjections
-> Renderer 只读显示

同时 P8-G 已完成：

HomeMapState
-> MapPlacement
-> ShapeGrammar
-> SpatialProjection
-> EntityGeometry
-> VisualState
-> VisualPlacement
-> Renderer SVG geometry layer

## 3. 当前 Debug View 的职责

Debug View 的职责是验证：

1. Renderer 是否只读世界事实。
2. Renderer 是否没有读取 PNG。
3. Renderer 是否没有读取 WORLD_MAP_ASSETS。
4. Renderer 是否没有生成 placement。
5. ShapeGrammar 是否真的生成了点 / 线 / 面。
6. Geometry Source 是否正确透传。
7. Actor projection 是否来自 world snapshot。
8. Butler 是否已进入 actor geometry 通道。
9. Pet 是否没有被错误默认接入。
10. canProject false 是否不会绘制 actor。
11. skipped_not_ready 是否能保留。
12. anchor source 是否可审计。

## 4. 当前 Debug View 包含但最终玩家主视觉不应直接显示的内容

以下内容不应作为最终玩家主视觉直接展示：

1. 大面积工程网格。
2. footprint / collision / support / influence 线框。
3. Geometry Source Diagnostics。
4. World Geometry Overview Debug。
5. Actor Geometry Diagnostics。
6. F / C / S / I 标记。
7. actor_projection_debug_only。
8. notFinalArt / notFinalMovement 标记。
9. source tree / house / road / generic / fallback / unknown 指标。
10. DrawCommand Summary。
11. Placement Rule Summary。
12. 基础线框预览。
13. Debug reason 文案。
14. anchor source 原始 tag。
15. raw tags / sources 列表。

这些内容可以留在 Debug View，但不能伪装成最终玩家 UI。

## 5. Formal World View 的目标

Formal World View 的目标是：

1. 给玩家看到干净、自然、自主运行的世界。
2. 保留几何 / 程序化生成路线。
3. 不回到 PNG 贴图主路径。
4. 不让 Renderer 生成世界事实。
5. 不让 UI 临时伪造角色。
6. 让管家作为第一生命自然出现在世界中。
7. 宠物仍然后置，必须通过生命关系事件接纳后进入。
8. 世界对象以正式视觉样式表现，而不是 Debug 线框。
9. 调试信息隐藏或迁移到 debug route。
10. Formal World View 只显示已经存在于 VisualState / RenderableWorldSnapshot 的事实。

## 6. Formal World View 初期建议显示内容

Formal World View 初期可以显示：

1. 程序化地面。
2. 程序化道路。
3. 程序化建筑。
4. 程序化树木。
5. 程序化设施。
6. 管家几何占位的正式样式版。
7. 基础环境氛围。
8. 少量世界状态提示。
9. 管家状态摘要。
10. 世界日志入口。

注意：
这些显示仍然必须来自 VisualState / RenderableWorldSnapshot。
不能由 UI 临时生成世界事实。

## 7. Debug View 与 Formal World View 的边界

Debug View 可以显示：

- raw geometry
- raw tags
- diagnostics
- audit data
- source labels
- anchor source
- rule status
- canProject
- skipped states
- debug labels

Formal World View 不能直接显示：

- raw tags
- source labels
- audit internals
- debug grids
- collision boxes
- F / C / S / I
- actor projection debug flags
- engineering-only reason strings

Formal World View 可以显示：

- 世界对象
- 管家
- 环境
- 状态摘要
- 日志入口
- 观察叙事
- 玩家可理解的世界状态

## 8. 推荐下一阶段 P8-I

下一阶段建议进入：

P8-I：Formal World View Shell

P8-I 目标不是重写 Renderer Core，而是建立一个正式玩家主视觉壳层。

建议阶段：

### P8-I0：Formal World View 规划

只写规划，明确正式视图边界。

### P8-I1：FormalWorldView 组件骨架

新增 FormalWorldView 组件。

它只读取 RenderableWorldSnapshot / VisualState。
它不读取 PNG。
它不生成 placement。
它不修改 HomeMapState。
它不显示 Debug Diagnostics。

### P8-I2：Formal World Canvas

建立干净画布：

- 无 Debug 网格。
- 无 Geometry Diagnostics。
- 无 raw tags。
- 无 F / C / S / I。
- 保留程序化世界对象。

### P8-I3：Formal Actor Presentation

将 butler actor projection 用正式几何样式显示。

注意：
不是最终角色美术。
只是从 Debug actor geometry 进入正式占位视觉。

### P8-I4：Formal World HUD 最小版

显示少量玩家可理解信息：

- 世界状态。
- 管家状态。
- 当前阶段。
- 最近世界日志入口。

不显示命理术语。
不显示内部工程字段。

### P8-I5：Debug / Formal 切换边界

Debug route 保留所有诊断。
Formal route 默认不显示 Debug 诊断。

## 9. 继续禁止事项

1. 禁止把 Debug View 当最终玩家主视觉。
2. 禁止把工程网格当最终世界效果。
3. 禁止把 actor Debug 占位当最终角色美术。
4. 禁止把 actor Debug 占位当最终 autonomous movement。
5. 禁止为了好看读取 PNG。
6. 禁止重新引入 WORLD_MAP_ASSETS 作为正式主路径。
7. 禁止 Renderer 生成 actor。
8. 禁止 Renderer 生成 placement。
9. 禁止 UI 临时伪造宠物。
10. 禁止默认接入 pet actor。
11. 禁止修改 HomeMapState 来服务显示。
12. 禁止让 Formal World View 读取 proposal 当现实。
13. 禁止把 raw tags / source diagnostics 暴露给最终玩家主视觉。
14. 禁止在 Formal World View 显示紫微斗数原始术语。
15. 禁止让宠物通过事件文本说人话。

## 10. 当前结论

P8-H Actor Geometry 阶段已经完成底层验证。

当前可以确认：

1. 管家 actor projection 能从 world snapshot 进入 VisualState。
2. Renderer 能只读显示 actor geometry。
3. 宠物没有被默认伪造。
4. Debug View 和最终 Formal World View 必须分离。

下一步进入：

P8-I0：Formal World View 规划
