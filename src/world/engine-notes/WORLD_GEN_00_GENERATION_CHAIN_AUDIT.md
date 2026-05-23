> Status: phase record. This document is kept for development traceability. Current development follows `src/docs/AI_PET_WORLD_V2_MVP_EXECUTION_PLAN_2026-05-23.md`.

# AI-PET-WORLD WORLD-GEN-00 世界生成链路现状审计

## 一、阶段定位

WORLD-GEN-00 是世界生成链路审计阶段。

本阶段只审计当前 world generation / map-state / placement / runtime 相关链路，明确哪些已经存在、哪些缺失、哪些与 MVP v1.5 冲突。

本阶段不修改代码。
本阶段不修改正式 UI。
本阶段不修改正式世界生成代码。
本阶段不删除旧逻辑。
本阶段不修 bug。
本阶段不生成新的世界对象。
本阶段不生成 placement。
本阶段不修改 HomeMapState。
本阶段不修改 world-loop。
本阶段不接入 pet。
本阶段不读取 PNG / WORLD_MAP_ASSETS 作为世界事实来源。

## 二、当前已有链路

### 2.1 create-world input -> buildWorldCreationRuntime

当前 `/world` 会读取 create-world input，并调用 `buildWorldCreationRuntime`。

入口文件：

```text
src/app/world/world-route-page.tsx
src/world/creation/world-creation-runtime.ts
```

当前 `buildWorldCreationRuntime` 会从 create-world input 生成：

1. `birthSignature`。
2. `stableToken`。
3. `worldId`。
4. `ownerId`。
5. `worldSalt`。
6. `butlerConstructionStyle`。
7. `now`。
8. `styleSource`。
9. runtime debug 信息。

当前 `worldSalt` 为：

```text
local-mvp-${createWorldInput.createdAt}
```

这意味着：如果 create-world input 被持久化，同一输入可以稳定复现；如果重新创建输入并产生新的 `createdAt`，相同出生信息也可能得到不同 worldSalt。

### 2.2 buildWorldCreationRuntime -> worldId / ownerId / birthSignature / worldSalt / butlerConstructionStyle

当前 `worldId` 与 `ownerId` 来自 `birthSignature` 的 stable token。

当前 `butlerConstructionStyle` 来自两层：

1. 优先尝试从 personality-core 的 butler profile 映射。
2. 失败时回退到 deterministic construction style。

当前 constructionStyle 字段包含：

1. `structuredBuilder`。
2. `warmCaretaker`。
3. `protectiveKeeper`。
4. `aestheticOrganizer`。
5. `quietMaintainer`。
6. `adaptivePlanner`。

### 2.3 buildWorldFirstSceneModel -> generateInitialHomeMap

当前 `buildWorldFirstSceneModel` 会调用 `buildWorldCreationRuntime`，再调用 `generateInitialHomeMap`。

入口文件：

```text
src/world/runtime/world-first-scene-model.ts
```

当前链路为：

```text
createWorldInput
-> buildWorldCreationRuntime
-> generateInitialHomeMap
-> homeMapState
-> first scene model
```

### 2.4 generateInitialHomeMap -> HomeMapState

当前 `generateInitialHomeMap` 位于：

```text
src/world/generation/initial-home-generator.ts
```

当前 `generateInitialHomeMapResult` 会：

1. 调用 `buildStableWorldSeed`。
2. 调用 `buildInitialHomePlacements`。
3. 从 `INITIAL_HOME_SCENE_RECIPE` 构建 zones。
4. 构建 resources。
5. 构建 constructionPlans。
6. 输出 HomeMapState。

当前 HomeMapState 初始 `mapDiffs` 是空数组。

### 2.5 generateInitialHomeMap 是否调用 buildStableWorldSeed

结论：是。

当前 seed 来源：

```text
ownerId + birthSignature + worldSalt
```

`buildStableWorldSeed` 已存在于：

```text
src/world/generation/world-seed.ts
```

### 2.6 generateInitialHomeMap 是否调用 buildInitialHomePlacements

结论：是。

当前 `buildInitialHomePlacements` 已存在于：

```text
src/world/placement/placement-engine.ts
```

它会生成初始 placements，并返回 placement audit / warnings。

### 2.7 后续视觉链路

当前后续链路已经接通：

```text
HomeMapState
-> VisualState
-> RenderableWorldSnapshot
-> FormalVisualModel
-> FormalWorldView
```

