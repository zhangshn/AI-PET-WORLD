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

的正式链路。

## 2. 当前最高原则

1. 世界不是前端画出来的，世界由规则和状态生成。
2. 布局不是固定模板，布局由 worldSeed、管家人格、资源、事件、建设意图和空间规则共同生成。
3. 正式视觉模型不是组件生成的，必须由 Formal Visual Generation Layer 生成。
4. FormalWorldView 只能只读 FormalVisualModel。
5. Debug View 与 Formal World View 必须分离。
6. Renderer / FormalWorldView 不能生成世界事实。
7. Renderer / FormalWorldView 不能生成 placement。
8. Renderer / FormalWorldView 不能生成 actor。
9. Renderer / FormalWorldView 不能读取 PNG / WORLD_MAP_ASSETS 作为正式世界事实来源。
10. 宠物后置，petState 不存在时不能默认显示宠物。

## 3. 已完成并保留的 P8-G 结论

P8-G 已完成几何视觉纠偏与收口。

保留链路：

```text
HomeMapState
-> MapPlacement
-> ShapeGrammar
-> SpatialProjection
-> EntityGeometry
-> VisualState
-> VisualPlacement
-> Renderer SVG geometry layer
-> Debug diagnostics
```

P8-G 的有效结论：

1. PNG / WORLD_MAP_ASSETS 不能作为正式 Renderer 主路径。
2. Renderer 不能为了视觉效果生成 placement。
3. Renderer 不能修改 HomeMapState。
4. Renderer 不能读取 proposal 当现实。
5. ShapeGrammar / EntityGeometry / VisualState 几何链路保留。
6. Debug diagnostics 可以保留在 Debug View。
7. Debug diagnostics 不能伪装成最终玩家 UI。

## 4. 已完成并保留的 P8-H 结论

P8-H 已完成 Actor Geometry Debug 链路。

保留链路：

```text
world-loop renderable state
-> buildButlerRuntimeProjection
-> buildActorGeometryProjectionFromRuntime
-> VisualState.actorGeometryProjections
-> Renderer Debug View 只读显示
```

P8-H 的有效结论：

1. butler actor projection 可以从 world snapshot 进入 VisualState。
2. Renderer 可以只读显示 actor geometry。
3. 当前 actor 图形是 Debug 几何占位。
4. 当前 actor 图形不是最终玩家 UI。
5. 当前 actor 图形不是最终角色美术。
6. 当前 actor 图形不代表最终 autonomous movement。
7. pet 没有被默认接入。
8. Renderer 不生成 actor。
9. Renderer 不填默认 anchor。
10. Renderer 不修改 HomeMapState。

## 5. 已回滚的旧 P8-I 路线

旧 P8-I0 / P8-I1 / P8-I2 / P8-I3 路线已作废。

作废原因：

1. 旧路线让 FormalWorldView 组件承担正式视觉模型生成职责。
2. 旧路线在组件内定义 FormalWorldVisualItem。
3. 旧路线在组件内定义 FormalActorVisualItem。
4. 旧路线在组件内实现 buildFormalWorldVisualItems。
5. 旧路线在组件内实现 buildFormalActorVisualItems。
6. 旧路线让组件决定地面、道路、建筑、树木、设施、管家如何显示。
7. 这违反 MVP v1.5、规则世界引擎 v1.3 和整体架构 v1.0。

已删除内容：

1. src/app/world/components/formal-world-view/formal-world-view.tsx。
2. src/app/world/components/formal-world-view/formal-world-view.styles.module.css。
3. src/app/world/components/formal-world-view/。
4. src/world/engine-notes/P8_I0_FORMAL_WORLD_VIEW_PLAN.md。
5. src/world/engine-notes/P8_I1_FORMAL_WORLD_VIEW_COMPONENT_SHELL.md。
6. src/world/engine-notes/P8_I2_FORMAL_WORLD_CANVAS.md。
7. src/world/engine-notes/P8_I3_FORMAL_ACTOR_PRESENTATION.md。

## 6. 当前正确正式路线

从现在开始，正式视觉路线必须是：

```text
HomeMapState / WorldState
-> placements / MapDiff
-> VisualState / RenderableWorldSnapshot
-> FormalVisualGenerator
-> FormalVisualModel
-> FormalWorldView 只读渲染
```

这条路线的核心是：

1. HomeMapState 保存世界事实。
2. MapDiff / EventLog 保存世界变化。
3. VisualState / RenderableWorldSnapshot 保存可渲染投影。
4. FormalVisualModel 保存正式玩家主视觉模型。
5. FormalWorldView 只负责渲染 FormalVisualModel。

## 7. FormalVisualModel 的定位

FormalVisualModel 是正式主视觉模型容器。

它可以包含：

1. FormalCanvasModel。
2. FormalWorldObjectModel。
3. FormalActorModel。
4. FormalEnvironmentModel。
5. FormalHudSummary。

