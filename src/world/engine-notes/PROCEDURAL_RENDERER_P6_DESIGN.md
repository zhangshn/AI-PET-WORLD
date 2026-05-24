> 历史归档：本文件不得作为 V2.6 当前产品、架构或开发依据。  
> 当前最高依据为 V2.6 三份核心文档。当前业务口径是：管家是第一主角；宠物不是开局资产；宠物来源于小镇领养中心；真正驱动宠物进场的是管家自主产生的领养意愿，并且必须通过 AdoptionReview 与 SafeApply 后才可以成为 HomeMapState 世界事实。  
> 本文件如出现孵化器、胚胎、pet_arrival、pet_rest、LifeEvent、CompanionDecision、伴生生命、候选宠物等旧词，仅代表历史阶段记录，不代表当前实现方向。

> Status: phase record. This document is kept for development traceability. Current development follows `src/docs/AI_PET_WORLD_V2_MVP_EXECUTION_PLAN_2026-05-23.md`.

# AI-PET-WORLD P6 ProceduralRenderer v0 前置设计

## 1. P6 的定位

P6 不是美术阶段。
P6 不是贴图阶段。
P6 不是 Renderer 自己生成世界。
P6 是把已有 WorldState / HomeMapState / Geometry / Terrain 可视化出来的过程。

Renderer 的职责：

```text
WorldState -> VisualState -> DrawCommands
```

Renderer 不负责：

- 生成世界
- 判断行为
- 决定意图
- 修改 HomeMapState
- 读取 proposal/audit/execution 当作事实
- 为了画面好看创造不存在的对象

## 2. Renderer 输入边界

Renderer v0 只能读取：

1. HomeMapState
2. MapPlacement
3. EntityGeometry
4. PlacementGeometryAudit
5. TerrainState
6. EnvironmentState
7. MapDiff history，只作为历史信息，不自动当作当前画面事实

Renderer 禁止读取：

1. WorldDiffProposal
2. WorldEvolutionAuditReport
3. WorldEvolutionExecutionResult
4. WorldEngineChainAuditReport
5. IntentDecision
6. WorldChangePlan

这些是过程层，不是最终世界事实。

## 3. ProceduralRenderer v0 输出目标

v0 只做调试可视化，不做漂亮画面。

必须支持：

1. placement 点位显示
2. footprint 显示
3. collision 显示
4. support 显示
5. influence 显示
6. terrain cell 显示
7. zone bounds 显示
8. layer 分类显示

不能做：

1. 贴图堆叠
2. 像素假地图
3. 手画房子树木
4. 装饰性视觉优先
5. Renderer 自行补全世界对象

## 4. 推荐目录结构

未来目录建议如下，本轮不创建这些代码文件：

```text
src/world/rendering/
  renderer-schema.ts
  visual-state-builder.ts
  draw-command-builder.ts
  renderer-gateway.ts

src/app/world-debug/procedural-renderer/
  procedural-renderer-debug-route-page.tsx
  procedural-renderer-debug-route-page.styles.module.css

src/app/world/components/procedural-renderer/
  procedural-renderer-view.tsx
  procedural-renderer-view.styles.module.css
```

## 5. VisualState 设计草案

类型草案如下，本轮不实现代码：

VisualState:

- worldId
- mapSize
- zones
- placements
- geometryLayers
- terrainCells
- debugOverlays
- tags

VisualPlacement:

- placementId
- assetId
- label
- anchor
- layer
- footprint
- collision
- support
- influence
- ruleStatus
- tags

DrawCommand:

- id
- kind
- layer
- geometry
- label
- debugStyle
- source

kind 可包括：

- point
- line
- polygon
- bounds
- label

## 6. P6 执行顺序

1. P6.1：设计文档与旧内容清理
2. P6.2：Renderer schema
3. P6.3：VisualState builder
4. P6.4：DrawCommand builder
5. P6.5：debug 页面只显示 DrawCommands JSON
6. P6.6：debug SVG/HTML 简单画线框
7. P6.7：正式 /world 再考虑接入

P6.5 / P6.6 都不追漂亮，只验证世界事实可视化。

## 7. Renderer 红线

1. Renderer 不能生成世界事实。
2. Renderer 不能绕过 WorldRule。
3. Renderer 不能根据视觉需要添加对象。
4. Renderer 不能直接读取 proposal / audit / execution 当成现实。
5. Renderer 不能替代 WorldEngine。
6. Renderer 不能用贴图骗过世界状态。
7. Renderer 只能显示 WorldState 已经存在的东西。
8. 任何“看起来有”的东西，必须能追溯到 WorldState / Geometry / Terrain。

## 8. 本轮清理结果记录

本轮清理旧贴图式 Renderer / 假世界视觉内容。

已删除旧 `src/world/rendering/` 贴图式渲染实现，包括旧 DOM sprite、canvas tile、autotile、decal、pixelated 样式和旧 render model。

已将 `src/app/world/components/home-map-renderer/HomeMapRenderer.tsx` 改为安全 placeholder，保留正式 `/world` 的 import 路径，但不再画树、房子、道路、装饰或假地图，不生成 placement，不修改状态。

已删除 `src/app/world/components/home-map-renderer/home-map-renderer.styles.module.css`，避免旧贴图式视觉方案继续影响 P6。
