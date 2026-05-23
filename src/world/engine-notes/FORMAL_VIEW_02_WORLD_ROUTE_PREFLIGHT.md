> Status: phase record. This document is kept for development traceability. Current development follows `src/docs/AI_PET_WORLD_V2_MVP_EXECUTION_PLAN_2026-05-23.md`.

# AI-PET-WORLD FORMAL-VIEW-02 /world 正式接入前检查

## 1. 阶段定位

本阶段只是 /world 正式接入前检查。

本阶段不接入 /world。

本阶段不新增组件。

本阶段不修改 FormalWorldView。

本阶段不修改 FormalVisualGenerator。

本阶段不修改 renderer。

本阶段不修改 world-loop。

本阶段不修改 HomeMapState。

本阶段不生成 world object / placement / actor。

本阶段不读取 PNG / WORLD_MAP_ASSETS。

本阶段不使用 preview mock 作为正式数据。

preview mock 不能被 /world 引用。

正式 /world 只能接真实链路产生的 FormalVisualModel。

## 2. 目标链路

正式路线必须保持：

```text
HomeMapState / WorldState
-> VisualState / RenderableWorldSnapshot
-> FormalVisualGenerator
-> FormalVisualModel
-> FormalWorldView
```

FormalWorldView 只能只读渲染 FormalVisualModel。

## 3. 当前已有链路

### 3.1 buildVisualState

当前已有：

```text
HomeMapState
EnvironmentState
placementGeometryAudit
actorRuntimeGeometryProjections?
-> VisualState
```

`buildVisualState` 已支持可选 `actorRuntimeGeometryProjections`。

缺省时 `VisualState.actorGeometryProjections` 为空数组。

### 3.2 buildRenderableWorldSnapshot

当前已有：

```text
VisualState
-> RenderableWorldSnapshot
```

`buildRenderableWorldSnapshot` 会从 VisualState 派生 DrawCommand，并保存 `visualState`。

### 3.3 buildFormalVisualModelFromSnapshot

当前已有：

```text
RenderableWorldSnapshot
-> FormalVisualModel
```

`buildFormalVisualModelFromSnapshot` 是纯函数入口。

它不生成世界事实，不生成 placement，不生成 actor。

### 3.4 FormalWorldView

当前已有：

```text
FormalVisualModel
-> 只读渲染
```

FormalWorldView 只接收 `model: FormalVisualModel`。

它不接收 RenderableWorldSnapshot / VisualState。

它不调用 FormalVisualGenerator。

## 4. 当前 /world 接入现状

### 4.1 /world 是否已有真实 HomeMapState 来源

已有。

`/world` 当前通过 `buildWorldFirstSceneModel`、`RuntimeWorldState.currentHomeMapState` 和持久化恢复链路取得真实 HomeMapState。

### 4.2 /world 是否已有真实 EnvironmentState 来源

已有，但当前不是 /world route 层的独立变量。

EnvironmentState 当前在 `buildWorldFirstSceneModel`、world-loop step、`buildWorldLoopRenderableState` 等上游派生过程中生成，并进入 VisualState / RenderableWorldSnapshot。

### 4.3 /world 是否已有 placementGeometryAudit 来源

已有，但当前不是 /world route 层的独立变量。

PlacementGeometryAudit 当前在 `buildWorldFirstSceneModel`、world-loop step、`buildWorldLoopRenderableState` 等上游派生过程中生成，并进入 VisualState。

### 4.4 /world 是否已有 actorRuntimeGeometryProjections 来源

部分已有，但正式接入前需要统一。

`buildVisualState` 已支持 actor projection。

`buildWorldLoopRenderableState` 已可以构建 butler actor projection。

但 `/world` 当前初始 `buildWorldFirstSceneModel` 路径仍直接调用 `buildVisualState`，未在该入口显式传入 actorRuntimeGeometryProjections。

world-loop runtime step 内部也存在 renderable state 派生路径，正式接入前需要确认所有进入 `/world` 的 RenderableWorldSnapshot 都一致携带期望的 actor projection。

### 4.5 /world 是否已有 RenderableWorldSnapshot 构建入口

已有。

`/world` 当前使用 `runtimeState.currentRenderableSnapshot`，并将它传给 Debug Renderer。

初始来源为 `firstSceneModel.renderableWorldSnapshot`。

恢复和 tick 后来源为 RuntimeWorldState 当前快照。

### 4.6 /world 是否已有 FormalVisualModel 构建入口

尚未接入。

`buildFormalVisualModelFromSnapshot` 已存在，但 `/world` 当前没有调用它。

### 4.7 /world 当前是否应该保留 Debug Renderer

应该保留。

当前 `/world` 仍使用 ProceduralRendererView 展示 Debug / Dev View。

在 FormalWorldView 正式接入前，Debug Renderer 不能被删除或替换。

### 4.8 /world 当前是否可以安全切换到 FormalWorldView

当前不应直接切换。

原因：

1. `/world` 尚未构建真实 FormalVisualModel。
2. preview mock 不能作为正式数据源。
3. actorRuntimeGeometryProjections 在进入 `/world` 的各条 RenderableWorldSnapshot 路径中仍需统一确认。
4. Debug Renderer 仍承担当前链路验证职责。

## 5. 正式 /world 接入前缺口清单

1. 明确 `/world` 使用哪一个真实 RenderableWorldSnapshot 作为 FormalVisualModel 输入。
2. 在 `/world` 或上游安全位置调用 `buildFormalVisualModelFromSnapshot`。
3. 确认初始 world snapshot、恢复 snapshot、tick 后 snapshot 的 actorRuntimeGeometryProjections 行为一致。
4. 确认 FormalVisualModel 只来自真实 RenderableWorldSnapshot，不来自 preview mock。
5. 确认 Debug Renderer 是否并列保留、折叠保留或迁移到 debug route。
6. 确认 FormalWorldView 接入不修改 HomeMapState / world-loop / renderer schema。
7. 确认 pet 仍然后置，不能默认接入。

## 6. FORMAL-VIEW-03 进入条件

只有满足以下条件后，才允许进入：

```text
FORMAL-VIEW-03：/world 只读接入 FormalVisualModel
```

进入条件：

1. 真实 RenderableWorldSnapshot 来源已确认。
2. FormalVisualModel 构建位置已确认。
3. preview mock 不会被 /world 引用。
4. actorRuntimeGeometryProjections 的真实链路已确认。
5. Debug Renderer 保留策略已确认。
6. 不生成 world object / placement / actor。
7. 不读取 PNG / WORLD_MAP_ASSETS。
8. 不默认接入 pet。

## 7. 结论

FORMAL-VIEW-02 已完成 /world 正式接入前检查。

当前真实底层链路基本存在，但 `/world` 尚未构建 FormalVisualModel。

下一步只有在确认真实链路完整后，才允许进入 FORMAL-VIEW-03。