它不能：

1. 生成不存在的世界对象。
2. 生成 placement。
3. 修改 HomeMapState。
4. 读取 proposal 当现实。
5. 伪造 pet。
6. 绕过 VisualState / RenderableWorldSnapshot。

## 8. FormalWorldView 的边界

FormalWorldView 是只读渲染容器。

FormalWorldView 可以：

1. 读取 FormalVisualModel。
2. 渲染 FormalCanvasModel。
3. 渲染 FormalWorldObjectModel。
4. 渲染 FormalActorModel。
5. 渲染 FormalEnvironmentModel。
6. 渲染 FormalHudSummary。

FormalWorldView 不能：

1. 生成 FormalWorldVisualItem。
2. 生成 FormalActorVisualItem。
3. buildFormalWorldVisualItems。
4. buildFormalActorVisualItems。
5. 决定树、房子、道路、设施、管家、宠物怎么长。
6. 生成 actor。
7. 生成 placement。
8. 填默认 anchor。
9. 修改 VisualState。
10. 修改 HomeMapState。
11. 读取 PNG / WORLD_MAP_ASSETS 作为正式世界事实来源。
12. 显示 raw tags / source diagnostics / F-C-S-I。
13. 显示紫微斗数原始术语。
14. petState 不存在时显示默认宠物。

## 9. 非固定布局规则

正式布局不能是固定模板。

正确规则：

```text
同一玩家 + 同一 worldSeed + 同一世界状态
-> 布局稳定可复现

不同玩家 + 不同管家人格 + 不同 seed + 不同资源 / 事件状态
-> 布局出现可观察差异
```

布局可以使用 layout recipe 作为候选关系，但 recipe 不能成为固定画面。

最终布局必须经过：

1. worldSeed。
2. 管家人格。
3. constructionStyle。
4. visualTendency。
5. resource state。
6. construction plan。
7. placement rules。
8. spatial validation。
9. MapDiff / HomeMapState 写入。

## 10. Debug View 与 Formal World View 边界

Debug View 可以显示：

1. grid。
2. raw tags。
3. source diagnostics。
4. Geometry Source Diagnostics。
5. Actor Geometry Diagnostics。
6. collision / support / influence。
7. F / C / S / I。
8. anchorSource。
9. debug reason。

Formal World View 不能直接显示：

1. debug grid。
2. raw tags。
3. source labels。
4. diagnostics。
5. collision / support / influence boxes。
6. F / C / S / I。
7. actor debug flags。
8. anchorSource 原始 tag。
9. 紫微斗数原始术语。

## 11. 当前阶段状态

当前阶段：

```text
P8-I-RESET-DOC-CLEANUP
```

当前目标：

1. 清理 P8 总控计划文档乱码。
2. 清理 Guardrails 乱码。
3. 对齐 MVP v1.5 / 引擎 v1.3 / 架构 v1.0。
4. 准备进入 VISUAL-MODEL-00。

## 12. 下一步

下一步进入：

```text
VISUAL-MODEL-00：FormalVisualModel schema
```

VISUAL-MODEL-00 目标：

1. 新增 src/world/formal-visual-model/。
2. 新增 formal-visual-model-schema.ts。
3. 新增 formal-visual-model-gateway.ts。
4. 只定义 FormalVisualModel 类型协议。
5. 不写 FormalVisualGenerator。
6. 不写 FormalWorldView。
7. 不接 /world 页面。

## 13. P8 当前最终结论

P8 当前结论：

1. P8-G / P8-H Debug Geometry 链路保留。
2. 旧 P8-I FormalWorldView 手写视觉路线作废。
3. 后续先做 FormalVisualModel 容器。
4. 再做 FormalVisualGenerator。
5. 最后做 FormalWorldView 只读渲染。
6. 不允许再回到前端手写世界内容路线。

## 14. VISUAL-MODEL-00 FormalVisualModel schema 完成记录

VISUAL-MODEL-00 已完成 FormalVisualModel 正式视觉模型容器协议。

本阶段新增：

1. `src/world/formal-visual-model/formal-visual-model-schema.ts`。
2. `src/world/formal-visual-model/formal-visual-model-gateway.ts`。
3. `src/world/engine-notes/VISUAL_MODEL_00_FORMAL_VISUAL_MODEL_SCHEMA.md`。

本阶段定义：

1. FormalVisualModelVersion。
2. FormalVisualModelSource。
3. FormalVisualTraceSource。
4. FormalVisualLayer。
5. FormalWorldObjectKind。
6. FormalActorKind。
7. FormalVisualStyleToken。
8. FormalCanvasMood。
9. FormalAtmosphereTone。
10. FormalActorPoseToken。
11. FormalPetStatusToken。
12. FormalVisualSourceTrace。
13. FormalVisualAuditSummary。
14. FormalCanvasModel。
15. FormalWorldObjectModel。
16. FormalActorModel。
17. FormalEnvironmentModel。
18. FormalHudSummary。
19. FormalVisualModel。
20. FormalVisualModelInput。
21. FORMAL_VISUAL_MODEL_VERSION。