已接通能力：

1. `buildVisualState`。
2. `buildRenderableWorldSnapshot`。
3. `buildFormalVisualModelFromSnapshot`。
4. `FormalWorldView`。

当前 `/world` 已经从真实 `runtimeState.currentRenderableSnapshot` 构建 `FormalVisualModel`，并交给 `FormalWorldView` 只读渲染。

## 三、当前已有能力

当前已有：

1. stable world seed。
2. seeded number。
3. seeded item pick。
4. initial home generator。
5. placement engine。
6. recipe 驱动初始区域。
7. constructionStyle 影响部分布局逻辑。
8. HomeMapState。
9. MapDiff schema。
10. MapDiff apply / validation。
11. VisualState。
12. RenderableWorldSnapshot。
13. FormalVisualModel。
14. FormalVisualGenerator。
15. FormalWorldView。

## 四、当前问题与风险

### 4.1 placements 是否仍然存在固定模板残留

结论：存在。

当前 placements 不是纯静态模板，因为 seed 与 constructionStyle 已经影响部分对象。

但是固定模板残留仍然明显：

1. mapSize 来自固定 recipe。
2. zones 来自固定 recipe area。
3. temporary shelter / initial care / storage 等核心区域中心点较固定。
4. 核心设施仍主要围绕固定区域生成。
5. 当前没有 recipe family 或 recipe variant 选择机制。

### 4.2 scene recipe 是否仍然固定中心点 / 固定区域

结论：是。

当前 `INITIAL_HOME_SCENE_RECIPE` 仍定义固定区域，例如：

1. `pet_arrival`。
2. `initial_care`。
3. `temporary_shelter`。
4. `storage_tools`。
5. `pet_rest`。

这说明当前初始世界仍以单一 recipe 为骨架，不是完整非固定布局规则。

### 4.3 worldSeed 是否影响整体布局

结论：worldSeed 已参与布局，但主要影响局部。

当前 seed 影响：

1. ground asset variant。
2. support edge 点位。
3. path 部分 waypoint。
4. nature boundary 数量与点位。
5. surface decoration 点位。
6. pet-bed 位置偏移。

当前 seed 尚未明显影响：

1. mapSize。
2. recipe area family。
3. 核心区域拓扑。
4. 核心建筑类型选择。
5. 整体道路结构策略。

### 4.4 constructionStyle 是否影响核心布局

结论：部分影响，还不完整。

当前 constructionStyle 已影响：

1. initial resources。
2. constructionPlans。
3. pet-bed 位置偏移。
4. 部分 path route。
5. nature boundary 数量。
6. surface decoration 数量。

当前 constructionStyle 对以下核心布局影响仍不足：

1. 住所类型与位置。
2. 核心道路拓扑。
3. 资源区结构。
4. 边界策略。
5. recipe variant 选择。

### 4.5 visualTendency 是否尚未接入

结论：当前没有发现明确 `visualTendency` 实现入口。

当前主要是 constructionStyle 影响世界生成。

后续如果新增 visualTendency，必须明确：

1. visualTendency 只能影响 FormalVisualModel 或 player-facing presentation。
2. visualTendency 不能反向生成 HomeMapState 事实。
3. visualTendency 不能作为 placement 生成依据，除非先经过世界规则层转换为可审计事实。

### 4.6 MapDiff 是否初始为空

结论：是。

当前 InitialHomeGenerator 生成的 HomeMapState 中：

```text
mapDiffs: []
```

当前 MapDiff 能力已经存在，但初始生成并不通过 MapDiff 表达。

后续世界演化已经有 MapDiff proposal / validation / apply 链路，但还没有形成完整建设变化覆盖。

### 4.7 是否存在 PlacementEngine 但还不是完整 PlacementEngine

结论：是。

当前已经有 `placement-engine.ts`，但它仍然更接近 “recipe + seed 局部扰动 + constructionStyle 局部偏移”。

它还缺少：

1. 明确 generation input schema。
2. 明确非固定布局协议。
3. 多 recipe family。
4. 不同人格 / seed / resource 的差异化测试。
5. pet 后置规则过滤。
6. 生成链路 debug/audit summary。

### 4.8 是否存在初始 pet placement 或 pet actor 默认出现风险

结论：存在，而且优先级高。

当前 `placement-engine.ts` 中存在：