本阶段规则：

1. 只定义 schema。
2. 不实现 FormalVisualGenerator。
3. 不实现 FormalWorldView。
4. 不新增 React 组件。
5. 不接入 /world 页面。
6. 不修改 ProceduralRendererView。
7. 不修改 renderer-schema.ts / renderer-gateway.ts。
8. 不修改 world-loop。
9. 不生成 actor。
10. 不生成 placement。
11. 不填默认 anchor。
12. 不修改 HomeMapState。
13. 不读取 PNG / WORLD_MAP_ASSETS。
14. 不默认接入 pet。
15. 不写固定布局。

下一步进入：

```text
VISUAL-MODEL-01：FormalVisualGenerator 纯函数
```

## 15. VISUAL-MODEL-01 FormalVisualGenerator 纯函数完成记录

VISUAL-MODEL-01 已完成 FormalVisualGenerator 纯函数层。

本阶段新增：

1. `src/world/formal-visual-model/formal-visual-generator.ts`。
2. `src/world/formal-visual-model/formal-world-object-model-builder.ts`。
3. `src/world/formal-visual-model/formal-actor-model-builder.ts`。
4. `src/world/formal-visual-model/formal-canvas-model-builder.ts`。
5. `src/world/formal-visual-model/formal-environment-model-builder.ts`。
6. `src/world/formal-visual-model/formal-hud-summary-builder.ts`。
7. `src/world/engine-notes/VISUAL_MODEL_01_FORMAL_VISUAL_GENERATOR.md`。

本阶段修改：

1. `formal-visual-model-gateway.ts` 导出 FormalVisualGenerator。

本阶段规则：

1. FormalVisualGenerator 是纯函数。
2. 输入是 RenderableWorldSnapshot / VisualState。
3. 输出是 FormalVisualModel。
4. 不新增 FormalWorldView。
5. 不新增 React 组件。
6. 不新增 CSS。
7. 不接入 /world 页面。
8. 不修改 ProceduralRendererView。
9. 不修改 renderer-schema.ts / renderer-gateway.ts。
10. 不修改 world-loop。
11. 不生成 actor。
12. 不生成 placement。
13. 不填默认 anchor。
14. 不读取 PNG / WORLD_MAP_ASSETS。
15. 不默认接入 pet。
16. 不写固定布局。

下一步进入：

```text
FORMAL-VIEW-00：FormalWorldView 只读 FormalVisualModel
```

FORMAL-VIEW-00 目标是新增只读 FormalWorldView，让它只读取 FormalVisualModel 渲染玩家主视觉壳层。

FORMAL-VIEW-00 仍然不能：

1. 在组件内生成 FormalWorldVisualItem。
2. 在组件内生成 FormalActorVisualItem。
3. buildFormalWorldVisualItems。
4. buildFormalActorVisualItems。
5. 生成世界事实。
6. 生成 placement。
7. 生成 actor。
8. 填默认 anchor。
9. 读取 PNG / WORLD_MAP_ASSETS 作为正式世界事实来源。
10. 默认显示 pet。

## 16. FORMAL-VIEW-00 FormalWorldView 只读 FormalVisualModel 完成记录

FORMAL-VIEW-00 已新增只读 FormalWorldView 组件。

本阶段新增：

1. `src/app/world/components/formal-world-view/formal-world-view.tsx`。
2. `src/app/world/components/formal-world-view/formal-world-view.styles.module.css`。
3. `src/app/world/components/formal-world-view/index.ts`。
4. `src/world/engine-notes/FORMAL_VIEW_00_FORMAL_WORLD_VIEW_READONLY.md`。

本阶段规则：

1. FormalWorldView 只接收 `model: FormalVisualModel`。
2. FormalWorldView 不接收 RenderableWorldSnapshot。
3. FormalWorldView 不接收 VisualState。
4. FormalWorldView 不调用 FormalVisualGenerator。
5. FormalWorldView 不生成 FormalVisualModel。
6. FormalWorldView 不生成 actor。
7. FormalWorldView 不生成 placement。
8. FormalWorldView 不填默认 anchor。
9. FormalWorldView 不修改 VisualState / HomeMapState。
10. FormalWorldView 不读取 PNG / WORLD_MAP_ASSETS。
11. FormalWorldView 不显示 raw tags / source diagnostics / audit internals。
12. FormalWorldView 不接入 /world 页面。
13. FormalWorldView 不修改 ProceduralRendererView。
14. FormalWorldView 不改变现有 Debug Renderer。

下一步进入：

```text
FORMAL-VIEW-01：FormalWorldView 接入演示入口或 debug preview
```