1. `pet-arrival-point`。
2. `pet-bed`。
3. `pet-near-arrival-point`。
4. `assetId: petPoseSkeletonIdleFront01`。
5. tags 中包含 `pet` / `actor`。

这与 MVP v1.5 的宠物后置原则冲突。

本轮只记录风险，不删除逻辑。

### 4.9 初始设施是否有 pet-bed / food / water 等旧宠物优先逻辑

结论：存在。

当前 `createFacilityPlacements` 中存在：

1. `food-bowl`。
2. `water-bowl`。
3. `pet-bed`。

这些设施可能来自旧的宠物优先 MVP 路线，需要后续重审：

1. 是否允许作为“未来宠物准备设施”。
2. 是否必须等宠物事件接纳后再生成。
3. 是否应改为管家 / 家园基础照护设施，而不是 pet 专属设施。

### 4.10 是否存在 pet_arrival 旧区域命名

结论：存在。

当前 recipe / layout-rules 中存在：

1. `pet_arrival`。
2. `pet_rest`。

这些命名与宠物后置策略存在冲突风险。

后续需要决定：

1. 改名为 neutral arrival / life_relation_pending。
2. 暂时保留但不生成 pet actor。
3. 完整迁移到宠物被接纳后的 MapDiff。

### 4.11 是否缺少不同 seed / 人格差异化测试

结论：缺少。

当前有 world creation influence 相关测试，但没有发现完整覆盖：

1. 同一 seed 稳定布局。
2. 不同 seed 可观察布局差异。
3. 不同 constructionStyle 可观察布局差异。
4. 不同 resource state 可观察 MapDiff / layout 差异。
5. pet 后置不默认生成的断言。

### 4.12 是否缺少生成链路 debug/audit 输出

结论：缺少。

当前有 placement audit / mapdiff debug / procedural renderer debug，但还缺少 WORLD-GEN 专用审计输出：

1. seed summary。
2. recipe summary。
3. constructionStyle influence summary。
4. placement source summary。
5. pet-default-risk summary。
6. fixed-template-risk summary。

## 五、宠物后置冲突专门记录

当前如果 placement-engine 中默认生成 pet actor / pet placement / pet bed / pet arrival point，只能作为旧逻辑风险记录。

本轮不能删除。
本轮不能修 bug。
本轮不能修改 placement-engine。
本轮不能修改 generation。
本轮不能直接接入或移除 pet。

当前风险项：

1. `pet-near-arrival-point` 默认 actor placement。
2. `petPoseSkeletonIdleFront01` 默认 pet actor assetId。
3. `pet-bed` 默认设施 placement。
4. `food-bowl` / `water-bowl` 默认照护设施。
5. `pet-arrival-point` 默认 pet 相关位置。
6. `pet_arrival` / `pet_rest` 默认区域。

下一轮如果优先处理宠物冲突，建议进入：

```text
WORLD-GEN-01：宠物默认生成逻辑回滚 / 宠物后置对齐
```

## 六、当前不能做什么

当前不能做：

1. 不修改 /world。
2. 不修改 FormalWorldView。
3. 不修改 FormalVisualGenerator。
4. 不修改 world-loop。
5. 不修改 HomeMapState。
6. 不修改 placement-engine。
7. 不修改 generation。
8. 不生成 placement。
9. 不删除 pet 逻辑。
10. 不接入 pet。
11. 不读取 PNG / WORLD_MAP_ASSETS。

## 七、下一步建议

当前 pet 默认出现风险与 layout 固定模板风险都存在。

优先建议先处理宠物默认生成风险，因为它直接违反 MVP v1.5 的宠物后置主线。

建议下一步进入：

```text
WORLD-GEN-01：宠物默认生成逻辑回滚 / 宠物后置对齐
```

该阶段应只处理：

1. 初始 pet actor 不默认生成。
2. 初始 pet placement 不默认生成。
3. pet-bed / food / water / pet_arrival / pet_rest 的产品语义重审。
4. 不破坏 butler 第一生命。
5. 不破坏 HomeMapState / VisualState / FormalVisualModel 链路。

宠物默认生成风险处理后，再进入：

```text
WORLD-GEN-02：worldSeed + personality layout input schema
```

用于补齐同一 seed 稳定、不同人格 / seed / 资源状态产生可观察差异的非固定布局规则入口。
